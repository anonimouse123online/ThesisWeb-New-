import React, { useState, useEffect } from 'react';
import '../components/Dashboard.css';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL;

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
const FilterBtn: React.FC<{ label: string }> = ({ label }) => (
  <button className="filter-btn">{label} ▾</button>
);

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
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchDashboard = async () => {
      try {
        setLoading(true);
        setError(null);

        const [stats, projects, monitorItems, rfisRes, notes, gaugeStats] = await Promise.all([
          fetch(`${BACKEND_URL}/dashboard/stats`).then(r => r.json()),
          fetch(`${BACKEND_URL}/dashboard/projects`).then(r => r.json()),
          fetch(`${BACKEND_URL}/dashboard/monitor`).then(r => r.json()),
          fetch(`${BACKEND_URL}/dashboard/rfis`).then(r => r.json()),
          fetch(`${BACKEND_URL}/dashboard/notes`).then(r => r.json()),
          fetch(`${BACKEND_URL}/dashboard/gauge`).then(r => r.json()),
        ]);

        setData({
          stats:           stats.data,
          projects:        projects.data,
          monitorItems:    monitorItems.data,
          rfis:            rfisRes.data,
          notes:           notes.data,
          gaugeStats:      gaugeStats.data,       // array directly
          overallProgress: 72,                    // TODO: add to gauge endpoint when DB is connected
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

  const { stats, projects, monitorItems, rfis, notes, gaugeStats, overallProgress } = data;

  return (
    <main className="main-content">

      {/* Header */}
      <header className="header-top">
        <div className="flex items-center gap-4">
          <h1>Field Analytics Command Center</h1>
        </div>
        <div className="flex items-center gap-4">
          <div className="search-bar">
            <input type="text" placeholder="Search for anything..." />
          </div>
          <div className="profile-section">
            <img
              src="https://api.dicebear.com/7.x/avataaars/svg?seed=Seth"
              alt="Seth"
              className="user-avatar"
            />
            <div className="profile-info">
              <p className="profile-name">Seth Andrew</p>
              <p className="profile-role">Product manager</p>
            </div>
            <span className="chevron">▾</span>
          </div>
        </div>
      </header>

      {/* Overview */}
      <section className="mb-8">
        <div className="flex justify-between items-center mb-6">
          <h2 className="section-title">Overview</h2>
          <FilterBtn label="Last 30 days" />
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
              {['Project', 'Project manager', 'Status'].map(f => (
                <FilterBtn key={f} label={f} />
              ))}
            </div>
          </div>
          <table className="project-table">
            <thead>
              <tr>
                {['Name', 'Project manager', 'Due date', 'Status', 'Progress'].map(h => (
                  <th key={h}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {projects.map(p => (
                <tr key={p.name}>
                  <td>{p.name}</td>
                  <td>{p.pm}</td>
                  <td>{p.date}</td>
                  <td><span className={pillClass(p.status)}>{p.status}</span></td>
                  <td className="font-bold">{p.prog}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="data-container">
          <div className="flex justify-between items-center mb-4">
            <p className="section-title">Overall Progress</p>
            <FilterBtn label="All" />
          </div>
          <div className="gauge-container py-8">
            <div className="progress-container">
              <svg viewBox="0 0 100 50" className="w-full">
                <path d="M 10 50 A 40 40 0 0 1 90 50" fill="none" stroke="#eee" strokeWidth="8" strokeLinecap="round" />
                <path d="M 10 50 A 40 40 0 0 1 75 20" fill="none" stroke="#22c55e" strokeWidth="8" strokeLinecap="round" />
              </svg>
              <div className="gauge-percentage">{overallProgress}%</div>
              <div className="text-muted text-[10px]">Completed</div>
            </div>
          </div>
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
              All Sites {monitorItems.length}
            </p>
            {monitorItems.map(m => (
              <div key={m.label} className="monitor-item">
                <Checkbox checked={m.checked} />
                <span>{m.label}</span>
              </div>
            ))}
          </div>

          <div>
            <p className="text-muted font-bold text-xs mb-4 inline-block pb-1">Urgent RFIs</p>
            {rfis.map(r => (
              <div key={r} className="monitor-item">
                <Checkbox checked={false} />
                <span>{r}</span>
              </div>
            ))}
          </div>

          <div>
            <p className="text-muted font-bold text-xs mb-4 inline-block pb-1">
              Notes {notes.length < 10 ? `0${notes.length}` : notes.length}
            </p>
            {notes.map(n => (
              <div key={n.label} className="flex justify-between items-center mb-3">
                <span className="text-[12px]">{n.label}</span>
                <span className={pillClass(n.status)}>{n.status}</span>
              </div>
            ))}
          </div>

        </div>
      </div>

    </main>
  );
};

export default Dashboard;