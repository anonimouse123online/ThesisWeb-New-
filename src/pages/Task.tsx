import React, { Fragment, useState, useEffect } from "react";
import AssignTaskModal from "../pages/Assigntaskmodal";
import { API_BASE_URL, fetchWithAuth } from "../utils/api";
import Dropdown from "../components/Dropdown";
import { showToast } from "../components/Toast";
import "../components/Task.css";

const BACKEND_URL = API_BASE_URL;

type Priority = "High" | "Medium" | "Low";
type Status = "in-progress" | "completed" | "blocked" | "Pending" | "pending" | "delayed" | "Delayed" | "Ongoing" | "ongoing" | "In Progress" | "Completed";

export interface SubTask {
  id: string;
  title: string;
  completed: boolean;
}

interface Task {
  id: number | string;
  task_name: string;
  phase: string;
  assignee: string;
  due_date: string;
  priority: Priority;
  status: Status;
  manpower_needed: string;
  materials_required: string;
  site_instructions: string;
  progress_pct?: number;
  phase_milestone_pct?: number;
  subtasks?: SubTask[];
  project_id?: string;
  project_name?: string;
  project_code?: string;
  code?: string;
}

interface User {
  id: string;
  full_name: string;
  email: string;
  role: string;
}

interface Project {
  id: string;
  code: string;
  name: string;
}

const PHASES = [
  "Phase 1 - Foundation",
  "Phase 2 - Structural",
  "Phase 3 - Electrical & Utilities",
  "Phase 4 - Plumbing & MEP",
  "Phase 5 - Finishing",
];

function normalizePhase(raw?: string): string {
  if (!raw) return PHASES[0];
  const s = raw.toLowerCase().trim();
  if (s.includes("phase 1") || s.includes("foundation")) return PHASES[0];
  if (s.includes("phase 2") || s.includes("structur") || s.includes("structure")) return PHASES[1];
  if (s.includes("phase 3") || s.includes("utilit") || s.includes("electr")) return PHASES[2];
  if (s.includes("phase 4") || s.includes("plumb") || s.includes("mep")) return PHASES[3];
  if (s.includes("phase 5") || s.includes("finish")) return PHASES[4];
  return raw;
}

function groupByPhase(tasks: Task[]): Record<string, Task[]> {
  const result: Record<string, Task[]> = {};
  
  // Initialize standard construction phases in order
  for (const p of PHASES) {
    result[p] = [];
  }

  // Populate tasks into normalized canonical phases
  for (const task of tasks) {
    const canonical = normalizePhase(task.phase);
    if (!result[canonical]) result[canonical] = [];
    result[canonical].push(task);
  }

  return result;
}

function getInitials(name: string): string {
  if (!name) return "?";
  return name.split(" ").slice(0, 2).map((n) => n[0]?.toUpperCase()).join("");
}

function avatarColor(name: string): string {
  const colors = ["#6366f1","#f59e0b","#10b981","#3b82f6","#ec4899","#8b5cf6","#14b8a6","#f97316"];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
}

function PriorityBadge({ priority }: { priority: Priority }) {
  return <span className={`task-priority-badge task-priority-badge--${priority?.toLowerCase()}`}>{priority}</span>;
}

// ── Interactive Detail Panel with Subtasks Checklist ──
interface TaskDetailPanelProps {
  task: Task;
  onToggleSubtask: (taskId: string | number, subtaskId: string) => void;
  onAddSubtask: (taskId: string | number, title: string) => void;
  onDeleteSubtask: (taskId: string | number, subtaskId: string) => void;
  onStatusChange: (taskId: string | number, newStatus: string) => void;
}

