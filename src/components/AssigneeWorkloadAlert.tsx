import { useEffect, useState, useRef } from 'react';
import {
  CheckCircle2,
  AlertTriangle,
  AlertOctagon,
  Flame,
  ChevronDown,
  ChevronUp,
  Layers,
  Calendar,
  Info
} from 'lucide-react';
import { fetchEngineerWorkload, type WorkloadData } from '../utils/taskWorkload';
import './AssigneeWorkloadAlert.css';

interface AssigneeWorkloadAlertProps {
  assigneeId?: string | null;
  assigneeName?: string;
  startDate?: string;
  dueDate?: string;
  excludeTaskId?: string;
  projectId?: string;
  onWorkloadCalculated?: (data: WorkloadData | null) => void;
}

export default function AssigneeWorkloadAlert({
  assigneeId,
  assigneeName,
  startDate,
  dueDate,
  excludeTaskId,
  projectId,
  onWorkloadCalculated
}: AssigneeWorkloadAlertProps) {
  const [workload, setWorkload] = useState<WorkloadData | null>(null);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!assigneeId) {
      setWorkload(null);
      setLoading(false);
      onWorkloadCalculated?.(null);
      return;
    }

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    setLoading(true);

    debounceTimerRef.current = setTimeout(async () => {
      try {
        const data = await fetchEngineerWorkload(
          assigneeId,
          startDate,
          dueDate,
          excludeTaskId,
          projectId
        );
        setWorkload(data);
        onWorkloadCalculated?.(data);

        // Auto-expand if there are conflicts
        if (data && data.conflictCount > 0) {
          setExpanded(true);
        } else {
          setExpanded(false);
        }
      } catch (err) {
        console.error('Workload check error:', err);
      } finally {
        setLoading(false);
      }
    }, 280);

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [assigneeId, startDate, dueDate, excludeTaskId, projectId]);

  if (!assigneeId) {
    return null;
  }

  if (loading && !workload) {
    return (
      <div className="workload-loading-banner">
        <div className="workload-spinner" />
        <span>Evaluating engineer daily workload and task concurrency…</span>
      </div>
    );
  }

  if (!workload) {
    return null;
  }

  const {
    workloadLevel,
    conflictCount,
    peakConcurrency,
    badgeColor,
    statusLabel,
    advisory,
    conflictingTasks
  } = workload;

  const renderIcon = () => {
    switch (workloadLevel) {
      case 'critical':
        return <Flame size={16} />;
      case 'heavy':
        return <AlertOctagon size={16} />;
      case 'moderate':
        return <AlertTriangle size={16} />;
      case 'optimal':
      default:
        return <CheckCircle2 size={16} />;
    }
  };

  const displayName = assigneeName || workload.assignee.name || 'Selected Engineer';

  return (
    <div className={`workload-alert-container workload-alert-container--${workloadLevel}`}>
      <div className="workload-header" onClick={() => setExpanded(prev => !prev)}>
        <div className="workload-header-left">
          <div className={`workload-status-icon workload-status-icon--${workloadLevel}`}>
            {renderIcon()}
          </div>
          <div className="workload-title-wrap">
            <span className="workload-title">
              {conflictCount === 0
                ? `${displayName} is available for this schedule`
                : `${conflictCount} active task${conflictCount > 1 ? 's' : ''} scheduled for ${displayName}`}
            </span>
            <span className="workload-subtitle">
              {startDate && dueDate
                ? `Schedule: ${startDate} to ${dueDate} · Peak daily load: ${peakConcurrency} task${peakConcurrency > 1 ? 's' : ''}`
                : `Current active commitments · Peak daily load: ${peakConcurrency} task${peakConcurrency > 1 ? 's' : ''}`}
            </span>
          </div>
        </div>

        <div className="workload-header-right">
          <span className={`workload-badge workload-badge--${badgeColor}`}>
            {statusLabel}
          </span>
          <button
            type="button"
            className="workload-toggle-btn"
            aria-label={expanded ? 'Collapse workload details' : 'Expand workload details'}
          >
            {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
        </div>
      </div>

      {expanded && (
        <div className="workload-body">
          <p className="workload-advisory">{advisory}</p>

          {conflictingTasks && conflictingTasks.length > 0 && (
            <div>
              <div className="workload-tasks-heading">
                <Layers size={13} /> Concurrent / Overlapping Tasks ({conflictingTasks.length})
              </div>
              <div className="workload-tasks-list">
                {conflictingTasks.map(task => (
                  <div key={task.id} className="workload-task-item">
                    <div className="workload-task-main">
                      <span className="workload-task-name">{task.taskName}</span>
                      <div className="workload-task-meta">
                        <span className={`workload-project-pill ${task.isCurrentProject ? 'workload-project-pill--current' : ''}`}>
                          {task.projectCode || task.projectName || 'Project'}
                        </span>
                        <span>•</span>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                          <Calendar size={11} /> {task.startDate ? `${task.startDate} → ${task.dueDate}` : `Due: ${task.dueDate}`}
                        </span>
                      </div>
                    </div>

                    <div className="workload-task-pills">
                      <span className={`workload-pill workload-pill--priority-${(task.priority || 'Medium').toLowerCase()}`}>
                        {task.priority || 'Normal'}
                      </span>
                      <span className="workload-pill workload-pill--status">
                        {task.status || 'Active'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Panelist & Engineering Best Practice Note */}
          <div className="workload-guidance-box">
            <Info size={14} />
            <div>
              <strong>Engineering Capacity Rule:</strong> Can an engineer do multiple tasks on the same day?
              {' '}Yes for supervisory or checklist inspections; no for full-time physical site execution.
              SitePulse highlights daily concurrency so managers can make informed delegation decisions without hard-blocking workflow.
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
