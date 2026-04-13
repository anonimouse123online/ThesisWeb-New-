import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import '../components/CreateTask.css';

const API_URL = import.meta.env.VITE_BACKEND_URL;

const CreateTask: React.FC = () => {
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    taskName: '',
    phase: 'Phase 1 - Foundation',
    assignee: '',
    dueDate: '',
    priority: 'Medium',
    manpowerNeeded: 0,
    materialsRequired: '',
    siteInstructions: ''
  });

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch(`${API_URL}/tasks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const data = await res.json();

      if (!res.ok) throw new Error(data.error || 'Failed to create task');

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
          <div className="back-btn" onClick={() => navigate('/tasks')}>‹</div>
          <h1 className="page-title">Create New Task</h1>
        </div>
      </header>

      <div className="data-container create-task-container">
        <form className="task-form" onSubmit={handleSubmit}>
          <h2 className="form-section-title">Engineer's Task Brief</h2>

          {error && (
            <div style={{ color: 'red', marginBottom: '1rem', fontSize: '14px' }}>
              ⚠ {error}
            </div>
          )}

          <div className="form-grid">
            <div className="form-group">
              <label>Task Name / Description</label>
              <input
                type="text"
                placeholder="e.g., Concrete Pouring - Sector A"
                required
                onChange={(e) => setFormData({ ...formData, taskName: e.target.value })}
              />
            </div>

            <div className="form-group">
              <label>Project Phase</label>
              <select onChange={(e) => setFormData({ ...formData, phase: e.target.value })}>
                <option>Phase 1 - Foundation</option>
                <option>Phase 2 - Structural</option>
                <option>Phase 3 - Electrical</option>
              </select>
            </div>

            <div className="form-group">
              <label>Assignee (Engineer-in-Charge)</label>
              <input
                type="text"
                placeholder="Search team member..."
                onChange={(e) => setFormData({ ...formData, assignee: e.target.value })}
              />
            </div>

            <div className="form-group">
              <label>Due Date</label>
              <input
                type="date"
                required
                onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
              />
            </div>

            <div className="form-group">
              <label>Priority Level</label>
              <div className="priority-options">
                {['High', 'Medium', 'Low'].map(p => (
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

            <div className="form-group">
              <label>Estimated Manpower (Pax)</label>
              <input
                type="number"
                placeholder="0"
                onChange={(e) => setFormData({ ...formData, manpowerNeeded: parseInt(e.target.value) })}
              />
            </div>
          </div>

          <div className="form-full-width">
            <div className="form-group">
              <label>Required Materials & Equipment</label>
              <textarea
                placeholder="List required cement, rebar, or machinery..."
                rows={3}
                onChange={(e) => setFormData({ ...formData, materialsRequired: e.target.value })}
              ></textarea>
            </div>

            <div className="form-group">
              <label>Site Specific Instructions</label>
              <textarea
                placeholder="Safety precautions, geofence constraints, etc."
                rows={4}
                onChange={(e) => setFormData({ ...formData, siteInstructions: e.target.value })}
              ></textarea>
            </div>
          </div>

          <div className="form-actions">
            <button type="button" className="cancel-btn" onClick={() => navigate('/tasks')}>
              Cancel
            </button>
            <button type="submit" className="submit-btn" disabled={submitting}>
              {submitting ? 'Publishing...' : 'Publish Task to Site'}
            </button>
          </div>
        </form>
      </div>
    </main>
  );
};

export default CreateTask;