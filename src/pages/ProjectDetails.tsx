import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import '../components/ProjectDetails.css';
import { API_BASE_URL, fetchWithAuth } from '../utils/api';
import ProfileDropdown from '../components/ProfileDropdown';
import { showToast } from '../components/Toast';
import {
  LayoutDashboard,
  ClipboardList,
  Boxes,
  Users,
  FolderClosed,
  FileText,
  AlertTriangle,
  BarChart3,
  DollarSign,
  HardHat,
  Package,
  Truck,
  Building2,
  X,
  Check,
  CheckCircle2,
  Clock,
  UserPlus,
  Play,
  ChevronDown,
  ChevronRight,
  ArrowRight,
  Info
} from 'lucide-react';

const API_URL = API_BASE_URL;

// ─── Interfaces ───────────────────────────────────────────────────────────────

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
  progress_pct?: number;
}

interface TeamMember {
  id: string;
  name: string;
  role: string;
  email?: string;
}

interface SubTask {
  id: string;
  title: string;
  completed: boolean;
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

interface TaskItem {
  id: string | number;
  task_name: string;
  phase: string;
  assignee: string;
  due_date: string;
  priority: 'High' | 'Medium' | 'Low';
  status: string;
  manpower_needed: string;
  materials_required: string;
  site_instructions: string;
  subtasks?: SubTask[];
  progress_pct?: number;
  images?: string[];
  project_id?: string;
  project_code?: string;
}

interface ResourceItem {
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
  updatedAt: string;
}

interface UserOption {
  id: string;
  full_name: string;
  email: string;
  role: string;
}

const PHASES = [
  'Foundation',
  'Structural',
  'Electrical & Utilities',
  'Plumbing & MEP',
  'Finishing',
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function normalizePhase(raw?: string): string {
  if (!raw) return PHASES[0];
  const s = raw.toLowerCase().trim();
  if (s.includes('phase 1') || s.includes('foundation')) return PHASES[0];
  if (s.includes('phase 2') || s.includes('structur') || s.includes('structure')) return PHASES[1];
  if (s.includes('phase 3') || s.includes('utilit') || s.includes('electr')) return PHASES[2];
  if (s.includes('phase 4') || s.includes('plumb') || s.includes('mep')) return PHASES[3];
  if (s.includes('phase 5') || s.includes('finish')) return PHASES[4];
  return raw.replace(/^Phase\s*\d+\s*[-–:]\s*/i, '').trim() || raw;
}

function getInitials(name?: string): string {
  if (!name) return '?';
  return name.split(' ').slice(0, 2).map(n => n[0]?.toUpperCase()).join('');
}

function avatarColor(name: string): string {
  const colors = ['#6366f1', '#f59e0b', '#10b981', '#3b82f6', '#ec4899', '#8b5cf6', '#14b8a6', '#f97316'];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
}

const formatBudget = (b: string | number) => {
  const n = parseFloat(String(b));
  if (isNaN(n)) return b;
  return `₱${(n / 1_000_000).toFixed(2)}M`;
};

const formatCurrency = (n: number) => {
  return '₱' + (n || 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

const formatTimeline = (start: string, end: string) => {
  if (!start || !end) return '—';
  const fmt = (d: string) => {
    const dt = new Date(d);
    return `${(dt.getMonth() + 1).toString().padStart(2, '0')}/${dt.getDate().toString().padStart(2, '0')}/${String(dt.getFullYear()).slice(2)}`;
  };
  return `${fmt(start)} – ${fmt(end)}`;
};

// ─── Generate Invite Code Modal ───────────────────────────────────────────────

const GenerateCodeModal: React.FC<{ project: Project; onClose: () => void }> = ({ project, onClose }) => {
  const [generating, setGenerating] = useState(false);
  const [generated, setGenerated] = useState(false);
  const [codeValue, setCodeValue] = useState('');
  const [copied, setCopied] = useState(false);
  const [loadingActive, setLoadingActive] = useState(true);

  useEffect(() => {
    const fetchActiveCode = async () => {
      try {
        const res = await fetchWithAuth(`${API_URL}/projects/${project.code}/active-code`);
        const data = await res.json();
        if (data.success && data.code) {
          setCodeValue(data.code);
          setGenerated(true);
        }
      } catch {
        // network error
      } finally {
        setLoadingActive(false);
      }
    };
    fetchActiveCode();
  }, [project.code]);

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const res = await fetchWithAuth(`${API_URL}/projects/${project.code}/generate-code`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to generate code');
      setCodeValue(data.code || '');
      setGenerated(true);
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setGenerating(false);
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(codeValue).then(() => {
      setCopied(true);
      showToast('Invite code copied to clipboard!', 'success');
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div className="gc-overlay" onClick={onClose}>
      <div className="gc-modal" onClick={e => e.stopPropagation()}>
        <div className="gc-modal-header">
          <div className="gc-header-left">
            <span className="gc-icon"><UserPlus size={18} /></span>
            <div>
              <h2 className="gc-title">Project Invite Code</h2>
              <p className="gc-subtitle">Share this code with your team to join <strong>{project.name}</strong></p>
            </div>
          </div>
          <button className="gc-close-btn" onClick={onClose} aria-label="Close"><X size={16} /></button>
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
              </div>
              <p className="gc-description">
                Generate an invite code to let site engineers and team members join this project.
              </p>
            </>
          ) : (
            <>
              <div className="gc-success-block">
                <div className="gc-success-icon"><Check size={20} /></div>
                <p className="gc-success-text">Active invite code ready to share!</p>
              </div>
              <div className="gc-code-display">
                <span className="gc-code-value">{codeValue}</span>
                <button
                  className={`gc-copy-btn ${copied ? 'gc-copy-btn--copied' : ''}`}
                  onClick={handleCopy}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                >
                  {copied ? <><Check size={14} /> Copied</> : 'Copy'}
                </button>
              </div>
              <p className="gc-expiry-note" style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                <Clock size={13} /> This code expires in 7 days or after use.
              </p>
            </>
          )}
        </div>

        <div className="gc-modal-footer">
          <button className="gc-cancel-btn" onClick={onClose}>
            {generated ? 'Close' : 'Cancel'}
          </button>
          {!loadingActive && !generated && (
            <button className="gc-generate-btn" onClick={handleGenerate} disabled={generating}>
              {generating ? 'Generating…' : 'Generate Code'}
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

// ─── MAIN COMPONENT: ProjectDetails (Unified Project Workspace) ───────────────

const ProjectDetails: React.FC = () => {
  const { projectId } = useParams<{ projectId: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  // Active Tab: 'overview' | 'tasks' | 'resources' | 'team' | 'documents'
  const currentTab = searchParams.get('tab') || 'overview';
  const setTab = (tab: string) => {
    setSearchParams({ tab });
  };

  // Main state
  const [allProjects, setAllProjects] = useState<Project[]>([]);
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activating, setActivating] = useState(false);
  const [showGenerateModal, setShowGenerateModal] = useState(false);

  // Tab Data States
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [tasksLoading, setTasksLoading] = useState(false);
  const [expandedTaskId, setExpandedTaskId] = useState<string | number | null>(null);
  const [taskSearch, setTaskSearch] = useState('');
  const [taskStatusFilter, setTaskStatusFilter] = useState('All');

  const [resources, setResources] = useState<ResourceItem[]>([]);
  const [resourcesLoading, setResourcesLoading] = useState(false);
  const [resourceCategoryFilter, setResourceCategoryFilter] = useState<'All' | 'Material' | 'Equipment'>('All');
  const [resourceSearch, setResourceSearch] = useState('');

  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [usersList, setUsersList] = useState<UserOption[]>([]);

  // Modals for In-Workspace Actions
  const [showAddTaskModal, setShowAddTaskModal] = useState(false);
  const [newTaskForm, setNewTaskForm] = useState({
    taskName: '',
    phase: PHASES[0],
    assigneeId: '',
    dueDate: '',
    priority: 'Medium' as 'High' | 'Medium' | 'Low',
    manpowerNeeded: '',
    materialsRequired: '',
    siteInstructions: '',
    subtasks: [] as SubTask[],
  });
  const [modalSubtaskInput, setModalSubtaskInput] = useState('');
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
  const [newSubtaskInputs, setNewSubtaskInputs] = useState<Record<string | number, string>>({});
  const [submittingSubtask, setSubmittingSubtask] = useState<Record<string | number, boolean>>({});
  const [addingTask, setAddingTask] = useState(false);

  const [showAddResourceModal, setShowAddResourceModal] = useState(false);
  const [resourceForm, setResourceForm] = useState({
    name: '',
    supplier: '',
    category: 'Material' as 'Material' | 'Equipment',
    quantity: '',
    unit: '',
    minThreshold: '',
    unitPrice: '',
  });
  const [addingResource, setAddingResource] = useState(false);

  // Read logged-in user
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

  // 1. Fetch All Projects & Selected Project
  useEffect(() => {
    const loadProjects = async () => {
      try {
        setLoading(true);
        setError(null);
        const res = await fetchWithAuth(`${API_URL}/projects`);
        if (!res.ok) throw new Error('Failed to fetch projects list');
        const json = await res.json();
        const list: Project[] = json.data ?? json ?? [];
        setAllProjects(list);

        // Find matching project
        const match = list.find(p => p.code === projectId || p.id === projectId);
        if (match) {
          setProject(match);
        } else if (list.length > 0) {
          const singleRes = await fetchWithAuth(`${API_URL}/projects/${projectId}`);
          if (singleRes.ok) {
            const singleJson = await singleRes.json();
            setProject(singleJson.data);
          } else {
            setError('Project not found');
          }
        }
      } catch (err: any) {
        setError(err.message || 'Error loading project');
      } finally {
        setLoading(false);
      }
    };

    if (projectId) loadProjects();
  }, [projectId]);

  // 2. Fetch Tasks, Resources, and Members for this Project
  const fetchProjectData = async () => {
    if (!project) return;

    // Fetch Tasks
    setTasksLoading(true);
    try {
      const tRes = await fetchWithAuth(`${API_URL}/tasks?project_id=${project.code}`);
      if (tRes.ok) {
        const tJson = await tRes.json();
        setTasks(tJson.tasks || tJson.data || []);
      }
    } catch { /* ignore */ } finally {
      setTasksLoading(false);
    }

    // Fetch Resources
    setResourcesLoading(true);
    try {
      const rRes = await fetchWithAuth(`${API_URL}/resources?project=${encodeURIComponent(project.name)}`);
      if (rRes.ok) {
        const rJson = await rRes.json();
        setResources(rJson.data || []);
      }
    } catch { /* ignore */ } finally {
      setResourcesLoading(false);
    }

    // Fetch Team Members
    try {
      const mRes = await fetchWithAuth(`${API_URL}/projects/${project.code}/members`);
      if (mRes.ok) {
        const mJson = await mRes.json();
        setTeamMembers(mJson.data || []);
      }
    } catch { /* ignore */ }

    // Fetch Users list for task assignment
    try {
      const uRes = await fetchWithAuth(`${API_URL}/users`);
      if (uRes.ok) {
        const uJson = await uRes.json();
        setUsersList(uJson.data || uJson || []);
      }
    } catch { /* ignore */ }
  };

  useEffect(() => {
    if (project) {
      fetchProjectData();
    }
  }, [project?.code]);

  // 3. Project Status Activation Handler
  const handleActivateProject = async () => {
    if (!project) return;
    try {
      setActivating(true);
      const res = await fetchWithAuth(`${API_URL}/projects/${project.code}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'Ongoing' }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to activate project');
      setProject(prev => prev ? { ...prev, status: 'Ongoing' } : prev);
      showToast('Project is now Ongoing!', 'success');
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setActivating(false);
    }
  };

  // 4. Task Subtasks Toggle
  const handleToggleSubtask = async (taskId: string | number, subtaskId: string) => {
    const task = tasks.find(t => String(t.id) === String(taskId));
    if (!task) return;

    const currentSubtasks: SubTask[] = Array.isArray(task.subtasks) ? task.subtasks : [];
    const updatedSubtasks = currentSubtasks.map(st =>
      st.id === subtaskId ? { ...st, completed: !st.completed } : st
    );

    const doneCount = updatedSubtasks.filter(s => s.completed).length;
    const newPct = updatedSubtasks.length > 0 ? Math.round((doneCount / updatedSubtasks.length) * 100) : 0;
    const allCompleted = updatedSubtasks.length > 0 && doneCount === updatedSubtasks.length;
    const anyCompleted = doneCount > 0;
    const newStatus = allCompleted ? 'Completed' : (anyCompleted ? 'In Progress' : task.status);

    setTasks(prev => prev.map(t =>
      String(t.id) === String(taskId) ? { ...t, subtasks: updatedSubtasks, status: newStatus, progress_pct: newPct } : t
    ));

    try {
      await fetchWithAuth(`${API_URL}/tasks/${taskId}/subtasks`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subtasks: updatedSubtasks }),
      });
    } catch (err) {
      console.error('Failed to update subtasks', err);
    }
  };

  // Add Subtask to Main Task in Table View
  const handleAddSubtask = async (taskId: string | number) => {
    const title = (newSubtaskInputs[taskId] || '').trim();
    if (!title) return;

    const task = tasks.find(t => String(t.id) === String(taskId));
    if (!task) return;

    const newSub: SubTask = {
      id: `${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      title,
      completed: false,
    };

    const currentSubs: SubTask[] = Array.isArray(task.subtasks) ? task.subtasks : [];
    const updatedSubs = [...currentSubs, newSub];
    const doneCount = updatedSubs.filter(s => s.completed).length;
    const newPct = Math.round((doneCount / updatedSubs.length) * 100);
    const newStatus = newPct === 100 ? 'Completed' : 'In Progress';

    setNewSubtaskInputs(prev => ({ ...prev, [taskId]: '' }));

    setTasks(prev =>
      prev.map(t =>
        String(t.id) === String(taskId)
          ? { ...t, subtasks: updatedSubs, progress_pct: newPct, status: newStatus }
          : t
      )
    );

    setSubmittingSubtask(prev => ({ ...prev, [taskId]: true }));
    try {
      const res = await fetchWithAuth(`${API_URL}/tasks/${taskId}/subtasks`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subtasks: updatedSubs }),
      });
      if (!res.ok) throw new Error('Failed to add subtask.');
      showToast('Subtask added to task!', 'success');
    } catch (err: any) {
      console.error('Failed to add subtask', err);
      showToast(err.message || 'Failed to add subtask', 'error');
    } finally {
      setSubmittingSubtask(prev => ({ ...prev, [taskId]: false }));
    }
  };

  // Delete Subtask from Main Task
  const handleDeleteSubtask = async (taskId: string | number, subtaskId: string) => {
    const task = tasks.find(t => String(t.id) === String(taskId));
    if (!task) return;

    const currentSubs: SubTask[] = Array.isArray(task.subtasks) ? task.subtasks : [];
    const updatedSubs = currentSubs.filter(s => s.id !== subtaskId);
    const doneCount = updatedSubs.filter(s => s.completed).length;
    const newPct = updatedSubs.length > 0 ? Math.round((doneCount / updatedSubs.length) * 100) : 0;
    const allDone = updatedSubs.length > 0 && doneCount === updatedSubs.length;
    const newStatus = allDone ? 'Completed' : (doneCount > 0 ? 'In Progress' : (task.status === 'Completed' ? 'In Progress' : task.status));

    setTasks(prev =>
      prev.map(t =>
        String(t.id) === String(taskId)
          ? { ...t, subtasks: updatedSubs, progress_pct: newPct, status: newStatus }
          : t
      )
    );

    try {
      const res = await fetchWithAuth(`${API_URL}/tasks/${taskId}/subtasks`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subtasks: updatedSubs }),
      });
      if (!res.ok) throw new Error('Failed to delete subtask');
      showToast('Subtask removed', 'info');
    } catch (err: any) {
      console.error('Failed to delete subtask', err);
      showToast('Failed to remove subtask', 'error');
    }
  };

  // 5. Task Status Change
  const handleTaskStatusChange = async (taskId: string | number, newStatus: string) => {
    setTasks(prev => prev.map(t =>
      String(t.id) === String(taskId) ? { ...t, status: newStatus } : t
    ));

    try {
      const res = await fetchWithAuth(`${API_URL}/tasks/${taskId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      if (!res.ok) throw new Error('Status update failed');
      showToast(`Task marked as ${newStatus}`, 'success');
    } catch {
      showToast('Failed to update task status', 'error');
    }
  };

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
    setNewTaskForm(prev => ({
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
    setNewTaskForm(prev => ({
      ...prev,
      materialsRequired: formatMaterialsString(updated),
    }));
  };

  const handleCloseAddTaskModal = () => {
    setShowAddTaskModal(false);
    setAllocatedMaterials([]);
    setMatItemInput({
      name: '',
      category: 'Material',
      supplier: '',
      quantity: '',
      unit: 'bags',
      minThreshold: '10',
      unitPrice: '',
    });
  };

  // 6. Inline Add Task
  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!project) return;
    if (!newTaskForm.taskName.trim()) {
      showToast('Task name is required', 'warning');
      return;
    }

    const todayStr = new Date().toISOString().split('T')[0];
    if (newTaskForm.dueDate && newTaskForm.dueDate < todayStr) {
      showToast('Due date cannot be a past date', 'warning');
      return;
    }

    try {
      setAddingTask(true);
      const payload = {
        taskName: newTaskForm.taskName.trim(),
        projectId: project.id || project.code,
        phase: newTaskForm.phase,
        assigneeId: newTaskForm.assigneeId || (usersList[0]?.id ?? null),
        dueDate: newTaskForm.dueDate || new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0],
        priority: newTaskForm.priority,
        manpowerNeeded: newTaskForm.manpowerNeeded,
        siteInstructions: newTaskForm.siteInstructions,
        subtasks: newTaskForm.subtasks || [],
        allocatedMaterials: allocatedMaterials,
      };

      const res = await fetchWithAuth(`${API_URL}/tasks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || data.error || 'Failed to create task');

      showToast('Task created successfully!', 'success');
      setShowAddTaskModal(false);
      setAllocatedMaterials([]);
      setMatItemInput({
        name: '',
        category: 'Material',
        supplier: '',
        quantity: '',
        unit: 'bags',
        minThreshold: '10',
        unitPrice: '',
      });
      setNewTaskForm({
        taskName: '',
        phase: PHASES[0],
        assigneeId: '',
        dueDate: '',
        priority: 'Medium',
        manpowerNeeded: '',
        materialsRequired: '',
        siteInstructions: '',
        subtasks: [],
      });
      setModalSubtaskInput('');
      fetchProjectData();
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setAddingTask(false);
    }
  };

  // 7. Inline Add Resource
  const handleCreateResource = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!project) return;
    if (!resourceForm.name || !resourceForm.quantity || !resourceForm.unitPrice) {
      showToast('Please fill in all required resource fields', 'warning');
      return;
    }

    try {
      setAddingResource(true);
      const payload = {
        name: resourceForm.name.trim(),
        supplier: resourceForm.supplier.trim() || 'General Supplier',
        category: resourceForm.category,
        quantity: parseFloat(resourceForm.quantity) || 0,
        unit: resourceForm.unit.trim() || (resourceForm.category === 'Material' ? 'units' : 'sets'),
        minThreshold: parseFloat(resourceForm.minThreshold) || 10,
        unitPrice: parseFloat(resourceForm.unitPrice) || 0,
        assignedProject: project.name,
        project: project.name,
      };

      const res = await fetchWithAuth(`${API_URL}/resources`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || data.error || 'Failed to add resource');

      showToast('Resource allocated to project!', 'success');
      setShowAddResourceModal(false);
      setResourceForm({
        name: '',
        supplier: '',
        category: 'Material',
        quantity: '',
        unit: '',
        minThreshold: '',
        unitPrice: '',
      });
      fetchProjectData();
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setAddingResource(false);
    }
  };

  // 8. Delete Resource
  const handleDeleteResource = async (id: number) => {
    if (!window.confirm('Remove this resource from the project?')) return;
    try {
      const res = await fetchWithAuth(`${API_URL}/resources/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete resource');
      showToast('Resource removed', 'success');
      setResources(prev => prev.filter(r => r.id !== id));
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  if (loading) return <div className="pd-state">Loading project workspace…</div>;
  if (error) return <div className="pd-state pd-state--error">{error}</div>;
  if (!project) return <div className="pd-state">Project not found.</div>;

  // Stats computation
  const activeTasksCount = tasks.filter(t => {
    const s = (t.status || '').toLowerCase();
    return s.includes('progress') || s.includes('ongoing') || s === 'pending';
  }).length;
  const completedTasksCount = tasks.filter(t => (t.status || '').toLowerCase().includes('completed')).length;
  const totalTasksCount = tasks.length;
  const taskProgressPct = totalTasksCount > 0 ? Math.round((completedTasksCount / totalTasksCount) * 100) : 0;

  // Overall Project Progress computation (from tasks and subtasks)
  let totalTaskScore = 0;
  let totalSubtasksCount = 0;
  let completedSubtasksCount = 0;

  tasks.forEach(t => {
    const isCompleted = (t.status || '').toLowerCase().includes('completed');
    const isOngoing = (t.status || '').toLowerCase().includes('progress') || (t.status || '').toLowerCase().includes('ongoing');
    const subs: SubTask[] = Array.isArray(t.subtasks) ? t.subtasks : [];

    if (subs.length > 0) {
      totalSubtasksCount += subs.length;
      const done = subs.filter(s => s.completed).length;
      completedSubtasksCount += done;
      if (isCompleted) {
        totalTaskScore += 1;
      } else {
        totalTaskScore += done / subs.length;
      }
    } else {
      if (isCompleted) {
        totalTaskScore += 1;
      } else if (isOngoing) {
        const pPct = (t as any).progress_pct;
        totalTaskScore += typeof pPct === 'number' && pPct > 0 ? pPct / 100 : 0.5;
      } else {
        totalTaskScore += 0;
      }
    }
  });

  const overallProgressPct = totalTasksCount > 0
    ? Math.min(100, Math.max(0, Math.round((totalTaskScore / totalTasksCount) * 100)))
    : (project.progress_pct || 0);

  const circumference = 2 * Math.PI * 44;
  const strokeDashoffset = circumference - (overallProgressPct / 100) * circumference;

  const lowStockResources = resources.filter(r => (r.status || '').toLowerCase().includes('low'));
  const totalResourceCost = resources.reduce((sum, r) => sum + (Number(r.quantity) || 0) * (Number(r.unitPrice) || 0), 0);

  // Group tasks by Phase
  const tasksByPhase: Record<string, TaskItem[]> = {};
  for (const p of PHASES) tasksByPhase[p] = [];
  for (const t of tasks) {
    const norm = normalizePhase(t.phase);
    if (!tasksByPhase[norm]) tasksByPhase[norm] = [];
    tasksByPhase[norm].push(t);
  }

  // Filter resources in Resources tab
  const filteredResources = resources.filter(r => {
    const matchCat = resourceCategoryFilter === 'All' || r.category === resourceCategoryFilter;
    const matchSearch = !resourceSearch || r.name.toLowerCase().includes(resourceSearch.toLowerCase()) || r.supplier.toLowerCase().includes(resourceSearch.toLowerCase());
    return matchCat && matchSearch;
  });

  return (
    <main className="main-content pd-workspace">
      {/* ─── Top Workspace Bar ─── */}
      <header className="pd-top-bar">
        <div className="pd-top-left">
          <button className="pd-back-btn" onClick={() => navigate('/projects')}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="19" y1="12" x2="5" y2="12" />
              <polyline points="12 19 5 12 12 5" />
            </svg>
            Projects Hub
          </button>
          <span className="pd-divider-slash">/</span>
          {/* Quick Project Switcher Dropdown */}
          <div className="pd-switcher-wrapper">
            <select
              className="pd-project-switcher"
              value={project.code}
              onChange={(e) => navigate(`/projects/${e.target.value}?tab=${currentTab}`)}
            >
              {allProjects.map(p => (
                <option key={p.code} value={p.code}>
                  {p.code} — {p.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="pd-top-right">
          <ProfileDropdown userName={userName} userRole={userRole} />
        </div>
      </header>

      {/* ─── Hero Header Card ─── */}
      <div className={`pd-hero-card ${project.status === 'Ongoing' ? 'pd-hero-card--ongoing' : ''}`}>
        <div className="pd-hero-top">
          <div className="pd-hero-left">
            <div className="pd-title-row">
              <span className="pd-code-badge">{project.code}</span>
              <h1 className="pd-title">{project.name}</h1>
              <span className={`pd-status-pill pd-status--${project.status.toLowerCase()}`}>
                {project.status}
              </span>
            </div>
            <p className="pd-location">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ verticalAlign: '-2px', marginRight: '4px' }}>
                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                <circle cx="12" cy="10" r="3" />
              </svg>
              {project.location}
            </p>
          </div>

          <div className="pd-hero-actions">
            {project.status === 'Planning' && (
              <button className="pd-btn-activate" onClick={handleActivateProject} disabled={activating} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                {activating ? 'Activating…' : <><Play size={13} fill="currentColor" /> Activate Construction</>}
              </button>
            )}
            <button className="pd-btn-invite" onClick={() => setShowGenerateModal(true)} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
              <UserPlus size={15} /> Invite Team
            </button>
          </div>
        </div>

        <div className="pd-hero-bottom">
          <div className="pd-hero-meta">
            <div className="pd-meta-item">
              <p className="pd-meta-label">Client</p>
              <p className="pd-meta-value">{project.client || '—'}</p>
            </div>
            <div className="pd-meta-item">
              <p className="pd-meta-label">Timeline</p>
              <p className="pd-meta-value">{formatTimeline(project.start_date, project.end_date)}</p>
            </div>
            <div className="pd-meta-item">
              <p className="pd-meta-label">Budget Allocated</p>
              <p className="pd-meta-value">{formatBudget(project.budget)}</p>
            </div>
          </div>

          {/* ── Overall Progress Graph (from Tasks & Subtasks) ── */}
          <div
            className="pd-progress-graph-container"
            onClick={() => setTab('tasks')}
            title={`Overall Progress: ${overallProgressPct}% (${completedTasksCount}/${totalTasksCount} tasks completed)`}
          >
            <div className="pd-progress-graph-ring">
              <svg className="pd-progress-graph-svg" width="116" height="116" viewBox="0 0 116 116">
                <defs>
                  <linearGradient id="pdHeroGraphGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#10b981" />
                    <stop offset="100%" stopColor="#047857" />
                  </linearGradient>
                  <filter id="pdGraphGlow" x="-20%" y="-20%" width="140%" height="140%">
                    <feDropShadow dx="0" dy="2" stdDeviation="3" floodColor="#10b981" floodOpacity="0.3" />
                  </filter>
                </defs>
                {/* Background Track */}
                <circle
                  cx="58"
                  cy="58"
                  r="46"
                  fill="none"
                  stroke="rgba(0, 0, 0, 0.08)"
                  strokeWidth="9"
                />
                {/* Dynamic Progress Fill */}
                <circle
                  cx="58"
                  cy="58"
                  r="46"
                  fill="none"
                  stroke="url(#pdHeroGraphGrad)"
                  strokeWidth="9"
                  strokeDasharray={circumference}
                  strokeDashoffset={strokeDashoffset}
                  strokeLinecap="round"
                  transform="rotate(-90 58 58)"
                  filter={overallProgressPct > 0 ? 'url(#pdGraphGlow)' : undefined}
                  style={{ transition: 'stroke-dashoffset 0.6s cubic-bezier(0.4, 0, 0.2, 1)' }}
                />
              </svg>
              <div className="pd-progress-graph-center">
                <span className="pd-progress-graph-pct">{overallProgressPct}%</span>
                <span className="pd-progress-graph-sub">Progress</span>
              </div>
            </div>
            <span className="pd-progress-graph-title">Overall Progress</span>
          </div>
        </div>
      </div>

      {/* ─── Merged Tabs Navigation Bar ─── */}
      <div className="pd-tabs-bar">
        <button
          className={`pd-tab-item ${currentTab === 'overview' ? 'pd-tab-item--active' : ''}`}
          onClick={() => setTab('overview')}
        >
          <span className="pd-tab-icon"><LayoutDashboard size={16} /></span>
          Overview &amp; Hub
        </button>

        <button
          className={`pd-tab-item ${currentTab === 'tasks' ? 'pd-tab-item--active' : ''}`}
          onClick={() => setTab('tasks')}
        >
          <span className="pd-tab-icon"><ClipboardList size={16} /></span>
          Tasks &amp; Milestones
          <span className="pd-tab-badge">{tasks.length}</span>
        </button>

        <button
          className={`pd-tab-item ${currentTab === 'resources' ? 'pd-tab-item--active' : ''}`}
          onClick={() => setTab('resources')}
        >
          <span className="pd-tab-icon"><Boxes size={16} /></span>
          Resources &amp; Inventory
          <span className="pd-tab-badge">{resources.length}</span>
        </button>

        <button
          className={`pd-tab-item ${currentTab === 'team' ? 'pd-tab-item--active' : ''}`}
          onClick={() => setTab('team')}
        >
          <span className="pd-tab-icon"><Users size={16} /></span>
          Team ({teamMembers.length})
        </button>

        <button
          className={`pd-tab-item ${currentTab === 'documents' ? 'pd-tab-item--active' : ''}`}
          onClick={() => setTab('documents')}
        >
          <span className="pd-tab-icon"><FolderClosed size={16} /></span>
          Documents &amp; Reports
        </button>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════════ */}
      {/* ── TAB 1: OVERVIEW & HUB ─────────────────────────────────────────── */}
      {/* ═══════════════════════════════════════════════════════════════════════ */}
      {currentTab === 'overview' && (
        <div className="pd-tab-content">
          {/* KPI Stat Cards */}
          <div className="pd-kpi-grid">
            <div className="pd-kpi-card" onClick={() => setTab('tasks')} style={{ cursor: 'pointer' }}>
              <div className="pd-kpi-icon" style={{ background: '#fff7ed', color: '#ea580c' }}>
                <ClipboardList size={22} />
              </div>
              <div>
                <p className="pd-kpi-label">Tasks Progress</p>
                <p className="pd-kpi-value">{completedTasksCount} / {totalTasksCount}</p>
                <div className="pd-progress-track">
                  <div className="pd-progress-fill" style={{ width: `${taskProgressPct}%`, background: '#ea580c' }} />
                </div>
                <span className="pd-kpi-sub">{taskProgressPct}% completed ({activeTasksCount} active)</span>
              </div>
            </div>

            <div className="pd-kpi-card" onClick={() => setTab('resources')} style={{ cursor: 'pointer' }}>
              <div className="pd-kpi-icon" style={{ background: '#ecfdf5', color: '#059669' }}>
                <Boxes size={22} />
              </div>
              <div>
                <p className="pd-kpi-label">Inventory &amp; Materials</p>
                <p className="pd-kpi-value">{resources.length} Items</p>
                <span className="pd-kpi-sub" style={{ color: lowStockResources.length > 0 ? '#dc2626' : '#059669', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                  {lowStockResources.length > 0 ? (
                    <><AlertTriangle size={13} /> {lowStockResources.length} Low stock alerts</>
                  ) : (
                    <><Check size={13} /> All items in stock</>
                  )}
                </span>
              </div>
            </div>

            <div className="pd-kpi-card">
              <div className="pd-kpi-icon" style={{ background: '#fef3c7', color: '#d97706' }}>
                <DollarSign size={22} />
              </div>
              <div>
                <p className="pd-kpi-label">Allocated Inventory Cost</p>
                <p className="pd-kpi-value">{formatCurrency(totalResourceCost)}</p>
                <span className="pd-kpi-sub">Tracked on site</span>
              </div>
            </div>

            <div className="pd-kpi-card" onClick={() => setTab('team')} style={{ cursor: 'pointer' }}>
              <div className="pd-kpi-icon" style={{ background: '#f3e8ff', color: '#7c3aed' }}>
                <HardHat size={22} />
              </div>
              <div>
                <p className="pd-kpi-label">Site Team</p>
                <p className="pd-kpi-value">{teamMembers.length} Members</p>
                <span className="pd-kpi-sub">Engineers &amp; Crew</span>
              </div>
            </div>
          </div>

          {/* Construction Phase Milestone Bar */}
          <div className="pd-phase-progress-card">
            <div className="pd-phase-card-header">
              <div>
                <h2 className="pd-card-heading">Construction Phases &amp; Milestones</h2>
                <p className="pd-card-sub">Track progress and tasks across all construction phases</p>
              </div>
              <button className="pd-btn-primary" onClick={() => setShowAddTaskModal(true)}>
                + Add Task to Phase
              </button>
            </div>

            <div className="pd-phases-stepper">
              {PHASES.map((pName, index) => {
                const phaseTasks = tasksByPhase[pName] || [];
                const phaseDone = phaseTasks.filter(t => (t.status || '').toLowerCase().includes('completed')).length;
                const isPassed = phaseTasks.length > 0 && phaseDone === phaseTasks.length;
                const hasTasks = phaseTasks.length > 0 && phaseDone < phaseTasks.length;

                return (
                  <div
                    key={pName}
                    className={`pd-phase-step ${hasTasks ? 'pd-phase-step--current' : ''} ${isPassed ? 'pd-phase-step--passed' : ''}`}
                    onClick={() => {
                      setTab('tasks');
                    }}
                    style={{ cursor: 'pointer' }}
                    title={`View tasks for ${pName}`}
                  >
                    <div className="pd-step-badge">{index + 1}</div>
                    <div className="pd-step-body">
                      <p className="pd-step-name">{pName}</p>
                      <p className="pd-step-count">{phaseDone}/{phaseTasks.length} tasks</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>


          {/* Project Scope Description */}
          {project.scope && (
            <div className="pd-section-card" style={{ marginTop: '16px' }}>
              <p className="pd-section-card-title">Project Scope &amp; Deliverables</p>
              <p style={{ fontSize: '14px', color: '#475569', lineHeight: '1.6' }}>{project.scope}</p>
            </div>
          )}
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════ */}
      {/* ── TAB 2: TASKS & MILESTONES ───────────────────────────────────────── */}
      {/* ═══════════════════════════════════════════════════════════════════════ */}
      {currentTab === 'tasks' && (
        <div className="pd-tab-content">
          <div className="pd-tab-header">
            <div>
              <h2 className="pd-card-heading">Project Tasks &amp; Execution Steps</h2>
              <p className="pd-card-sub">Organized by construction phase for <strong>{project.name}</strong></p>
            </div>
            <div className="pd-tab-header-actions">
              <input
                type="text"
                className="pd-search-input"
                placeholder="Search tasks or assignees…"
                value={taskSearch}
                onChange={e => setTaskSearch(e.target.value)}
              />
              <select
                className="pd-select-filter"
                value={taskStatusFilter}
                onChange={e => setTaskStatusFilter(e.target.value)}
              >
                <option value="All">All Statuses</option>
                <option value="Pending">Pending</option>
                <option value="In Progress">In Progress</option>
                <option value="Completed">Completed</option>
                <option value="Delayed">Delayed</option>
              </select>
              <button className="pd-btn-primary" onClick={() => setShowAddTaskModal(true)}>
                + New Task
              </button>
            </div>
          </div>

          {tasksLoading ? (
            <p className="pd-state-msg">Loading project tasks…</p>
          ) : tasks.length === 0 ? (
            <div className="pd-empty-card">
              <p className="pd-empty-title">No tasks created for this project yet</p>
              <p className="pd-empty-sub">Add tasks to organize daily construction activities across Foundation, Structural, and MEP phases.</p>
              <button className="pd-btn-primary" onClick={() => setShowAddTaskModal(true)} style={{ marginTop: '12px' }}>
                + Create First Task
              </button>
            </div>
          ) : (
            <div className="pd-tasks-phase-list">
              {PHASES.map(phaseName => {
                const phaseTasks = (tasksByPhase[phaseName] || []).filter(t => {
                  const matchSearch = !taskSearch || t.task_name.toLowerCase().includes(taskSearch.toLowerCase()) || (t.assignee && t.assignee.toLowerCase().includes(taskSearch.toLowerCase()));
                  const matchStatus = taskStatusFilter === 'All' || (t.status || '').toLowerCase() === taskStatusFilter.toLowerCase();
                  return matchSearch && matchStatus;
                });

                if (phaseTasks.length === 0 && taskSearch) return null;

                const completedInPhase = phaseTasks.filter(t => (t.status || '').toLowerCase().includes('completed')).length;

                return (
                  <div key={phaseName} className="pd-phase-group-card">
                    <div className="pd-phase-group-header">
                      <div className="pd-phase-group-title">
                        <span className="pd-phase-bullet" />
                        <h3>{phaseName}</h3>
                        <span className="pd-phase-counter">
                          {completedInPhase} / {phaseTasks.length} completed
                        </span>
                      </div>
                      <button
                        className="pd-btn-link"
                        onClick={() => {
                          setNewTaskForm(prev => ({ ...prev, phase: phaseName }));
                          setShowAddTaskModal(true);
                        }}
                      >
                        + Add to {phaseName.replace(/^Phase\s*\d+\s*[-–:]\s*/i, '') || phaseName}
                      </button>
                    </div>

                    {phaseTasks.length === 0 ? (
                      <p className="pd-phase-empty-text">No tasks logged in this phase yet.</p>
                    ) : (
                      <div className="pd-tasks-table-wrapper">
                        <table className="pd-tasks-table">
                          <thead>
                            <tr>
                              <th style={{ width: '30px' }} />
                              <th>Task Name</th>
                              <th>Assignee</th>
                              <th>Due Date</th>
                              <th>Priority</th>
                              <th>Progress</th>
                              <th>Status</th>
                            </tr>
                          </thead>
                          <tbody>
                            {phaseTasks.map(task => {
                              const isExpanded = expandedTaskId === task.id;
                              const subtasks: SubTask[] = Array.isArray(task.subtasks) ? task.subtasks : [];
                              const subtasksDone = subtasks.filter(s => s.completed).length;

                              return (
                                <React.Fragment key={task.id}>
                                  <tr className={`pd-task-row ${isExpanded ? 'pd-task-row--expanded' : ''}`}>
                                    <td>
                                      <button
                                        className="pd-expand-btn"
                                        onClick={() => setExpandedTaskId(isExpanded ? null : task.id)}
                                        aria-label={isExpanded ? 'Collapse subtasks' : 'Expand subtasks'}
                                      >
                                        {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                                      </button>
                                    </td>
                                    <td>
                                      <span className="pd-task-name" onClick={() => setExpandedTaskId(isExpanded ? null : task.id)}>
                                        {task.task_name}
                                      </span>
                                      {subtasks.length > 0 && (
                                        <span className="pd-subtask-pill" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                                          <Check size={11} strokeWidth={3} /> {subtasksDone}/{subtasks.length} steps
                                        </span>
                                      )}
                                    </td>
                                    <td>
                                      <div className="pd-assignee-cell">
                                        <div className="pd-avatar-circle" style={{ background: avatarColor(task.assignee || 'Unassigned') }}>
                                          {getInitials(task.assignee)}
                                        </div>
                                        <span>{task.assignee || 'Unassigned'}</span>
                                      </div>
                                    </td>
                                    <td className="pd-td-muted">
                                      {task.due_date ? new Date(task.due_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}
                                    </td>
                                    <td>
                                      <span className={`pd-priority-badge pd-priority--${(task.priority || 'medium').toLowerCase()}`}>
                                        {task.priority || 'Medium'}
                                      </span>
                                    </td>
                                    <td>
                                      {(() => {
                                        const taskPct = subtasks.length > 0
                                          ? Math.round((subtasksDone / subtasks.length) * 100)
                                          : (typeof task.progress_pct === 'number'
                                              ? task.progress_pct
                                              : ((task.status || '').toLowerCase().includes('completed') ? 100 : ((task.status || '').toLowerCase().includes('progress') ? 50 : 0)));
                                        return (
                                          <div className="pd-task-progress-cell">
                                            <div className="pd-task-progress-bar-bg">
                                              <div
                                                className="pd-task-progress-bar-fill"
                                                style={{
                                                  width: `${taskPct}%`,
                                                  background:
                                                    taskPct === 100
                                                      ? 'linear-gradient(90deg, #10b981 0%, #059669 100%)'
                                                      : taskPct > 0
                                                      ? 'linear-gradient(90deg, #f97316 0%, #ea580c 100%)'
                                                      : '#cbd5e1',
                                                }}
                                              />
                                            </div>
                                            <span className="pd-task-progress-pct">
                                              {taskPct}%
                                            </span>
                                          </div>
                                        );
                                      })()}
                                    </td>
                                    <td>
                                      <select
                                        className={`pd-status-select pd-status-select--${(task.status || 'pending')
                                          .toLowerCase()
                                          .replace(/\s+/g, '')}`}
                                        value={task.status || 'Pending'}
                                        onChange={e =>
                                          handleTaskStatusChange(
                                            task.id,
                                            e.target.value
                                          )
                                        }
                                      >
                                        <option value="Pending">Pending</option>
                                        <option value="In Progress">In Progress</option>
                                        <option value="Completed">Completed</option>
                                        <option value="Delayed">Delayed</option>
                                      </select>
                                    </td>
                                  </tr>

                                  {/* Expanded Subtasks & Details Row */}
                                  {isExpanded && (
                                    <tr className="pd-task-detail-row">
                                      <td />
                                      <td colSpan={6}>
                                        <div className="pd-task-detail-card">
                                          <div className="pd-detail-grid">
                                            {/* Subtasks Checklist */}
                                            <div className="pd-subtasks-box">
                                              <div className="pd-subtasks-header">
                                                <h4>Execution Steps &amp; Subtasks</h4>
                                                {subtasks.length > 0 && (
                                                  <span className="pd-subtasks-progress-badge">
                                                    {subtasksDone} / {subtasks.length} Done ({task.progress_pct ?? Math.round((subtasksDone / (subtasks.length || 1)) * 100)}%)
                                                  </span>
                                                )}
                                              </div>

                                              {subtasks.length === 0 ? (
                                                <p className="pd-td-muted" style={{ fontSize: '12px', margin: '4px 0 12px' }}>
                                                  No subtasks defined yet. Break down this task into execution steps below.
                                                </p>
                                              ) : (
                                                <div className="pd-subtasks-list">
                                                  {subtasks.map(st => (
                                                    <div key={st.id} className="pd-subtask-row">
                                                      <label className="pd-subtask-item">
                                                        <input
                                                          type="checkbox"
                                                          checked={st.completed}
                                                          onChange={() => {
                                                            handleToggleSubtask(
                                                              task.id,
                                                              st.id
                                                            );
                                                          }}
                                                        />
                                                        <span className={st.completed ? 'pd-subtask-done' : ''}>
                                                          {st.title}
                                                        </span>
                                                      </label>
                                                      <button
                                                        type="button"
                                                        className="pd-subtask-delete-btn"
                                                        title="Delete subtask"
                                                        onClick={() => handleDeleteSubtask(task.id, st.id)}
                                                      >
                                                        <X size={12} />
                                                      </button>
                                                    </div>
                                                  ))}
                                                </div>
                                              )}

                                              {subtasks.length > 0 && subtasksDone === subtasks.length && (
                                                <div className="pd-subtasks-completed-notice" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                  <Check size={14} /> All current execution steps completed! You can still add more steps below anytime.
                                                </div>
                                              )}

                                              {/* Create / Add Subtask Input Form — ALWAYS VISIBLE */}
                                              <form
                                                className="pd-add-subtask-form"
                                                onSubmit={e => {
                                                  e.preventDefault();
                                                  handleAddSubtask(task.id);
                                                }}
                                              >
                                                <input
                                                  type="text"
                                                  className="pd-add-subtask-input"
                                                  placeholder="Add execution step or subtask (e.g. Rebar inspection, Pour footing)..."
                                                  value={newSubtaskInputs[task.id] || ''}
                                                  disabled={submittingSubtask[task.id]}
                                                  onChange={e =>
                                                    setNewSubtaskInputs(prev => ({
                                                      ...prev,
                                                      [task.id]: e.target.value,
                                                    }))
                                                  }
                                                />
                                                <button
                                                  type="submit"
                                                  className="pd-add-subtask-btn"
                                                  disabled={!newSubtaskInputs[task.id]?.trim() || submittingSubtask[task.id]}
                                                >
                                                  {submittingSubtask[task.id] ? 'Adding…' : '+ Add Subtask'}
                                                </button>
                                              </form>
                                            </div>

                                            {/* Site Instructions & Materials */}
                                            <div className="pd-notes-box">
                                              <h4>Materials &amp; Instructions</h4>
                                              <div style={{ marginBottom: '8px' }}>
                                                <div style={{ fontSize: '12px', fontWeight: 700, color: '#475569', marginBottom: '4px' }}>
                                                  Materials &amp; Resources:
                                                </div>
                                                {task.materials_required ? (
                                                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                                                    {task.materials_required.split(',').map((mat, i) => {
                                                      const trimmed = mat.trim();
                                                      if (!trimmed) return null;
                                                      const isEquip = trimmed.toLowerCase().includes('equipment');
                                                      return (
                                                        <span
                                                          key={i}
                                                          style={{
                                                            display: 'inline-flex',
                                                            alignItems: 'center',
                                                            gap: '5px',
                                                            background: isEquip ? '#eff6ff' : '#f8fafc',
                                                            border: `1px solid ${isEquip ? '#bfdbfe' : '#e2e8f0'}`,
                                                            color: isEquip ? '#1d4ed8' : '#334155',
                                                            borderRadius: '6px',
                                                            padding: '3px 8px',
                                                            fontSize: '11.5px',
                                                            fontWeight: 600,
                                                          }}
                                                        >
                                                          <span>{isEquip ? <Truck size={13} style={{ color: '#2563eb' }} /> : <Package size={13} style={{ color: '#64748b' }} />}</span>
                                                          <span>{trimmed}</span>
                                                        </span>
                                                      );
                                                    })}
                                                  </div>
                                                ) : (
                                                  <span style={{ fontSize: '12px', color: '#94a3b8' }}>None specified</span>
                                                )}
                                              </div>
                                              <p><strong>Instructions:</strong> {task.site_instructions || 'Standard engineering protocol'}</p>

                                              {(task.status || '').toLowerCase() === 'completed' && (
                                                <p
                                                  style={{
                                                    marginTop: '12px',
                                                    fontWeight: 600,
                                                    color: '#16a34a',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: '6px',
                                                  }}
                                                >
                                                  <CheckCircle2 size={15} /> Completed by engineer — this task is locked.
                                                </p>
                                              )}
                                            </div>
                                          </div>
                                        </div>
                                      </td>
                                    </tr>
                                  )}
                                </React.Fragment>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════ */}
      {/* ── TAB 3: RESOURCES & INVENTORY ───────────────────────────────────── */}
      {/* ═══════════════════════════════════════════════════════════════════════ */}
      {currentTab === 'resources' && (
        <div className="pd-tab-content">
          <div className="pd-tab-header">
            <div>
              <h2 className="pd-card-heading">Materials &amp; Equipment Inventory</h2>
              <p className="pd-card-sub">Stock allocated for <strong>{project.name}</strong></p>
            </div>
            <div className="pd-tab-header-actions">
              <div className="pd-cat-pills">
                <button
                  className={`pd-cat-pill ${resourceCategoryFilter === 'All' ? 'pd-cat-pill--active' : ''}`}
                  onClick={() => setResourceCategoryFilter('All')}
                >
                  All ({resources.length})
                </button>
                <button
                  className={`pd-cat-pill ${resourceCategoryFilter === 'Material' ? 'pd-cat-pill--active' : ''}`}
                  onClick={() => setResourceCategoryFilter('Material')}
                >
                  Materials ({resources.filter(r => r.category === 'Material').length})
                </button>
                <button
                  className={`pd-cat-pill ${resourceCategoryFilter === 'Equipment' ? 'pd-cat-pill--active' : ''}`}
                  onClick={() => setResourceCategoryFilter('Equipment')}
                >
                  Equipment ({resources.filter(r => r.category === 'Equipment').length})
                </button>
              </div>

              <input
                type="text"
                className="pd-search-input"
                placeholder="Search materials, equipment, supplier…"
                value={resourceSearch}
                onChange={e => setResourceSearch(e.target.value)}
              />

              <button className="pd-btn-primary" onClick={() => setShowAddResourceModal(true)}>
                + Add Resource
              </button>
            </div>
          </div>

          {resourcesLoading ? (
            <p className="pd-state-msg">Loading project inventory…</p>
          ) : resources.length === 0 ? (
            <div className="pd-empty-card">
              <p className="pd-empty-title">No resources assigned to this project yet</p>
              <p className="pd-empty-sub">Allocate cement, steel bars, tower cranes, or excavators to track real-time quantities and budget burn.</p>
              <button className="pd-btn-primary" onClick={() => setShowAddResourceModal(true)} style={{ marginTop: '12px' }}>
                + Allocate First Resource
              </button>
            </div>
          ) : (
            <div className="pd-card">
              <table className="pm-table">
                <thead>
                  <tr>
                    <th>Item Name</th>
                    <th>Category</th>
                    <th>Supplier</th>
                    <th>Quantity / Unit</th>
                    <th>Threshold</th>
                    <th>Unit Price</th>
                    <th>Total Value</th>
                    <th>Stock Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredResources.map(res => {
                    const isLow = (res.status || '').toLowerCase().includes('low');
                    const totalVal = (Number(res.quantity) || 0) * (Number(res.unitPrice) || 0);

                    return (
                      <tr key={res.id}>
                        <td className="pm-td-bold">{res.name}</td>
                        <td>
                          <span className={`pd-res-badge ${res.category === 'Material' ? 'pd-res-badge--mat' : 'pd-res-badge--equip'}`}>
                            {res.category}
                          </span>
                        </td>
                        <td className="pm-td-muted">{res.supplier || '—'}</td>
                        <td>
                          <strong>{res.quantity}</strong> {res.unit}
                        </td>
                        <td className="pm-td-muted">Min {res.minThreshold} {res.unit}</td>
                        <td>₱{Number(res.unitPrice).toLocaleString()}</td>
                        <td><strong>₱{totalVal.toLocaleString()}</strong></td>
                        <td>
                          <span className={`pd-status-pill ${isLow ? 'pd-status--lowstock' : 'pd-status--instock'}`}>
                            {res.status || (isLow ? 'Low stock' : 'In stock')}
                          </span>
                        </td>
                        <td>
                          <button
                            className="pd-btn-danger-sm"
                            onClick={() => handleDeleteResource(res.id)}
                            title="Remove resource"
                            aria-label="Remove resource"
                          >
                            <X size={14} />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════ */}
      {/* ── TAB 4: TEAM & COLLABORATORS ────────────────────────────────────── */}
      {/* ═══════════════════════════════════════════════════════════════════════ */}
      {currentTab === 'team' && (
        <div className="pd-tab-content">
          <div className="pd-tab-header">
            <div>
              <h2 className="pd-card-heading">Assigned Project Engineers &amp; Members</h2>
              <p className="pd-card-sub">Site personnel collaborating on <strong>{project.name}</strong></p>
            </div>
            <div className="pd-tab-header-actions">
              <button className="pd-btn-primary" onClick={() => setShowGenerateModal(true)} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                <UserPlus size={15} /> Generate Invite Code
              </button>
              <button className="pd-btn-secondary" onClick={() => navigate(`/projects/${project.code}/team`)} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                Manage Full Roster <ArrowRight size={14} />
              </button>
            </div>
          </div>

          <div className="pd-team-grid">
            {teamMembers.length === 0 ? (
              <p className="pd-empty-hint">No team members assigned yet. Generate an invite code to let site engineers join!</p>
            ) : (
              teamMembers.map(m => (
                <div key={m.id} className="pd-member-card">
                  <div className="pd-avatar-large" style={{ background: avatarColor(m.name) }}>
                    {getInitials(m.name)}
                  </div>
                  <div className="pd-member-info">
                    <h4>{m.name}</h4>
                    <p className="pd-member-role">{m.role || 'Site Member'}</p>
                    <span className="pd-member-active-tag" style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                      <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'currentColor', display: 'inline-block' }} />
                      Active On Site
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════ */}
      {/* ── TAB 5: DOCUMENTS & REPORTS ─────────────────────────────────────── */}
      {/* ═══════════════════════════════════════════════════════════════════════ */}
      {currentTab === 'documents' && (
        <div className="pd-tab-content">
          <div className="pd-tab-header">
            <div>
              <h2 className="pd-card-heading">Project Documents, Logs &amp; Reports</h2>
              <p className="pd-card-sub">Architectural plans, engineering specs, daily logs, and site reports</p>
            </div>
            <div className="pd-tab-header-actions">
              <button className="pd-btn-primary" onClick={() => navigate(`/projects/${project.code}/documents`)}>
                + Upload Document
              </button>
            </div>
          </div>

          <div className="pd-docs-shortcuts-grid">
            <div className="pd-doc-tile" onClick={() => navigate(`/projects/${project.code}/documents`)}>
              <span className="pd-doc-tile-icon"><FileText size={32} /></span>
              <h3>Technical Drawings &amp; Specs</h3>
              <p>DWG, PDF, and XLS design files</p>
            </div>

            <div className="pd-doc-tile" onClick={() => navigate(`/projects/${project.code}/issues/report`)}>
              <span className="pd-doc-tile-icon"><AlertTriangle size={32} /></span>
              <h3>Field Issue Reports</h3>
              <p>Report defects, delays, and safety hazards</p>
            </div>

            <div className="pd-doc-tile" onClick={() => navigate(`/projects/${project.code}/reports`)}>
              <span className="pd-doc-tile-icon"><BarChart3 size={32} /></span>
              <h3>Executive Site Reports</h3>
              <p>Formal summaries for clients &amp; managers</p>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════ */}
      {/* ── MODALS ─────────────────────────────────────────────────────────── */}
      {/* ═══════════════════════════════════════════════════════════════════════ */}

      {/* 1. Add Task Modal */}
      {showAddTaskModal && (
        <div className="pm-overlay" onClick={handleCloseAddTaskModal}>
          <div className="pm-modal" onClick={e => e.stopPropagation()}>
            <h2 className="pm-modal-title">Create Task for {project.name}</h2>
            <form onSubmit={handleCreateTask}>
              <div className="pm-form-row pm-form-row--1">
                <div className="pm-form-group">
                  <label>Task Name <span className="pm-required">*</span></label>
                  <input
                    className="pm-input"
                    value={newTaskForm.taskName}
                    onChange={e => setNewTaskForm({ ...newTaskForm, taskName: e.target.value })}
                    placeholder="e.g., Rebar Tying & Inspection"
                    required
                  />
                </div>
              </div>

              <div className="pm-form-row pm-form-row--2">
                <div className="pm-form-group">
                  <label>Construction Phase <span className="pm-required">*</span></label>
                  <select
                    className="pm-input pm-select"
                    value={newTaskForm.phase}
                    onChange={e => setNewTaskForm({ ...newTaskForm, phase: e.target.value })}
                  >
                    {PHASES.map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
                <div className="pm-form-group">
                  <label>Assign Lead Engineer <span className="pm-required">*</span></label>
                  <select
                    className="pm-input pm-select"
                    value={newTaskForm.assigneeId}
                    onChange={e => setNewTaskForm({ ...newTaskForm, assigneeId: e.target.value })}
                  >
                    <option value="">Select an engineer</option>
                    {usersList.map(u => (
                      <option key={u.id} value={u.id}>
                        {u.full_name || u.email} ({u.role})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="pm-form-row pm-form-row--2">
                <div className="pm-form-group">
                  <label>Due Date</label>
                  <input
                    type="date"
                    min={new Date().toISOString().split('T')[0]}
                    className="pm-input"
                    value={newTaskForm.dueDate}
                    onChange={e => setNewTaskForm({ ...newTaskForm, dueDate: e.target.value })}
                  />
                </div>
                <div className="pm-form-group">
                  <label>Priority</label>
                  <select
                    className="pm-input pm-select"
                    value={newTaskForm.priority}
                    onChange={e => setNewTaskForm({ ...newTaskForm, priority: e.target.value as 'High' | 'Medium' | 'Low' })}
                  >
                    <option value="High">High</option>
                    <option value="Medium">Medium</option>
                    <option value="Low">Low</option>
                  </select>
                </div>
              </div>

              {/* Materials & Resources Required Builder */}
              <div className="pm-form-row pm-form-row--1">
                <div className="pm-form-group">
                  <div className="pm-mat-section-header">
                    <label className="pm-mat-main-label" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                      <Package size={16} style={{ color: '#ea580c' }} /> Materials &amp; Resources Required
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
                            className="pm-input pm-mat-input"
                            list="project-stock-options"
                            placeholder="e.g., Portland Cement Type 1"
                            value={matItemInput.name}
                            onChange={e => {
                              const val = e.target.value;
                              const match = resources.find(r => r.name.toLowerCase() === val.toLowerCase());
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
                          <datalist id="project-stock-options">
                            {resources.map(res => (
                              <option key={res.id} value={res.name}>
                                {res.category} ({res.quantity} {res.unit} in stock — {res.supplier || 'General'})
                              </option>
                            ))}
                          </datalist>
                        </div>

                        <div className="pm-mat-field">
                          <label className="pm-mat-label">Category <span className="pm-required">*</span></label>
                          <select
                            className="pm-input pm-select pm-mat-input"
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
                            className="pm-input pm-mat-input"
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
                            className="pm-input pm-mat-input"
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
                            className="pm-input pm-mat-input"
                            list="common-units-list"
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
                          <datalist id="common-units-list">
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
                            className="pm-input pm-mat-input"
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
                            className="pm-input pm-mat-input"
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
                          className="pd-btn-primary pm-mat-add-btn"
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
                            <span className="pm-allocated-mat-icon" style={{ display: 'inline-flex', alignItems: 'center' }}>
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
                                <span className="pm-allocated-mat-detail" title="Supplier" style={{ display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
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
                              aria-label="Remove resource"
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
              </div>

              <div className="pm-form-row pm-form-row--1">
                <div className="pm-form-group">
                  <label>Site Instructions</label>
                  <textarea
                    className="pm-input pm-textarea"
                    value={newTaskForm.siteInstructions}
                    onChange={e => setNewTaskForm({ ...newTaskForm, siteInstructions: e.target.value })}
                    placeholder="Provide detailed instructions for workers and site engineers"
                    rows={3}
                  />
                </div>
              </div>

              {/* Subtasks / Execution Steps Builder */}
              <div className="pm-form-row pm-form-row--1">
                <div className="pm-form-group">
                  <label>Initial Execution Steps / Subtasks (Optional)</label>
                  <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                    <input
                      type="text"
                      className="pm-input"
                      value={modalSubtaskInput}
                      onChange={e => setModalSubtaskInput(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          if (modalSubtaskInput.trim()) {
                            setNewTaskForm(prev => ({
                              ...prev,
                              subtasks: [
                                ...(prev.subtasks || []),
                                {
                                  id: `${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
                                  title: modalSubtaskInput.trim(),
                                  completed: false,
                                },
                              ],
                            }));
                            setModalSubtaskInput('');
                          }
                        }
                      }}
                      placeholder="e.g., Pour concrete foundation, Inspect steel rebar..."
                    />
                    <button
                      type="button"
                      className="pd-btn-primary"
                      style={{ padding: '0 16px', fontSize: '13px', whiteSpace: 'nowrap' }}
                      onClick={() => {
                        if (modalSubtaskInput.trim()) {
                          setNewTaskForm(prev => ({
                            ...prev,
                            subtasks: [
                              ...(prev.subtasks || []),
                              {
                                id: `${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
                                title: modalSubtaskInput.trim(),
                                completed: false,
                              },
                            ],
                          }));
                          setModalSubtaskInput('');
                        }
                      }}
                    >
                      + Add Subtask
                    </button>
                  </div>
                  {newTaskForm.subtasks && newTaskForm.subtasks.length > 0 && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '6px' }}>
                      {newTaskForm.subtasks.map((st, idx) => (
                        <div
                          key={st.id}
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            background: '#f8fafc',
                            border: '1px solid #e2e8f0',
                            borderRadius: '8px',
                            padding: '6px 12px',
                            fontSize: '13px',
                          }}
                        >
                          <span>{idx + 1}. {st.title}</span>
                          <button
                            type="button"
                            style={{
                              background: 'none',
                              border: 'none',
                              color: '#ef4444',
                              cursor: 'pointer',
                              fontWeight: 700,
                              fontSize: '14px',
                            }}
                            onClick={() => {
                              setNewTaskForm(prev => ({
                                ...prev,
                                subtasks: (prev.subtasks || []).filter(s => s.id !== st.id),
                              }));
                            }}
                            aria-label="Remove subtask"
                          >
                            <X size={14} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="pm-modal-actions">
                <button
                  type="button"
                  className="pm-btn-cancel"
                  onClick={handleCloseAddTaskModal}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="pm-btn-create"
                  disabled={addingTask}
                >
                  {addingTask ? 'Creating…' : 'Create Task'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 2. Add Resource Modal */}
      {showAddResourceModal && (
        <div className="pm-overlay" onClick={() => setShowAddResourceModal(false)}>
          <div className="pm-modal" onClick={e => e.stopPropagation()}>
            <h2 className="pm-modal-title">Allocate Resource to {project.name}</h2>
            <form onSubmit={handleCreateResource}>
              <div className="pm-form-row pm-form-row--2">
                <div className="pm-form-group">
                  <label>Resource / Item Name <span className="pm-required">*</span></label>
                  <input
                    className="pm-input"
                    value={resourceForm.name}
                    onChange={e => setResourceForm({ ...resourceForm, name: e.target.value })}
                    placeholder="e.g., Portland Cement Type 1"
                    required
                  />
                </div>
                <div className="pm-form-group">
                  <label>Category <span className="pm-required">*</span></label>
                  <select
                    className="pm-input pm-select"
                    value={resourceForm.category}
                    onChange={e => setResourceForm({ ...resourceForm, category: e.target.value as 'Material' | 'Equipment' })}
                  >
                    <option value="Material">Material</option>
                    <option value="Equipment">Equipment</option>
                  </select>
                </div>
              </div>

              <div className="pm-form-row pm-form-row--2">
                <div className="pm-form-group">
                  <label>Supplier / Vendor</label>
                  <input
                    className="pm-input"
                    value={resourceForm.supplier}
                    onChange={e => setResourceForm({ ...resourceForm, supplier: e.target.value })}
                    placeholder="e.g., Eagle Cement Corp"
                  />
                </div>
                <div className="pm-form-group">
                  <label>Quantity <span className="pm-required">*</span></label>
                  <input
                    type="number"
                    min="0"
                    className="pm-input"
                    value={resourceForm.quantity}
                    onChange={e => setResourceForm({ ...resourceForm, quantity: e.target.value })}
                    placeholder="e.g., 500"
                    required
                  />
                </div>
              </div>

              <div className="pm-form-row pm-form-row--3">
                <div className="pm-form-group">
                  <label>Unit (e.g. bags, tons, units)</label>
                  <input
                    className="pm-input"
                    value={resourceForm.unit}
                    onChange={e => setResourceForm({ ...resourceForm, unit: e.target.value })}
                    placeholder="e.g., bags"
                  />
                </div>
                <div className="pm-form-group">
                  <label>Min Threshold</label>
                  <input
                    type="number"
                    min="0"
                    className="pm-input"
                    value={resourceForm.minThreshold}
                    onChange={e => setResourceForm({ ...resourceForm, minThreshold: e.target.value })}
                    placeholder="e.g., 50"
                  />
                </div>
                <div className="pm-form-group">
                  <label>Unit Price (PHP) <span className="pm-required">*</span></label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    className="pm-input"
                    value={resourceForm.unitPrice}
                    onChange={e => setResourceForm({ ...resourceForm, unitPrice: e.target.value })}
                    placeholder="250.00"
                    required
                  />
                </div>
              </div>

              <div className="pm-modal-actions">
                <button
                  type="button"
                  className="pm-btn-cancel"
                  onClick={() => setShowAddResourceModal(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="pm-btn-create"
                  disabled={addingResource}
                >
                  {addingResource ? 'Allocating…' : 'Allocate Resource'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 3. Invite Code Modal */}
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