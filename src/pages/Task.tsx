import { useState, useEffect } from "react";
import AssignTaskModal, { type TaskInfo} from "../pages/Assigntaskmodal";
import "../components/Task.css";

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL;

type Priority = "high" | "medium" | "low";
type Status   = "in-progress" | "completed" | "blocked" | "Pending" | "pending";

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
}

// ── Helpers ───────────────────────────────────────────────

function groupByPhase(tasks: Task[]): Record<string, Task[]> {
  return tasks.reduce((acc, task) => {
    if (!acc[task.phase]) acc[task.phase] = [];
    acc[task.phase].push(task);
    return acc;
  }, {} as Record<string, Task[]>);
}

function getInitial(name: string): string {
  return name?.charAt(0).toUpperCase() ?? "?";
}

// ── Sub-components ────────────────────────────────────────

function StatusBadge({ status }: { status: Status }) {
  const normalized = status?.toLowerCase().replace(" ", "-");
  return (
    <span className={`task-status-badge task-status-badge--${normalized}`}>
      {normalized === "in-progress" && (
        <span className="task-status-icon">
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <circle cx="6" cy="6" r="5" stroke="currentColor" strokeWidth="1.5" />
            <path d="M6 3v3l2 1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </span>
      )}
      {status}
    </span>
  );
}

function PriorityBadge({ priority }: { priority: Priority }) {
  return (
    <span className={`task-priority-badge task-priority-badge--${priority?.toLowerCase()}`}>
      {priority}
    </span>
  );
}

function ProgressBar({ value }: { value: number }) {
  return (
    <div className="task-progress-wrap">
      <div className="task-progress-bar">
        <div className="task-progress-fill" style={{ width: `${value}%` }} />
      </div>
      <span className="task-progress-label">{value}%</span>
    </div>
  );
}

// ── Create Task Form ──────────────────────────────────────

interface CreateTaskFormProps {
  onClose: () => void;
  onCreated: (task: Task) => void;
}

const EMPTY_FORM = {
  taskName: "",
  phase: "",
  assignee: "",
  dueDate: "",
  priority: "medium" as Priority,
  manpowerNeeded: "",
  materialsRequired: "",
  siteInstructions: "",
};

