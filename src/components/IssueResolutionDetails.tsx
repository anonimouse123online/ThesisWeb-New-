import { Check, CheckCircle2, FileText } from 'lucide-react';
import type { Issue } from '../utils/projectIssues';
import { safeEvidenceUrl } from '../utils/issueResolution';
import { apiUrl } from '../utils/api';

export default function IssueResolutionDetails({ issue, id }: { issue: Issue; id: string }) {
  const resolver = issue.resolved_by_name || (typeof issue.resolved_by === 'object' ? issue.resolved_by?.name : null);
  const resolvedAt = issue.resolved_at ? new Date(issue.resolved_at) : null;
  const steps = Array.isArray(issue.resolution_steps) ? issue.resolution_steps.filter(step => typeof step === 'string' && step.trim()) : [];
  const evidence = Array.isArray(issue.resolution_evidence) ? issue.resolution_evidence : [];
  return (
    <section id={id} className="ir-resolution-details" aria-labelledby={`${id}-title`}>
      <div className="ir-resolution-details-heading">
        <h4 id={`${id}-title`}>Resolution Details</h4>
        <span className="ir-resolution-complete"><CheckCircle2 size={14} /> RESOLVED</span>
      </div>
      <dl className="ir-resolution-metadata">
        <div><dt>Resolved by:</dt><dd>{resolver || 'Not recorded'}</dd></div>
        <div><dt>Resolved on:</dt><dd>{resolvedAt && !Number.isNaN(resolvedAt.getTime())
          ? <time dateTime={issue.resolved_at!}>{resolvedAt.toLocaleString('en-US', { year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZoneName: 'short' })}</time>
          : 'Not recorded'}</dd></div>
      </dl>
      <div className="ir-resolution-detail-field">
        <h5>Resolution Summary</h5>
        <p>{issue.resolution_summary || issue.resolution_notes || 'No resolution summary was recorded.'}</p>
      </div>
      <div className="ir-resolution-detail-field">
        <h5>Steps Taken</h5>
        {steps.length ? <ol className="ir-resolution-timeline">
          {steps.map((step, index) => <li key={index}>
            <span className="ir-resolution-step-marker"><Check size={12} aria-hidden="true" /><span>{index + 1}</span></span>
            <p>{step}</p>
          </li>)}
        </ol> : <p>No resolution steps were recorded.</p>}
      </div>
      {issue.final_remarks?.trim() && <div className="ir-resolution-detail-field"><h5>Final Remarks</h5><p>{issue.final_remarks}</p></div>}
      {evidence.length > 0 && <div className="ir-resolution-detail-field"><h5>Evidence</h5>
        <ul className="ir-resolution-evidence">
          {evidence.map((item, index) => {
            const url = typeof item?.url === 'string' ? safeEvidenceUrl(item.url) : null;
            return <li key={item?.id || index}><FileText size={15} aria-hidden="true" />
              {url ? <a href={apiUrl(url)} target="_blank" rel="noopener noreferrer">{item.name || 'Evidence attachment'}</a> : <span>{item?.name || 'Attachment unavailable'}</span>}
            </li>;
          })}
        </ul>
      </div>}
    </section>
  );
}
