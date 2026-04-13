import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import '../components/Dashboard.css';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL;

interface ProjectRecord {
  code: string;
  name: string;
  location: string;
  client: string;
  due_date: string;
  status: 'Completed' | 'Delayed' | 'At risk' | 'In Review' | 'ongoing';
  progress: string;
}

interface NewProjectForm {
  code: string;
  name: string;
  location: string;
  client: string;
  due_date: string;
  status: string;
  progress: string;
}

const emptyForm: NewProjectForm = {
  code: '', name: '', location: '', client: '',
  due_date: '', status: 'In Review', progress: '0%',
};

const Projects: React.FC = () => {
  const navigate = useNavigate();
  const [projects, setProjects] = useState<ProjectRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState<NewProjectForm>(emptyForm);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    fetchProjects();
  }, []);

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
    if (!form.code || !form.name || !form.location || !form.client || !form.due_date) {
      setFormError('Please fill in all required fields.');
      return;
    }

    try {
      setSubmitting(true);
      setFormError(null);
      const token = localStorage.getItem('token');
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
    const s = status.toLowerCase().replace(/\s/g, '');
    return `status-pill status-${s}`;
  };

  return (
    <main className="main-content">
      {/* Header */}
      <header className="header-top">
        <div className="flex items-center gap-4">
          <div className="back-btn" onClick={() => navigate('/dashboard')}>‹</div>
          <h1 className="page-title">Dashboard</h1>
        </div>
        <div className="flex items-center gap-4">
          <div className="search-bar"></div>
          <div className="profile-section">
            <img src="https://api.dicebear.com/7.x/avataaars/svg?seed=Alex" alt="Alex" className="user-avatar" />
            <div className="profile-info">
              <p className="profile-name">Alex meian</p>
              <p className="profile-role">Product manager</p>
            </div>
            <span className="chevron">▾</span>
          </div>
        </div>
      </header>

      {/* Table */}
      <div className="data-container" style={{ minHeight: '70vh' }}>
        <div className="flex justify-between items-center mb-8">
          <h2 className="section-title">Active Project Table</h2>
          <div className="flex gap-3">
            <button className="filter-btn">Project ▾</button>
            <button className="filter-btn">Status ▾</button>
            <button className="create-task-btn" onClick={() => setShowModal(true)}>
              + Create Project
            </button>
          </div>
        </div>

        {loading && <p style={{ color: '#888', textAlign: 'center', padding: '2rem' }}>Loading projects...</p>}
        {error   && <p style={{ color: '#e74c3c', textAlign: 'center', padding: '2rem' }}>{error}</p>}
        {!loading && !error && projects.length === 0 && (
          <p style={{ color: '#aaa', textAlign: 'center', padding: '2rem' }}>No projects found.</p>
        )}

        {!loading && !error && projects.length > 0 && (
          <table className="project-table">
            <thead>
              <tr>
                <th>Project Code</th>
                <th>Name</th>
                <th>Location</th>
                <th>Client</th>
                <th>Due date</th>
                <th>Status</th>
                <th>Progress</th>
              </tr>
            </thead>
            <tbody>
              {projects.map((prj) => (
                <tr
                  key={prj.code}
                  onClick={() => navigate(`/projects/${prj.code}`)}
                  className="clickable-row"
                  style={{ cursor: 'pointer' }}
                >
                  <td className="font-bold">{prj.code}</td>
                  <td style={{ color: '#555' }}>{prj.name}</td>
                  <td style={{ color: '#888' }}>{prj.location}</td>
                  <td style={{ color: '#555', maxWidth: '200px' }}>{prj.client}</td>
                  <td style={{ color: '#555' }}>{prj.due_date}</td>
                  <td><span className={getStatusClass(prj.status)}>{prj.status}</span></td>
                  <td className="font-bold text-right" style={{ color: '#aaa' }}>{prj.progress}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Create Project Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h2 className="modal-title">Create New Project</h2>
            <p className="modal-subtitle">Fill in the project details below</p>

            {formError && (
              <p style={{ color: 'red', fontSize: '13px', marginBottom: '12px' }}>⚠ {formError}</p>
            )}

            <div className="modal-form">
              <div className="form-row form-row--2">
                <div className="form-group">
                  <label>Project Code <span className="required">*</span></label>
                  <input className="form-input" value={form.code} onChange={e => setForm({ ...form, code: e.target.value })} placeholder="PRJ-2026-001" />
                </div>
                <div className="form-group">
                  <label>Status</label>
                  <div className="select-wrap">
                    <select className="form-select" value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}>
                      <option>In Review</option>
                      <option>Approved</option>
                      <option>At risk</option>
                      <option>Delayed</option>
                      <option>Completed</option>
                      <option>ongoing</option>
                    </select>
                  </div>
                </div>
              </div>

              <div className="form-row form-row--1">
                <div className="form-group">
                  <label>Project Name <span className="required">*</span></label>
                  <input className="form-input" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="e.g. Tower A: Foundation Works" />
                </div>
              </div>

              <div className="form-row form-row--2">
                <div className="form-group">
                  <label>Location <span className="required">*</span></label>
                  <input className="form-input" value={form.location} onChange={e => setForm({ ...form, location: e.target.value })} placeholder="123 Main Street, Cebu" />
                </div>
                <div className="form-group">
                  <label>Client <span className="required">*</span></label>
                  <input className="form-input" value={form.client} onChange={e => setForm({ ...form, client: e.target.value })} placeholder="Client name" />
                </div>
              </div>

              <div className="form-row form-row--2">
                <div className="form-group">
                  <label>Due Date <span className="required">*</span></label>
                  <input className="form-input" type="date" value={form.due_date} onChange={e => setForm({ ...form, due_date: e.target.value })} />
                </div>
                <div className="form-group">
                  <label>Progress</label>
                  <input className="form-input" value={form.progress} onChange={e => setForm({ ...form, progress: e.target.value })} placeholder="0%" />
                </div>
              </div>
            </div>

            <div className="modal-actions">
              <button className="btn-cancel" onClick={() => { setShowModal(false); setForm(emptyForm); setFormError(null); }}>
                Cancel
              </button>
              <button className="btn-confirm" onClick={handleCreateProject} disabled={submitting}>
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