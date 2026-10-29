export type TimelineScale = 'Day' | 'Week' | 'Month';

const addDays = (date: Date, amount: number) =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate() + amount, 12);

/** A navigable, padded window that remains useful for both short and long schedules. */
export function getScheduleTimelineUnits(anchor: Date, scale: TimelineScale): Date[] {
  if (scale === 'Day') {
    const start = addDays(anchor, -14);
    return Array.from({ length: 57 }, (_, index) => addDays(start, index));
  }
  if (scale === 'Week') {
    const monday = addDays(anchor, -((anchor.getDay() + 6) % 7) - 28);
    return Array.from({ length: 25 }, (_, index) => addDays(monday, index * 7));
  }
  const start = new Date(anchor.getFullYear(), anchor.getMonth() - 6, 1, 12);
  return Array.from({ length: 25 }, (_, index) => new Date(start.getFullYear(), start.getMonth() + index, 1, 12));
}

export function projectTaskMatches(task: { project_id?: string | number; project_code?: string }, project?: { id: string | number; code?: string }): boolean {
  if (!project) return true;
  return String(task.project_id) === String(project.id) || Boolean(project.code && task.project_code === project.code);
}
