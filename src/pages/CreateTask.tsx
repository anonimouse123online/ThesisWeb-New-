import { getErrorMessage } from '../utils/errors';
import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import '../components/CreateTask.css';
import { API_BASE_URL, fetchWithAuth } from '../utils/api';
import { showToast } from '../utils/toast';
import { Package, Truck, Building2, X, AlertTriangle, Info } from 'lucide-react';
import Dropdown from '../components/Dropdown';

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
  start_date?: string;
  end_date?: string;
}

const toDateInputValue = (d?: string | null): string => {
  if (!d) return '';
  if (/^\d{4}-\d{2}-\d{2}/.test(d)) {
    return d.slice(0, 10);
  }
  try {
    const dt = new Date(d);
    if (isNaN(dt.getTime())) return '';
    const year = dt.getFullYear();
    const month = String(dt.getMonth() + 1).padStart(2, '0');
    const day = String(dt.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  } catch {
    return '';
  }
};

interface UserOption {
  id: string;
  full_name: string;
  role: string;
  system_role?: string;
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

interface ProjectResource {
  id: string | number;
  name: string;
  category?: AllocatedMaterial['category'] | null;
  supplier?: string | null;
  quantity: string | number;
  unit?: string | null;
  minThreshold?: string | number | null;
  unitPrice?: string | number | null;
}

interface ProjectMemberResponse {
  id: string;
  name?: string;
  full_name?: string;
  email: string;
  role?: string;
  system_role?: string;
}

const CreateTask: React.FC = () => {
  const navigate = useNavigate();

  const [projects, setProjects] = useState<ProjectOption[]>([]);
  const [users, setUsers]       = useState<UserOption[]>([]);

  const isEngineerUser = (u: { role?: string; system_role?: string }) => {
    const r = (u.role || '').toLowerCase();
    const sr = (u.system_role || '').toLowerCase();
    return r.includes('engineer') || sr.includes('engineer');
  };

  const formatUserRole = (role?: string, system_role?: string) => {
    const r = role || system_role || 'Engineer';
    if (r.toLowerCase() === 'engineer') return 'Engineer';
    if (r.toLowerCase() === 'site engineer') return 'Site Engineer';
    if (r.toLowerCase() === 'lead engineer') return 'Lead Engineer';
    if (r.toLowerCase() === 'admin') return 'Admin';
    return r;
  };

  const engineerUsers = useMemo(
    () => users.filter(isEngineerUser),
    [users]
  );
  const [loadingOptions, setLoadingOptions] = useState(true);
  const [projectResources, setProjectResources] = useState<ProjectResource[]>([]);

  const [formData, setFormData] = useState({
    taskName: '',
    projectId: '',
    phase: 'Phase 1 - Foundation',
    assigneeId: '',
    startDate: '',
    dueDate: '',
    priority: 'Medium',
    manpowerNeeded: 1,
    materialsRequired: '',
    siteInstructions: '',
  });

  const selectedProject = useMemo(() => {
    return projects.find(
      p => String(p.id) === String(formData.projectId) || p.code === formData.projectId
    );
  }, [projects, formData.projectId]);

  const projectMinDate = toDateInputValue(selectedProject?.start_date);
  const projectMaxDate = toDateInputValue(selectedProject?.end_date);
  const todayStr = new Date().toISOString().split('T')[0];
  const minStartDate = projectMinDate && projectMinDate > todayStr ? projectMinDate : todayStr;

  const [subtasks, setSubtasks] = useState<{ id: string; title: string; completed: boolean }[]>([]);
  const [subtaskInput, setSubtaskInput] = useState('');

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
        const pRes = await fetchWithAuth(`${API_URL}/projects`);
        if (pRes.ok) {
          const pJson = await pRes.json();
          const pList = pJson.data || pJson || [];
          setProjects(pList);
          if (pList.length > 0) {
            setFormData(prev => prev.projectId ? prev : { ...prev, projectId: pList[0].id });
          }
        }
      } catch (err: unknown) {
        console.error('Failed to load options', err);
      } finally {
        setLoadingOptions(false);
      }
    };

    fetchOptions();
  }, []);

  // Keep task dates strictly inside project timeline (only if date entered)
  useEffect(() => {
    if (!selectedProject) return;
    const minD = toDateInputValue(selectedProject.start_date);
    const maxD = toDateInputValue(selectedProject.end_date);

    setFormData(prev => {
      let initialStart = prev.startDate;
      if (initialStart) {
        if (minD && initialStart < minD) initialStart = minD;
        if (maxD && initialStart > maxD) initialStart = maxD;
      }

      let initialDue = prev.dueDate;
      if (initialDue) {
        if (maxD && initialDue > maxD) initialDue = maxD;
        if (minD && initialDue < minD) initialDue = minD;
        if (initialStart && initialDue < initialStart) initialDue = initialStart;
      }

      if (initialStart === prev.startDate && initialDue === prev.dueDate) return prev;
      return {
        ...prev,
        startDate: initialStart,
        dueDate: initialDue
      };
    });
  }, [selectedProject]);

  useEffect(() => {
    if (!formData.projectId) return;

    // Fetch resources for this project
    fetchWithAuth(`${API_URL}/resources?project_id=${formData.projectId}`)
      .then(res => (res.ok ? res.json() : null))
      .then(data => {
        if (data) {
          const list = data.data || data || [];
          setProjectResources(Array.isArray(list) ? list : []);
        }
      })
      .catch(() => {});

    // Fetch members invited to this project
    const selectedProj = projects.find(p => String(p.id) === String(formData.projectId) || p.code === formData.projectId);
    const projCode = selectedProj?.code || formData.projectId;

    fetchWithAuth(`${API_URL}/projects/${projCode}/members`)
      .then(res => (res.ok ? res.json() : null))
      .then(mJson => {
        if (mJson && Array.isArray(mJson.data)) {
          const members: UserOption[] = mJson.data.map((m: ProjectMemberResponse) => ({
            id: m.id,
            full_name: m.name || m.full_name || m.email,
            email: m.email || '',
            role: m.role || 'Member',
            system_role: m.system_role || '',
          }));
          setUsers(members);
          const engineers = members.filter(isEngineerUser);
          if (engineers.length > 0) {
            setFormData(prev => ({
              ...prev,
              assigneeId: engineers.some(u => u.id === prev.assigneeId) ? prev.assigneeId : engineers[0].id,
            }));
          } else {
            setFormData(prev => ({ ...prev, assigneeId: '' }));
          }
        }
      })
      .catch(() => {});
  }, [formData.projectId, projects]);

  const formatMaterialsString = (items: AllocatedMaterial[]) => {
    return items
      .map(item => {
        const qty = item.quantity ? `${item.quantity} ` : '';
        const unit = item.unit ? `${item.unit} ` : '';
        const name = (item.name || '').trim();
        return `${qty}${unit}${name}`.trim();
      })
      .filter(Boolean)
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
    if (!formData.startDate) {
      setError('Start date is required.');
      return;
    }
    if (formData.startDate < todayStr) {
      setError('Start date cannot be a past date.');
      return;
    }
    if (!formData.dueDate) {
      setError('Due date is required.');
      return;
    }
    if (formData.dueDate < formData.startDate) {
      setError('Due date cannot be earlier than start date.');
      return;
    }
    if (formData.dueDate < todayStr) {
      setError('Due date cannot be a past date.');
      return;
    }
    if (projectMinDate && formData.startDate < projectMinDate) {
      setError(`Task start date cannot be earlier than project start date (${projectMinDate}).`);
      return;
    }
    if (projectMaxDate && formData.startDate > projectMaxDate) {
      setError(`Task start date cannot exceed project end date (${projectMaxDate}).`);
      return;
    }
    if (projectMinDate && formData.dueDate < projectMinDate) {
      setError(`Task due date cannot be earlier than project start date (${projectMinDate}).`);
      return;
    }
    if (projectMaxDate && formData.dueDate > projectMaxDate) {
      setError(`Task due date cannot exceed project end date (${projectMaxDate}).`);
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
        body: JSON.stringify({ ...formData, allocatedMaterials, subtasks }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create task');

      showToast('Task created and published successfully!', 'success');
      navigate('/tasks');
    } catch (err: unknown) {
      setError(getErrorMessage(err));
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
              <Dropdown
                fullWidth
                disabled={loadingOptions}
                searchable={projects.length > 5}
                options={projects.map((p) => ({ value: p.id, label: `${p.code} — ${p.name}` }))}
                value={formData.projectId}
                onChange={(val) => setFormData((prev) => ({ ...prev, projectId: val }))}
                placeholder={loadingOptions ? 'Loading projects…' : 'Select a project'}
              />
            </div>

            {/* Project Phase */}
            <div className="form-group">
              <label>Project Phase *</label>
              <Dropdown
                fullWidth
                options={PHASES.map((ph) => ({ value: ph, label: ph }))}
                value={formData.phase}
                onChange={(val) => setFormData((prev) => ({ ...prev, phase: val }))}
                placeholder="Select a phase"
              />
            </div>

            {/* Assignee */}
            <div className="form-group">
              <label>Assign Lead Engineer *</label>
              <Dropdown
                fullWidth
                disabled={loadingOptions}
                searchable={engineerUsers.length > 5}
                options={
                  engineerUsers.length === 0
                    ? [{ value: '', label: 'No engineers assigned to this project', disabled: true }]
                    : engineerUsers.map((u) => ({
                        value: u.id,
                        label: `${u.full_name} (${formatUserRole(u.role, u.system_role)})`
                      }))
                }
                value={formData.assigneeId}
                onChange={(val) => setFormData((prev) => ({ ...prev, assigneeId: val }))}
                placeholder={loadingOptions ? 'Loading engineers…' : 'Select an engineer'}
              />
            </div>

            {/* Start Date */}
            <div className="form-group">
              <label>
                Start Date *
                {minStartDate && (
                  <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 500, marginLeft: '4px' }}>
                    (From {minStartDate})
                  </span>
                )}
              </label>
              <input
                type="date"
                min={minStartDate}
                max={projectMaxDate || undefined}
                required
                value={formData.startDate}
                onChange={(e) => {
                  const val = e.target.value;
                  if (minStartDate && val && val < minStartDate) return;
                  if (projectMaxDate && val && val > projectMaxDate) return;
                  setFormData(prev => ({
                    ...prev,
                    startDate: val,
                    dueDate: prev.dueDate && val && prev.dueDate < val ? val : prev.dueDate
                  }));
                }}
              />
            </div>

            {/* Due Date */}
            <div className="form-group">
              <label>
                Due Date *
                {projectMaxDate && (
                  <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 500, marginLeft: '4px' }}>
                    (Project ends: {projectMaxDate})
                  </span>
                )}
              </label>
              <input
                type="date"
                min={formData.startDate ? (minStartDate && minStartDate > formData.startDate ? minStartDate : formData.startDate) : minStartDate}
                max={projectMaxDate || undefined}
                required
                value={formData.dueDate}
                onChange={(e) => {
                  const val = e.target.value;
                  if (projectMaxDate && val && val > projectMaxDate) return;
                  if (minStartDate && val && val < minStartDate) return;
                  setFormData(prev => ({ ...prev, dueDate: val }));
                }}
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
              <label>Estimated Manpower (Workers Needed)</label>
              <input
                type="number"
                min="0"
                placeholder="e.g. 5 (optional)"
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
                          const match = projectResources.find((r) => (r.name || '').toLowerCase() === val.toLowerCase());
                          if (match) {
                            setMatItemInput(prev => ({
                              ...prev,
                              name: val,
                              category: match.category || prev.category,
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
                        {projectResources.map((res) => (
                          <option key={res.id} value={res.name}>
                            {res.category} ({res.quantity} {res.unit} in stock — {res.supplier || 'General'})
                          </option>
                        ))}
                      </datalist>
                    </div>

                    <div className="pm-mat-field">
                      <label className="pm-mat-label">Category <span className="pm-required">*</span></label>
                      <Dropdown
                        fullWidth
                        size="sm"
                        options={[
                          { value: 'Material', label: 'Material' },
                          { value: 'Equipment', label: 'Equipment' }
                        ]}
                        value={matItemInput.category}
                        onChange={(val) => setMatItemInput((prev) => ({ ...prev, category: val as 'Material' | 'Equipment' }))}
                        placeholder="Select category"
                      />
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

            {/* Subtasks / Execution Steps */}
            <div className="form-group">
              <label>Execution Steps / Subtasks (Optional)</label>
              <p className="pm-mat-hint" style={{ marginBottom: '8px' }}>Add checklist items or step-by-step milestones for site workers to complete</p>
              <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                <input
                  type="text"
                  placeholder="e.g., Pour concrete foundation, Inspect steel rebar..."
                  value={subtaskInput}
                  onChange={(e) => setSubtaskInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      if (subtaskInput.trim()) {
                        setSubtasks((prev) => [
                          ...prev,
                          { id: `${Date.now()}_${Math.random().toString(36).substr(2, 6)}`, title: subtaskInput.trim(), completed: false },
                        ]);
                        setSubtaskInput('');
                      }
                    }
                  }}
                />
                <button
                  type="button"
                  className="submit-btn"
                  style={{ whiteSpace: 'nowrap', padding: '0 16px', fontSize: '13px' }}
                  onClick={() => {
                    if (subtaskInput.trim()) {
                      setSubtasks((prev) => [
                        ...prev,
                        { id: `${Date.now()}_${Math.random().toString(36).substr(2, 6)}`, title: subtaskInput.trim(), completed: false },
                      ]);
                      setSubtaskInput('');
                    }
                  }}
                >
                  + Add Step
                </button>
              </div>
              {subtasks.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '6px' }}>
                  {subtasks.map((st, idx) => (
                    <div
                      key={st.id}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        background: '#f8fafc',
                        border: '1px solid #e2e8f0',
                        borderRadius: '6px',
                        padding: '8px 12px',
                        fontSize: '13px',
                      }}
                    >
                      <span style={{ fontWeight: 500, color: '#1e293b' }}>{idx + 1}. {st.title}</span>
                      <button
                        type="button"
                        style={{
                          background: 'none',
                          border: 'none',
                          color: '#ef4444',
                          cursor: 'pointer',
                          fontWeight: 700,
                          fontSize: '16px',
                          display: 'flex',
                          alignItems: 'center',
                        }}
                        onClick={() => setSubtasks((prev) => prev.filter((s) => s.id !== st.id))}
                        title="Remove subtask"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
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
