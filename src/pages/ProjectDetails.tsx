import React, { useState, useEffect, useRef } from 'react';
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

interface TeamMember {
  id: string;
  name: string;
  role: string;
}

interface ActiveTask {
  id: string;
  title: string;
  status: string;
  assignee?: string;
}

interface GenerateCodeModalProps {
  project: Project;
  onClose: () => void;
}

const GenerateCodeModal: React.FC<GenerateCodeModalProps> = ({ project, onClose }) => {
  const [generating, setGenerating] = useState(false);
  const [generated, setGenerated] = useState(false);
  const [codeValue, setCodeValue] = useState('');
  const [copied, setCopied] = useState(false);
  const [loadingActive, setLoadingActive] = useState(true);
  const overlayRef = useRef<HTMLDivElement>(null);

  const handleOverlayClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === overlayRef.current) onClose();
  };

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  useEffect(() => {
    const fetchActiveCode = async () => {
      try {
        const res = await fetch(`${API_URL}/projects/${project.code}/active-code`);
        const data = await res.json();
        if (data.success && data.code) {
          setCodeValue(data.code);
          setGenerated(true);
        }
      } catch (err) {
        // network error — just show Generate button
      } finally {
        setLoadingActive(false);
      }
    };
    fetchActiveCode();
  }, [project.code]);

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const res = await fetch(`${API_URL}/projects/${project.code}/generate-code`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to generate code');
      setCodeValue(data.code || '');
      setGenerated(true);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setGenerating(false);
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(codeValue).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div className="gc-overlay" ref={overlayRef} onClick={handleOverlayClick}>
      <div className="gc-modal" role="dialog" aria-modal="true" aria-labelledby="gc-title">
        <div className="gc-modal-header">
          <div className="gc-header-left">
            <span className="gc-icon">⟨/⟩</span>
            <div>
              <h2 className="gc-title" id="gc-title">Generate Project Code</h2>
              <p className="gc-subtitle">Share this code with your team to join <strong>{project.name}</strong></p>
            </div>
          </div>
          <button className="gc-close-btn" onClick={onClose} aria-label="Close">✕</button>
        </div>

        <div className="gc-modal-body">
          {loadingActive ? (
            <p className="gc-description">Checking for active code…</p>
          ) : !generated ? (
            <>
              <div className="gc-info-block">
                <div className="gc-info-row">
                  <span className="gc-info-label">Project</span>
                  <span className="gc-info-value">{project.name}</span>
                </div>
                <div className="gc-info-row">
                  <span className="gc-info-label">Code</span>
                  <span className="gc-info-value gc-badge">{project.code}</span>
                </div>
                <div className="gc-info-row">
                  <span className="gc-info-label">Status</span>
                  <span className="gc-info-value">{project.status}</span>
                </div>
              </div>
              <p className="gc-description">
                No active invite code found. Generate one to share with your team.
                It expires after first use or 7 days.
              </p>
            </>
          ) : (
            <>
              <div className="gc-success-block">
                <div className="gc-success-icon">✓</div>
                <p className="gc-success-text">Active code ready to share!</p>
              </div>
              <div className="gc-code-display">
                <span className="gc-code-value">{codeValue}</span>
                <button
                  className={`gc-copy-btn ${copied ? 'gc-copy-btn--copied' : ''}`}
                  onClick={handleCopy}
                >
                  {copied ? '✓ Copied' : 'Copy'}
                </button>
              </div>
              <p className="gc-expiry-note">⏱ This code expires in 7 days or after first use.</p>
            </>
          )}
        </div>

        <div className="gc-modal-footer">
          <button className="gc-cancel-btn" onClick={onClose}>
            {generated ? 'Close' : 'Cancel'}
          </button>
          {!loadingActive && !generated && (
            <button className="gc-generate-btn" onClick={handleGenerate} disabled={generating}>
              {generating ? (<><span className="gc-spinner" /> Generating…</>) : 'Generate Code'}
            </button>
          )}
          {!loadingActive && generated && (
            <button className="gc-generate-btn" onClick={() => { setGenerated(false); setCodeValue(''); }}>
              Generate New
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

// ── Main Component ────────────────────────────────────────────────────────────
const ProjectDetails: React.FC = () => {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();

  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activating, setActivating] = useState(false);
  const [showGenerateModal, setShowGenerateModal] = useState(false);

  // Ongoing dashboard data
  const [activeTaskCount, setActiveTaskCount] = useState<number>(0);
  const [memberCount, setMemberCount] = useState<number>(0);
  const [pendingIssueCount, setPendingIssueCount] = useState<number>(0);
  const [activeTask, setActiveTask] = useState<ActiveTask | null>(null);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [dashboardLoading, setDashboardLoading] = useState(false);

  useEffect(() => {
    const fetchProject = async () => {
      try {
        const res = await fetch(`${API_URL}/projects/${projectId}`);
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

  // Fetch ongoing dashboard data when project is Ongoing
  useEffect(() => {
    if (!project || project.status !== 'Ongoing') return;

    const fetchDashboard = async () => {
      setDashboardLoading(true);
      try {
        const [statsRes, taskRes, membersRes] = await Promise.allSettled([
          fetch(`${API_URL}/projects/${project.code}/stats`),
          fetch(`${API_URL}/projects/${project.code}/active-task`),
          fetch(`${API_URL}/projects/${project.code}/members`),
        ]);

        if (statsRes.status === 'fulfilled' && statsRes.value.ok) {
          const d = await statsRes.value.json();
          setActiveTaskCount(d.data?.activeTaskCount ?? 0);
          setMemberCount(d.data?.memberCount ?? 0);
          setPendingIssueCount(d.data?.pendingIssueCount ?? 0);
        }

        if (taskRes.status === 'fulfilled' && taskRes.value.ok) {
          const d = await taskRes.value.json();
          setActiveTask(d.data ?? null);
        }

        if (membersRes.status === 'fulfilled' && membersRes.value.ok) {
          const d = await membersRes.value.json();
          setTeamMembers(d.data ?? []);
        }
      } catch (err) {
        // fail silently — show zeros
      } finally {
        setDashboardLoading(false);
      }
    };

    fetchDashboard();
  }, [project]);

  const handleActivate = async () => {
    if (!project) return;
    try {
      setActivating(true);
      const res = await fetch(`${API_URL}/projects/${project.code}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
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
      {/* Header */}
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

      {/* ── ONGOING VIEW ── */}
      {isOngoing ? (
        <>
          {/* Hero Card — green tint for ongoing */}
          <div className="pd-hero-card pd-hero-card--ongoing">
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

          {/* Stats Row */}
          <div className="pd-stats-row">
            <div className="pd-stat-card">
              <p className="pd-stat-label">Active Task</p>
              <p className="pd-stat-value">{dashboardLoading ? '—' : activeTaskCount}</p>
            </div>
            <div className="pd-stat-card">
              <p className="pd-stat-label">Members</p>
              <p className="pd-stat-value">{dashboardLoading ? '—' : memberCount}</p>
            </div>
            <div className="pd-stat-card">
              <p className="pd-stat-label">Pending Issue</p>
              <p className="pd-stat-value">{dashboardLoading ? '—' : pendingIssueCount}</p>
            </div>
          </div>

          {/* Active Task Card */}
          <div className="pd-section-card">
            <p className="pd-section-card-title">Active Task</p>
            {dashboardLoading ? (
              <p className="pd-empty-hint">Loading…</p>
            ) : activeTask ? (
              <div className="pd-active-task-row">
                <span className="pd-active-task-name">{activeTask.title}</span>
                <span className="pd-active-task-status">{activeTask.status}</span>
              </div>
            ) : (
              <p className="pd-empty-hint">No active task at the moment.</p>
            )}
          </div>

          {/* Team Members Card */}
          <div className="pd-section-card">
            <p className="pd-section-card-title">Team Members ({teamMembers.length})</p>
            {dashboardLoading ? (
              <p className="pd-empty-hint">Loading…</p>
            ) : teamMembers.length > 0 ? (
              <div className="pd-members-list">
                {teamMembers.map((m) => (
                  <span key={m.id} className="pd-member-chip">{m.name}</span>
                ))}
              </div>
            ) : (
              <p className="pd-empty-hint">No team members yet.</p>
            )}
          </div>

          {/* Project Actions Card */}
          <div className="pd-section-card">
            <p className="pd-section-card-title">Project Actions</p>
            <div className="pd-actions-grid">
              <button
                className="pd-action-tile"
                onClick={() => navigate(`/projects/${project.code}/progress`)}
              >
                <span className="pd-action-icon">
                  {/* Update Progress icon */}
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="3" width="18" height="18" rx="2"/>
                    <path d="M3 9h18"/>
                    <path d="M9 21V9"/>
                  </svg>
                </span>
                <span className="pd-action-label">Update Progress</span>
              </button>

              <button
                className="pd-action-tile"
                onClick={() => navigate(`/projects/${project.code}/issues/report`)}
              >
                <span className="pd-action-icon">
                  {/* Reported Issue icon */}
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
                    <line x1="12" y1="9" x2="12" y2="13"/>
                    <line x1="12" y1="17" x2="12.01" y2="17"/>
                  </svg>
                </span>
                <span className="pd-action-label">Reported Issue</span>
              </button>

              <button
                className="pd-action-tile"
                onClick={() => navigate(`/projects/${project.code}/reports`)}
              >
                <span className="pd-action-icon">
                  {/* View Reports icon */}
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
                    <polyline points="14 2 14 8 20 8"/>
                    <line x1="16" y1="13" x2="8" y2="13"/>
                    <line x1="16" y1="17" x2="8" y2="17"/>
                    <polyline points="10 9 9 9 8 9"/>
                  </svg>
                </span>
                <span className="pd-action-label">View Reports</span>
              </button>
            </div>
          </div>
        </>
      ) : (
        <>
          {/* ── PLANNING / COMPLETED VIEW (original layout) ── */}

          {/* Project Hero Card */}
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

          {/* Project Hub Card */}
          <div className="pd-hub-card">
            <div className="pd-hub-header">
              <div className="pd-hub-header-left">
                <h2 className="pd-hub-title">Project Hub</h2>
                <p className="pd-hub-sub">This is your main project management center</p>
              </div>
              <button className="pd-generate-btn" onClick={() => setShowGenerateModal(true)}>
                Generate Code
              </button>
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

            {isPlanning && (
              <div className="pd-activate-banner">
                <div>
                  <p className="pd-activate-title">Ready to start construction?</p>
                  <p className="pd-activate-sub">
                    Once you've set up your team and planned tasks, activate the project to begin field execution.
                  </p>
                </div>
                <button className="pd-activate-btn" onClick={handleActivate} disabled={activating}>
                  {activating ? 'Activating...' : 'Active Project'}
                </button>
              </div>
            )}

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

          {/* Current Phase Card */}
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
            {isCompleted && (
              <>
                <p className="pd-phase-sub">Project scope:</p>
                <p className="pd-phase-scope">{project.scope || '—'}</p>
              </>
            )}
          </div>
        </>
      )}

      {/* Generate Code Modal */}
      {showGenerateModal && (
        <GenerateCodeModal
          project={project}
          onClose={() => setShowGenerateModal(false)}
        />
      )}
    </main>
  );
};

export default ProjectDetails;