import { Fragment, useState, useEffect } from "react";
import AssignTaskModal, { type TaskInfo } from "../pages/Assigntaskmodal";
import "../components/Task.css";

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL;

type Priority = "High" | "Medium" | "Low";
type Status = "in-progress" | "completed" | "blocked" | "Pending" | "pending" | "delayed" | "Delayed" | "Ongoing" | "ongoing";

interface Task {
  id: number;
  task_name: string;
  phase: string;
  assignee: string;
  due_date: string;
  priority: Priority;
  status: Status;
  manpower_needed: string;
  materials_required: string;
  site_instructions: string;
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

// NEW
interface Project {
  id: string;
  code: string;
  name: string;
}

const PHASES = [
  "Phase 1 - Foundation",
  "Phase 2 - Structural",
  "Phase 3 - Electrical",
];

function groupByPhase(tasks: Task[]): Record<string, Task[]> {
  return tasks.reduce((acc, task) => {
    const key = task.phase?.trim() || "Other";
    if (!acc[key]) acc[key] = [];
    acc[key].push(task);
    return acc;
  }, {} as Record<string, Task[]>);
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

function StatusBadge({ status }: { status: Status }) {
  const normalized = status?.toLowerCase().replace(" ", "-");
  return <span className={`task-status-badge task-status-badge--${normalized}`}>{status}</span>;
}

function PriorityBadge({ priority }: { priority: Priority }) {
  return <span className={`task-priority-badge task-priority-badge--${priority?.toLowerCase()}`}>{priority}</span>;
}

function TaskDetailPanel({ task }: { task: Task }) {
  const assignees = task.assignee
    ? task.assignee.split(",").map((s) => s.trim()).filter(Boolean)
    : [];
  const materials = task.materials_required
    ? task.materials_required.split(",").map((s) => s.trim()).filter(Boolean)
    : [];

  return (
    <tr className="tasks-tr-detail">
      <td />
      <td colSpan={9}>
        <div className="tasks-detail-panel">
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

// ── Create Task Form ──
interface CreateTaskFormProps {
  onClose: () => void;
  onCreated: (task: Task) => void;
}

const EMPTY_FORM = {
  taskName: "", phase: "", assigneeId: "", projectId: "", dueDate: "",
  priority: "Medium" as Priority, manpowerNeeded: "",
  materialsRequired: "", siteInstructions: "",
};

function CreateTaskForm({ onClose, onCreated }: CreateTaskFormProps) {
  const [form, setForm]                       = useState(EMPTY_FORM);
  const [loading, setLoading]                 = useState(false);
  const [error, setError]                     = useState<string | null>(null);
  const [users, setUsers]                     = useState<User[]>([]);
  const [usersLoading, setUsersLoading]       = useState(true);
  const [projects, setProjects]               = useState<Project[]>([]);
  const [projectsLoading, setProjectsLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${BACKEND_URL}/users`);
        if (!res.ok) throw new Error("Failed to fetch users.");
        const { data } = await res.json();
        setUsers(data);
      } catch { } finally { setUsersLoading(false); }
    })();
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${BACKEND_URL}/projects`);
        if (!res.ok) throw new Error("Failed to fetch projects.");
        const { data } = await res.json();
        setProjects(data);
      } catch { } finally { setProjectsLoading(false); }
    })();
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setLoading(true); setError(null);
    try {
      const res = await fetch(`${BACKEND_URL}/tasks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          taskName:          form.taskName,
          phase:             form.phase,
          assigneeId:        form.assigneeId,
          projectId:         form.projectId || null,
          dueDate:           form.dueDate,
          priority:          form.priority,
          manpowerNeeded:    form.manpowerNeeded,
          materialsRequired: form.materialsRequired,
          siteInstructions:  form.siteInstructions,
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
      };

      onCreated(taskWithMeta);
      onClose();
    } catch (err: any) { setError(err.message); } finally { setLoading(false); }
  };

  return (
    <div className="ct-overlay" onClick={onClose}>
      <div className="ct-modal" onClick={(e) => e.stopPropagation()}>
        <div className="ct-header">
          <div><h2 className="ct-title">Create Task</h2><p className="ct-subtitle">Add a new task to your project</p></div>
          <button className="ct-close" onClick={onClose}>✕</button>
        </div>
        <form className="ct-form" onSubmit={handleSubmit}>
          {error && <div className="ct-error-banner">{error}</div>}

          <div className="ct-field">
            <label className="ct-label">Task Name <span className="ct-required">*</span></label>
            <input name="taskName" className="ct-input" placeholder="e.g. Foundation Excavation - Section A" value={form.taskName} onChange={handleChange} required />
          </div>

          {/* NEW: Project selector */}
          <div className="ct-field">
            <label className="ct-label">Project <span className="ct-required">*</span></label>
            <select name="projectId" className="ct-select" value={form.projectId} onChange={handleChange} required disabled={projectsLoading}>
              <option value="" disabled>{projectsLoading ? "Loading projects…" : "Select a project"}</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>{p.code} — {p.name}</option>
              ))}
            </select>
          </div>

          <div className="ct-field">
            <label className="ct-label">Phase <span className="ct-required">*</span></label>
            <select name="phase" className="ct-select" value={form.phase} onChange={handleChange} required>
              <option value="" disabled>Select a phase</option>
              {PHASES.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>

          <div className="ct-row">
            <div className="ct-field">
              <label className="ct-label">Assignee <span className="ct-required">*</span></label>
              <select name="assigneeId" className="ct-select" value={form.assigneeId} onChange={handleChange} required disabled={usersLoading}>
                <option value="" disabled>{usersLoading ? "Loading users…" : "Select a user"}</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>{u.full_name} — {u.role}</option>
                ))}
              </select>
            </div>
            <div className="ct-field">
              <label className="ct-label">Due Date <span className="ct-required">*</span></label>
              <input name="dueDate" type="date" className="ct-input" value={form.dueDate} onChange={handleChange} required />
            </div>
          </div>

          <div className="ct-field">
            <label className="ct-label">Priority</label>
            <select name="priority" className="ct-select" value={form.priority} onChange={handleChange}>
              <option value="Low">Low</option><option value="Medium">Medium</option><option value="High">High</option>
            </select>
          </div>
          <div className="ct-field">
            <label className="ct-label">Manpower Needed</label>
            <input name="manpowerNeeded" className="ct-input" placeholder="e.g. 5 workers" value={form.manpowerNeeded} onChange={handleChange} />
          </div>
          <div className="ct-field">
            <label className="ct-label">Materials Required</label>
            <input name="materialsRequired" className="ct-input" placeholder="e.g. Concrete, Steel bars" value={form.materialsRequired} onChange={handleChange} />
          </div>
          <div className="ct-field">
            <label className="ct-label">Site Instructions</label>
            <textarea name="siteInstructions" className="ct-textarea" placeholder="Special instructions for the site..." value={form.siteInstructions} onChange={handleChange} rows={3} />
          </div>
          <div className="ct-footer">
            <button type="button" className="ct-btn ct-btn--cancel" onClick={onClose}>Cancel</button>
            <button type="submit" className="ct-btn ct-btn--submit" disabled={loading}>{loading ? "Creating..." : "+ Create Task"}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Main Page ──
export default function Tasks() {
  const [tasks, setTasks]                     = useState<Task[]>([]);
  const [loading, setLoading]                 = useState(true);
  const [fetchError, setFetchError]           = useState<string | null>(null);
  const [expandedIds, setExpandedIds]         = useState<Set<number>>(new Set());
  const [showCreate, setShowCreate]           = useState(false);
  const [assignTask, setAssignTask]           = useState<TaskInfo | null>(null);
  const [filterProjectId, setFilterProjectId] = useState<string>("");
  const [projects, setProjects]               = useState<Project[]>([]);

  // Fetch projects for the filter dropdown
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${BACKEND_URL}/projects`);
        const { data } = await res.json();
        setProjects(data);
      } catch {}
    })();
  }, []);

  // Re-fetch tasks whenever the project filter changes
  useEffect(() => {
    setLoading(true);
    setFetchError(null);
    (async () => {
      try {
        const url = filterProjectId
          ? `${BACKEND_URL}/tasks?project_id=${filterProjectId}`
          : `${BACKEND_URL}/tasks`;
        const res = await fetch(url);
        if (!res.ok) throw new Error("Failed to fetch tasks.");
        const json = await res.json();
        const list = Array.isArray(json) ? json : Array.isArray(json.data) ? json.data : [];
        setTasks(list);
      } catch (err: any) {
        setFetchError(err.message);
      } finally {
        setLoading(false);
      }
    })();
  }, [filterProjectId]);

  const totalTasks = tasks.length;
  const completed  = tasks.filter((t) => t.status?.toLowerCase() === "completed").length;
  const ongoing    = tasks.filter((t) => ["in-progress","ongoing"].includes(t.status?.toLowerCase())).length;
  const delayed    = tasks.filter((t) => t.status?.toLowerCase() === "delayed").length;
  const grouped    = groupByPhase(tasks);

  const toggleExpand = (id: number) =>
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
      await fetch(`${BACKEND_URL}/tasks/${payload.taskId}/assign`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    } catch (err) {
      console.error("Assign failed:", err);
    } finally {
      setAssignTask(null);
    }
  };

  return (
    <div className="tasks-page">
      {showCreate && (
        <CreateTaskForm
          onClose={() => setShowCreate(false)}
          onCreated={(t) => setTasks((prev) => [t, ...prev])}
        />
      )}

      {assignTask && (
        <AssignTaskModal
          task={assignTask}
          documents={[
            { id: "doc-1", name: "Structural Plans - Foundation Level", tag: "structural" },
            { id: "doc-2", name: "Excavation Safety Protocol",          tag: "safety"     },
            { id: "doc-3", name: "Site Survey Report - Section A",      tag: "survey"     },
          ]}
          onClose={() => setAssignTask(null)}
          onAssign={handleAssign}
        />
      )}

      <div className="tasks-page-header">
        <div>
          <h1 className="tasks-page-title">Task and Subtask Management</h1>
          <p className="tasks-page-subtitle">Create, organize, and track project tasks</p>
        </div>
        <button className="tasks-create-btn" onClick={() => setShowCreate(true)}>+ Create Task</button>
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

      {!loading && !fetchError && Object.entries(grouped).map(([phase, phaseTasks]) => (
        <div className="tasks-table-section" key={phase}>
          <div className="tasks-phase-header">
            <h2 className="tasks-phase-title">{phase}</h2>
            <div className="tasks-phase-filters">
              <button className="tasks-filter-btn">Status ▾</button>
            </div>
          </div>

          <table className="tasks-table">
            <colgroup>
              <col style={{ width: "36px" }} />
              <col style={{ width: "14%" }} />
              <col style={{ width: "16%" }} />
              <col style={{ width: "10%" }} />
              <col style={{ width: "12%" }} />
              <col style={{ width: "10%" }} />
              <col style={{ width: "9%" }} />
              <col style={{ width: "9%" }} />
              <col style={{ width: "6%" }} />
              <col style={{ width: "7%" }} />
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
              {phaseTasks.map((task) => (
                <Fragment key={task.id}>
                  <tr
                    className={`tasks-tr${expandedIds.has(task.id) ? " tasks-tr--expanded" : ""}`}
                    onClick={() => toggleExpand(task.id)}
                  >
                    <td className="tasks-td tasks-td--toggle">
                      <span className={`tasks-chevron${expandedIds.has(task.id) ? " tasks-chevron--open" : ""}`}>›</span>
                    </td>
                    <td className="tasks-td tasks-td--name">{task.task_name}</td>
                    <td className="tasks-td tasks-td--code">{task.code ?? `PRJ-${task.id}`}</td>
                    {/* NEW: Project column */}
                    <td className="tasks-td tasks-td--project">
                      {task.project_code
                        ? <span className="tasks-project-tag">{task.project_code}</span>
                        : <span className="tasks-project-none">—</span>}
                    </td>
                    <td className="tasks-td">{task.assignee}</td>
                    <td className="tasks-td tasks-td--date">
                      {task.due_date
                        ? new Date(task.due_date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
                        : "—"}
                    </td>
                    <td className="tasks-td"><PriorityBadge priority={task.priority} /></td>
                    <td className="tasks-td"><StatusBadge status={task.status} /></td>
                    <td className="tasks-td tasks-td--progress">0%</td>
                    <td className="tasks-td" onClick={(e) => e.stopPropagation()}>
                      <button className="tasks-action-assign" onClick={(e) => handleOpenAssign(task, e)}>Assign</button>
                    </td>
                  </tr>
                  {expandedIds.has(task.id) && <TaskDetailPanel task={task} />}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      ))}

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