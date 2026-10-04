/** Only these issue workflow states require attention. General reports do not. */
export function isActiveIssue(issue: { status?: string | null }): boolean {
  const status = issue.status?.trim().toLowerCase().replace(/[_-]+/g, ' ');
  return status === 'open' || status === 'in progress';
}

export function readActiveIssueCount(value: unknown): number | null {
  if (typeof value !== 'number' && typeof value !== 'string') return null;
  if (typeof value === 'string' && !/^\d+$/.test(value.trim())) return null;
  const count = Number(value);
  return Number.isSafeInteger(count) && count >= 0 ? count : null;
}

/** Accept the existing { data: [...] } API envelope or an unwrapped array. */
export function parseProjectIssues<T extends { status?: string | null }>(payload: unknown): T[] {
  const records = payload && typeof payload === 'object' && 'data' in payload
    ? payload.data
    : payload;
  if (!Array.isArray(records) || records.some(record =>
    !record || typeof record !== 'object' ||
    (record.status != null && typeof record.status !== 'string')
  )) {
    throw new Error('Invalid project issues response');
  }
  return records as T[];
}

export async function fetchActiveIssueCount(
  projectCode: string,
  request: (url: string, options?: RequestInit) => Promise<Response>,
  signal?: AbortSignal,
): Promise<number> {
  // This endpoint already supports project codes. Fetch all issue states because
  // the current backend does not require support for a synthetic "active" state.
  const response = await request(`/projects/${encodeURIComponent(projectCode)}/issues`, { signal });
  if (!response.ok) throw new Error('Failed to load project issues');
  const issues = parseProjectIssues(await response.json());
  return issues.filter(isActiveIssue).length;
}
