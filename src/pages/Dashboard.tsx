import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { API_BASE_URL, fetchWithAuth } from '../utils/api';
import Dropdown from '../components/Dropdown';
import ProfileDropdown from '../components/ProfileDropdown';
import '../components/Dashboard.css';

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
  status: 'Approved' | 'Delayed' | 'At risk' | 'In Review';
  prog: string;
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

interface GaugeStat {
  v: string;
  l: string;
  c: string;
}

interface DashboardData {
  stats: StatItem[];
  projects: ProjectItem[];
  monitorItems: MonitorItem[];
  rfis: string[];
  notes: NoteItem[];
  gaugeStats: GaugeStat[];
  overallProgress: number;
}

// --- HELPERS ---
const pillClass = (status: string): string => {
  const s = status.toLowerCase().replace(/\s/g, '');
  return `status-pill status-${s}`;
};

// --- SUB-COMPONENTS ---
const StatCard: React.FC<StatItem> = ({ label, value, trend, up, bg, clr, icon }) => (
  <div className="stat-card">
    <div className="stat-icon-box" style={{ background: bg, color: clr }}>{icon}</div>
    <p className="stat-label text-muted">{label}</p>
    <p className="stat-value">{value}</p>
    <p className={`stat-trend ${up ? 'text-green' : 'text-red'}`}>
      <span>{up ? '↗' : '↘'}</span> {trend} from last month
    </p>
  </div>
);

const Checkbox: React.FC<{ checked: boolean }> = ({ checked }) => (
  <div className={`monitor-checkbox ${checked ? 'checked' : ''}`}>
    {checked && <span style={{ color: 'white', fontSize: '10px' }}>✓</span>}
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
  const [progressCategory, setProgressCategory] = useState('All');
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

        const [stats, projects, monitorItems, rfisRes, notes, gaugeStats, progressRes] = await Promise.all([
          fetchData(`${BACKEND_URL}/dashboard/stats`),
          fetchData(`${BACKEND_URL}/dashboard/projects`),
          fetchData(`${BACKEND_URL}/dashboard/monitor`),
          fetchData(`${BACKEND_URL}/dashboard/rfis`),
          fetchData(`${BACKEND_URL}/dashboard/notes`),
          fetchData(`${BACKEND_URL}/dashboard/gauge`),
          fetchData(`${BACKEND_URL}/dashboard/progress`),
        ]);

        setData({
          stats:           stats.data ?? [],
          projects:        projects.data ?? [],
          monitorItems:    monitorItems.data ?? [],
          rfis:            rfisRes.data ?? [],
          notes:           notes.data ?? [],
          gaugeStats:      gaugeStats.data ?? [],
          overallProgress: progressRes.data?.overallProgress ?? 0,
        });
      } catch (err: any) {
        setError(err.message || "Something went wrong");
      } finally {
        setLoading(false);
      }
    };

    fetchDashboard();
  }, []);

  // Update Progress and Gauge Stats when category filter changes
  useEffect(() => {
    const updateCategoryProgress = async () => {
      try {
        const [gaugeRes, progRes] = await Promise.all([
          fetchWithAuth(`${BACKEND_URL}/dashboard/gauge?category=${progressCategory}`).then(r => r.json()),
          fetchWithAuth(`${BACKEND_URL}/dashboard/progress?category=${progressCategory}`).then(r => r.json()),
        ]);
        setData(prev => prev ? {
          ...prev,
          gaugeStats: gaugeRes.data ?? prev.gaugeStats,
          overallProgress: progRes.data?.overallProgress ?? prev.overallProgress,
        } : null);
      } catch (err) {
        console.error("Failed to update category progress:", err);
      }
    };
    updateCategoryProgress();
  }, [progressCategory]);

  if (loading) return <div className="rm-empty">Loading dashboard...</div>;
  if (error)   return <div className="rm-empty" style={{ color: 'red' }}>{error}</div>;
  if (!data)   return <div className="rm-empty">No data available.</div>;

  const { stats, projects, monitorItems, rfis, notes, gaugeStats, overallProgress } = data;

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

  const categoryOptions = [
    'All',
    'Foundation',
    'Structural',
    'Electrical',
    'Plumbing',
    'Finishing',
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
            <span className="search-icon">🔍</span>
            <input
              type="text"
              placeholder="Search projects, sites, RFIs..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#999', fontSize: '12px' }}
              >
                ✕
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

      {/* Summary + Gauge */}
      <div className="grid grid-cols-3 gap-6 mb-8">
        <div className="col-span-2 data-container">
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
            <div style={{ padding: '2rem', textAlign: 'center', color: '#999', fontSize: '13px' }}>
              No projects matching the selected filters.
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
                    <td className="font-bold">{p.prog}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="data-container">
          <div className="flex justify-between items-center mb-4">
            <p className="section-title">Overall Progress</p>
            <Dropdown
              options={categoryOptions}
              value={progressCategory}
              onChange={setProgressCategory}
              align="right"
            />
          </div>
          {/* Live Dynamic Semi-Circle Gauge */}
          {(() => {
            const arcLength = Math.PI * 40; // ~125.66
            const clampedProgress = Math.min(100, Math.max(0, overallProgress));
            const dashOffset = arcLength * (1 - clampedProgress / 100);
            const gaugeColor = clampedProgress === 100
              ? '#10b981'
              : clampedProgress >= 50
              ? '#2563eb'
              : clampedProgress > 0
              ? '#f59e0b'
              : '#cbd5e1';

            return (
              <div className="gauge-container py-8">
                <div className="progress-container">
                  <svg viewBox="0 0 100 55" className="w-full" style={{ overflow: 'visible' }}>
                    <path
                      d="M 10 50 A 40 40 0 0 1 90 50"
                      fill="none"
                      stroke="#f1f5f9"
                      strokeWidth="8"
                      strokeLinecap="round"
                    />
                    <path
                      d="M 10 50 A 40 40 0 0 1 90 50"
                      fill="none"
                      stroke={gaugeColor}
                      strokeWidth="8"
                      strokeLinecap="round"
                      strokeDasharray={arcLength}
                      strokeDashoffset={dashOffset}
                      style={{
                        transition: "stroke-dashoffset 0.8s cubic-bezier(0.4, 0, 0.2, 1), stroke 0.4s ease",
                      }}
                    />
                  </svg>
                  <div className="gauge-percentage">{clampedProgress}%</div>
                  <div className="text-muted text-[10px]">
                    {progressCategory === 'All' ? 'Weighted Task Progress' : `${progressCategory} Progress`}
                  </div>
                </div>
              </div>
            );
          })()}
          <div className="grid grid-cols-4 gap-2 mt-4">
            {gaugeStats.map(s => (
              <div key={s.l} className="text-center">
                <p className="text-sm font-bold" style={{ color: s.c }}>{s.v}</p>
                <p className="text-[9px] text-muted uppercase">{s.l}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Active Monitoring */}
      <div className="data-container">
        <p className="section-title">Active Field Monitoring</p>
        <div className="monitor-grid">

          <div>
            <p className="text-blue-500 font-bold text-xs mb-4 border-b-2 border-blue-500 inline-block pb-1">
              All Sites ({filteredMonitor.length})
            </p>
            {filteredMonitor.length === 0 ? (
              <p style={{ fontSize: '12px', color: '#999' }}>No sites matching search.</p>
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
              <p style={{ fontSize: '12px', color: '#999' }}>No urgent RFIs matching search.</p>
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
              <p style={{ fontSize: '12px', color: '#999' }}>No notes matching search.</p>
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