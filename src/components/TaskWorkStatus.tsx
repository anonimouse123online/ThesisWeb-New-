import StatusBadge from './StatusBadge';
import {
  getWorkProgress,
  getWorkStatus,
  isTaskExtended,
  getTaskExtensionDays,
  type WorkStatusFields,
} from '../utils/taskWorkStatus';
import './TaskWorkStatus.css';

export function TaskWorkStatusBadge({ item }: { item: WorkStatusFields }) {
  const isExtended = isTaskExtended(item);
  const extDays = getTaskExtensionDays(item);

  if (!isExtended) {
    return <StatusBadge status={getWorkStatus(item)} />;
  }

  return (
    <div className="sp-task-status-stack">
      <StatusBadge status={getWorkStatus(item)} />
      <StatusBadge
        status={extDays > 0 ? `Extended (+${extDays}d)` : 'Extended'}
        variant="extended"
        title={item.original_due_date ? `Due date extended from ${item.original_due_date} to ${item.due_date || item.dueDate}` : 'Due date extended'}
      />
    </div>
  );
}

export function SubtaskWorkSummary({ subtask }: { subtask: WorkStatusFields }) {
  return (
    <span className="task-subtask-work-summary">
      <TaskWorkStatusBadge item={subtask} />
      <span className="task-subtask-progress">Progress: {getWorkProgress(subtask)}%</span>
    </span>
  );
}
