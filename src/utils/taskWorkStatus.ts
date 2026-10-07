export interface WorkStatusFields {
  status?: string | null;
  progress?: number | string | null;
  progress_pct?: number | string | null;
  completed?: boolean;
}

export interface SubTask extends WorkStatusFields {
  id: string;
  title: string;
}

// Format saved work status independently of progress and due dates.
export function getWorkStatus(item: WorkStatusFields): string {
  const status = item.status?.trim();
  if (!status) return item.completed ? 'Completed' : 'Pending';

  switch (status.toLowerCase().replace(/[_-]+/g, ' ').replace(/\s+/g, ' ')) {
    case 'pending': return 'Pending';
    case 'ongoing':
    case 'in progress':
    case 'inprogress':
    case 'active': return 'Ongoing';
    case 'completed':
    case 'complete':
    case 'done': return 'Completed';
    case 'delayed':
    case 'late': return 'Delayed';
    case 'blocked': return 'Blocked';
    default: return status.replace(/[_-]+/g, ' ').replace(/\b\w/g, char => char.toUpperCase());
  }
}

export function isWorkCompleted(item: WorkStatusFields): boolean {
  return getWorkStatus(item) === 'Completed';
}

export function getWorkProgress(item: WorkStatusFields, fallback = isWorkCompleted(item) ? 100 : 0): number {
  for (const value of [item.progress, item.progress_pct]) {
    if (value == null || (typeof value === 'string' && value.trim() === '')) continue;
    const number = Number(value);
    if (Number.isFinite(number)) return Math.min(100, Math.max(0, number));
  }
  return fallback;
}

export function getTaskProgress(task: WorkStatusFields & { subtasks?: SubTask[] }): number {
  const subtasks = Array.isArray(task.subtasks) ? task.subtasks : [];
  const legacyProgress = subtasks.length > 0
    ? Math.round(subtasks.filter(isWorkCompleted).length / subtasks.length * 100)
    : (isWorkCompleted(task) ? 100 : 0);
  return getWorkProgress(task, legacyProgress);
}
