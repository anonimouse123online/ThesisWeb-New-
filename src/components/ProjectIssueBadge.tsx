import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, CheckCircle2 } from 'lucide-react';
import { fetchWithAuth } from '../utils/api';
import { fetchActiveIssueCount, readActiveIssueCount } from '../utils/projectIssues';

interface Props {
  projectCode: string;
  activeIssueCount?: number | string | null;
}

export default function ProjectIssueBadge({ projectCode, activeIssueCount }: Props) {
  const backendCount = readActiveIssueCount(activeIssueCount);
  const [result, setResult] = useState<{ projectCode: string; count: number | null } | null>(null);

  useEffect(() => {
    if (backendCount !== null) return;
    const controller = new AbortController();
    fetchActiveIssueCount(projectCode, fetchWithAuth, controller.signal)
      .then(count => {
        if (!controller.signal.aborted) setResult({ projectCode, count });
      })
      .catch(() => {
        if (!controller.signal.aborted) setResult({ projectCode, count: null });
      });
    return () => controller.abort();
  }, [projectCode, backendCount]);

  const currentResult = result?.projectCode === projectCode ? result : null;
  const count = backendCount ?? currentResult?.count ?? null;
  const loading = backendCount === null && currentResult === null;
  const hasIssues = count !== null && count > 0;
  const label = loading ? 'Checking issues…' : count === null ? 'Issues unavailable'
    : hasIssues ? `${count} Active Issue${count === 1 ? '' : 's'}` : 'No Issues';
  const displayLabel = loading ? '…' : count === null ? '?' : hasIssues ? String(count) : null;
  const tone = count === null ? 'neutral' : hasIssues ? 'warning' : 'clear';

  return (
    <Link
      className={`pm-issue-badge pm-issue-badge--${tone}`}
      to={`/projects/${encodeURIComponent(projectCode)}/issues/report?status=active`}
      aria-label={`${projectCode}: ${label}. View active issues`}
      title={count === null && !loading ? 'Could not load the issue count. Open the issue log to check.' : `${label}. View open and in progress issues`}
      aria-busy={loading}
    >
      {hasIssues && <AlertTriangle size={12} aria-hidden="true" />}
      {count === 0 && <CheckCircle2 size={12} aria-hidden="true" />}
      {displayLabel !== null && <span>{displayLabel}</span>}
    </Link>
  );
}
