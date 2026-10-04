import { useEffect, useRef, useState } from 'react';
import { Eye, MapPin, RefreshCw, ShieldCheck, X } from 'lucide-react';
import Dropdown from '../components/Dropdown';
import StatusBadge, { type StatusVariant } from '../components/StatusBadge';
import { fetchSecurityLogs, locationUrl, type SecurityLoginLog, type SecurityLogsPage } from '../utils/securityLogs';
import '../components/Projects.css';
import '../components/AuditTrail.css';

function timestamp(value: string | null): string {
  if (!value) return 'Not provided';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Not provided' : date.toLocaleString(undefined, {
    year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit', timeZoneName: 'short',
  });
}

function securityVariant(status: string | null): StatusVariant {
  // Only choose presentation for a classification supplied by the backend.
  switch (status?.trim().toUpperCase()) {
    case 'NORMAL': return 'completed';
    case 'SUSPICIOUS': return 'delayed';
    case 'NEEDS_REVIEW': return 'pending';
    default: return 'neutral';
  }
}

function SecurityIndicator({ status }: { status: string | null }) {
  return <StatusBadge status={status || 'Not provided'} variant={securityVariant(status)} />;
}

function LogDetails({ log, onClose }: { log: SecurityLoginLog; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const mapUrl = locationUrl(log);
  useEffect(() => {
    const node = dialog.current;
    node?.showModal();
    return () => node?.close();
  }, []);

  const fields: [string, string | number | null][] = [
    ['User / Admin Name', log.user_name], ['Email', log.email], ['Role', log.role],
    ['Event Type', log.event_type], ['Login Status', log.login_status],
    ['Timestamp', timestamp(log.timestamp)], ['IP Address', log.ip_address],
    ['Latitude', log.latitude], ['Longitude', log.longitude],
    ['Accuracy', log.location_accuracy === null ? null : `${log.location_accuracy} m`],
    ['Location Permission Status', log.location_permission_status],
    ['Location', log.location], ['Browser / User Agent', log.user_agent],
    ['Platform', log.platform], ['Language', log.language],
    ['Security Reason', log.security_reason],
  ];

  return (
    <dialog ref={dialog} className="pm-modal audit-dialog" aria-labelledby="security-log-title" onCancel={onClose} onClose={onClose}>
      <div className="audit-dialog-header">
        <h2 id="security-log-title" className="pm-modal-title">Login Security Details</h2>
        <button type="button" className="audit-button" onClick={onClose} aria-label="Close details" autoFocus><X size={18} /></button>
      </div>
      <div className="audit-security-summary"><span>Security Status</span><SecurityIndicator status={log.security_status} /></div>
      <dl className="audit-details">
        {fields.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value ?? 'Not provided'}</dd></div>)}
      </dl>
      <div className="audit-dialog-actions">
        {mapUrl && <a href={mapUrl} target="_blank" rel="noopener noreferrer" referrerPolicy="no-referrer" className="audit-button audit-button-primary"><MapPin size={16} /> View Location</a>}
        <button type="button" className="audit-button" onClick={onClose}>Close</button>
      </div>
    </dialog>
  );
}

