import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import '../components/Projects.css';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL;

interface ProjectRecord {
  code: string;
  name: string;
  location: string;
  client: string;
  start_date: string;
  end_date: string;
  budget: string;
  status: 'Planning' | 'Ongoing' | 'Completed';
  scope?: string;
  phase?: string;
}

interface NewProjectForm {
  code: string;
  name: string;
  location: string;
  scope: string;
  client: string;
  budget: string;
  start_date: string;
  end_date: string;
  phase: string;
}

const emptyForm: NewProjectForm = {
  code: '',
  name: '',
  location: '',
  scope: '',
  client: '',
  budget: '',
  start_date: '',
  end_date: '',
  phase: 'Phase 1 - Foundation',
};

const PHASES = [
  'Phase 1 - Foundation',
  'Phase 2 - Structure',
  'Phase 3 - Envelope',
  'Phase 4 - Interior',
  'Phase 5 - Finishing',
];

const Projects: React.FC = () => {
  const navigate = useNavigate();
  const [projects, setProjects] = useState<ProjectRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState<NewProjectForm>(emptyForm);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => { fetchProjects(); }, []);

  const fetchProjects = async () => {
    try {
      setLoading(true);
      setError(null);
      const token = localStorage.getItem('token');
      const response = await fetch(`${BACKEND_URL}/projects`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
      if (!response.ok) throw new Error(`Failed to fetch projects: ${response.statusText}`);
      const data = await response.json();
      setProjects(data.data ?? data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unexpected error occurred.');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateProject = async () => {
    if (!form.code || !form.name || !form.location || !form.client || !form.start_date || !form.end_date || !form.budget || !form.scope) {
      setFormError('Please fill in all required fields.');
      return;
    }

    try {
      setSubmitting(true);
      setFormError(null);
      const token = localStorage.getItem('token');

      // status is always 'Planning' on create — set by backend
      const res = await fetch(`${BACKEND_URL}/projects`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(form),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to create project');

      setProjects(prev => [data.data ?? data, ...prev]);
      setShowModal(false);
      setForm(emptyForm);
    } catch (err: any) {
      setFormError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const getStatusClass = (status: string) => {
    const s = status.toLowerCase();
    if (s === 'ongoing')   return 'proj-pill proj-pill--ongoing';
    if (s === 'planning')  return 'proj-pill proj-pill--planning';
    if (s === 'completed') return 'proj-pill proj-pill--completed';
    return 'proj-pill proj-pill--planning';
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

  return (
    <main className="main-content">
      {/* ── Header ── */}
      <header className="pm-header">
        <div>
          <h1 className="pm-title">Project Management</h1>
          <p className="pm-subtitle">Create and manage construction projects</p>
        </div>
        <div className="pm-header-right">
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
        </div>
      </header>

      {/* ── Table Card ── */}
      <div className="pm-card">
        <div className="pm-card-header">
          <h2 className="section-title">Active Project Table</h2>
          <div className="flex gap-3 items-center ">
            <button className="filter-btn">Project ▾</button>
            <button className="filter-btn">Status ▾</button>
            <button className="pm-new-btn" onClick={() => setShowModal(true)}>
              + New Project
            </button>
          </div>
        </div>

        {loading && <p className="pm-state-msg">Loading projects...</p>}
        {error   && <p className="pm-state-msg pm-state-msg--error">{error}</p>}
        {!loading && !error && projects.length === 0 && (
          <p className="pm-state-msg">No projects found.</p>
        )}

        {!loading && !error && projects.length > 0 && (
          <table className="pm-table">
            <thead>
              <tr>
                <th>Project Code</th>
                <th>Name</th>
                <th>Location</th>
                <th>Client</th>
                <th>Timeline</th>
                <th>Budget</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {projects.map((prj) => (
                <tr key={prj.code}>
                  <td className="pm-td-bold">{prj.code}</td>
                  <td>{prj.name}</td>
                  <td className="pm-td-muted">{prj.location}</td>
                  <td>{prj.client}</td>
                  <td className="pm-td-muted">{formatTimeline(prj.start_date, prj.end_date)}</td>
                  <td>{formatBudget(prj.budget)}</td>
                  <td><span className={getStatusClass(prj.status)}>{prj.status}</span></td>
                  <td>
                    <button
                      className="pm-view-btn"
                      onClick={() => navigate(`/projects/${prj.code}`)}
                    >
                      View Details
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* ── Create Project Modal ── */}
      {showModal && (
        <div className="pm-overlay" onClick={() => setShowModal(false)}>
          <div className="pm-modal" onClick={e => e.stopPropagation()}>
            <h2 className="pm-modal-title">Create New Project</h2>

            {formError && (
              <p className="pm-form-error">⚠ {formError}</p>
            )}

            {/* Row 1: Project Name + Project Code */}
            <div className="pm-form-row pm-form-row--2">
              <div className="pm-form-group">
                <label>Project Name <span className="pm-required">*</span></label>
                <input
                  className="pm-input"
                  value={form.name}
                  onChange={e => setForm({ ...form, name: e.target.value })}
                  placeholder="e.g., Downtown Office Complex"
                />
              </div>
              <div className="pm-form-group">
                <label>Project Code <span className="pm-required">*</span></label>
                <input
                  className="pm-input"
                  value={form.code}
                  onChange={e => setForm({ ...form, code: e.target.value })}
                  placeholder="e.g., PRJ-2026-001"
                />
              </div>
            </div>

            {/* Row 2: Location (full width) */}
            <div className="pm-form-row pm-form-row--1">
              <div className="pm-form-group">
                <label>Location <span className="pm-required">*</span></label>
                <input
                  className="pm-input"
                  value={form.location}
                  onChange={e => setForm({ ...form, location: e.target.value })}
                  placeholder="Full address with coordinates"
                />
              </div>
            </div>

            {/* Row 3: Project Scope (textarea, full width) */}
            <div className="pm-form-row pm-form-row--1">
              <div className="pm-form-group">
                <label>Project Scope <span className="pm-required">*</span></label>
                <textarea
                  className="pm-input pm-textarea"
                  value={form.scope}
                  onChange={e => setForm({ ...form, scope: e.target.value })}
                  placeholder="Detailed description of project scope, deliverables, and requirements"
                  rows={4}
                />
              </div>
            </div>

            {/* Row 4: Client Name + Budget */}
            <div className="pm-form-row pm-form-row--2">
              <div className="pm-form-group">
                <label>Client Name <span className="pm-required">*</span></label>
                <input
                  className="pm-input"
                  value={form.client}
                  onChange={e => setForm({ ...form, client: e.target.value })}
                  placeholder="Client organization"
                />
              </div>
              <div className="pm-form-group">
                <label>Budget (USD) <span className="pm-required">*</span></label>
                <input
                  className="pm-input"
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.budget}
                  onChange={e => setForm({ ...form, budget: e.target.value })}
                  placeholder="0.00"
                />
              </div>
            </div>

            {/* Row 5: Start Date + End Date + Phase */}
            <div className="pm-form-row pm-form-row--3">
              <div className="pm-form-group">
                <label>Start Date <span className="pm-required">*</span></label>
                <input
                  className="pm-input"
                  type="date"
                  value={form.start_date}
                  onChange={e => setForm({ ...form, start_date: e.target.value })}
                />
              </div>
              <div className="pm-form-group">
                <label>End Date <span className="pm-required">*</span></label>
                <input
                  className="pm-input"
                  type="date"
                  value={form.end_date}
                  onChange={e => setForm({ ...form, end_date: e.target.value })}
                />
              </div>
              <div className="pm-form-group">
                <label>Construction Phase <span className="pm-required">*</span></label>
                <select
                  className="pm-input pm-select"
                  value={form.phase}
                  onChange={e => setForm({ ...form, phase: e.target.value })}
                >
                  {PHASES.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
            </div>

            <div className="pm-modal-actions">
              <button
                className="pm-btn-cancel"
                onClick={() => { setShowModal(false); setForm(emptyForm); setFormError(null); }}
              >
                Cancel
              </button>
              <button
                className="pm-btn-create"
                onClick={handleCreateProject}
                disabled={submitting}
              >
                {submitting ? 'Creating...' : 'Create Project'}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
};

export default Projects;
