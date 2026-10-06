export interface ResolutionFeedback {
  resolution_summary: string;
  resolution_steps: string[];
  final_remarks?: string;
}

export const resolutionValidationMessage = 'Please provide a resolution summary and at least one resolution step.';

/** Trim draft values and exclude unused extra steps before sending feedback. */
export function prepareResolution(feedback: ResolutionFeedback): ResolutionFeedback {
  const resolution_summary = feedback.resolution_summary.trim();
  const resolution_steps = feedback.resolution_steps.map(step => step.trim()).filter(Boolean);
  if (!resolution_summary || !resolution_steps.length) throw new Error(resolutionValidationMessage);
  const final_remarks = feedback.final_remarks?.trim();
  return { resolution_summary, resolution_steps, ...(final_remarks ? { final_remarks } : {}) };
}

export function resolutionErrorMessage(status: number, payload: unknown): string {
  switch (status) {
    case 400: return resolutionValidationMessage;
    case 403: return 'You do not have permission to resolve this issue.';
    case 404: return 'Issue not found.';
    case 409: return 'This issue has already been resolved.';
  }
  if (status >= 500) return 'Unable to resolve the issue. Please try again.';
  if (payload && typeof payload === 'object') {
    const fields = payload as Record<string, unknown>;
    for (const key of ['message', 'error'] as const) {
      const message = fields[key];
      if (typeof message === 'string' && message.trim()) return message;
    }
  }
  return 'Unable to resolve the issue. Please try again.';
}

/** The backend's canonical states use lowercase and underscores. */
export function issueDisplayStatus(status: string): string {
  switch (status.trim().toLowerCase().replace(/[_-]+/g, ' ')) {
    case 'open': return 'Open';
    case 'in progress': return 'In Progress';
    case 'resolved': return 'Resolved';
    default: return status;
  }
}

/** Permit web/relative evidence links; never render executable URL schemes. */
export function safeEvidenceUrl(value: string): string | null {
  try {
    const url = new URL(value, 'https://sitepulse.invalid');
    return ['http:', 'https:'].includes(url.protocol) ? value : null;
  } catch {
    return null;
  }
}