function TaskDetailPanel({
  task,
  onToggleSubtask,
  onAddSubtask,
  onDeleteSubtask,
  onStatusChange,
}: TaskDetailPanelProps) {
  const [newSubtaskTitle, setNewSubtaskTitle] = useState("");

  const assignees = task.assignee
    ? task.assignee.split(",").map((s) => s.trim()).filter(Boolean)
    : [];
  const materials = task.materials_required
    ? task.materials_required.split(",").map((s) => s.trim()).filter(Boolean)
    : [];
  const subtasks: SubTask[] = Array.isArray(task.subtasks) ? task.subtasks : [];
  const completedCount = subtasks.filter((s) => s.completed).length;

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSubtaskTitle.trim()) return;
    onAddSubtask(task.id, newSubtaskTitle.trim());
    setNewSubtaskTitle("");
  };

  return (
    <tr className="tasks-tr-detail">
      <td />
      <td colSpan={9}>
        <div className="tasks-detail-panel">
          {/* Subtasks & Execution Steps Checklist */}
          <div className="tdp-section" style={{ background: '#f8fafc', padding: '16px 20px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
            <div className="tdp-subtasks-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#ea580c" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 11l3 3L22 4" /><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11" />
                </svg>
                <p className="tdp-section-title" style={{ margin: 0, color: '#1e293b' }}>
                  Subtasks & Execution Steps
                </p>
                <span className="tdp-subtasks-badge">
                  {completedCount} / {subtasks.length} Done ({task.progress_pct ?? 0}%)
                </span>
              </div>

              {/* Status Quick Select */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ fontSize: '12px', color: '#64748b', fontWeight: 600 }}>Task Status:</span>
                <select
                  className={`tasks-status-select tasks-status-select--${(task.status || 'pending').toLowerCase().replace(' ', '-')}`}
                  value={task.status}
                  onChange={(e) => onStatusChange(task.id, e.target.value)}
                >
                  <option value="Pending">Pending (0%)</option>
                  <option value="In Progress">In Progress (Active)</option>
                  <option value="Completed">Completed (100%)</option>
                  <option value="Delayed">Delayed</option>
                </select>
              </div>
            </div>

            {/* Checklist items */}
            {subtasks.length > 0 ? (
              <div className="tdp-subtasks-list">
                {subtasks.map((st) => (
                  <div
                    key={st.id}
                    className={`tdp-subtask-row ${st.completed ? "tdp-subtask-row--done" : ""}`}
                  >
                    <input
                      type="checkbox"
                      className="tdp-subtask-checkbox"
                      checked={st.completed}
                      onChange={() => onToggleSubtask(task.id, st.id)}
                    />
                    <span className="tdp-subtask-title">{st.title}</span>
                    <button
                      type="button"
                      className="tdp-subtask-delete-btn"
                      onClick={() => onDeleteSubtask(task.id, st.id)}
                      title="Delete step"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <p style={{ fontSize: '12.5px', color: '#94a3b8', margin: '8px 0 12px' }}>
                No execution steps defined yet. Add the first step below to track progress.
              </p>
            )}

            {/* Add step form */}
            <form className="tdp-add-subtask-form" onSubmit={handleAdd}>
              <input
                type="text"
                className="tdp-add-subtask-input"
                placeholder="Add new subtask or execution milestone (e.g., Rebar inspection approved)..."
                value={newSubtaskTitle}
                onChange={(e) => setNewSubtaskTitle(e.target.value)}
              />
              <button type="submit" className="tdp-add-subtask-btn">
                + Add Step
              </button>
            </form>
          </div>

          <div className="tdp-divider" />

          {/* Assigned Field Engineers */}
          <div className="tdp-section">
            <p className="tdp-section-title">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
                <path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
              </svg>
              Assigned Engineers / Workers
            </p>
            {assignees.length > 0 ? (
              <div className="tdp-assignee-list">
                {assignees.map((name) => (
                  <div className="tdp-assignee-chip" key={name}>
                    <span className="tdp-assignee-avatar" style={{ background: avatarColor(name) }}>{getInitials(name)}</span>
                    <div className="tdp-assignee-info">
                      <span className="tdp-assignee-name">{name}</span>
                      <span className="tdp-assignee-role">Field Engineer</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="tdp-empty">No assignees yet — click <strong>Assign</strong> to add workers.</p>
            )}
          </div>

          <div className="tdp-divider" />

          <div className="tdp-info-grid">
            {task.project_name && (
              <div className="tdp-info-item">
                <span className="tdp-info-label">Project</span>
                <span className="tdp-info-value">{task.project_code} — {task.project_name}</span>
              </div>
            )}
            <div className="tdp-info-item">
              <span className="tdp-info-label">Phase Milestone Target</span>
              <span className="tdp-info-value" style={{ color: '#ea580c', fontWeight: 700 }}>
                {task.phase_milestone_pct != null
                  ? `${task.phase_milestone_pct}% (Synced from Project Progress)`
                  : `${task.progress_pct ?? 0}% (Execution Target)`}
              </span>
            </div>
            <div className="tdp-info-item">
              <span className="tdp-info-label">Manpower Needed</span>
              <span className="tdp-info-value">{task.manpower_needed || "—"}</span>
            </div>
            <div className="tdp-info-item">
              <span className="tdp-info-label">Materials Required</span>
              {materials.length > 0 ? (
                <div className="tdp-tag-list">
                  {materials.map((m) => <span className="tdp-tag" key={m}>{m}</span>)}
                </div>
              ) : (
                <span className="tdp-info-value">—</span>
              )}
            </div>
            <div className="tdp-info-item tdp-info-item--full">
              <span className="tdp-info-label">Site Instructions</span>
              <span className="tdp-info-value">{task.site_instructions || "No special instructions provided."}</span>
            </div>
          </div>
        </div>
      </td>
    </tr>
  );
}

interface CreateTaskFormProps {
  initialPhase?: string;
  initialProjectId?: string;
  onClose: () => void;
  onCreated: (task: Task) => void;
}

const EMPTY_FORM = {
  taskName: "", phase: "", assigneeId: "", projectId: "", dueDate: "",
  priority: "Medium" as Priority, manpowerNeeded: "",
  materialsRequired: "", siteInstructions: "",
};

function CreateTaskForm({ initialPhase, initialProjectId, onClose, onCreated }: CreateTaskFormProps) {
  const [form, setForm] = useState({
    ...EMPTY_FORM,
    phase: initialPhase || "Phase 1 - Foundation",
    projectId: initialProjectId || "",
  });
  const [loading, setLoading]                 = useState(false);
  const [error, setError]                     = useState<string | null>(null);
  const [users, setUsers]                     = useState<User[]>([]);
  const [usersLoading, setUsersLoading]       = useState(true);
  const [projects, setProjects]               = useState<Project[]>([]);
  const [projectsLoading, setProjectsLoading] = useState(true);

  useEffect(() => {
    if (initialPhase) {
      setForm((prev) => ({ ...prev, phase: initialPhase }));
    }
  }, [initialPhase]);

  useEffect(() => {
    if (initialProjectId) {
      setForm((prev) => ({ ...prev, projectId: initialProjectId }));
    }
  }, [initialProjectId]);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetchWithAuth(`${BACKEND_URL}/users`);
        if (!res.ok) throw new Error("Failed to fetch users.");
        const { data } = await res.json();
        setUsers(data);
      } catch { } finally { setUsersLoading(false); }
    })();

    (async () => {
      try {
        const res = await fetchWithAuth(`${BACKEND_URL}/projects`);
        if (!res.ok) throw new Error("Failed to fetch projects.");
        const { data } = await res.json();
        setProjects(data);
      } catch { } finally { setProjectsLoading(false); }
    })();
  }, []);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.taskName.trim())          { setError("Task name is required."); return; }
    if (!form.phase)                    { setError("Phase is required."); return; }
    if (!form.projectId)                { setError("Please select a project."); return; }
    if (!form.assigneeId)               { setError("Please select an assignee engineer."); return; }
    if (!form.priority)                 { setError("Priority is required."); return; }
    if (!form.dueDate)                  { setError("Due date is required."); return; }
    if (!form.manpowerNeeded.trim())    { setError("Manpower needed is required (e.g. 5 workers)."); return; }
    if (!form.materialsRequired.trim()) { setError("Materials required is required (e.g. Cement, Rebar)."); return; }
    if (!form.siteInstructions.trim())  { setError("Site instructions are required."); return; }

    setLoading(true);
    setError(null);

    try {
      const res = await fetchWithAuth(`${BACKEND_URL}/tasks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          taskName:          form.taskName.trim(),
          phase:             form.phase,
          assigneeId:        form.assigneeId,
          projectId:         form.projectId,
          dueDate:           form.dueDate,
          priority:          form.priority,
          manpowerNeeded:    form.manpowerNeeded.trim(),
          materialsRequired: form.materialsRequired.trim(),
          siteInstructions:  form.siteInstructions.trim(),
        }),
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error ?? "Failed to create task."); }
      const { data } = await res.json();

      const selectedUser    = users.find((u) => u.id === form.assigneeId);
      const selectedProject = projects.find((p) => p.id === form.projectId);
      const taskWithMeta: Task = {
        ...data,
        assignee:     selectedUser?.full_name ?? "",
        project_name: selectedProject?.name  ?? undefined,
        project_code: selectedProject?.code  ?? undefined,
        progress_pct: 0,
        subtasks: [
          { id: "1", title: "Site preparation & safety check", completed: false },
          { id: "2", title: "Material staging & equipment setup", completed: false }
        ]
      };

      showToast("Task created successfully!", "success");
      onCreated(taskWithMeta);
      onClose();
    } catch (err: any) { setError(err.message); } finally { setLoading(false); }
  };

  return (
    <div className="ct-overlay" onClick={onClose}>
      <div className="ct-modal" onClick={(e) => e.stopPropagation()}>
        <div className="ct-header">
          <div>
            <h2 className="ct-title">Create New Task</h2>
            <p className="ct-subtitle">Fill in all required details below to add a new task.</p>
          </div>
          <button className="ct-close" onClick={onClose} aria-label="Close">&#x2715;</button>
        </div>

        <form className="ct-form" onSubmit={handleSubmit}>
          {error && <div className="ct-error-banner">{error}</div>}

          <div className="ct-field">
            <label className="ct-label">Task Name <span className="ct-required">*</span></label>
            <input
              name="taskName"
              className="ct-input"
              placeholder="e.g. Foundation Pouring - Block A"
              value={form.taskName}
              onChange={handleChange}
              required
            />
          </div>

          <div className="ct-row">
            <div className="ct-field">
              <label className="ct-label">Phase <span className="ct-required">*</span></label>
              <select name="phase" className="ct-select" value={form.phase} onChange={handleChange} required>
                <option value="" disabled>Select a phase</option>
                {PHASES.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>

            <div className="ct-field">
              <label className="ct-label">Project <span className="ct-required">*</span></label>
              <select name="projectId" className="ct-select" value={form.projectId} onChange={handleChange} disabled={projectsLoading} required>
                <option value="" disabled>{projectsLoading ? "Loading projects…" : "Select a project"}</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>{p.code} — {p.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="ct-row">
            <div className="ct-field">
              <label className="ct-label">Assignee <span className="ct-required">*</span></label>
              <select name="assigneeId" className="ct-select" value={form.assigneeId} onChange={handleChange} disabled={usersLoading} required>
                <option value="" disabled>{usersLoading ? "Loading users…" : "Select an engineer"}</option>
                {users.map((u) => <option key={u.id} value={u.id}>{u.full_name} ({u.role})</option>)}
              </select>
            </div>

            <div className="ct-field">
              <label className="ct-label">Priority <span className="ct-required">*</span></label>
              <select name="priority" className="ct-select" value={form.priority} onChange={handleChange} required>
                <option value="High">High</option>
                <option value="Medium">Medium</option>
                <option value="Low">Low</option>
              </select>
            </div>
          </div>

          <div className="ct-row">
            <div className="ct-field">
              <label className="ct-label">Due Date <span className="ct-required">*</span></label>
              <input name="dueDate" type="date" className="ct-input" value={form.dueDate} onChange={handleChange} required />
            </div>

            <div className="ct-field">
              <label className="ct-label">Manpower Needed <span className="ct-required">*</span></label>
              <input name="manpowerNeeded" className="ct-input" placeholder="e.g. 5 workers" value={form.manpowerNeeded} onChange={handleChange} required />
            </div>
          </div>

          <div className="ct-field">
            <label className="ct-label">Materials Required <span className="ct-required">*</span></label>
            <input name="materialsRequired" className="ct-input" placeholder="e.g. Cement, Rebar, Gravel (comma-separated)" value={form.materialsRequired} onChange={handleChange} required />
          </div>

          <div className="ct-field">
            <label className="ct-label">Site Instructions <span className="ct-required">*</span></label>
            <textarea name="siteInstructions" className="ct-textarea" placeholder="Special instructions for the site team…" value={form.siteInstructions} onChange={handleChange} rows={3} required />
          </div>

          <div className="ct-footer">
            <button type="button" className="ct-btn ct-btn--cancel" onClick={onClose} disabled={loading}>Cancel</button>
            <button type="submit" className="ct-btn ct-btn--submit" disabled={loading}>{loading ? "Creating…" : "Create Task"}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Main Tasks Component ──
export default function Tasks() {
  const [tasks, setTasks]                     = useState<Task[]>([]);
  const [loading, setLoading]                 = useState(true);
  const [fetchError, setFetchError]           = useState<string | null>(null);
  const [expandedIds, setExpandedIds]         = useState<Set<number | string>>(new Set());
  const [showCreate, setShowCreate]           = useState(false);
  const [createTaskPhase, setCreateTaskPhase] = useState<string>("Phase 1 - Foundation");
  const [assignTask, setAssignTask]           = useState<import("../pages/Assigntaskmodal").TaskInfo | null>(null);
  const [projects, setProjects]               = useState<Project[]>([]);
  const [filterProjectId, setFilterProjectId] = useState<string>("");

  useEffect(() => {
    (async () => {
      try {
        const res = await fetchWithAuth(`${BACKEND_URL}/projects`);
        if (!res.ok) throw new Error("Failed to fetch projects.");
        const { data } = await res.json();
        setProjects(data);
      } catch (err: any) {
        console.error("Failed to load projects for filter:", err);
      }
    })();
  }, []);

  const fetchTasks = async () => {
    setLoading(true);
    setFetchError(null);
    try {
      const url = filterProjectId
        ? `${BACKEND_URL}/tasks?project_id=${filterProjectId}`
        : `${BACKEND_URL}/tasks`;
      const res = await fetchWithAuth(url);
      if (!res.ok) throw new Error("Failed to fetch tasks.");
      const json = await res.json();
      const list = Array.isArray(json) ? json : Array.isArray(json.data) ? json.data : [];
      setTasks(list);
    } catch (err: any) {
      setFetchError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTasks();
  }, [filterProjectId]);

  // Status Change Handler
  const handleStatusChange = async (taskId: string | number, newStatus: string) => {
    try {
      const res = await fetchWithAuth(`${BACKEND_URL}/tasks/${taskId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });

      if (!res.ok) throw new Error("Failed to update status.");
      const json = await res.json();
      const updated = json.data;

      setTasks((prev) =>
        prev.map((t) =>
          t.id === taskId
            ? { ...t, status: updated.status as Status, progress_pct: updated.progress_pct }
            : t
        )
      );
      showToast(`Task status updated to ${newStatus}`, "success");
    } catch (err: any) {
      showToast(err.message || "Failed to update status", "error");
    }
  };

  // Subtask Toggle Handler
  const handleToggleSubtask = async (taskId: string | number, subtaskId: string) => {
    const task = tasks.find((t) => t.id === taskId);
    if (!task) return;

    const currentSubs: SubTask[] = Array.isArray(task.subtasks) ? [...task.subtasks] : [];
    const updatedSubs = currentSubs.map((st) =>
      st.id === subtaskId ? { ...st, completed: !st.completed } : st
    );

    const doneCount = updatedSubs.filter((s) => s.completed).length;
    const newPct = Math.round((doneCount / updatedSubs.length) * 100);

    // Optimistic UI update
    setTasks((prev) =>
      prev.map((t) =>
        t.id === taskId
          ? {
              ...t,
              subtasks: updatedSubs,
              progress_pct: newPct,
              status: newPct === 100 ? ("Completed" as Status) : newPct > 0 ? ("In Progress" as Status) : t.status,
            }
          : t
      )
    );

    try {
      await fetchWithAuth(`${BACKEND_URL}/tasks/${taskId}/subtasks`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subtasks: updatedSubs }),
      });
    } catch (err) {
      console.error("Failed to sync subtask update", err);
    }
  };

  // Add Subtask Handler
  const handleAddSubtask = async (taskId: string | number, title: string) => {
    const task = tasks.find((t) => t.id === taskId);
    if (!task) return;

    const newSub: SubTask = {
      id: `${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      title,
      completed: false,
    };
    const updatedSubs = [...(Array.isArray(task.subtasks) ? task.subtasks : []), newSub];
    const doneCount = updatedSubs.filter((s) => s.completed).length;
    const newPct = Math.round((doneCount / updatedSubs.length) * 100);

    setTasks((prev) =>
      prev.map((t) =>
        t.id === taskId ? { ...t, subtasks: updatedSubs, progress_pct: newPct } : t
      )
    );

    try {
      await fetchWithAuth(`${BACKEND_URL}/tasks/${taskId}/subtasks`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subtasks: updatedSubs }),
      });
      showToast("Execution step added!", "success");
    } catch (err) {
      console.error("Failed to add subtask", err);
    }
  };

  // Delete Subtask Handler
  const handleDeleteSubtask = async (taskId: string | number, subtaskId: string) => {
    const task = tasks.find((t) => t.id === taskId);
    if (!task) return;

    const currentSubs: SubTask[] = Array.isArray(task.subtasks) ? task.subtasks : [];
    const updatedSubs = currentSubs.filter((s) => s.id !== subtaskId);
    const newPct = updatedSubs.length > 0
      ? Math.round((updatedSubs.filter((s) => s.completed).length / updatedSubs.length) * 100)
      : 0;

    setTasks((prev) =>
      prev.map((t) =>
        t.id === taskId ? { ...t, subtasks: updatedSubs, progress_pct: newPct } : t
      )
    );

    try {
      await fetchWithAuth(`${BACKEND_URL}/tasks/${taskId}/subtasks`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subtasks: updatedSubs }),
      });
    } catch (err) {
      console.error("Failed to delete subtask", err);
    }
  };

  const totalTasks = tasks.length;
  const completed  = tasks.filter((t) => t.status?.toLowerCase() === "completed").length;
  const ongoing    = tasks.filter((t) => ["in-progress","ongoing","in progress"].includes(t.status?.toLowerCase())).length;
  const delayed    = tasks.filter((t) => t.status?.toLowerCase() === "delayed").length;
  const grouped    = groupByPhase(tasks);

  const toggleExpand = (id: number | string) =>
    setExpandedIds((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const handleOpenAssign = (task: Task, e: React.MouseEvent) => {
    e.stopPropagation();
    setAssignTask({
      id: String(task.id),
      name: task.task_name,
      description: task.site_instructions ?? "",
      phase: task.phase,
      priority: task.priority,
    });
  };

  const handleAssign = async (payload: import("../pages/Assigntaskmodal").AssignPayload) => {
    try {
      const res = await fetchWithAuth(`${BACKEND_URL}/tasks/${payload.taskId}/assign`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          assigneeId:       payload.engineerId,
          dueDate:          payload.deadline,
          priority:         payload.priority,
          manpowerNeeded:   payload.estimatedHours,
          siteInstructions: payload.notes,
        }),
      });
      if (res.ok) {
        showToast("Task assigned successfully!", "success");
        fetchTasks();
      }
    } catch (err) {
      console.error("Assign failed:", err);
    } finally {
      setAssignTask(null);
    }
  };

  const [phaseFilters, setPhaseFilters]       = useState<Record<string, string>>({});

  const TASK_STATUS_OPTIONS = [
    { value: 'All', label: 'All Statuses' },
    { value: 'in-progress', label: 'In Progress' },
    { value: 'completed', label: 'Completed' },
    { value: 'pending', label: 'Pending' },
    { value: 'delayed', label: 'Delayed' },
  ];

  return (
    <div className="tasks-page">
      {showCreate && (
        <CreateTaskForm
          initialPhase={createTaskPhase}
          initialProjectId={filterProjectId}
          onClose={() => setShowCreate(false)}
          onCreated={(t) => setTasks((prev) => [t, ...prev])}
        />
      )}

      {assignTask && (
        <AssignTaskModal
          task={assignTask}
          onClose={() => setAssignTask(null)}
          onAssign={handleAssign}
        />
      )}

      <div className="tasks-page-header">
        <div>
          <h1 className="tasks-page-title">Task and Subtask Management</h1>
          <p className="tasks-page-subtitle">Create, organize, and track real-time execution steps</p>
        </div>
        <button
          className="tasks-create-btn"
          onClick={() => {
            setCreateTaskPhase("Phase 1 - Foundation");
            setShowCreate(true);
          }}
        >
          + Create Task
        </button>
      </div>

      <div className="tasks-stats">
        <div className="tasks-stat-card"><span className="tasks-stat-label">Total Task</span><span className="tasks-stat-value">{totalTasks}</span></div>
        <div className="tasks-stat-card"><span className="tasks-stat-label">Completed</span><span className="tasks-stat-value">{completed}</span></div>
        <div className="tasks-stat-card"><span className="tasks-stat-label">On Going</span><span className="tasks-stat-value">{ongoing}</span></div>
        <div className="tasks-stat-card"><span className="tasks-stat-label">Delayed</span><span className="tasks-stat-value">{delayed}</span></div>
      </div>

      {/* Project filter bar */}
      <div className="tasks-filter-bar">
        <span className="tasks-filter-label">Filter by project:</span>
        <select
          className="tasks-filter-select"
          value={filterProjectId}
          onChange={(e) => setFilterProjectId(e.target.value)}
        >
          <option value="">All Projects</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>{p.code} — {p.name}</option>
          ))}
        </select>
      </div>

      {loading    && <div className="tasks-loading">Loading tasks…</div>}
      {fetchError && <div className="tasks-fetch-error">{fetchError}</div>}

      {!loading && !fetchError && (
        PHASES.map((phase) => {
          const phaseTasks = grouped[phase] || [];
          const filterStatus = phaseFilters[phase] || 'All';
          const displayedTasks = filterStatus === 'All'
            ? phaseTasks
            : phaseTasks.filter((t) => {
                const s = (t.status || '').toLowerCase().replace(' ', '-');
                const target = filterStatus.toLowerCase().replace(' ', '-');
                if (target === 'in-progress') return ['in-progress', 'ongoing', 'in progress'].includes(s);
                return s === target;
              });

          return (
            <div className="tasks-table-section" key={phase}>
              <div className="tasks-phase-header">
                <h2 className="tasks-phase-title">{phase} ({displayedTasks.length})</h2>
                <div className="tasks-phase-filters">
                  <Dropdown
                    options={TASK_STATUS_OPTIONS}
                    value={filterStatus}
                    onChange={(val) => setPhaseFilters((prev) => ({ ...prev, [phase]: val }))}
                    prefix="Status"
                  />
                </div>
              </div>

            {displayedTasks.length === 0 ? (
              <div style={{ padding: '2rem 1.5rem', textAlign: 'center', background: '#f8fafc', borderRadius: '10px', margin: '8px 0', border: '1px dashed #cbd5e1' }}>
                <p style={{ margin: '0 0 6px', fontSize: '13.5px', fontWeight: 600, color: '#334155' }}>
                  🚀 {phase} is ready for execution.
                </p>
                <p style={{ margin: '0 0 12px', fontSize: '12px', color: '#64748b' }}>
                  No tasks scheduled in this phase yet. Click below to add the first task.
                </p>
                <button
                  type="button"
                  className="tdp-add-subtask-btn"
                  onClick={() => {
                    setCreateTaskPhase(phase);
                    setShowCreate(true);
                  }}
                  style={{ padding: '6px 16px', fontSize: '12px' }}
                >
                  + Add Task to {phase.split(' - ')[1] || phase}
                </button>
              </div>
            ) : (
              <table className="tasks-table">
                <colgroup>
                  <col style={{ width: "36px" }} />
                  <col style={{ width: "18%" }} />
                  <col style={{ width: "12%" }} />
                  <col style={{ width: "12%" }} />
                  <col style={{ width: "12%" }} />
                  <col style={{ width: "10%" }} />
                  <col style={{ width: "9%" }} />
                  <col style={{ width: "11%" }} />
                  <col style={{ width: "10%" }} />
                  <col style={{ width: "8%" }} />
                </colgroup>
                <thead className="tasks-thead">
                  <tr>
                    <th className="tasks-th tasks-th--toggle" />
                    <th className="tasks-th">Task Name</th>
                    <th className="tasks-th">Task Code</th>
                    <th className="tasks-th">Project</th>
                    <th className="tasks-th">Assignee</th>
                    <th className="tasks-th">Due date</th>
                    <th className="tasks-th">Priority</th>
                    <th className="tasks-th">Status</th>
                    <th className="tasks-th">Progress</th>
                    <th className="tasks-th">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {displayedTasks.map((task) => {
                    const pct = task.progress_pct ?? 0;
                    const statusKey = (task.status || "pending").toLowerCase().replace(" ", "-");

                    return (
                      <Fragment key={task.id}>
                        <tr
                          className={`tasks-tr${expandedIds.has(task.id) ? " tasks-tr--expanded" : ""}`}
                          onClick={() => toggleExpand(task.id)}
                        >
                          <td className="tasks-td tasks-td--toggle">
                            <span className={`tasks-chevron${expandedIds.has(task.id) ? " tasks-chevron--open" : ""}`}>›</span>
                          </td>
                          <td className="tasks-td tasks-td--name">{task.task_name}</td>
                          <td className="tasks-td tasks-td--code">{task.code ?? `PRJ-${String(task.id).slice(0, 8)}`}</td>
                          <td className="tasks-td tasks-td--project">
                            {task.project_code
                              ? <span className="tasks-project-tag">{task.project_code}</span>
                              : <span className="tasks-project-none">—</span>}
                          </td>
                          <td className="tasks-td">{task.assignee || "—"}</td>
                          <td className="tasks-td tasks-td--date">
                            {task.due_date
                              ? new Date(task.due_date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
                              : "—"}
                          </td>
                          <td className="tasks-td"><PriorityBadge priority={task.priority} /></td>
                          
                          {/* Live Interactive Status Dropdown */}
                          <td className="tasks-td" onClick={(e) => e.stopPropagation()}>
                            <select
                              className={`tasks-status-select tasks-status-select--${statusKey}`}
                              value={task.status}
                              onChange={(e) => handleStatusChange(task.id, e.target.value)}
                            >
                              <option value="Pending">Pending</option>
                              <option value="In Progress">In Progress</option>
                              <option value="Completed">Completed</option>
                              <option value="Delayed">Delayed</option>
                            </select>
                          </td>

                          {/* Dynamic Progress Bar */}
                          <td className="tasks-td tasks-td--progress">
                            <div className="task-progress-cell">
                              <div className="task-progress-bar-bg">
                                <div
                                  className="task-progress-bar-fill"
                                  style={{
                                    width: `${pct}%`,
                                    backgroundColor:
                                      pct === 100
                                        ? "#10b981"
                                        : pct > 0
                                        ? "#f59e0b"
                                        : "#cbd5e1",
                                  }}
                                />
                              </div>
                              <span className="task-progress-text">{pct}%</span>
                            </div>
                          </td>

                          <td className="tasks-td" onClick={(e) => e.stopPropagation()}>
                            <button className="tasks-action-assign" onClick={(e) => handleOpenAssign(task, e)}>Assign</button>
                          </td>
                        </tr>

                        {expandedIds.has(task.id) && (
                          <TaskDetailPanel
                            task={task}
                            onToggleSubtask={handleToggleSubtask}
                            onAddSubtask={handleAddSubtask}
                            onDeleteSubtask={handleDeleteSubtask}
                            onStatusChange={handleStatusChange}
                          />
                        )}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        );
      }))}

      {!loading && !fetchError && tasks.length === 0 && (
        <div className="tasks-empty">
          {filterProjectId
            ? "No tasks found for this project."
            : <>No tasks yet. Click <strong>+ Create Task</strong> to get started.</>}
        </div>
      )}
    </div>
  );
}