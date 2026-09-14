import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import '../components/CreateTask.css';
import { API_BASE_URL, fetchWithAuth } from '../utils/api';
import { showToast } from '../components/Toast';
import { Package, Truck, Building2, X, AlertTriangle, Info } from 'lucide-react';

const API_URL = API_BASE_URL;

const PHASES = [
  'Foundation',
  'Structural',
  'Electrical & Utilities',
  'Plumbing & MEP',
  'Finishing',
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

interface AllocatedMaterial {
  id: string;
  name: string;
  category: 'Material' | 'Equipment';
  supplier?: string;
  quantity: string;
  unit: string;
  minThreshold?: string;
  unitPrice?: string;
}

const CreateTask: React.FC = () => {
  const navigate = useNavigate();

  const [projects, setProjects] = useState<ProjectOption[]>([]);
  const [users, setUsers]       = useState<UserOption[]>([]);
  const [loadingOptions, setLoadingOptions] = useState(true);
  const [projectResources, setProjectResources] = useState<any[]>([]);

  const [formData, setFormData] = useState({
    taskName: '',
    projectId: '',
    phase: 'Foundation',
    assigneeId: '',
    dueDate: '',
    priority: 'Medium',
    manpowerNeeded: 1,
    materialsRequired: '',
    siteInstructions: '',
  });

  const [allocatedMaterials, setAllocatedMaterials] = useState<AllocatedMaterial[]>([]);
  const [matItemInput, setMatItemInput] = useState<{
    name: string;
    category: 'Material' | 'Equipment';
    supplier: string;
    quantity: string;
    unit: string;
    minThreshold: string;
    unitPrice: string;
  }>({
    name: '',
    category: 'Material',
    supplier: '',
    quantity: '',
    unit: 'bags',
    minThreshold: '10',
    unitPrice: '',
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

  const todayStr = new Date().toISOString().split('T')[0];

  useEffect(() => {
    if (!formData.projectId) return;
    fetchWithAuth(`${API_URL}/resources?project_id=${formData.projectId}`)
      .then(res => (res.ok ? res.json() : null))
      .then(data => {
        if (data) {
          const list = data.data || data || [];
          setProjectResources(Array.isArray(list) ? list : []);
        }
      })
      .catch(() => {});
  }, [formData.projectId]);

  const formatMaterialsString = (items: AllocatedMaterial[]) => {
    return items
      .map(item => {
        let details = [];
        if (item.supplier && item.supplier !== 'General Supplier') details.push(item.supplier);
        if (item.unitPrice && Number(item.unitPrice) > 0) details.push(`₱${item.unitPrice}`);
        const extra = details.length ? ` - ${details.join(', ')}` : '';
        return `${item.quantity ? item.quantity + ' ' : ''}${item.unit ? item.unit + ' ' : ''}${item.name} (${item.category}${extra})`.trim();
      })
      .join(', ');
  };

  const handleAddMaterialItem = () => {
    if (!matItemInput.name.trim()) return;
    const newItem: AllocatedMaterial = {
      id: `${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      name: matItemInput.name.trim(),
      category: matItemInput.category,
      supplier: matItemInput.supplier.trim() || 'General Supplier',
      quantity: matItemInput.quantity.trim() || '1',
      unit: matItemInput.unit.trim() || (matItemInput.category === 'Material' ? 'bags' : 'units'),
      minThreshold: matItemInput.minThreshold.trim() || '10',
      unitPrice: matItemInput.unitPrice.trim() || '0',
    };
    const updated = [...allocatedMaterials, newItem];
    setAllocatedMaterials(updated);
    setFormData(prev => ({
      ...prev,
      materialsRequired: formatMaterialsString(updated),
    }));
    setMatItemInput(prev => ({
      name: '',
      category: prev.category,
      supplier: '',
      quantity: '',
      unit: prev.unit || 'bags',
      minThreshold: '10',
      unitPrice: '',
    }));
  };

  const handleRemoveMaterialItem = (id: string) => {
    const updated = allocatedMaterials.filter(m => m.id !== id);
    setAllocatedMaterials(updated);
    setFormData(prev => ({
      ...prev,
      materialsRequired: formatMaterialsString(updated),
    }));
  };

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
    if (formData.dueDate < todayStr) {
      setError('Due date cannot be a past date.');
      return;
    }
    if (!formData.manpowerNeeded || formData.manpowerNeeded <= 0) {
      setError('Estimated manpower is required (e.g. 5 workers).');
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
        body: JSON.stringify({ ...formData, allocatedMaterials }),
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
            <div style={{ color: '#dc2626', background: '#fee2e2', padding: '10px 14px', borderRadius: '8px', marginBottom: '1.2rem', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <AlertTriangle size={16} />
              <span>{error}</span>
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
                min={todayStr}
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
              <div className="pm-mat-section-header">
                <label className="pm-mat-main-label" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Package size={18} />
                  <span>Materials &amp; Resources Required *</span>
                </label>
                <p className="pm-mat-hint">Allocate specific materials, tools, or equipment needed for this task</p>
              </div>

              <div className="pm-mat-builder-panel">
                <div className="pm-mat-inputs-stack">
                  {/* Row 1: Item Name, Category, Supplier */}
                  <div className="pm-mat-row-1">
                    <div className="pm-mat-field">
                      <label className="pm-mat-label">Resource / Item Name <span className="pm-required">*</span></label>
                      <input
                        type="text"
                        className="pm-mat-input"
                        list="ct-project-stock-options"
                        placeholder="e.g., Portland Cement Type 1"
                        value={matItemInput.name}
                        onChange={e => {
                          const val = e.target.value;
                          const match = projectResources.find((r: any) => (r.name || '').toLowerCase() === val.toLowerCase());
                          if (match) {
                            setMatItemInput(prev => ({
                              ...prev,
                              name: val,
                              category: (match.category as any) || prev.category,
                              supplier: match.supplier || prev.supplier,
                              unit: match.unit || prev.unit,
                              minThreshold: match.minThreshold !== undefined ? String(match.minThreshold) : prev.minThreshold,
                              unitPrice: match.unitPrice !== undefined ? String(match.unitPrice) : prev.unitPrice,
                            }));
                          } else {
                            setMatItemInput(prev => ({ ...prev, name: val }));
                          }
                        }}
                        onKeyDown={e => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            handleAddMaterialItem();
                          }
                        }}
                      />
                      <datalist id="ct-project-stock-options">
                        {projectResources.map((res: any) => (
                          <option key={res.id} value={res.name}>
                            {res.category} ({res.quantity} {res.unit} in stock — {res.supplier || 'General'})
                          </option>
                        ))}
                      </datalist>
                    </div>

                    <div className="pm-mat-field">
                      <label className="pm-mat-label">Category <span className="pm-required">*</span></label>
                      <select
                        className="pm-mat-input"
                        value={matItemInput.category}
                        onChange={e => setMatItemInput(prev => ({ ...prev, category: e.target.value as 'Material' | 'Equipment' }))}
                      >
                        <option value="Material">Material</option>
                        <option value="Equipment">Equipment</option>
                      </select>
                    </div>

                    <div className="pm-mat-field">
                      <label className="pm-mat-label">Supplier / Vendor</label>
                      <input
                        type="text"
                        className="pm-mat-input"
                        placeholder="e.g., Eagle Cement Corp"
                        value={matItemInput.supplier}
                        onChange={e => setMatItemInput(prev => ({ ...prev, supplier: e.target.value }))}
                        onKeyDown={e => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            handleAddMaterialItem();
                          }
                        }}
                      />
                    </div>
                  </div>

                  {/* Row 2: Quantity, Unit, Min Threshold, Unit Price, Add Button */}
                  <div className="pm-mat-row-2">
                    <div className="pm-mat-field">
                      <label className="pm-mat-label">Quantity <span className="pm-required">*</span></label>
                      <input
                        type="number"
                        min="0"
                        step="any"
                        className="pm-mat-input"
                        placeholder="e.g., 500"
                        value={matItemInput.quantity}
                        onChange={e => setMatItemInput(prev => ({ ...prev, quantity: e.target.value }))}
                        onKeyDown={e => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            handleAddMaterialItem();
                          }
                        }}
                      />
                    </div>

                    <div className="pm-mat-field">
                      <label className="pm-mat-label">Unit</label>
                      <input
                        type="text"
                        className="pm-mat-input"
                        list="ct-common-units-list"
                        placeholder="bags, tons..."
                        value={matItemInput.unit}
                        onChange={e => setMatItemInput(prev => ({ ...prev, unit: e.target.value }))}
                        onKeyDown={e => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            handleAddMaterialItem();
                          }
                        }}
                      />
                      <datalist id="ct-common-units-list">
                        <option value="bags" />
                        <option value="tons" />
                        <option value="pcs" />
                        <option value="units" />
                        <option value="kg" />
                        <option value="meters" />
                        <option value="liters" />
                        <option value="sets" />
                        <option value="rolls" />
                        <option value="cu.m" />
                      </datalist>
                    </div>

                    <div className="pm-mat-field">
                      <label className="pm-mat-label">Min Threshold</label>
                      <input
                        type="number"
                        min="0"
                        className="pm-mat-input"
                        placeholder="e.g., 10"
                        value={matItemInput.minThreshold}
                        onChange={e => setMatItemInput(prev => ({ ...prev, minThreshold: e.target.value }))}
                        onKeyDown={e => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            handleAddMaterialItem();
                          }
                        }}
                      />
                    </div>

                    <div className="pm-mat-field">
                      <label className="pm-mat-label">Unit Price (PHP)</label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        className="pm-mat-input"
                        placeholder="e.g., 280.00"
                        value={matItemInput.unitPrice}
                        onChange={e => setMatItemInput(prev => ({ ...prev, unitPrice: e.target.value }))}
                        onKeyDown={e => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            handleAddMaterialItem();
                          }
                        }}
                      />
                    </div>

                    <button
                      type="button"
                      className="pm-mat-add-btn"
                      onClick={handleAddMaterialItem}
                      disabled={!matItemInput.name.trim()}
                    >
                      + Add Resource
                    </button>
                  </div>
                </div>

                {/* Allocated Resources List */}
                {allocatedMaterials.length > 0 ? (
                  <div className="pm-allocated-mat-list">
                    {allocatedMaterials.map(mat => (
                      <div key={mat.id} className="pm-allocated-mat-chip">
                        <span className="pm-allocated-mat-icon">
                          {mat.category === 'Equipment' ? <Truck size={15} /> : <Package size={15} />}
                        </span>
                        <div className="pm-allocated-mat-info">
                          <span className="pm-allocated-mat-name">{mat.name}</span>
                          {mat.quantity && (
                            <span className="pm-allocated-mat-badge">
                              {mat.quantity} {mat.unit || ''}
                            </span>
                          )}
                          <span className={`pm-allocated-cat-badge pm-allocated-cat--${mat.category.toLowerCase()}`}>
                            {mat.category}
                          </span>
                          {mat.supplier && mat.supplier !== 'General Supplier' && (
                            <span className="pm-allocated-mat-detail" title="Supplier" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                              <Building2 size={12} /> {mat.supplier}
                            </span>
                          )}
                          {mat.unitPrice && Number(mat.unitPrice) > 0 && (
                            <span className="pm-allocated-mat-detail" title="Unit Price">
                              ₱{Number(mat.unitPrice).toLocaleString()}
                            </span>
                          )}
                          {mat.minThreshold && Number(mat.minThreshold) > 0 && (
                            <span className="pm-allocated-mat-detail" title="Threshold">
                              Min {mat.minThreshold}
                            </span>
                          )}
                        </div>
                        <button
                          type="button"
                          className="pm-allocated-mat-remove"
                          onClick={() => handleRemoveMaterialItem(mat.id)}
                          title="Remove resource"
                        >
                          <X size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="pm-mat-empty-state">
                    <Info size={16} />
                    <span>No materials or equipment added yet. Fill in the fields above and click "+ Add Resource" to allocate.</span>
                  </div>
                )}
              </div>
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