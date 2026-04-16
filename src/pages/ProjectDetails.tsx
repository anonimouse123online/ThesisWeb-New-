import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import '../components/ProjectDetails.css';

const API_URL = import.meta.env.VITE_BACKEND_URL;

interface Project {
  id: string;
  code: string;
  name: string;
  location: string;
  client: string;
  start_date: string;
  end_date: string;
  budget: string;
  status: 'Planning' | 'Ongoing' | 'Completed';
  phase: string;
  scope: string;
}

const ProjectDetails: React.FC = () => {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();

  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activating, setActivating] = useState(false);

  useEffect(() => {
    const fetchProject = async () => {
      try {
        const token = localStorage.getItem('token');
        const res = await fetch(`${API_URL}/projects/${projectId}`, {
          headers: { 'Authorization': `Bearer ${token}` },
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || 'Failed to fetch project');
        setProject(data.data);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    if (projectId) fetchProject();
  }, [projectId]);

  const handleActivate = async () => {
    if (!project) return;
    try {
      setActivating(true);
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_URL}/projects/${project.code}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ status: 'Ongoing' }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to activate project');
      setProject(prev => prev ? { ...prev, status: 'Ongoing' } : prev);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setActivating(false);
    }
  };

  const formatTimeline = (start: string, end: string) => {
    if (!start || !end) return '—';
    const fmt = (d: string) => {
      const dt = new Date(d);
      return `${(dt.getMonth() + 1).toString().padStart(2, '0')}/${dt.getDate().toString().padStart(2, '0')}/${String(dt.getFullYear()).slice(2)}`;
    };
    return `${fmt(start)} - ${fmt(end)}`;
  };

  const formatBudget = (b: string | number) => {
    const n = parseFloat(String(b));
    if (isNaN(n)) return b;
    return `${(n / 1_000_000).toFixed(2)}M`;
  };

  const getStatusClass = (status: string) => {
    if (status === 'Ongoing')   return 'pd-status-pill pd-status--ongoing';
    if (status === 'Planning')  return 'pd-status-pill pd-status--planning';
    if (status === 'Completed') return 'pd-status-pill pd-status--completed';
    return 'pd-status-pill pd-status--planning';
  };

  if (loading) return <div className="pd-state">Loading project...</div>;
  if (error)   return <div className="pd-state pd-state--error">{error}</div>;
  if (!project) return <div className="pd-state">Project not found.</div>;

  const isPlanning  = project.status === 'Planning';
  const isOngoing   = project.status === 'Ongoing';
  const isCompleted = project.status === 'Completed';

  return (
    <main className="main-content">
      {/* ── Header ── */}
      <header className="pm-header">
        <div>
          <button className="pd-back-btn" onClick={() => navigate('/projects')}>
            ← Back to Projects
          </button>
        </div>
        <div className="pm-profile">
          <img
            src="https://api.dicebear.com/7.x/avataaars/svg?seed=Alex"
            alt="Alex"
            className="user-avatar"
          />
          <div className="profile-info">
            <p className="profile-name">Alex meian</p>
            <p className="profile-role">Product manager</p>
          </div>
          <span className="chevron">▾</span>
        </div>
      </header>

      {/* ── Project Hero Card ── */}
      <div className="pd-hero-card">
        <div className="pd-hero-top">
          <div className="pd-hero-left">
            <div className="pd-title-row">
              <h1 className="pd-title">{project.name}</h1>
              <span className="pd-code-badge">{project.code}</span>
            </div>
            <p className="pd-location">{project.location}</p>
          </div>
          <span className={getStatusClass(project.status)}>{project.status}</span>
        </div>

        <div className="pd-hero-meta">
          <div className="pd-meta-item">
            <p className="pd-meta-label">Client</p>
            <p className="pd-meta-value">{project.client}</p>
          </div>
          <div className="pd-meta-item">
            <p className="pd-meta-label">Timeline</p>
            <p className="pd-meta-value">{formatTimeline(project.start_date, project.end_date)}</p>
          </div>
          <div className="pd-meta-item">
            <p className="pd-meta-label">Budget</p>
            <p className="pd-meta-value">{formatBudget(project.budget)}</p>
          </div>
        </div>
      </div>

      {/* ── Project Hub Card ── */}
      <div className="pd-hub-card">
        <div className="pd-hub-header">
          <h2 className="pd-hub-title">Project Hub</h2>
          <p className="pd-hub-sub">This is your main project management center</p>
        </div>

        <div className="pd-hub-grid">
          <div className="pd-hub-tile" onClick={() => navigate(`/projects/${project.code}/team`)}>
            <p className="pd-hub-tile-title">Manage Team</p>
            <p className="pd-hub-tile-sub">Add engineers &amp; workers</p>
          </div>
          <div className="pd-hub-tile" onClick={() => navigate(`/projects/${project.code}/documents`)}>
            <p className="pd-hub-tile-title">Documents</p>
            <p className="pd-hub-tile-sub">Drawings &amp; specifications</p>
          </div>
        </div>

        {/* ── Activate Banner (Planning only) ── */}
        {isPlanning && (
          <div className="pd-activate-banner">
            <div>
              <p className="pd-activate-title">Ready to start construction?</p>
              <p className="pd-activate-sub">
                Once you've set up your team and planned tasks, activate the project to begin field execution.
              </p>
            </div>
            <button
              className="pd-activate-btn"
              onClick={handleActivate}
              disabled={activating}
            >
              {activating ? 'Activating...' : 'Active Project'}
            </button>
          </div>
        )}

        {/* ── Ongoing Banner ── */}
        {isOngoing && (
          <div className="pd-ongoing-banner">
            <div>
              <p className="pd-activate-title">Project is currently active</p>
              <p className="pd-activate-sub">
                Field execution is in progress. Monitor tasks, team, and issues in real time.
              </p>
            </div>
            <span className="pd-ongoing-badge">● Ongoing</span>
          </div>
        )}

        {/* ── Completed Banner ── */}
        {isCompleted && (
          <div className="pd-completed-banner">
            <div>
              <p className="pd-activate-title">Project completed</p>
              <p className="pd-activate-sub">
                This project has been marked as completed. All records are archived.
              </p>
            </div>
            <span className="pd-completed-badge">✓ Completed</span>
          </div>
        )}
      </div>

      {/* ── Current Phase Card ── */}
      <div className="pd-phase-card">
        <h2 className="pd-phase-title">Current Phase: {project.phase || '—'}</h2>
        {isPlanning && (
          <>
            <p className="pd-phase-sub">During the planning phase, you can:</p>
            <ul className="pd-phase-list">
              <li>Build your project team</li>
              <li>Create and organize tasks</li>
              <li>Upload project documents</li>
              <li>Set up workflows and approvals</li>
              <li>Define roles and responsibilities</li>
            </ul>
          </>
        )}
        {isOngoing && (
          <>
            <p className="pd-phase-sub">During the active phase, you can:</p>
            <ul className="pd-phase-list">
              <li>Track daily field progress</li>
              <li>Monitor team attendance and location</li>
              <li>Submit and resolve issues</li>
              <li>Log time and resources</li>
              <li>Review and approve RFIs</li>
            </ul>
          </>
        )}
        {isCompleted && (
          <>
            <p className="pd-phase-sub">Project scope:</p>
            <p className="pd-phase-scope">{project.scope || '—'}</p>
          </>
        )}
      </div>
    </main>
  );
};

export default ProjectDetails;
