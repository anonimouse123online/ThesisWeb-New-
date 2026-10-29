export type ScheduleStatus = 'VALID' | 'WARNING' | 'INVALID' | 'INSUFFICIENT_DATA';

export interface ScheduleSuggestion {
  startDate?: string;
  dueDate?: string;
  reason: string;
}

export interface ScheduleValidation {
  status: ScheduleStatus;
  warnings: string[];
  errors: string[];
  suggestions: ScheduleSuggestion[];
  availableWorkingDays?: number;
  estimatedDurationDays?: number;
}

export type ScheduleField = 'startDate' | 'dueDate' | 'durationDays' | 'predecessors';

export interface ScheduleIssue {
  title: string;
  message: string;
  guidance: string;
  fields: ScheduleField[];
}

/** Classify individual backend errors using its documented, distinct error entries. */
export function scheduleIssues(validation: ScheduleValidation): ScheduleIssue[] {
  return validation.errors.map(message => {
    const normalized = message.toLowerCase();
    if (normalized.includes('potentially unrealistic schedule')) {
      return { title: 'Insufficient Working Days', message, guidance: 'Adjust the selected dates or estimated task duration.', fields: ['startDate', 'dueDate', 'durationDays'] };
    }
    if (normalized.includes('predecessor') || normalized.includes('dependency') || normalized.includes('cannot begin')) {
      return { title: 'Task Dependency Conflict', message, guidance: 'Review the predecessor relationship or adjust the task start date.', fields: ['startDate', 'predecessors'] };
    }
    if (normalized.includes('estimated duration')) {
      return { title: 'Invalid Estimated Duration', message, guidance: 'Enter a whole number of working days between 1 and 3650.', fields: ['durationDays'] };
    }
    if (normalized.includes('start date') || normalized.includes('due date') || normalized.includes('task dates')) {
      const fields: ScheduleField[] = [];
      if (normalized.includes('start date') || normalized.includes('task dates')) fields.push('startDate');
      if (normalized.includes('due date') || normalized.includes('task dates')) fields.push('dueDate');
      return { title: 'Task Date Conflict', message, guidance: 'Adjust the task dates to fit the project timeline and date order.', fields };
    }
    return { title: 'Schedule Conflict', message, guidance: 'Review this constraint and update the schedule before saving.', fields: [] };
  });
}

export function scheduleFieldMessage(validation: ScheduleValidation | null, field: ScheduleField): string | null {
  if (!validation || validation.status !== 'INVALID') return null;
  if (!scheduleIssues(validation).some(issue => issue.fields.includes(field))) return null;
  switch (field) {
    case 'startDate': return 'Review the start date against this schedule conflict.';
    case 'dueDate': return 'Review the due date against this schedule conflict.';
    case 'durationDays': return 'This duration does not fit the available working days.';
    case 'predecessors': return 'Review the selected predecessor relationship.';
  }
}

export function readScheduleValidation(value: unknown): ScheduleValidation | null {
  if (!value || typeof value !== 'object') return null;
  const candidate = value as Record<string, unknown>;
  if (!['VALID', 'WARNING', 'INVALID', 'INSUFFICIENT_DATA'].includes(String(candidate.status))) return null;
  return {
    status: candidate.status as ScheduleStatus,
    warnings: Array.isArray(candidate.warnings) ? candidate.warnings.filter((item): item is string => typeof item === 'string') : [],
    errors: Array.isArray(candidate.errors) ? candidate.errors.filter((item): item is string => typeof item === 'string') : [],
    suggestions: Array.isArray(candidate.suggestions) ? candidate.suggestions.filter((item): item is ScheduleSuggestion => Boolean(item && typeof item === 'object' && typeof (item as ScheduleSuggestion).reason === 'string')) : [],
    ...(typeof candidate.availableWorkingDays === 'number' ? { availableWorkingDays: candidate.availableWorkingDays } : {}),
    ...(typeof candidate.estimatedDurationDays === 'number' ? { estimatedDurationDays: candidate.estimatedDurationDays } : {}),
  };
}

export function scheduleValidationFromPayload(payload: unknown): ScheduleValidation | null {
  if (!payload || typeof payload !== 'object') return null;
  return readScheduleValidation((payload as Record<string, unknown>).schedule_validation);
}

export function scheduleMessage(payload: unknown, fallback: string): string {
  if (payload && typeof payload === 'object') {
    const body = payload as Record<string, unknown>;
    const validation = scheduleValidationFromPayload(payload);
    if (validation?.errors.length) return validation.errors.join(' ');
    if (typeof body.message === 'string') return body.message;
    if (typeof body.error === 'string') return body.error;
  }
  return fallback;
}
