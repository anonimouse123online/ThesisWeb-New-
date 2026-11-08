export interface WorkStatusFields {
  status?: string | null;
  progress?: number | string | null;
  progress_pct?: number | string | null;
  completed?: boolean;
  due_date?: string | null;
  dueDate?: string | null;
  end_date?: string | null;
  endDate?: string | null;
  original_due_date?: string | null;
  originalDueDate?: string | null;
  is_extended?: boolean;
  isExtended?: boolean;
}

export interface SubTask extends WorkStatusFields {
  id: string;
  title: string;
}

export function isTaskOverdue(dueDate?: string | null): boolean {
  if (!dueDate) return false;
  const trimmed = String(dueDate).trim();
  if (!trimmed) return false;

  const match = trimmed.match(/^(\d{4}-\d{2}-\d{2})(?:[T\s](\d{2}):(\d{2})(?::(\d{2}))?)?/);
  if (!match) {
    const parsed = new Date(trimmed);
    return !isNaN(parsed.getTime()) && parsed.getTime() < Date.now();
  }

  const [, dateStr, hours, minutes] = match;
  if (hours !== undefined && minutes !== undefined) {
    const dueTime = new Date(trimmed).getTime();
    if (!isNaN(dueTime)) {
      return dueTime < Date.now();
    }
  }

  // Pure calendar date (YYYY-MM-DD): compare with current local date string
  const now = new Date();
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  return dateStr < todayStr;
}

export function isWorkCompleted(item: WorkStatusFields): boolean {
  const status = item.status?.trim();
  const normalized = status ? status.toLowerCase().replace(/[_-]+/g, ' ').replace(/\s+/g, ' ') : '';
  return ['completed', 'complete', 'done', 'approved', 'verified', 'closed'].includes(normalized) || (!status && Boolean(item.completed));
}

// Format saved work status, displaying Delayed when overdue unless already completed.
export function getWorkStatus(item: WorkStatusFields): string {
  const status = item.status?.trim();
  const normalized = status ? status.toLowerCase().replace(/[_-]+/g, ' ').replace(/\s+/g, ' ') : '';
  const isCompleted = ['completed', 'complete', 'done', 'approved', 'verified', 'closed'].includes(normalized) || (!status && Boolean(item.completed));

  if (isCompleted) {
    return 'Completed';
  }

  if (normalized === 'locked') {
    return 'Locked';
  }

  const deadline = item.due_date || item.dueDate || item.end_date || item.endDate;
  if (deadline && isTaskOverdue(deadline)) {
    return 'Delayed';
  }

  if (!status) return 'Pending';

  switch (normalized) {
    case 'pending': return 'Pending';
    case 'ongoing':
    case 'in progress':
    case 'inprogress':
    case 'active': return 'Ongoing';
    case 'delayed':
    case 'late': return 'Delayed';
    case 'blocked': return 'Blocked';
    default: return status.replace(/[_-]+/g, ' ').replace(/\b\w/g, char => char.toUpperCase());
  }
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

export function isTaskExtended(item: WorkStatusFields): boolean {
  const original = item.original_due_date || item.originalDueDate;
  const current = item.due_date || item.dueDate || item.end_date || item.endDate;
  if (!original || !current) return false;
  const origStr = String(original).slice(0, 10);
  const currStr = String(current).slice(0, 10);
  // Extended ONLY when current due date is strictly after (>) the original given due date
  return currStr > origStr;
}

export function getTaskExtensionDays(item: WorkStatusFields): number {
  const original = item.original_due_date || item.originalDueDate;
  const current = item.due_date || item.dueDate || item.end_date || item.endDate;
  if (!original || !current) return 0;
  const origStr = String(original).slice(0, 10);
  const currStr = String(current).slice(0, 10);
  const origTime = new Date(`${origStr}T00:00:00`).getTime();
  const currTime = new Date(`${currStr}T00:00:00`).getTime();
  if (isNaN(origTime) || isNaN(currTime) || currTime <= origTime) return 0;
  return Math.round((currTime - origTime) / (1000 * 60 * 60 * 24));
}
