import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { API_BASE_URL, fetchWithAuth } from '../utils/api';
import Dropdown from '../components/Dropdown';
import ProfileDropdown from '../components/ProfileDropdown';
import '../components/Dashboard.css';
import {
  TrendingUp,
  TrendingDown,
  Check,
  Search,
  X,
  FolderClosed,
  CheckSquare,
  Users,
  AlertTriangle,
} from 'lucide-react';

const BACKEND_URL = API_BASE_URL;

// --- TYPES ---
interface StatItem {
  label: string;
  value: string;
  trend: string;
  up: boolean;
  bg: string;
  clr: string;
  icon: string;
}

interface ProjectItem {
  id?: string;
  code?: string;
  name: string;
  pm: string;
  date: string;
  status: 'Approved' | 'Delayed' | 'At risk' | 'In Review' | 'Ongoing' | string;
  prog?: string;
  progress_pct?: number;
  completed_tasks?: number;
  total_tasks?: number;
}

interface MonitorItem {
  label: string;
  checked: boolean;
}

interface NoteItem {
  label: string;
  status: string;
  cls: string;
}

interface DashboardData {
  stats: StatItem[];
  projects: ProjectItem[];
  monitorItems: MonitorItem[];
  rfis: string[];
  notes: NoteItem[];
}

// --- HELPERS ---
const pillClass = (status: string): string => {
  const s = status.toLowerCase().replace(/\s/g, '');
  return `status-pill status-${s}`;
};

const renderStatIcon = (label: string, icon: string) => {
  const norm = (label || '').toLowerCase();
  if (norm.includes('project') || icon === 'FolderClosed' || icon === '\uD83D\uDCCB') return <FolderClosed size={20} />;
  if (norm.includes('task') || icon === 'CheckSquare' || icon === '\u2705') return <CheckSquare size={20} />;
  if (norm.includes('team') || norm.includes('member') || icon === 'Users' || icon === '\uD83D\uDC65') return <Users size={20} />;
  if (norm.includes('issue') || icon === 'AlertTriangle' || icon?.includes('\u26A0')) return <AlertTriangle size={20} />;
  return <FolderClosed size={20} />;
};

