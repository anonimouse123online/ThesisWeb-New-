import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import '../components/ProjectDetails.css';
import { API_BASE_URL, fetchWithAuth } from '../utils/api';
import ProfileDropdown from '../components/ProfileDropdown';
import { showToast } from '../components/Toast';

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
  'Phase 1 - Foundation',
  'Phase 2 - Structural',
  'Phase 3 - Electrical & Utilities',
  'Phase 4 - Plumbing & MEP',
  'Phase 5 - Finishing',
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
  return raw;
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
            <span className="gc-icon">⟨/⟩</span>
            <div>
              <h2 className="gc-title">Project Invite Code</h2>
              <p className="gc-subtitle">Share this code with your team to join <strong>{project.name}</strong></p>
            </div>
          </div>
          <button className="gc-close-btn" onClick={onClose}>✕</button>
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
                <div className="gc-success-icon">✓</div>
                <p className="gc-success-text">Active invite code ready to share!</p>
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
              <p className="gc-expiry-note">⏱ This code expires in 7 days or after use.</p>
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
    manpowerNeeded: '5 workers',
    materialsRequired: '',
    siteInstructions: '',
  });
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

    setTasks(prev => prev.map(t =>
      String(t.id) === String(taskId) ? { ...t, subtasks: updatedSubtasks } : t
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

  // 6. Inline Add Task
  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!project) return;
    if (!newTaskForm.taskName.trim()) {
      showToast('Task name is required', 'warning');
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
        materialsRequired: newTaskForm.materialsRequired,
        siteInstructions: newTaskForm.siteInstructions,
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
      setNewTaskForm({
        taskName: '',
        phase: PHASES[0],
        assigneeId: '',
        dueDate: '',
        priority: 'Medium',
        manpowerNeeded: '5 workers',
        materialsRequired: '',
        siteInstructions: '',
      });
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
              <button className="pd-btn-activate" onClick={handleActivateProject} disabled={activating}>
                {activating ? 'Activating…' : '▶ Activate Construction'}
              </button>
            )}
            <button className="pd-btn-invite" onClick={() => setShowGenerateModal(true)}>
              ⟨/⟩ Invite Team
            </button>
          </div>
        </div>

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
          <div className="pd-meta-item">
            <p className="pd-meta-label">Active Phase</p>
            <p className="pd-meta-value" style={{ color: '#2563eb' }}>{project.phase || PHASES[0]}</p>
          </div>
        </div>
      </div>

      {/* ─── Merged Tabs Navigation Bar ─── */}
      <div className="pd-tabs-bar">
        <button
          className={`pd-tab-item ${currentTab === 'overview' ? 'pd-tab-item--active' : ''}`}
          onClick={() => setTab('overview')}
        >
          <span className="pd-tab-icon">📊</span>
          Overview &amp; Hub
        </button>

        <button
          className={`pd-tab-item ${currentTab === 'tasks' ? 'pd-tab-item--active' : ''}`}
          onClick={() => setTab('tasks')}
        >
          <span className="pd-tab-icon">📋</span>
          Tasks &amp; Milestones
          <span className="pd-tab-badge">{tasks.length}</span>
        </button>

        <button
          className={`pd-tab-item ${currentTab === 'resources' ? 'pd-tab-item--active' : ''}`}
          onClick={() => setTab('resources')}
        >
          <span className="pd-tab-icon">📦</span>
          Resources &amp; Inventory
          <span className="pd-tab-badge">{resources.length}</span>
        </button>

        <button
          className={`pd-tab-item ${currentTab === 'team' ? 'pd-tab-item--active' : ''}`}
          onClick={() => setTab('team')}
        >
          <span className="pd-tab-icon">👥</span>
          Team ({teamMembers.length})
        </button>

        <button
          className={`pd-tab-item ${currentTab === 'documents' ? 'pd-tab-item--active' : ''}`}
          onClick={() => setTab('documents')}
        >
          <span className="pd-tab-icon">📁</span>
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
              <div className="pd-kpi-icon" style={{ background: '#eff6ff', color: '#2563eb' }}>📋</div>
              <div>
                <p className="pd-kpi-label">Tasks Progress</p>
                <p className="pd-kpi-value">{completedTasksCount} / {totalTasksCount}</p>
                <div className="pd-progress-track">
                  <div className="pd-progress-fill" style={{ width: `${taskProgressPct}%`, background: '#2563eb' }} />
                </div>
                <span className="pd-kpi-sub">{taskProgressPct}% completed ({activeTasksCount} active)</span>
              </div>
            </div>

            <div className="pd-kpi-card" onClick={() => setTab('resources')} style={{ cursor: 'pointer' }}>
              <div className="pd-kpi-icon" style={{ background: '#ecfdf5', color: '#059669' }}>📦</div>
              <div>
                <p className="pd-kpi-label">Inventory &amp; Materials</p>
                <p className="pd-kpi-value">{resources.length} Items</p>
                <span className="pd-kpi-sub" style={{ color: lowStockResources.length > 0 ? '#dc2626' : '#059669', fontWeight: 600 }}>
                  {lowStockResources.length > 0 ? `⚠ ${lowStockResources.length} Low stock alerts` : '✓ All items in stock'}
                </span>
              </div>
            </div>

            <div className="pd-kpi-card">
              <div className="pd-kpi-icon" style={{ background: '#fef3c7', color: '#d97706' }}>💰</div>
              <div>
                <p className="pd-kpi-label">Allocated Inventory Cost</p>
                <p className="pd-kpi-value">{formatCurrency(totalResourceCost)}</p>
                <span className="pd-kpi-sub">Tracked on site</span>
              </div>
            </div>

            <div className="pd-kpi-card" onClick={() => setTab('team')} style={{ cursor: 'pointer' }}>
              <div className="pd-kpi-icon" style={{ background: '#f3e8ff', color: '#7c3aed' }}>👷</div>
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
                <p className="pd-card-sub">Current Active Phase: <strong>{project.phase || PHASES[0]}</strong></p>
              </div>
              <button className="pd-btn-primary" onClick={() => setShowAddTaskModal(true)}>
                + Add Task to Phase
              </button>
            </div>

            <div className="pd-phases-stepper">
              {PHASES.map((pName, index) => {
                const phaseTasks = tasksByPhase[pName] || [];
                const phaseDone = phaseTasks.filter(t => (t.status || '').toLowerCase().includes('completed')).length;
                const isCurrent = (project.phase || PHASES[0]) === pName;
                const isPassed = PHASES.indexOf(project.phase || PHASES[0]) > index;

                return (
                  <div key={pName} className={`pd-phase-step ${isCurrent ? 'pd-phase-step--current' : ''} ${isPassed ? 'pd-phase-step--passed' : ''}`}>
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

          {/* Quick Actions & Short Cuts */}
          <div className="pd-actions-hub-grid">
            <div className="pd-action-box" onClick={() => setTab('tasks')}>
              <div className="pd-action-box-icon" style={{ background: '#eff6ff', color: '#2563eb' }}>📋</div>
              <div>
                <h3>Manage Project Tasks</h3>
                <p>View, assign, update status, and track subtask steps for all phases.</p>
              </div>
            </div>

            <div className="pd-action-box" onClick={() => setTab('resources')}>
              <div className="pd-action-box-icon" style={{ background: '#ecfdf5', color: '#059669' }}>📦</div>
              <div>
                <h3>Material &amp; Equipment Inventory</h3>
                <p>Monitor stock quantities, unit prices, and allocate materials to site.</p>
              </div>
            </div>

            <div className="pd-action-box" onClick={() => navigate(`/projects/${project.code}/progress`)}>
              <div className="pd-action-box-icon" style={{ background: '#fef3c7', color: '#d97706' }}>📈</div>
              <div>
                <h3>Daily Site Progress Log</h3>
                <p>Submit daily logs, weather conditions, manpower, and work summaries.</p>
              </div>
            </div>

            <div className="pd-action-box" onClick={() => navigate(`/projects/${project.code}/issues/report`)}>
              <div className="pd-action-box-icon" style={{ background: '#fef2f2', color: '#dc2626' }}>⚠️</div>
              <div>
                <h3>Report &amp; Track Issues</h3>
                <p>Flag critical site hazards, engineering delays, or quality defects.</p>
              </div>
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
                        + Add to {phaseName.split(' - ')[1] || 'Phase'}
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
                              <th>Manpower</th>
                              <th>Status</th>
                              <th>Actions</th>
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
                                      >
                                        {isExpanded ? '▼' : '▶'}
                                      </button>
                                    </td>
                                    <td>
                                      <span className="pd-task-name" onClick={() => setExpandedTaskId(isExpanded ? null : task.id)}>
                                        {task.task_name}
                                      </span>
                                      {subtasks.length > 0 && (
                                        <span className="pd-subtask-pill">
                                          ✓ {subtasksDone}/{subtasks.length} steps
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
                                    <td className="pd-td-muted">{task.manpower_needed || '—'}</td>
                                    <td>
                                      <select
                                        className={`pd-status-select pd-status-select--${(task.status || 'pending').toLowerCase().replace(/\s+/g, '')}`}
                                        value={task.status || 'Pending'}
                                        onChange={e => handleTaskStatusChange(task.id, e.target.value)}
                                      >
                                        <option value="Pending">Pending</option>
                                        <option value="In Progress">In Progress</option>
                                        <option value="Completed">Completed</option>
                                        <option value="Delayed">Delayed</option>
                                      </select>
                                    </td>
                                    <td>
                                      <button
                                        className="pd-btn-sm"
                                        onClick={() => navigate(`/task/${task.id}`)}
                                      >
                                        Inspect
                                      </button>
                                    </td>
                                  </tr>

                                  {/* Expanded Subtasks & Details Row */}
                                  {isExpanded && (
                                    <tr className="pd-task-detail-row">
                                      <td />
                                      <td colSpan={7}>
                                        <div className="pd-task-detail-card">
                                          <div className="pd-detail-grid">
                                            {/* Subtasks Checklist */}
                                            <div className="pd-subtasks-box">
                                              <h4>Execution Steps &amp; Subtasks</h4>
                                              {subtasks.length === 0 ? (
                                                <p className="pd-td-muted" style={{ fontSize: '12px' }}>No subtasks defined. Break down this task into checklist steps.</p>
                                              ) : (
                                                <div className="pd-subtasks-list">
                                                  {subtasks.map(st => (
                                                    <label key={st.id} className="pd-subtask-item">
                                                      <input
                                                        type="checkbox"
                                                        checked={st.completed}
                                                        onChange={() => handleToggleSubtask(task.id, st.id)}
                                                      />
                                                      <span className={st.completed ? 'pd-subtask-done' : ''}>
                                                        {st.title}
                                                      </span>
                                                    </label>
                                                  ))}
                                                </div>
                                              )}
                                            </div>

                                            {/* Site Instructions & Materials */}
                                            <div className="pd-notes-box">
                                              <h4>Materials &amp; Instructions</h4>
                                              <p><strong>Materials:</strong> {task.materials_required || 'None specified'}</p>
                                              <p><strong>Instructions:</strong> {task.site_instructions || 'Standard engineering protocol'}</p>
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
                          >
                            ✕
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
              <button className="pd-btn-primary" onClick={() => setShowGenerateModal(true)}>
                ⟨/⟩ Generate Invite Code
              </button>
              <button className="pd-btn-secondary" onClick={() => navigate(`/projects/${project.code}/team`)}>
                Manage Full Roster →
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
                    <span className="pd-member-active-tag">● Active On Site</span>
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
              <span className="pd-doc-tile-icon">📄</span>
              <h3>Technical Drawings &amp; Specs</h3>
              <p>DWG, PDF, and XLS design files</p>
            </div>

            <div className="pd-doc-tile" onClick={() => navigate(`/projects/${project.code}/progress`)}>
              <span className="pd-doc-tile-icon">📝</span>
              <h3>Daily Site Progress Logs</h3>
              <p>Daily activity logs &amp; manpower records</p>
            </div>

            <div className="pd-doc-tile" onClick={() => navigate(`/projects/${project.code}/issues/report`)}>
              <span className="pd-doc-tile-icon">⚠️</span>
              <h3>Field Issue Reports</h3>
              <p>Report defects, delays, and safety hazards</p>
            </div>

            <div className="pd-doc-tile" onClick={() => navigate(`/projects/${project.code}/reports`)}>
              <span className="pd-doc-tile-icon">📊</span>
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
        <div className="pm-overlay" onClick={() => setShowAddTaskModal(false)}>
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

              <div className="pm-form-row pm-form-row--3">
                <div className="pm-form-group">
                  <label>Due Date</label>
                  <input
                    type="date"
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
                <div className="pm-form-group">
                  <label>Manpower Needed</label>
                  <input
                    className="pm-input"
                    value={newTaskForm.manpowerNeeded}
                    onChange={e => setNewTaskForm({ ...newTaskForm, manpowerNeeded: e.target.value })}
                    placeholder="e.g., 8 workers"
                  />
                </div>
              </div>

              <div className="pm-form-row pm-form-row--1">
                <div className="pm-form-group">
                  <label>Materials Required</label>
                  <input
                    className="pm-input"
                    value={newTaskForm.materialsRequired}
                    onChange={e => setNewTaskForm({ ...newTaskForm, materialsRequired: e.target.value })}
                    placeholder="e.g., 50 bags cement, 2 tons rebar"
                  />
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

              <div className="pm-modal-actions">
                <button
                  type="button"
                  className="pm-btn-cancel"
                  onClick={() => setShowAddTaskModal(false)}
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