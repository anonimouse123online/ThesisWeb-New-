import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import '../components/CreateTask.css';
import { API_BASE_URL, fetchWithAuth } from '../utils/api';
import { showToast } from '../components/Toast';

const API_URL = API_BASE_URL;

const PHASES = [
  'Phase 1 - Foundation',
  'Phase 2 - Structural',
  'Phase 3 - Electrical & Utilities',
  'Phase 4 - Plumbing & MEP',
  'Phase 5 - Finishing',
];

interface ProjectOption {
  id: string;
  code: string;
  name: string;
}

interface UserOption {
  id: string;
  full_name: string;
  role: string;
}

const CreateTask: React.FC = () => {
  const navigate = useNavigate();

  const [projects, setProjects] = useState<ProjectOption[]>([]);
  const [users, setUsers]       = useState<UserOption[]>([]);
  const [loadingOptions, setLoadingOptions] = useState(true);

  const [formData, setFormData] = useState({
    taskName: '',
    projectId: '',
    phase: 'Phase 1 - Foundation',
    assigneeId: '',
    dueDate: '',
    priority: 'Medium',
    manpowerNeeded: 5,
    materialsRequired: '',
    siteInstructions: '',
  });

  const [submitting, setSubmitting] = useState(false);
  const [error, setError]           = useState<string | null>(null);

  useEffect(() => {
    const fetchOptions = async () => {
      try {
        const [pRes, uRes] = await Promise.all([
          fetchWithAuth(`${API_URL}/projects`),
          fetchWithAuth(`${API_URL}/users`),
        ]);

        if (pRes.ok) {
          const pJson = await pRes.json();
          const pList = pJson.data || pJson || [];
          setProjects(pList);
          if (pList.length > 0 && !formData.projectId) {
            setFormData(prev => ({ ...prev, projectId: pList[0].id }));
          }
        }

        if (uRes.ok) {
          const uJson = await uRes.json();
          const uList = uJson.data || uJson || [];
          setUsers(uList);
          if (uList.length > 0 && !formData.assigneeId) {
            setFormData(prev => ({ ...prev, assigneeId: uList[0].id }));
          }
        }
      } catch (err: any) {
        console.error('Failed to load options', err);
      } finally {
        setLoadingOptions(false);
      }
    };

    fetchOptions();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.taskName.trim()) {
      setError('Task name is required.');
      return;
    }
    if (!formData.projectId) {
      setError('Please select a target project.');
      return;
    }
    if (!formData.phase) {
      setError('Project phase is required.');
      return;
    }
    if (!formData.assigneeId) {
      setError('Please select an assignee engineer.');
      return;
    }
    if (!formData.dueDate) {
      setError('Due date is required.');
      return;
    }
    if (!formData.manpowerNeeded || formData.manpowerNeeded <= 0) {
      setError('Estimated manpower is required (e.g. 5 workers).');
      return;
    }
    if (!formData.materialsRequired.trim()) {
      setError('Required materials & equipment is required.');
      return;
    }
    if (!formData.siteInstructions.trim()) {
      setError('Site specific instructions are required.');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const res = await fetchWithAuth(`${API_URL}/tasks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create task');

      showToast('Task created and published successfully!', 'success');
      navigate('/tasks');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="main-content">
      <header className="header-top">
        <div className="flex items-center gap-4">
          <div className="back-btn" onClick={() => navigate('/tasks')} style={{ cursor: 'pointer' }}>‹</div>
          <h1 className="page-title">Create New Task</h1>
        </div>
      </header>

      <div className="data-container create-task-container">
        <form className="task-form" onSubmit={handleSubmit}>
          <h2 className="form-section-title">Engineer's Task Brief</h2>

          {error && (
            <div style={{ color: '#dc2626', background: '#fee2e2', padding: '10px 14px', borderRadius: '8px', marginBottom: '1.2rem', fontSize: '13px' }}>
              ⚠ {error}
            </div>
          )}

          <div className="form-grid">
            {/* Task Name */}
            <div className="form-group">
              <label>Task Name / Description *</label>
              <input
                type="text"
                placeholder="e.g., Concrete Pouring - Sector A"
                value={formData.taskName}
                required
                onChange={(e) => setFormData({ ...formData, taskName: e.target.value })}
              />
            </div>

            {/* Target Project */}
            <div className="form-group">
              <label>Target Project *</label>
              <select
                value={formData.projectId}
                required
                disabled={loadingOptions}
                onChange={(e) => setFormData({ ...formData, projectId: e.target.value })}
              >
                <option value="" disabled>{loadingOptions ? 'Loading projects…' : 'Select a project'}</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>{p.code} — {p.name}</option>
                ))}
              </select>
            </div>

            {/* Project Phase */}
            <div className="form-group">
              <label>Project Phase *</label>
              <select
                value={formData.phase}
                required
                onChange={(e) => setFormData({ ...formData, phase: e.target.value })}
              >
                {PHASES.map((ph) => (
                  <option key={ph} value={ph}>{ph}</option>
                ))}
              </select>
            </div>

            {/* Assignee */}
            <div className="form-group">
              <label>Assignee (Engineer / Team Member) *</label>
              <select
                value={formData.assigneeId}
                required
                disabled={loadingOptions}
                onChange={(e) => setFormData({ ...formData, assigneeId: e.target.value })}
              >
                <option value="" disabled>{loadingOptions ? 'Loading engineers…' : 'Select an engineer'}</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>{u.full_name} ({u.role})</option>
                ))}
              </select>
            </div>

            {/* Due Date */}
            <div className="form-group">
              <label>Due Date *</label>
              <input
                type="date"
                required
                value={formData.dueDate}
                onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
              />
            </div>

            {/* Priority */}
            <div className="form-group">
              <label>Priority Level *</label>
              <div className="priority-options">
                {['High', 'Medium', 'Low'].map((p) => (
                  <button
                    key={p}
                    type="button"
                    className={`priority-btn ${formData.priority === p ? 'active' : ''}`}
                    onClick={() => setFormData({ ...formData, priority: p })}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>

            {/* Manpower */}
            <div className="form-group">
              <label>Estimated Manpower (Workers Needed) *</label>
              <input
                type="number"
                min="1"
                placeholder="e.g. 5"
                required
                value={formData.manpowerNeeded || ''}
                onChange={(e) => setFormData({ ...formData, manpowerNeeded: parseInt(e.target.value) || 0 })}
              />
            </div>
          </div>

          <div className="form-full-width">
            <div className="form-group">
              <label>Required Materials & Equipment *</label>
              <textarea
                placeholder="List required cement, rebar, excavators, or scaffolding..."
                rows={3}
                required
                value={formData.materialsRequired}
                onChange={(e) => setFormData({ ...formData, materialsRequired: e.target.value })}
              />
            </div>

            <div className="form-group">
              <label>Site Specific Instructions *</label>
              <textarea
                placeholder="Safety precautions, QA checks, inspection schedules..."
                rows={3}
                required
                value={formData.siteInstructions}
                onChange={(e) => setFormData({ ...formData, siteInstructions: e.target.value })}
              />
            </div>
          </div>

          <div className="form-actions">
            <button type="button" className="cancel-btn" onClick={() => navigate('/tasks')}>
              Cancel
            </button>
            <button type="submit" className="submit-btn" disabled={submitting}>
              {submitting ? 'Publishing Task…' : '+ Publish Task to Site'}
            </button>
          </div>
        </form>
      </div>
    </main>
  );
};

export default CreateTask;