// --- SUB-COMPONENTS ---
const StatCard: React.FC<StatItem> = ({ label, value, trend, up, bg, clr, icon }) => (
  <div className="stat-card">
    <div className="stat-icon-box" style={{ background: bg, color: clr, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      {renderStatIcon(label, icon)}
    </div>
    <p className="stat-label text-muted">{label}</p>
    <p className="stat-value">{value}</p>
    <p className={`stat-trend ${up ? 'text-green' : 'text-red'}`} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
      {up ? <TrendingUp size={13} /> : <TrendingDown size={13} />}
      <span>{trend} from last month</span>
    </p>
  </div>
);

const Checkbox: React.FC<{ checked: boolean }> = ({ checked }) => (
  <div className={`monitor-checkbox ${checked ? 'checked' : ''}`} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
    {checked && <Check size={10} color="white" strokeWidth={3} />}
  </div>
);

// --- MAIN COMPONENT ---
const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filter States
  const [overviewRange, setOverviewRange] = useState('Last 30 days');
  const [selectedProjectFilter, setSelectedProjectFilter] = useState('All');
  const [selectedPmFilter, setSelectedPmFilter] = useState('All');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');

  // Read logged-in user from localStorage
  const storedUser = localStorage.getItem('user');
  let userName = 'User';
  let userRole = 'Member';
  try {
    if (storedUser) {
      const parsed = JSON.parse(storedUser);
      userName = parsed.name || parsed.email?.split('@')[0] || 'User';
      userRole = parsed.role || 'Member';
    }
  } catch { /* ignore */ }

  useEffect(() => {
    const fetchDashboard = async () => {
      try {
        setLoading(true);
        setError(null);

        const fetchData = (url: string) => fetchWithAuth(url).then(r => r.json());

        const [stats, projects, monitorItems, rfisRes, notes] = await Promise.all([
          fetchData(`${BACKEND_URL}/dashboard/stats`),
          fetchData(`${BACKEND_URL}/dashboard/projects`),
          fetchData(`${BACKEND_URL}/dashboard/monitor`),
          fetchData(`${BACKEND_URL}/dashboard/rfis`),
          fetchData(`${BACKEND_URL}/dashboard/notes`),
        ]);

        setData({
          stats:        stats.data ?? [],
          projects:     projects.data ?? [],
          monitorItems: monitorItems.data ?? [],
          rfis:         rfisRes.data ?? [],
          notes:        notes.data ?? [],
        });
      } catch (err: any) {
        setError(err.message || "Something went wrong");
      } finally {
        setLoading(false);
      }
    };

    fetchDashboard();
  }, []);

  if (loading) return <div className="rm-empty">Loading dashboard...</div>;
  if (error)   return <div className="rm-empty" style={{ color: 'red' }}>{error}</div>;
  if (!data)   return <div className="rm-empty">No data available.</div>;

  const { stats, projects, monitorItems, rfis, notes } = data;

  // Filter options
  const projectOptions = [
    { value: 'All', label: 'All Projects' },
    ...Array.from(new Set(projects.map(p => p.name))).map(name => ({ value: name, label: name }))
  ];

  const pmOptions = [
    { value: 'All', label: 'All PMs' },
    ...Array.from(new Set(projects.map(p => p.pm))).map(pm => ({ value: pm, label: pm }))
  ];

  const statusOptions = [
    { value: 'All', label: 'All Statuses' },
    { value: 'Approved', label: 'Approved' },
    { value: 'Delayed', label: 'Delayed' },
    { value: 'At risk', label: 'At risk' },
    { value: 'In Review', label: 'In Review' },
  ];

  const timeRangeOptions = [
    'Last 7 days',
    'Last 30 days',
    'Last 90 days',
    'This Year',
    'All time',
  ];

  // Filter projects table
  const filteredProjects = projects.filter(p => {
    const matchSearch = !searchQuery ||
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.pm.toLowerCase().includes(searchQuery.toLowerCase());
    const matchProject = selectedProjectFilter === 'All' || p.name === selectedProjectFilter;
    const matchPm      = selectedPmFilter === 'All' || p.pm === selectedPmFilter;
    const matchStatus  = selectedStatusFilter === 'All' || p.status.toLowerCase() === selectedStatusFilter.toLowerCase();
    return matchSearch && matchProject && matchPm && matchStatus;
  });

  // Filter monitoring items
  const filteredMonitor = monitorItems.filter(m =>
    !searchQuery || m.label.toLowerCase().includes(searchQuery.toLowerCase())
  );
  const filteredRfis = rfis.filter(r =>
    !searchQuery || r.toLowerCase().includes(searchQuery.toLowerCase())
  );
  const filteredNotes = notes.filter(n =>
    !searchQuery || n.label.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <main className="main-content">

      {/* Header */}
      <header className="header-top">
        <div className="flex items-center gap-4">
          <h1>Field Analytics Command Center</h1>
        </div>
        <div className="flex items-center gap-4">
          <div className="search-bar">
            <span className="search-icon" style={{ display: 'flex', alignItems: 'center' }}>
              <Search size={14} />
            </span>
            <input
              type="text"
              placeholder="Search projects, sites, RFIs..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#999', padding: '0', display: 'flex', alignItems: 'center' }}
                aria-label="Clear search"
              >
                <X size={13} />
              </button>
            )}
          </div>
          <ProfileDropdown userName={userName} userRole={userRole} />
        </div>
      </header>

      {/* Overview */}
      <section className="mb-8">
        <div className="flex justify-between items-center mb-6">
          <h2 className="section-title">Overview</h2>
          <Dropdown
            options={timeRangeOptions}
            value={overviewRange}
            onChange={setOverviewRange}
            align="right"
          />
        </div>
        <div className="overview-grid">
          {stats.map(s => <StatCard key={s.label} {...s} />)}
        </div>
      </section>

      {/* Project Summary */}
      <div className="data-container mb-8">
        <div className="flex justify-between items-center mb-6">
          <p className="section-title">Project summary</p>
          <div className="flex gap-2">
            <Dropdown
              options={projectOptions}
              value={selectedProjectFilter}
              onChange={setSelectedProjectFilter}
              prefix="Project"
            />
            <Dropdown
              options={pmOptions}
              value={selectedPmFilter}
              onChange={setSelectedPmFilter}
              prefix="PM"
            />
            <Dropdown
              options={statusOptions}
              value={selectedStatusFilter}
              onChange={setSelectedStatusFilter}
              prefix="Status"
            />
          </div>
        </div>

        {filteredProjects.length === 0 ? (
          <div style={{ padding: '2.5rem', textAlign: 'center', color: '#64748b', fontSize: '13px' }}>
            {projects.length === 0 ? 'No projects logged yet. Head over to Projects Hub to create your first project.' : 'No projects matching the selected filters.'}
          </div>
        ) : (
          <table className="project-table">
            <thead>
              <tr>
                {['Name', 'Project manager', 'Due date', 'Status', 'Progress'].map(h => (
                  <th key={h}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredProjects.map(p => (
                <tr
                  key={p.name}
                  className="project-row"
                  onClick={() => navigate(`/projects/${p.code || p.name}`)}
                  style={{ cursor: 'pointer' }}
                  title={`View ${p.name} details`}
                >
                  <td style={{ fontWeight: 600 }}>{p.name}</td>
                  <td>{p.pm}</td>
                  <td>{p.date}</td>
                  <td><span className={pillClass(p.status)}>{p.status}</span></td>
                  <td>
                    {(() => {
                      const pct = typeof p.progress_pct === 'number'
                        ? Math.min(100, Math.max(0, Math.round(p.progress_pct)))
                        : (p.prog && !isNaN(Number(String(p.prog).replace('%', ''))))
                          ? Math.min(100, Math.max(0, Math.round(Number(String(p.prog).replace('%', '')))))
                          : 0;

                      return (
                        <div
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'flex-end',
                            gap: '10px',
                            width: '100%',
                            maxWidth: '180px',
                          }}
                          title={
                            p.total_tasks !== undefined
                              ? `${p.completed_tasks || 0} of ${p.total_tasks} tasks completed (${pct}%)`
                              : `${pct}% completed`
                          }
                        >
                          <div
                            style={{
                              flex: 1,
                              height: '7px',
                              backgroundColor: '#e2e8f0',
                              borderRadius: '999px',
                              overflow: 'hidden',
                              minWidth: '70px',
                            }}
                          >
                            <div
                              style={{
                                width: `${pct}%`,
                                height: '100%',
                                backgroundColor: pct === 100 ? '#16a34a' : '#ea580c',
                                borderRadius: '999px',
                                transition: 'width 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
                              }}
                            />
                          </div>
                          <span
                            style={{
                              fontSize: '12px',
                              fontWeight: 700,
                              color: '#0f172a',
                              minWidth: '34px',
                              textAlign: 'right',
                            }}
                          >
                            {pct}%
                          </span>
                        </div>
                      );
                    })()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Active Monitoring */}
      <div className="data-container">
        <p className="section-title">Active Field Monitoring</p>
        <div className="monitor-grid">

          <div>
            <p className="font-bold text-xs mb-4 border-b-2 inline-block pb-1" style={{ color: '#ea580c', borderColor: '#ea580c' }}>
              All Sites ({filteredMonitor.length})
            </p>
            {filteredMonitor.length === 0 ? (
              <p style={{ fontSize: '12px', color: '#999' }}>{searchQuery ? 'No sites matching search.' : 'No active sites logged yet.'}</p>
            ) : (
              filteredMonitor.map(m => (
                <div key={m.label} className="monitor-item">
                  <Checkbox checked={m.checked} />
                  <span>{m.label}</span>
                </div>
              ))
            )}
          </div>

          <div>
            <p className="text-muted font-bold text-xs mb-4 inline-block pb-1">
              Urgent RFIs ({filteredRfis.length})
            </p>
            {filteredRfis.length === 0 ? (
              <p style={{ fontSize: '12px', color: '#999' }}>{searchQuery ? 'No urgent RFIs matching search.' : 'No urgent RFIs pending.'}</p>
            ) : (
              filteredRfis.map(r => (
                <div key={r} className="monitor-item">
                  <Checkbox checked={false} />
                  <span>{r}</span>
                </div>
              ))
            )}
          </div>

          <div>
            <p className="text-muted font-bold text-xs mb-4 inline-block pb-1">
              Notes ({filteredNotes.length < 10 ? `0${filteredNotes.length}` : filteredNotes.length})
            </p>
            {filteredNotes.length === 0 ? (
              <p style={{ fontSize: '12px', color: '#999' }}>{searchQuery ? 'No notes matching search.' : 'No field notes recorded yet.'}</p>
            ) : (
              filteredNotes.map(n => (
                <div key={n.label} className="flex justify-between items-center mb-3">
                  <span className="text-[12px]">{n.label}</span>
                  <span className={pillClass(n.status)}>{n.status}</span>
                </div>
              ))
            )}
          </div>

        </div>
      </div>

    </main>
  );
};

export default Dashboard;