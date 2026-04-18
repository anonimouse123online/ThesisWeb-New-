import { useState, useEffect } from "react";
import "../components/Assigntaskmodal.css";

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL;

/* ── Types ── */
export interface TaskInfo {
  id: string;
  name: string;
  description: string;
  phase: string;
  priority: "High" | "Medium" | "Low";
}

export interface Engineer {
  id: string;
  name: string;
  role: string;
  status: "available" | "busy";
  currentTasks: number;
}

export interface TechDocument {
  id: string;
  name: string;
  tag: string;
}

interface AssignTaskModalProps {
  task: TaskInfo;
  documents?: TechDocument[];
  onClose: () => void;
  onSuccess?: () => void; // optional: refresh task list after assign
}

export interface AssignPayload {
  taskId: string;
  engineerId: string;
  priority: string;
  deadline: string;
  estimatedHours: string;
  documentIds: string[];
  notes: string;
}

/* ── Helpers ── */
const priorityLabel: Record<string, string> = {
  High: "High priority",
  Medium: "Medium priority",
  Low: "Low priority",
};

const initials = (name: string) =>
  (name ?? "?")
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

/* ── Component ── */
export default function AssignTaskModal({
  task,
  documents = [],
  onClose,
  onSuccess,
}: AssignTaskModalProps) {
  const [engineers, setEngineers]               = useState<Engineer[]>([]);
  const [engLoading, setEngLoading]             = useState(true);
  const [selectedEngineer, setSelectedEngineer] = useState<string>("");
  const [priority, setPriority]                 = useState(task.priority);
  const [deadline, setDeadline]                 = useState("");
  const [estimatedHours, setEstimatedHours]     = useState("");
  const [selectedDocs, setSelectedDocs]         = useState<Set<string>>(new Set());
  const [notes, setNotes]                       = useState("");
  const [errors, setErrors]                     = useState<Record<string, string>>({});
  const [submitting, setSubmitting]             = useState(false); // ← loading state
  const [submitError, setSubmitError]           = useState<string | null>(null); // ← error banner

  // ── Fetch real users from DB ──
  useEffect(() => {
    (async () => {
      try {
        const token = localStorage.getItem("auth_token");
        const res = await fetch(`${BACKEND_URL}/users`, {
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
        });
        if (!res.ok) throw new Error("Failed to fetch users.");
        const { data } = await res.json();

        const mapped: Engineer[] = data.map((u: any) => ({
          id:           String(u.id),
          name:         u.full_name ?? u.email,
          role:         u.role,
          status:       Number(u.current_tasks) > 0 ? "busy" : "available",
          currentTasks: Number(u.current_tasks ?? 0),
        }));

        setEngineers(mapped);
        if (mapped.length > 0) setSelectedEngineer(mapped[0].id);
      } catch {
        // silently fail — no users shown
      } finally {
        setEngLoading(false);
      }
    })();
  }, []);

  const toggleDoc = (id: string) => {
    setSelectedDocs((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const validate = () => {
    const e: Record<string, string> = {};
    if (!selectedEngineer) e.engineer = "Please select a user.";
    if (!deadline)         e.deadline = "Deadline is required.";
    return e;
  };

  // ── handleAssign: POST to backend ──
  const handleSubmit = async () => {
    const errs = validate();
    if (Object.keys(errs).length) { setErrors(errs); return; }

    setSubmitting(true);
    setSubmitError(null);

    try {
      const token = localStorage.getItem("auth_token");
      const res = await fetch(`${BACKEND_URL}/tasks`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          taskName:          task.name,
          phase:             task.phase,
          assigneeId:        selectedEngineer,   // ← user.id FK
          dueDate:           deadline,
          priority,
          manpowerNeeded:    estimatedHours,
          materialsRequired: "",
          siteInstructions:  notes,
        }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Failed to assign task.");
      }

      onSuccess?.(); // refresh parent task list if provided
      onClose();     // close modal
    } catch (err: any) {
      setSubmitError(err.message ?? "Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleOverlay = (e: React.MouseEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).classList.contains("atm-overlay")) onClose();
  };

  return (
    <div className="atm-overlay" onMouseDown={handleOverlay}>
      <div className="atm-modal" role="dialog" aria-modal="true" aria-labelledby="atm-title">

        {/* ── Header ── */}
        <div className="atm-header">
          <div>
            <h2 className="atm-title" id="atm-title">Assign task to site engineer</h2>
            <p className="atm-subtitle">Select an engineer and configure assignment details</p>
          </div>
          <button className="atm-close" onClick={onClose} aria-label="Close">&#x2715;</button>
        </div>

        <div className="atm-body">

          {/* ── Submit error banner ── */}
          {submitError && (
            <div className="atm-error-banner">
              {submitError}
            </div>
          )}

          {/* ── Task Card ── */}
          <div className="atm-task-card">
            <span className="atm-task-card__label">Task</span>
            <p className="atm-task-card__name">{task.name}</p>
            <p className="atm-task-card__desc">{task.description}</p>
            <div className="atm-task-card__meta">
              <span><strong>Phase:</strong> {task.phase}</span>
              <span>
                <strong>Current priority:</strong>{" "}
                <span className={`atm-badge atm-badge--${task.priority.toLowerCase()}`}>
                  {task.priority}
                </span>
              </span>
            </div>
          </div>

          {/* ── Engineer Selection ── */}
          <div>
            <p className="atm-section-label">
              Select site engineer <span className="atm-required">*</span>
            </p>
            {errors.engineer && <p className="atm-field-error">{errors.engineer}</p>}

            {engLoading ? (
              <p className="atm-section-label">Loading users…</p>
            ) : engineers.length === 0 ? (
              <p className="atm-section-label">No users found.</p>
            ) : (
              <div className="atm-engineers">
                {engineers.map((eng) => (
                  <button
                    key={eng.id}
                    className={`atm-eng-card${selectedEngineer === eng.id ? " atm-eng-card--selected" : ""}`}
                    onClick={() => {
                      setSelectedEngineer(eng.id);
                      setErrors((e) => ({ ...e, engineer: "" }));
                    }}
                  >
                    <div className="atm-eng-card__top">
                      <div className="atm-eng-card__avatar">{initials(eng.name)}</div>
                      <span className={`atm-pill atm-pill--${eng.status}`}>{eng.status}</span>
                    </div>
                    <p className="atm-eng-card__name">{eng.name}</p>
                    <p className="atm-eng-card__role">{eng.role}</p>
                    <p className="atm-eng-card__tasks">Current tasks: {eng.currentTasks}</p>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* ── Priority & Deadline ── */}
          <div className="atm-row">
            <div className="atm-field">
              <label className="atm-label">
                <span className="atm-label__icon"><FlagIcon /></span>
                Task priority <span className="atm-required">*</span>
              </label>
              <select
                className="atm-select"
                value={priority}
                onChange={(e) => setPriority(e.target.value as TaskInfo["priority"])}
              >
                {(["High", "Medium", "Low"] as const).map((p) => (
                  <option key={p} value={p}>{priorityLabel[p]}</option>
                ))}
              </select>
            </div>

            <div className="atm-field">
              <label className="atm-label">
                <span className="atm-label__icon"><CalendarIcon /></span>
                Deadline <span className="atm-required">*</span>
              </label>
              <input
                className={`atm-input${errors.deadline ? " atm-input--error" : ""}`}
                type="date"
                value={deadline}
                onChange={(e) => {
                  setDeadline(e.target.value);
                  setErrors((err) => ({ ...err, deadline: "" }));
                }}
              />
              {errors.deadline && <p className="atm-field-error">{errors.deadline}</p>}
            </div>
          </div>

          {/* ── Estimated Hours ── */}
          <div className="atm-field">
            <label className="atm-label">Estimated hours</label>
            <input
              className="atm-input"
              type="number"
              min="1"
              placeholder="e.g., 8"
              value={estimatedHours}
              onChange={(e) => setEstimatedHours(e.target.value)}
            />
          </div>

          {/* ── Documents ── */}
          {documents.length > 0 && (
            <div>
              <p className="atm-section-label">
                <DocIcon /> Attach technical documents
              </p>
              <div className="atm-docs-box">
                {documents.map((doc) => (
                  <div
                    key={doc.id}
                    className={`atm-doc-item${selectedDocs.has(doc.id) ? " atm-doc-item--checked" : ""}`}
                    onClick={() => toggleDoc(doc.id)}
                  >
                    <div className={`atm-doc-check${selectedDocs.has(doc.id) ? " atm-doc-check--on" : ""}`} />
                    <div className="atm-doc-icon">&#128196;</div>
                    <div>
                      <p className="atm-doc-name">{doc.name}</p>
                      <p className="atm-doc-tag">{doc.tag}</p>
                    </div>
                  </div>
                ))}
              </div>
              <p className="atm-doc-count">{selectedDocs.size} document(s) selected</p>
            </div>
          )}

          {/* ── Notes ── */}
          <div className="atm-field">
            <label className="atm-label">
              <span className="atm-label__icon"><NoteIcon /></span>
              Special instructions / notes
            </label>
            <textarea
              className="atm-textarea"
              rows={3}
              placeholder="Add any specific instructions, safety requirements, or important notes..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>

          {/* ── Footer ── */}
          <div className="atm-footer">
            <button
              className="atm-btn atm-btn--cancel"
              onClick={onClose}
              disabled={submitting}
            >
              Cancel
            </button>
            <button
              className="atm-btn atm-btn--submit"
              onClick={handleSubmit}
              disabled={submitting}
            >
              <AssignIcon />
              {submitting ? "Assigning…" : "Assign task"}
            </button>
          </div>

        </div>
      </div>
    </div>
  );
}

/* ── Inline SVG Icons ── */
const FlagIcon = () => (
  <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
    <path d="M3 1v14M3 2h9l-2 4 2 4H3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
const CalendarIcon = () => (
  <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
    <rect x="1" y="2" width="14" height="13" rx="2" stroke="currentColor" strokeWidth="1.4" />
    <path d="M1 7h14M5 1v3m6-3v3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
  </svg>
);
const DocIcon = () => (
  <svg width="13" height="13" viewBox="0 0 16 16" fill="none" style={{ display: "inline", marginRight: 6 }}>
    <rect x="2" y="1" width="10" height="14" rx="1.5" stroke="currentColor" strokeWidth="1.4" />
    <path d="M5 5h6M5 8h6M5 11h3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
  </svg>
);
const NoteIcon = () => (
  <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
    <path d="M8 1l1.9 3.8 4.2.6-3 2.9.7 4.2L8 10.4l-3.8 2 .7-4.2-3-2.9 4.2-.6z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
  </svg>
);
const AssignIcon = () => (
  <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
    <circle cx="6" cy="5" r="3" stroke="currentColor" strokeWidth="1.4" />
    <path d="M1 14c0-3 2.2-5 5-5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    <path d="M11 10v5m-2.5-2.5h5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
  </svg>
);