export default function AuditTrail() {
  const [result, setResult] = useState<SecurityLogsPage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);
  const [reload, setReload] = useState(0);
  const [search, setSearch] = useState('');
  const [securityStatus, setSecurityStatus] = useState('ALL');
  const [selected, setSelected] = useState<SecurityLoginLog | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      setLoading(true);
      setError('');
      setResult(null);
      try {
        const data = await fetchSecurityLogs(page, controller.signal);
        if (!controller.signal.aborted) setResult(data);
      } catch (error) {
        if (!controller.signal.aborted) setError(error instanceof Error ? error.message : 'Unable to load security logs.');
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }
    void load();
    return () => controller.abort();
  }, [page, reload]);

  const query = search.trim().toLowerCase();
  const logs = (result?.logs ?? []).filter(log => (
    securityStatus === 'ALL' || log.security_status?.trim().toUpperCase() === securityStatus
  ) && (!query || [log.user_name, log.email, log.role, log.ip_address, log.event_type, log.user_agent, log.platform]
    .some(value => value?.toLowerCase().includes(query))));
  const pagination = result?.pagination;

  return (
    <div className="audit-settings">
      <header className="audit-header">
        <div><h2>Audit Trail</h2><p>Review administrative activity and login security records.</p></div>
      </header>
      <section aria-labelledby="security-logs-heading" className="audit-card">
        <div className="audit-section-header">
          <div><h3 id="security-logs-heading"><ShieldCheck size={20} /> Security Logs</h3><p>Security classifications are reported by the server.</p></div>
          <button type="button" className="audit-button" disabled={loading} onClick={() => setReload(value => value + 1)}><RefreshCw size={16} /> Refresh</button>
        </div>
        <div className="audit-filters">
          <label className="audit-search">Search this page<input type="search" placeholder="Name, email, IP address or browser" value={search} onChange={event => setSearch(event.target.value)} /></label>
          <div className="audit-status-filter"><span>Security Status (this page)</span><Dropdown value={securityStatus} onChange={setSecurityStatus} options={[
            { value: 'ALL', label: 'All statuses' }, { value: 'NORMAL', label: 'NORMAL' },
            { value: 'SUSPICIOUS', label: 'SUSPICIOUS' }, { value: 'NEEDS_REVIEW', label: 'NEEDS_REVIEW' },
          ]} /></div>
        </div>
        {loading ? <p className="pm-state-msg" role="status">Loading security logs…</p>
          : error ? <div className="audit-error" role="alert"><p>{error}</p><button type="button" className="audit-button" onClick={() => setReload(value => value + 1)}>Try again</button></div>
          : <>
            <div className="audit-table-scroll" role="region" aria-label="Login security records" tabIndex={0}>
              <table className="pm-table audit-table">
                <caption className="audit-sr-only">Login security audit records</caption>
                <thead><tr>{['Date & Time', 'User / Admin Name', 'Email', 'Role', 'Event Type', 'Login Status', 'Location Status', 'Location', 'IP Address', 'Browser / Device', 'Security Status', 'Action'].map(label => <th scope="col" key={label}>{label}</th>)}</tr></thead>
                <tbody>{logs.length === 0 ? <tr><td colSpan={12} className="pm-state-msg">{result?.logs.length ? 'No records match the filters on this page.' : 'No login security records found.'}</td></tr>
                  : logs.map(log => <tr key={log.id}>
                    <td>{timestamp(log.timestamp)}</td><td className="pm-td-bold">{log.user_name ?? 'Not provided'}</td>
                    <td>{log.email ?? 'Not provided'}</td><td>{log.role ?? 'Not provided'}</td>
                    <td>{log.event_type ?? 'Not provided'}</td><td>{log.login_status ?? 'Not provided'}</td>
                    <td><StatusBadge status={log.location_permission_status ?? 'Not provided'} variant="neutral" /></td>
                    <td>{log.location ?? (locationUrl(log) ? `${log.latitude}, ${log.longitude}` : 'Not available')}</td>
                    <td className="audit-ip">{log.ip_address ?? 'Not provided'}</td>
                    <td><div className="audit-device" title={log.user_agent ?? undefined}>{log.user_agent ?? 'Not provided'}</div><small>{log.platform ?? 'Not provided'}</small></td>
                    <td><SecurityIndicator status={log.security_status} /></td>
                    <td><button type="button" className="audit-button" onClick={() => setSelected(log)} aria-label={`View details for ${log.user_name ?? log.email ?? 'login'} at ${timestamp(log.timestamp)}`}><Eye size={15} /> View Details</button></td>
                  </tr>)}</tbody>
              </table>
            </div>
            <div className="audit-pagination">
              <span>{logs.length} shown on page {pagination?.page ?? page} of {pagination?.total_pages ?? page}{pagination ? ` · ${pagination.total} records` : ''}</span>
              <div><button type="button" className="audit-button" disabled={page <= 1} onClick={() => setPage(value => value - 1)}>Previous</button><button type="button" className="audit-button" disabled={!pagination || page >= pagination.total_pages} onClick={() => setPage(value => value + 1)}>Next</button></div>
            </div>
          </>}
      </section>
      {selected && <LogDetails log={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}
