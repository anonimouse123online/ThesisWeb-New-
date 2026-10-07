import StatusBadge from './StatusBadge';
import { getWorkProgress, getWorkStatus, type WorkStatusFields } from '../utils/taskWorkStatus';
import './TaskWorkStatus.css';

export function TaskWorkStatusBadge({ item }: { item: WorkStatusFields }) {
  return <StatusBadge status={getWorkStatus(item)} />;
}

export function SubtaskWorkSummary({ subtask }: { subtask: WorkStatusFields }) {
  return (
    <span className="task-subtask-work-summary">
      <TaskWorkStatusBadge item={subtask} />
      <span className="task-subtask-progress">Progress: {getWorkProgress(subtask)}%</span>
    </span>
  );
}