function CreateTaskForm({ onClose, onCreated }: CreateTaskFormProps) {
  const [form, setForm]       = useState(EMPTY_FORM);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState<string | null>(null);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${BACKEND_URL}/tasks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Failed to create task.");
      }
      const { data } = await res.json();
      onCreated(data);
      onClose();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="ct-overlay" onClick={onClose}>
      <div className="ct-modal" onClick={(e) => e.stopPropagation()}>
        <div className="ct-header">
          <div>
            <h2 className="ct-title">Create Task</h2>
            <p className="ct-subtitle">Add a new task to your project</p>
          </div>
          <button className="ct-close" onClick={onClose}>✕</button>
        </div>

        <form className="ct-form" onSubmit={handleSubmit}>
          {error && <div className="ct-error-banner">{error}</div>}

          <div className="ct-field">
            <label className="ct-label">Task Name <span className="ct-required">*</span></label>
            <input name="taskName" className="ct-input"
              placeholder="e.g. Foundation Excavation - Section A"
              value={form.taskName} onChange={handleChange} required />
          </div>

          <div className="ct-field">
            <label className="ct-label">Phase <span className="ct-required">*</span></label>
            <input name="phase" className="ct-input"
              placeholder="e.g. Phase 1 - Foundation"
              value={form.phase} onChange={handleChange} required />
          </div>

          <div className="ct-row">
            <div className="ct-field">
              <label className="ct-label">Assignee <span className="ct-required">*</span></label>
              <input name="assignee" className="ct-input"
                placeholder="e.g. Mike Johnson"
                value={form.assignee} onChange={handleChange} required />
            </div>
            <div className="ct-field">
              <label className="ct-label">Due Date <span className="ct-required">*</span></label>
              <input name="dueDate" type="date" className="ct-input"
                value={form.dueDate} onChange={handleChange} required />
            </div>
          </div>

          <div className="ct-field">
            <label className="ct-label">Priority</label>
            <select name="priority" className="ct-select"
              value={form.priority} onChange={handleChange}>
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
            </select>
          </div>

          <div className="ct-field">
            <label className="ct-label">Manpower Needed</label>
            <input name="manpowerNeeded" className="ct-input"
              placeholder="e.g. 5 workers"
              value={form.manpowerNeeded} onChange={handleChange} />
          </div>

          <div className="ct-field">
            <label className="ct-label">Materials Required</label>
            <input name="materialsRequired" className="ct-input"
              placeholder="e.g. Concrete, Steel bars"
              value={form.materialsRequired} onChange={handleChange} />
          </div>

          <div className="ct-field">
            <label className="ct-label">Site Instructions</label>
            <textarea name="siteInstructions" className="ct-textarea"
              placeholder="Special instructions for the site..."
              value={form.siteInstructions} onChange={handleChange} rows={3} />
          </div>

          <div className="ct-footer">
            <button type="button" className="ct-btn ct-btn--cancel" onClick={onClose}>Cancel</button>
            <button type="submit" className="ct-btn ct-btn--submit" disabled={loading}>
              {loading ? "Creating..." : "+ Create Task"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Table header — rendered once per phase ────────────────

function TaskTableHeader() {
  return (
    <thead className="tasks-thead">
      <tr>
        <th className="tasks-th tasks-th--expand" />
        <th className="tasks-th">Task</th>
        <th className="tasks-th">Status</th>
        <th className="tasks-th">Priority</th>
        <th className="tasks-th">Assignee</th>
        <th className="tasks-th">Progress</th>
        <th className="tasks-th">Due&nbsp;Date</th>
        <th className="tasks-th">Actions</th>
      </tr>
    </thead>
  );
}

// ── Main Page ─────────────────────────────────────────────

export default function Tasks() {
  const [tasks, setTasks]             = useState<Task[]>([]);
  const [loading, setLoading]         = useState(true);
  const [fetchError, setFetchError]   = useState<string | null>(null);
  const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set());
  const [showCreate, setShowCreate]   = useState(false);

  // ── Assign modal state ──
  const [assignTask, setAssignTask]   = useState<TaskInfo | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${BACKEND_URL}/tasks`);
        if (!res.ok) throw new Error("Failed to fetch tasks.");
        const { data } = await res.json();
        setTasks(data);
      } catch (err: any) {
        setFetchError(err.message);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const totalTasks = tasks.length;
  const inProgress = tasks.filter((t) => t.status?.toLowerCase() === "in-progress").length;
  const completed  = tasks.filter((t) => t.status?.toLowerCase() === "completed").length;
  const blocked    = tasks.filter((t) => t.status?.toLowerCase() === "blocked").length;

  const grouped = groupByPhase(tasks);

  const toggleExpand = (id: number) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const handleOpenAssign = (task: Task) => {
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
      {/* Create Task Modal */}
      {showCreate && (
        <CreateTaskForm
          onClose={() => setShowCreate(false)}
          onCreated={(t) => setTasks((prev) => [t, ...prev])}
        />
      )}

      {/* Assign Task Modal */}
      {assignTask && (
        <AssignTaskModal
          task={assignTask}
          engineers={[
            { id: "eng-1", name: "Mike Johnson", role: "Senior Site Engineer", status: "busy",      currentTasks: 3 },
            { id: "eng-2", name: "Sarah Chen",   role: "Site Engineer",        status: "available", currentTasks: 2 },
          ]}
          documents={[
            { id: "doc-1", name: "Structural Plans - Foundation Level", tag: "structural" },
            { id: "doc-2", name: "Excavation Safety Protocol",          tag: "safety"     },
            { id: "doc-3", name: "Site Survey Report - Section A",      tag: "survey"     },
          ]}
          onAssign={handleAssign}
          onClose={() => setAssignTask(null)}
        />
      )}

      {/* Header */}
      <div className="tasks-page-header">
        <div>
          <h1 className="tasks-page-title">Task &amp; Subtask Management</h1>
          <p className="tasks-page-subtitle">Create, organize, and track project tasks</p>
        </div>
        <button className="tasks-create-btn" onClick={() => setShowCreate(true)}>
          <span>+</span> Create Task
        </button>
      </div>

      {/* Stats */}
      <div className="tasks-stats">
        <div className="tasks-stat-card">
          <span className="tasks-stat-label">Total Tasks</span>
          <span className="tasks-stat-value tasks-stat-value--default">{totalTasks}</span>
        </div>
        <div className="tasks-stat-card">
          <span className="tasks-stat-label">In Progress</span>
          <span className="tasks-stat-value tasks-stat-value--blue">{inProgress}</span>
        </div>
        <div className="tasks-stat-card">
          <span className="tasks-stat-label">Completed</span>
          <span className="tasks-stat-value tasks-stat-value--green">{completed}</span>
        </div>
        <div className="tasks-stat-card">
          <span className="tasks-stat-label">Blocked</span>
          <span className="tasks-stat-value tasks-stat-value--red">{blocked}</span>
        </div>
      </div>

      {loading    && <div className="tasks-loading">Loading tasks…</div>}
      {fetchError && <div className="tasks-fetch-error">{fetchError}</div>}

      {/* Phase tables */}
      {!loading && !fetchError && Object.entries(grouped).map(([phase, phaseTasks]) => (
        <div className="tasks-table-section" key={phase}>
          <h2 className="tasks-phase-title">{phase}</h2>

          <table className="tasks-table">
            <colgroup>
              <col style={{ width: "40px" }} />
              <col style={{ width: "30%" }} />
              <col style={{ width: "130px" }} />
              <col style={{ width: "90px" }} />
              <col style={{ width: "16%" }} />
              <col style={{ width: "140px" }} />
              <col style={{ width: "110px" }} />
              <col style={{ width: "120px" }} />
            </colgroup>

            <TaskTableHeader />

            <tbody>
              {phaseTasks.map((task) => (
                <>
                  <tr className="tasks-tr" key={task.id}>
                    {/* Chevron */}
                    <td className="tasks-td tasks-td--expand">
                      <button
                        className={`tasks-chevron${expandedIds.has(task.id) ? " tasks-chevron--open" : ""}`}
                        onClick={() => toggleExpand(task.id)}
                        aria-label="Expand"
                      >›</button>
                    </td>

                    {/* Task name + instructions */}
                    <td className="tasks-td">
                      <div className="tasks-task-name">{task.task_name}</div>
                      {task.site_instructions && (
                        <div className="tasks-task-desc">{task.site_instructions}</div>
                      )}
                    </td>

                    {/* Status */}
                    <td className="tasks-td">
                      <StatusBadge status={task.status} />
                    </td>

                    {/* Priority */}
                    <td className="tasks-td">
                      <PriorityBadge priority={task.priority} />
                    </td>

                    {/* Assignee */}
                    <td className="tasks-td">
                      <div className="tasks-assignee">
                        <span className="tasks-assignee-avatar">{getInitial(task.assignee)}</span>
                        <span className="tasks-assignee-name" title={task.assignee}>
                          {task.assignee}
                        </span>
                      </div>
                    </td>

                    {/* Progress */}
                    <td className="tasks-td">
                      <ProgressBar value={0} />
                    </td>

                    {/* Due Date */}
                    <td className="tasks-td tasks-td--date">{task.due_date}</td>

                    {/* Actions */}
                    <td className="tasks-td">
                      <div className="tasks-actions">
                        <button
                          className="tasks-action-assign"
                          onClick={() => handleOpenAssign(task)}
                        >
                          Assign
                        </button>
                        <button className="tasks-action-add">+</button>
                      </div>
                    </td>
                  </tr>

                  {/* Expanded row */}
                  {expandedIds.has(task.id) && (
                    <tr className="tasks-tr tasks-tr--sub" key={`${task.id}-sub`}>
                      <td />
                      <td colSpan={7}>
                        <div className="tasks-subtask-details">
                          <div className="tasks-detail-row">
                            <span className="tasks-detail-label">Manpower Needed:</span>
                            <span className="tasks-detail-value">{task.manpower_needed || "—"}</span>
                          </div>
                          <div className="tasks-detail-row">
                            <span className="tasks-detail-label">Materials Required:</span>
                            <span className="tasks-detail-value">{task.materials_required || "—"}</span>
                          </div>
                          <div className="tasks-detail-row">
                            <span className="tasks-detail-label">Site Instructions:</span>
                            <span className="tasks-detail-value">{task.site_instructions || "—"}</span>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </>
              ))}
            </tbody>
          </table>
        </div>
      ))}

      {!loading && !fetchError && tasks.length === 0 && (
        <div className="tasks-empty">
          No tasks yet. Click <strong>+ Create Task</strong> to get started.
        </div>
      )}
    </div>
  );
}