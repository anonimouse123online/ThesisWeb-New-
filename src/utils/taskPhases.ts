export const TASK_PHASE_CATEGORIES = [
  'Site Development',
  'Structural',
  'Electrical & Utilities',
  'Plumbing & MEP',
  'Architectural',
  'Construction Phase',
  'Turnover Phase',
] as const;

export interface TaskPhaseFields {
  phase?: string | null;
  phases?: string[] | null;
}

export const taskPhaseRequiredMessage = 'Please select at least one construction phase category.';

/** Map legacy labels only in frontend state/display; never rewrite stored records. */
export function normalizeTaskPhase(value: string): string {
  const label = value.replace(/^Phase\s*\d+\s*[-–:]\s*/i, '').trim();
  const key = label.toLowerCase();
  if (key === 'foundation') return 'Site Development';
  if (key === 'finishing') return 'Architectural';
  return TASK_PHASE_CATEGORIES.find(category => category.toLowerCase() === key) || label;
}

export function getTaskPhases(task: TaskPhaseFields): string[] {
  const values = Array.isArray(task.phases) ? task.phases : typeof task.phase === 'string' ? [task.phase] : [];
  return [...new Set(values.filter(value => typeof value === 'string').map(normalizeTaskPhase).filter(Boolean))];
}

export function formatTaskPhases(task: TaskPhaseFields): string {
  return getTaskPhases(task).join(' • ') || 'Not specified';
}

/** A task appears in each applicable category; callers keep totals based on unique tasks. */
export function groupTasksByPhase<T extends TaskPhaseFields>(tasks: T[]): Record<string, T[]> {
  const groups: Record<string, T[]> = Object.create(null);
  for (const category of TASK_PHASE_CATEGORIES) groups[category] = [];
  for (const task of tasks) {
    const categories = getTaskPhases(task);
    for (const category of categories.length ? categories : ['Uncategorized']) {
      (groups[category] ??= []).push(task);
    }
  }
  return groups;
}

const LEGACY_TASK_PHASES: Record<string, string> = {
  'Site Development': 'Phase 1 - Foundation',
  'Structural': 'Phase 2 - Structural',
  'Electrical & Utilities': 'Phase 3 - Electrical & Utilities',
  'Plumbing & MEP': 'Phase 4 - Plumbing & MEP',
  'Architectural': 'Phase 5 - Finishing',
};

/** The inspected POST /tasks accepts only these five single-string values. */
export function legacyTaskPhasePayload(phases: string[]): { phase: string } {
  const selected = getTaskPhases({ phases });
  if (!selected.length) throw new Error(taskPhaseRequiredMessage);
  if (selected.length > 1) {
    throw new Error('Multiple construction phase categories cannot be saved yet. Please contact your administrator.');
  }
  const phase = Object.hasOwn(LEGACY_TASK_PHASES, selected[0]) ? LEGACY_TASK_PHASES[selected[0]] : undefined;
  if (!phase) {
    throw new Error('The selected construction phase category cannot be saved yet. Please contact your administrator.');
  }
  return { phase };
}
