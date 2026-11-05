import { fetchWithAuth } from './api';
import { parseProjectIssues, isActiveIssue, type Issue } from './projectIssues';
import {
  issueDisplayStatus,
  prepareResolution,
  resolutionErrorMessage,
  type ResolutionFeedback,
} from './issueResolution';

export interface IssueStatistics {
  total: number;
  open: number;
  inProgress: number;
  resolved: number;
  active: number;
  critical: number;
}

type AuthenticatedRequest = typeof fetchWithAuth;

export function projectIssuesPath(projectCode: string): string {
  return `/projects/${encodeURIComponent(projectCode)}/issues`;
}

export function parseIssueRecords(payload: unknown): Issue[] {
  return parseProjectIssues<Issue>(payload).map(issue => {
    const priority = issue.priority || issue.severity;
    const res = (issue as any).resolution;

    const resolvedByName =
      issue.resolved_by_name ??
      (typeof res?.resolved_by === 'object' ? res?.resolved_by?.name : null) ??
      (typeof res?.resolved_by === 'string' ? res.resolved_by : null) ??
      (typeof issue.resolved_by === 'object' ? (issue.resolved_by as any)?.name : null) ??
      (typeof issue.resolved_by === 'string' ? issue.resolved_by : null) ??
      null;

    const resolvedBy =
      res?.resolved_by ??
      issue.resolved_by ??
      (resolvedByName ? { name: resolvedByName } : null);

    return {
      ...issue,
      status: issueDisplayStatus(issue.status) as Issue['status'],
      priority: (
        priority
          ? priority[0].toUpperCase() + priority.slice(1).toLowerCase()
          : issue.priority
      ) as Issue['priority'],
      resolution_summary:
        res?.resolution_summary ??
        issue.resolution_summary ??
        (issue as any).resolution_notes ??
        null,
      resolution_steps:
        res?.resolution_steps ??
        issue.resolution_steps ??
        null,
      final_remarks:
        res?.final_remarks ??
        issue.final_remarks ??
        null,
      resolved_by_name: resolvedByName,
      resolved_by: resolvedBy,
      resolved_at:
        res?.resolved_at ??
        issue.resolved_at ??
        null,
    };
  });
}

/**
 * Use the existing project issue list endpoint
 * to calculate statistics.
 */
export async function fetchIssueStatistics(
  projectCode: string,
  request: AuthenticatedRequest = fetchWithAuth,
  signal?: AbortSignal,
): Promise<IssueStatistics> {
  const response = await request(projectIssuesPath(projectCode), {
    signal,
    cache: 'no-store',
  });

  if (!response.ok) {
    throw new Error('Unable to refresh issue counts. Please try again.');
  }

  const issues = parseIssueRecords(await response.json());

  return {
    total: issues.length,
    open: issues.filter(issue => issue.status === 'Open').length,
    inProgress: issues.filter(issue => issue.status === 'In Progress').length,
    resolved: issues.filter(issue => issue.status === 'Resolved').length,
    active: issues.filter(isActiveIssue).length,
    critical: issues.filter(
      issue => issue.priority === 'Critical' || issue.priority === 'High',
    ).length,
  };
}

/**
 * Backend route:
 * PATCH /projects/:projectCode/issues/:issueId/resolve
 *
 * Environment variable can still override this if necessary.
 */
export const ISSUE_RESOLUTION_PATH =
  import.meta.env.VITE_ISSUE_RESOLUTION_PATH?.trim() ||
  '/projects/:projectCode/issues/:issueId/resolve';

export async function resolveProjectIssue(
  projectCode: string,
  issueId: string,
  feedback: ResolutionFeedback,
  request: AuthenticatedRequest = fetchWithAuth,
  pathTemplate: string = ISSUE_RESOLUTION_PATH,
): Promise<void> {
  const body = prepareResolution(feedback);

  if (
    !pathTemplate ||
    !pathTemplate.startsWith('/') ||
    !pathTemplate.includes(':issueId') ||
    /[?#]/.test(pathTemplate) ||
    pathTemplate.startsWith('//') ||
    /:[a-zA-Z]+/.test(
      pathTemplate
        .replaceAll(':projectCode', '')
        .replaceAll(':issueId', ''),
    )
  ) {
    throw new Error('The issue resolution endpoint has not been configured or is invalid.');
  }

  const path = pathTemplate
    .replaceAll(':projectCode', encodeURIComponent(projectCode))
    .replaceAll(':issueId', encodeURIComponent(issueId));

  let response: Response;

  try {
    response = await request(path, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
  } catch (error) {
    // Preserve expired-session handling from fetchWithAuth.
    if (
      error instanceof Error &&
      error.message.startsWith('Session expired')
    ) {
      throw error;
    }

    throw new Error('Unable to resolve the issue. Please try again.');
  }

  if (!response.ok) {
    const payload: unknown = await response.json().catch(() => null);

    throw new Error(
      resolutionErrorMessage(response.status, payload),
    );
  }

  // Successful endpoint may return JSON or 204.
  // The issue list/details should be refetched by the caller.
}