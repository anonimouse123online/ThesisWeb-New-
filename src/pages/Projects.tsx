import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import '../components/Projects.css';
import { fetchWithAuth } from '../utils/api';
import Dropdown from '../components/Dropdown';
import ProfileDropdown from '../components/ProfileDropdown';
import { showToast } from '../components/Toast';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL;

interface ProjectRecord {
  id?: string;
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
  task_count?: number;
  completed_task_count?: number;
  resource_count?: number;
}

interface TaskRecord {
  id: string | number;
  task_name: string;
  phase: string;
  assignee: string;
  due_date: string;
  priority: string;
  status: string;
  project_id?: string;
  project_name?: string;
  project_code?: string;
  code?: string;
}

interface ResourceRecord {
  id: number;
  name: string;
  supplier: string;
  category: 'Material' | 'Equipment';
  quantity: number;
  unit: string;
  minThreshold: number;
  unitPrice: number;
  project: string;
  status: string;
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
  'Phase 2 - Structural',
  'Phase 3 - Electrical & Utilities',
  'Phase 4 - Plumbing & MEP',
  'Phase 5 - Finishing',
];

const Projects: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  // Active View: 'projects' | 'tasks' | 'resources'
  const activeView = searchParams.get('view') || 'projects';
  const setView = (v: string) => setSearchParams({ view: v });

  const [projects, setProjects] = useState<ProjectRecord[]>([]);
  const [tasks, setTasks] = useState<TaskRecord[]>([]);
  const [resources, setResources] = useState<ResourceRecord[]>([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modal
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState<NewProjectForm>(emptyForm);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Filters
  const [selectedProjectFilter, setSelectedProjectFilter] = useState('All');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');

  // User
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
    fetchAllData();
  }, []);

  const fetchAllData = async () => {
    try {
      setLoading(true);
      setError(null);

      const [pRes, tRes, rRes] = await Promise.allSettled([
        fetchWithAuth(`${BACKEND_URL}/projects`),
        fetchWithAuth(`${BACKEND_URL}/tasks`),
        fetchWithAuth(`${BACKEND_URL}/resources`),
      ]);

      if (pRes.status === 'fulfilled' && pRes.value.ok) {
        const pData = await pRes.value.json();
        setProjects(pData.data ?? pData ?? []);
      } else {
        throw new Error('Failed to load projects');
      }

      if (tRes.status === 'fulfilled' && tRes.value.ok) {
        const tData = await tRes.value.json();
        setTasks(tData.tasks || tData.data || []);
      }

      if (rRes.status === 'fulfilled' && rRes.value.ok) {
        const rData = await rRes.value.json();
        setResources(rData.data || []);
      }
    } catch (err: any) {
      setError(err.message || 'An unexpected error occurred.');
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
      const res = await fetchWithAuth(`${BACKEND_URL}/projects`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to create project');

      setProjects(prev => [data.data ?? data, ...prev]);
      setShowModal(false);
      setForm(emptyForm);
      showToast('Project created successfully!', 'success');
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
    return `₱${(n / 1_000_000).toFixed(2)}M`;
  };

  // Filter options
  const projectOptions = [
    { value: 'All', label: 'All Projects' },
    ...projects.map(p => ({ value: p.code, label: `${p.code} — ${p.name}` }))
  ];

  const statusOptions = [
    { value: 'All', label: 'All Statuses' },
    { value: 'Planning', label: 'Planning' },
    { value: 'Ongoing', label: 'Ongoing' },
    { value: 'Completed', label: 'Completed' },
  ];

  // Filtered lists
  const filteredProjects = projects.filter(p => {
    const matchProject = selectedProjectFilter === 'All' || p.code === selectedProjectFilter;
    const matchStatus  = selectedStatusFilter === 'All' || p.status.toLowerCase() === selectedStatusFilter.toLowerCase();
    const matchSearch  = !searchQuery || p.name.toLowerCase().includes(searchQuery.toLowerCase()) || p.code.toLowerCase().includes(searchQuery.toLowerCase()) || (p.client && p.client.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchProject && matchStatus && matchSearch;
  });

  const filteredTasks = tasks.filter(t => {
    const pCode = t.project_code || t.code || '';
    const matchProject = selectedProjectFilter === 'All' || pCode === selectedProjectFilter || (t.project_name && t.project_name.toLowerCase().includes(selectedProjectFilter.toLowerCase()));
    const matchStatus  = selectedStatusFilter === 'All' || (t.status || '').toLowerCase() === selectedStatusFilter.toLowerCase();
    const matchSearch  = !searchQuery || t.task_name.toLowerCase().includes(searchQuery.toLowerCase()) || (t.assignee && t.assignee.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchProject && matchStatus && matchSearch;
  });

  const filteredResources = resources.filter(r => {
    const matchProject = selectedProjectFilter === 'All' || (r.project && r.project.toLowerCase().includes(selectedProjectFilter.toLowerCase()));
    const matchSearch  = !searchQuery || r.name.toLowerCase().includes(searchQuery.toLowerCase()) || (r.supplier && r.supplier.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchProject && matchSearch;
  });

  // Calculate project specific task stats
  const getProjectTaskStats = (prjCode: string, prjName: string) => {
    const prjTasks = tasks.filter(t => (t.project_code === prjCode) || (t.project_name === prjName) || (t.code === prjCode));
    const done = prjTasks.filter(t => (t.status || '').toLowerCase().includes('completed')).length;
    const total = prjTasks.length;
    const pct = total > 0 ? Math.round((done / total) * 100) : 0;
    return { done, total, pct };
  };

  const getProjectResourceCount = (prjName: string) => {
    return resources.filter(r => r.project && r.project.toLowerCase() === prjName.toLowerCase()).length;
  };

  return (
    <main className="main-content">
      {/* ── Header ── */}
      <header className="pm-header">
        <div>
          <h1 className="pm-title">Projects Hub</h1>
          <p className="pm-subtitle">Unified management for construction projects, tasks, and site resources</p>
        </div>
        <div className="pm-header-right">
          <ProfileDropdown userName={userName} userRole={userRole} />
        </div>
      </header>

      {/* ── Unified Switcher Tabs ── */}
      <div className="pm-hub-nav-bar">
        <div className="pm-hub-tabs">
          <button
            className={`pm-hub-tab ${activeView === 'projects' ? 'pm-hub-tab--active' : ''}`}
            onClick={() => setView('projects')}
          >
            🏢 Projects Overview ({projects.length})
          </button>
          <button
            className={`pm-hub-tab ${activeView === 'tasks' ? 'pm-hub-tab--active' : ''}`}
            onClick={() => setView('tasks')}
          >
            📋 All Tasks ({tasks.length})
          </button>
          <button
            className={`pm-hub-tab ${activeView === 'resources' ? 'pm-hub-tab--active' : ''}`}
            onClick={() => setView('resources')}
          >
            📦 All Resources ({resources.length})
          </button>
        </div>

        <button className="pm-new-btn" onClick={() => setShowModal(true)}>
          + New Project
        </button>
      </div>

      {/* ── View Controls & Filters ── */}
      <div className="pm-card">
        <div className="pm-card-header">
          <div className="flex gap-3 items-center flex-wrap">
            <input
              type="text"
              className="pd-search-input"
              placeholder={`Search ${activeView}…`}
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
            {activeView !== 'projects' && (
              <Dropdown
                options={projectOptions}
                value={selectedProjectFilter}
                onChange={setSelectedProjectFilter}
                prefix="Project"
              />
            )}
            <Dropdown
              options={statusOptions}
              value={selectedStatusFilter}
              onChange={setSelectedStatusFilter}
              prefix="Status"
            />
          </div>
        </div>

        {loading && <p className="pm-state-msg">Loading {activeView}…</p>}
        {error   && <p className="pm-state-msg pm-state-msg--error">{error}</p>}

        {/* ═══════════════════════════════════════════════════════════════════ */}
        {/* ── VIEW 1: PROJECTS OVERVIEW ──────────────────────────────────── */}
        {/* ═══════════════════════════════════════════════════════════════════ */}
        {!loading && !error && activeView === 'projects' && (
          filteredProjects.length === 0 ? (
            <p className="pm-state-msg">No projects match the selected filters.</p>
          ) : (
            <table className="pm-table">
              <thead>
                <tr>
                  <th>Project Code</th>
                  <th>Name &amp; Location</th>
                  <th>Client</th>
                  <th>Timeline</th>
                  <th>Budget</th>
                  <th>Task Progress</th>
                  <th>Resources</th>
                  <th>Status</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredProjects.map((prj) => {
                  const { done, total, pct } = getProjectTaskStats(prj.code, prj.name);
                  const resCount = getProjectResourceCount(prj.name);

                  return (
                    <tr key={prj.code}>
                      <td className="pm-td-bold">
                        <span className="pd-code-badge">{prj.code}</span>
                      </td>
                      <td>
                        <div style={{ fontWeight: 700, color: '#0f172a' }}>{prj.name}</div>
                        <div className="pm-td-muted" style={{ fontSize: '12px' }}>{prj.location}</div>
                      </td>
                      <td>{prj.client}</td>
                      <td className="pm-td-muted">{formatTimeline(prj.start_date, prj.end_date)}</td>
                      <td><strong>{formatBudget(prj.budget)}</strong></td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <div className="pd-progress-track" style={{ width: '80px', marginBottom: 0 }}>
                            <div className="pd-progress-fill" style={{ width: `${pct}%`, background: '#2563eb' }} />
                          </div>
                          <span style={{ fontSize: '12px', fontWeight: 600, color: '#475569' }}>
                            {done}/{total} ({pct}%)
                          </span>
                        </div>
                      </td>
                      <td>
                        <span style={{ fontSize: '12px', background: '#f1f5f9', padding: '3px 8px', borderRadius: '12px', fontWeight: 600 }}>
                          📦 {resCount} items
                        </span>
                      </td>
                      <td><span className={getStatusClass(prj.status)}>{prj.status}</span></td>
                      <td style={{ textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', gap: '6px' }}>
                          <button
                            className="pm-view-btn"
                            onClick={() => navigate(`/projects/${prj.code}?tab=overview`)}
                            title="Open Project Workspace"
                          >
                            Workspace →
                          </button>
                          <button
                            className="pd-btn-sm"
                            onClick={() => navigate(`/projects/${prj.code}?tab=tasks`)}
                            title="Open Tasks"
                          >
                            Tasks
                          </button>
                          <button
                            className="pd-btn-sm"
                            onClick={() => navigate(`/projects/${prj.code}?tab=resources`)}
                            title="Open Resources"
                          >
                            Resources
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )
        )}

        {/* ═══════════════════════════════════════════════════════════════════ */}
        {/* ── VIEW 2: GLOBAL TASKS ───────────────────────────────────────── */}
        {/* ═══════════════════════════════════════════════════════════════════ */}
        {!loading && !error && activeView === 'tasks' && (
          filteredTasks.length === 0 ? (
            <p className="pm-state-msg">No tasks found matching criteria.</p>
          ) : (
            <table className="pm-table">
              <thead>
                <tr>
                  <th>Task Name</th>
                  <th>Project</th>
                  <th>Phase</th>
                  <th>Assignee</th>
                  <th>Due Date</th>
                  <th>Priority</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredTasks.map((t) => (
                  <tr key={t.id}>
                    <td className="pm-td-bold">{t.task_name}</td>
                    <td>
                      <span className="pd-code-badge">{t.project_code || t.code || 'PRJ'}</span>{' '}
                      <span style={{ fontSize: '12px', color: '#475569' }}>{t.project_name}</span>
                    </td>
                    <td className="pm-td-muted">{t.phase}</td>
                    <td>{t.assignee || 'Unassigned'}</td>
                    <td className="pm-td-muted">
                      {t.due_date ? new Date(t.due_date).toLocaleDateString() : '—'}
                    </td>
                    <td>
                      <span className={`pd-priority-badge pd-priority--${(t.priority || 'medium').toLowerCase()}`}>
                        {t.priority || 'Medium'}
                      </span>
                    </td>
                    <td>
                      <span className={`pd-status-pill pd-status--${(t.status || 'pending').toLowerCase().replace(/\s+/g, '')}`}>
                        {t.status}
                      </span>
                    </td>
                    <td>
                      <button
                        className="pm-view-btn"
                        onClick={() => navigate(`/task/${t.id}`)}
                      >
                        Inspect
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )
        )}

        {/* ═══════════════════════════════════════════════════════════════════ */}
        {/* ── VIEW 3: GLOBAL RESOURCES ───────────────────────────────────── */}
        {/* ═══════════════════════════════════════════════════════════════════ */}
        {!loading && !error && activeView === 'resources' && (
          filteredResources.length === 0 ? (
            <p className="pm-state-msg">No resources found matching criteria.</p>
          ) : (
            <table className="pm-table">
              <thead>
                <tr>
                  <th>Resource Name</th>
                  <th>Category</th>
                  <th>Project Assigned</th>
                  <th>Supplier</th>
                  <th>Quantity / Unit</th>
                  <th>Threshold</th>
                  <th>Unit Price</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {filteredResources.map((r) => {
                  const isLow = (r.status || '').toLowerCase().includes('low');
                  return (
                    <tr key={r.id}>
                      <td className="pm-td-bold">{r.name}</td>
                      <td>
                        <span className={`pd-res-badge ${r.category === 'Material' ? 'pd-res-badge--mat' : 'pd-res-badge--equip'}`}>
                          {r.category}
                        </span>
                      </td>
                      <td><strong>{r.project || 'General / Unassigned'}</strong></td>
                      <td className="pm-td-muted">{r.supplier || '—'}</td>
                      <td><strong>{r.quantity}</strong> {r.unit}</td>
                      <td className="pm-td-muted">Min {r.minThreshold} {r.unit}</td>
                      <td>₱{Number(r.unitPrice).toLocaleString()}</td>
                      <td>
                        <span className={`pd-status-pill ${isLow ? 'pd-status--lowstock' : 'pd-status--instock'}`}>
                          {r.status || (isLow ? 'Low stock' : 'In stock')}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )
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

            <div className="pm-form-row pm-form-row--1">
              <div className="pm-form-group">
                <label>Location <span className="pm-required">*</span></label>
                <input
                  className="pm-input"
                  value={form.location}
                  onChange={e => setForm({ ...form, location: e.target.value })}
                  placeholder="Full address or site location"
                />
              </div>
            </div>

            <div className="pm-form-row pm-form-row--1">
              <div className="pm-form-group">
                <label>Project Scope <span className="pm-required">*</span></label>
                <textarea
                  className="pm-input pm-textarea"
                  value={form.scope}
                  onChange={e => setForm({ ...form, scope: e.target.value })}
                  placeholder="Detailed description of project scope, deliverables, and requirements"
                  rows={3}
                />
              </div>
            </div>

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
                <label>Budget (PHP) <span className="pm-required">*</span></label>
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
                <label>Initial Phase <span className="pm-required">*</span></label>
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
                {submitting ? 'Creating…' : 'Create Project'}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
};

export default Projects;
