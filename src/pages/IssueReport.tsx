import { getErrorMessage } from '../utils/errors';
import React, { useState, useEffect, useCallback, useEffectEvent, useRef } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import '../components/IssueReport.css';
import '../components/ProjectReports.css';
import { API_BASE_URL, fetchWithAuth, apiUrl } from '../utils/api';
import { showToast } from '../utils/toast';
import ProfileDropdown from '../components/ProfileDropdown';
import StatusBadge from '../components/StatusBadge';
import Dropdown from '../components/Dropdown';
import { isActiveIssue, type Issue } from '../utils/projectIssues';
import { fetchIssueStatistics, parseIssueRecords, projectIssuesPath, resolveProjectIssue, type IssueStatistics } from '../utils/issuesApi';
import { safeEvidenceUrl } from '../utils/issueResolution';
import { useAuth } from '../hooks/useAuth';
import ResolveIssueModal from '../components/ResolveIssueModal';
import IssueResolutionDetails from '../components/IssueResolutionDetails';
import {
  AlertCircle,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Search,
  X,
  PartyPopper,
  MapPin,
  User,
  Wrench,
  Calendar,
  ArrowLeft,
  Eye,
  Printer
} from 'lucide-react';

const API_URL = API_BASE_URL;

function AuthenticatedReportImage({ url, alt }: { url: string; alt: string }) {
  const [objectUrl, setObjectUrl] = useState('');
  useEffect(() => {
    let active = true;
    let createdUrl = '';
    const token = localStorage.getItem('token');
    const controller = new AbortController();
    fetchWithAuth(/^https?:\/\//i.test(url) ? url : `${API_URL}${url.startsWith('/') ? '' : '/'}${url}`, { signal: controller.signal })
      .then(response => { if (!response.ok) throw new Error('Image unavailable'); return response.blob(); })
      .then(blob => {
        if (!active || localStorage.getItem('token') !== token) return;
        createdUrl = URL.createObjectURL(blob);
        setObjectUrl(createdUrl);
      }).catch(() => { if (active) setObjectUrl(''); });
    return () => { active = false; controller.abort(); if (createdUrl) URL.revokeObjectURL(createdUrl); };
  }, [url]);
  return objectUrl
    ? <a href={objectUrl} target="_blank" rel="noreferrer" title="Open full image in new tab"><img src={objectUrl} alt={alt} loading="lazy" /></a>
    : <span style={{ padding: '24px 12px', display: 'block', textAlign: 'center', color: '#94a3b8', fontSize: '12px' }}>{alt}</span>;
}

const cleanImageAlt = (image: { url: string; filename?: string; name?: string }, index: number) => {
  const name = image.name || image.filename || '';
  if (!name || /^[a-f0-9-]{20,}/i.test(name) || name.length > 28) {
    return `Inspection photograph ${index + 1}`;
  }
  return name;
};

const CATEGORIES = [
  'Safety Hazard',
  'Material Shortage',
  'Quality Defect',
  'Design Clash',
  'Equipment Breakdown',
  'Weather Delay',
] as const;

const PRIORITIES = ['Critical', 'High', 'Medium', 'Low'] as const;

interface TeamMember {
  id: string;
  name: string;
  role: string;
}

const IssueReport: React.FC = () => {
  const { projectCode } = useParams<{ projectCode: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const canManageIssues = user?.role?.trim().toLowerCase() === 'admin';
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedStatus = searchParams.get('status');
  const statusFilter = requestedStatus === 'active' ? 'Active'
    : ['Open', 'In Progress', 'Resolved'].includes(requestedStatus || '') ? requestedStatus! : 'All';
  const setStatusFilter = (status: string) => {
    setSearchParams(previous => {
      const next = new URLSearchParams(previous);
      if (status === 'All') next.delete('status');
      else next.set('status', status === 'Active' ? 'active' : status);
      return next;
    });
  };

  const [issues, setIssues]               = useState<Issue[]>([]);
  const [teamMembers, setTeamMembers]     = useState<TeamMember[]>([]);
  const [loading, setLoading]             = useState(true);
  const [issueLoadError, setIssueLoadError] = useState('');
  const [search, setSearch]               = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('All');
  const [priorityFilter, setPriorityFilter] = useState<string>('All');
  const [showModal, setShowModal]         = useState(false);
  const [previewIssue, setPreviewIssue]   = useState<Issue | null>(null);
  const [projectData, setProjectData]     = useState<{ name: string; location: string } | null>(null);
  const [resolutionTarget, setResolutionTarget] = useState<{ issue: Issue; projectCode: string } | null>(null);
  const [expandedResolutions, setExpandedResolutions] = useState<string[]>([]);
  const [statistics, setStatistics] = useState<IssueStatistics | null>(null);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const issueRequest = useRef<AbortController | null>(null);
  const statisticsRequest = useRef<AbortController | null>(null);
  const statusPending = useRef(false);
  const previewScrollWrapRef = useRef<HTMLDivElement>(null);

  // Form State
  const [title, setTitle]             = useState('');
  const [category, setCategory]       = useState<string>(CATEGORIES[0]);
  const [priority, setPriority]       = useState<string>('Medium');
  const [location, setLocation]       = useState('');
  const [description, setDescription] = useState('');
  const [assignedTo, setAssignedTo]   = useState('');
  const [submitting, setSubmitting]   = useState(false);

  // Fetch issues
  const fetchIssues = useCallback(async (searchTerm: string) => {
    if (!projectCode) return;
    issueRequest.current?.abort();
    const controller = new AbortController();
    issueRequest.current = controller;
    setLoading(true);
    setIssueLoadError('');
    try {
      const queryParams = new URLSearchParams();
      if (statusFilter !== 'All' && statusFilter !== 'Active') queryParams.append('status', statusFilter);
      if (categoryFilter !== 'All') queryParams.append('category', categoryFilter);
      if (priorityFilter !== 'All') queryParams.append('priority', priorityFilter);
      if (searchTerm.trim()) queryParams.append('search', searchTerm.trim());

      const res = await fetchWithAuth(`${projectIssuesPath(projectCode)}?${queryParams.toString()}`, { signal: controller.signal, cache: 'no-store' });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message || 'Failed to fetch issues');
      const records = parseIssueRecords(json);
      if (controller.signal.aborted) return;
      setIssues(statusFilter === 'Active' ? records.filter(isActiveIssue) : records);
    } catch (err: unknown) {
      if (controller.signal.aborted) return;
      setIssues([]);
      const message = getErrorMessage(err, 'Unable to refresh issues. Please try again.');
      setIssueLoadError(message);
      showToast(message, 'error');
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }, [projectCode, statusFilter, categoryFilter, priorityFilter]);

  const fetchStatistics = useCallback(async () => {
    if (!projectCode) return;
    statisticsRequest.current?.abort();
    const controller = new AbortController();
    statisticsRequest.current = controller;
    setStatistics(null);
    try {
      const next = await fetchIssueStatistics(projectCode, fetchWithAuth, controller.signal);
      if (!controller.signal.aborted) setStatistics(next);
    } catch (error: unknown) {
      if (!controller.signal.aborted) showToast(getErrorMessage(error, 'Unable to refresh issue counts.'), 'error');
    }
  }, [projectCode]);

  // Fetch project team members for assignee dropdown
  const fetchMembers = useCallback(async () => {
    try {
      const res = await fetchWithAuth(`${API_URL}/projects/${projectCode}/members`);
      const json = await res.json();
      if (res.ok) setTeamMembers(json.data || []);
    } catch { /* ignore */ }
  }, [projectCode]);

  // Search is a draft submitted on Enter, not a trigger for automatic fetching.
  const readSearch = useEffectEvent(() => search);
  useEffect(() => {
    fetchIssues(readSearch());
    fetchMembers();
  }, [fetchIssues, fetchMembers]);

  useEffect(() => {
    fetchStatistics();
    return () => {
      issueRequest.current?.abort();
      statisticsRequest.current?.abort();
    };
  }, [fetchStatistics]);

  useEffect(() => {
    if (!projectCode) return;
    fetchWithAuth(`${API_URL}/projects/${projectCode}`)
      .then(res => res.json())
      .then(json => {
        if (json?.data) {
          setProjectData({
            name: json.data.name || json.data.title || '',
            location: json.data.location || '',
          });
        }
      })
      .catch(() => {});
  }, [projectCode]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && previewIssue) {
        setPreviewIssue(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [previewIssue]);

  useEffect(() => {
    if (previewIssue && previewScrollWrapRef.current) {
      previewScrollWrapRef.current.scrollTop = 0;
    }
  }, [previewIssue]);

  const handleStatusChange = async (issue: Issue, newStatus: string) => {
    if (!projectCode || !canManageIssues || issue.status === 'Resolved' || statusPending.current) return;
    if (newStatus === 'Resolved') {
      setResolutionTarget({ issue, projectCode });
      return;
    }
    if (newStatus !== 'Open' && newStatus !== 'In Progress') return;
    statusPending.current = true;
    setUpdatingStatus(true);
    try {
      const res = await fetchWithAuth(`${projectIssuesPath(projectCode)}/${encodeURIComponent(issue.id)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message || 'Failed to update status');

      showToast(`Issue status updated to ${newStatus}.`, 'success');
      window.dispatchEvent(new Event('project-issues-updated'));
      await Promise.all([fetchIssues(search), fetchStatistics()]);
    } catch (err: unknown) {
      showToast(getErrorMessage(err), 'error');
    } finally {
      statusPending.current = false;
      setUpdatingStatus(false);
    }
  };

  const confirmResolution = async (feedback: Parameters<typeof resolveProjectIssue>[2]) => {
    if (!resolutionTarget || resolutionTarget.projectCode !== projectCode || !canManageIssues) {
      throw new Error('You do not have permission to resolve this issue.');
    }
    await resolveProjectIssue(resolutionTarget.projectCode, resolutionTarget.issue.id, feedback);
    setResolutionTarget(null);
    showToast('Issue resolved successfully.', 'success');
    window.dispatchEvent(new Event('project-issues-updated'));
    await Promise.all([fetchIssues(search), fetchStatistics()]);
  };

  const handleCreateIssue = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !description.trim()) {
      showToast('Please fill in required fields.', 'warning');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetchWithAuth(`${API_URL}/projects/${projectCode}/issues`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          category,
          priority,
          location: location.trim(),
          description: description.trim(),
          assigned_to: assignedTo || null,
        }),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.message || 'Failed to report issue');

      showToast('New issue reported successfully!', 'success');
      window.dispatchEvent(new Event('project-issues-updated'));
      setShowModal(false);
      setTitle('');
      setDescription('');
      setLocation('');
      await Promise.all([fetchIssues(search), fetchStatistics()]);
    } catch (err: unknown) {
      showToast(getErrorMessage(err), 'error');
    } finally {
      setSubmitting(false);
    }
  };

  // Stats calculation
  const visibleIssues = statusFilter === 'Active' ? issues.filter(isActiveIssue) : issues;
  const activeCount = statistics?.active ?? '—';
  const totalCount = statistics?.total ?? '—';
  const openCount = statistics?.open ?? '—';
  const inProgCount = statistics?.inProgress ?? '—';
  const resolvedCount = statistics?.resolved ?? '—';
  const criticalCount = statistics?.critical ?? '—';

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

  const categoryOptions = [
    { value: 'All', label: 'All Categories' },
    ...CATEGORIES.map(c => ({ value: c, label: c })),
  ];

  const priorityOptions = [
    { value: 'All', label: 'All Priorities' },
    ...PRIORITIES.map(p => ({ value: p, label: p })),
  ];

  return (
    <main className="ir-page">
      {/* ── Nav & Profile ── */}
      <div className="ir-nav-row">
        <button
          type="button"
          className="pd-back-btn"
          onClick={() => {
            if (window.history.state && window.history.state.idx > 0) {
              navigate(-1);
            } else {
              navigate(projectCode ? `/projects/${projectCode}` : '/projects');
            }
          }}
          title="Back to previous page"
          style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', fontSize: '15px', fontWeight: 700, color: '#0f172a', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
        >
          <ArrowLeft size={16} strokeWidth={2.5} />
          Back
        </button>
        <ProfileDropdown />
      </div>

      {/* ── Header ── */}
      <div className="ir-header">
        <div className="ir-header-left">
          <div className="ir-title-wrap">
            <h1 className="ir-title">Site Issue Tracking & Safety Log</h1>
            <span className="ir-count-badge">{openCount} Open</span>
          </div>
          <p className="ir-subtitle">
            {projectCode} • Log and resolve hazards, defect tickets, quality clashes, and blockers
          </p>
        </div>

        <button className="ir-report-btn" onClick={() => setShowModal(true)}>
          <span>+ Report New Issue</span>
        </button>
      </div>

      {/* ── Metric Cards ── */}
      <div className="ir-stats-grid">
        <div className="ir-stat-card">
          <div className="ir-stat-icon" style={{ background: '#fee2e2', color: '#dc2626' }}>
            <AlertCircle size={22} />
          </div>
          <div className="ir-stat-info">
            <span className="ir-stat-value">{openCount}</span>
            <span className="ir-stat-label">Open Issues</span>
          </div>
        </div>

        <div className="ir-stat-card">
          <div className="ir-stat-icon" style={{ background: '#fef3c7', color: '#d97706' }}>
            <Clock size={22} />
          </div>
          <div className="ir-stat-info">
            <span className="ir-stat-value">{inProgCount}</span>
            <span className="ir-stat-label">In Progress</span>
          </div>
        </div>

        <div className="ir-stat-card">
          <div className="ir-stat-icon" style={{ background: '#dcfce7', color: '#16a34a' }}>
            <CheckCircle2 size={22} />
          </div>
          <div className="ir-stat-info">
            <span className="ir-stat-value">{resolvedCount}</span>
            <span className="ir-stat-label">Resolved</span>
          </div>
        </div>

        <div className="ir-stat-card">
          <div className="ir-stat-icon" style={{ background: '#fee2e2', color: '#991b1b' }}>
            <AlertTriangle size={22} />
          </div>
          <div className="ir-stat-info">
            <span className="ir-stat-value">{criticalCount}</span>
            <span className="ir-stat-label">Critical / High Priority</span>
          </div>
        </div>
      </div>

      {/* ── Filter Toolbar ── */}
      <div className="ir-toolbar">
        <div className="ir-toolbar-top">
          {/* Search bar */}
          <div className="ir-search-wrap">
            <span className="ir-search-icon"><Search size={16} /></span>
            <input
              className="ir-search-input"
              placeholder="Search by issue title, location, or notes..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') fetchIssues(search); }}
            />
            {search && (
              <button className="ir-search-clear" onClick={() => { setSearch(''); fetchIssues(''); }} aria-label="Clear search">
                <X size={14} />
              </button>
            )}
          </div>

          <div style={{ display: 'flex', gap: '10px' }}>
            <Dropdown
              options={categoryOptions}
              value={categoryFilter}
              onChange={setCategoryFilter}
              prefix="Category"
            />
            <Dropdown
              options={priorityOptions}
              value={priorityFilter}
              onChange={setPriorityFilter}
              prefix="Priority"
            />
          </div>
        </div>

        {/* Status Filter Pills */}
        <div className="ir-toolbar-filters">
          {['All', 'Active', 'Open', 'In Progress', 'Resolved'].map((st) => (
            <button
              key={st}
              className={`ir-filter-pill ${statusFilter === st ? 'ir-filter-pill--active' : ''}`}
              onClick={() => setStatusFilter(st)}
            >
              <span>{st}</span>
              <span className="ir-pill-count">
                {st === 'All' ? totalCount : st === 'Active' ? activeCount : st === 'Open' ? openCount : st === 'In Progress' ? inProgCount : resolvedCount}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* ── Content Grid ── */}
      {loading ? (
        <p style={{ textAlign: 'center', padding: '3rem', color: '#64748b' }}>Loading issues log…</p>
      ) : issueLoadError ? (
        <div className="ir-card">
          <p role="alert">{issueLoadError}</p>
          <button type="button" className="ir-resolution-view" onClick={() => {
            void Promise.all([fetchIssues(search), fetchStatistics()]);
          }}>Retry</button>
        </div>
      ) : visibleIssues.length === 0 ? (
        <div style={{
          background: '#fff', borderRadius: '16px', border: '1.5px dashed #cbd5e1',
          padding: '48px 24px', textAlign: 'center', margin: '20px 0',
        }}>
          <PartyPopper size={44} style={{ color: '#16a34a', display: 'block', margin: '0 auto 10px' }} />
          <h3 style={{ fontSize: '16px', fontWeight: 700, margin: '0 0 6px' }}>No issues found</h3>
          <p style={{ color: '#64748b', fontSize: '13px', margin: 0 }}>
            {statusFilter !== 'All' || categoryFilter !== 'All' ? 'No tickets match the active filters.' : 'All clear! No site issues reported for this project.'}
          </p>
        </div>
      ) : (
        <div className="ir-grid">
          {visibleIssues.map((issue) => {
            const prioClass = `prio-${issue.priority.toLowerCase()}`;

            return (
              <div key={issue.id} className="ir-card">
                <div>
                  <div className="ir-card-top">
                    <div className="ir-badges-row">
                      <StatusBadge status={issue.status} />
                      <span className={`ir-badge-priority ${prioClass}`}>{issue.priority}</span>
                    </div>
                    <span className="ir-card-category">{issue.category}</span>
                  </div>

                  <h3 className="ir-card-title" style={{ marginTop: '12px' }}>{issue.title}</h3>
                  <p className="ir-card-desc" style={{ marginTop: '6px' }}>{issue.description}</p>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <div className="ir-card-meta">
                    {issue.location && (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                        <MapPin size={13} /> {issue.location}
                      </span>
                    )}
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                      <User size={13} /> Reported by: {issue.reporter_name || 'Site Engineer'}
                    </span>
                    {issue.assignee_name && (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                        <Wrench size={13} /> Assigned to: {issue.assignee_name}
                      </span>
                    )}
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                      <Calendar size={13} /> Date: {formatDate(issue.created_at)}
                    </span>
                  </div>

                  <div className="ir-card-footer">
                    {issue.status === 'Resolved' ? (
                      <>
                        <span className="ir-resolution-complete">Resolved <CheckCircle2 size={14} /></span>
                        <div className="ir-footer-actions">
                          <button
                            type="button"
                            className="ir-btn-preview"
                            onClick={() => setPreviewIssue(issue)}
                            title="Preview issue report details"
                          >
                            <Eye size={13} /> Preview
                          </button>
                          <button
                            type="button"
                            className="ir-resolution-view"
                            aria-expanded={expandedResolutions.includes(issue.id)}
                            aria-controls={`ir-resolution-${issue.id}`}
                            onClick={() => setExpandedResolutions(previous => previous.includes(issue.id) ? [] : [issue.id])}
                          >
                            {expandedResolutions.includes(issue.id) ? 'Hide Resolution' : 'View Resolution'}
                          </button>
                        </div>
                      </>
                    ) : canManageIssues ? (
                      <>
                        <div className="ir-status-update-wrap">
                          <label htmlFor={`ir-status-${issue.id}`} className="ir-status-label">Update Status:</label>
                          <select
                            id={`ir-status-${issue.id}`}
                            aria-label={`Update status for ${issue.title}`}
                            className="ir-status-select"
                            value={issue.status}
                            disabled={updatingStatus}
                            onChange={(e) => handleStatusChange(issue, e.target.value)}
                          >
                            <option value="Open">Open</option>
                            <option value="In Progress">In Progress</option>
                            <option value="Resolved">Resolved</option>
                          </select>
                        </div>
                        <button
                          type="button"
                          className="ir-btn-preview"
                          onClick={() => setPreviewIssue(issue)}
                          title="Preview issue report details"
                        >
                          <Eye size={13} /> Preview
                        </button>
                      </>
                    ) : (
                      <>
                        <StatusBadge status={issue.status} />
                        <button
                          type="button"
                          className="ir-btn-preview"
                          onClick={() => setPreviewIssue(issue)}
                          title="Preview issue report details"
                        >
                          <Eye size={13} /> Preview
                        </button>
                      </>
                    )}
                  </div>
                  {issue.status === 'Resolved' && expandedResolutions.includes(issue.id) &&
                    <IssueResolutionDetails issue={issue} id={`ir-resolution-${issue.id}`} />}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {resolutionTarget && resolutionTarget.projectCode === projectCode && <ResolveIssueModal
        key={`${resolutionTarget.projectCode}-${resolutionTarget.issue.id}`}
        issue={resolutionTarget.issue}
        resolvedBy={user?.name || user?.email || 'Current user'}
        onClose={() => setResolutionTarget(null)}
        onConfirm={confirmResolution}
      />}

      {/* ── Issue Preview Modal (Full Document View) ── */}
      {previewIssue && (
        <div
          className="client-doc-overlay"
          onClick={(e) => {
            if (e.target === e.currentTarget) setPreviewIssue(null);
          }}
        >
          <div className="client-doc-modal">
            {/* Topbar */}
            <div className="client-doc-topbar no-print">
              <div className="client-doc-topbar-left">
                <span className="pr-card-type-badge pr-badge-ai">
                  {previewIssue.category}
                </span>
                <span className="client-doc-topbar-title">{previewIssue.title}</span>
                <StatusBadge status={previewIssue.status} />
              </div>
              <div className="client-doc-topbar-actions">
                <button
                  type="button"
                  className="client-doc-btn-print"
                  onClick={() => window.print()}
                  title="Print or Save as PDF"
                >
                  <Printer size={15} /> Print / Export PDF
                </button>
                <button
                  type="button"
                  className="client-doc-btn-close"
                  onClick={() => setPreviewIssue(null)}
                  aria-label="Close"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Scrollable Document Viewport */}
            <div className="client-doc-scroll-wrap" ref={previewScrollWrapRef}>
              <article className="client-doc-paper" id="printable-issue-report">
                {/* Document Header Title */}
                <h1 className="client-doc-title">Site Issue Report</h1>

                {/* Metadata block */}
                <div className="client-doc-meta-section">
                  <div className="client-doc-meta-row">
                    <span className="client-doc-meta-label">Date:</span>
                    <span className="client-doc-meta-value">{formatDate(previewIssue.created_at)}</span>
                  </div>
                  <div className="client-doc-meta-row">
                    <span className="client-doc-meta-label">Project Name:</span>
                    <span className="client-doc-meta-value">{projectData?.name || projectCode}</span>
                  </div>
                  <div className="client-doc-meta-row">
                    <span className="client-doc-meta-label">Location:</span>
                    <span className="client-doc-meta-value">{previewIssue.location || projectData?.location || 'Site Location'}</span>
                  </div>
                  <div className="client-doc-meta-row">
                    <span className="client-doc-meta-label">Category:</span>
                    <span className="client-doc-meta-value">{previewIssue.category}</span>
                  </div>
                  <div className="client-doc-meta-row">
                    <span className="client-doc-meta-label">Priority:</span>
                    <span className="client-doc-meta-value">{previewIssue.priority}</span>
                  </div>
                  <div className="client-doc-meta-row">
                    <span className="client-doc-meta-label">Status:</span>
                    <span className="client-doc-meta-value">{previewIssue.status}</span>
                  </div>
                  <div className="client-doc-meta-row">
                    <span className="client-doc-meta-label">Reported By:</span>
                    <span className="client-doc-meta-value">{previewIssue.reporter_name || 'Site Engineer'}</span>
                  </div>
                  {/* Removed "Assigned Resolver: Unassigned" completely — only shown if valid assignee exists */}
                  {previewIssue.assignee_name && previewIssue.assignee_name.trim().toLowerCase() !== 'unassigned' && (
                    <div className="client-doc-meta-row">
                      <span className="client-doc-meta-label">Assigned To:</span>
                      <span className="client-doc-meta-value">{previewIssue.assignee_name}</span>
                    </div>
                  )}
                </div>

                {/* Issue Description & Observations */}
                <section className="client-doc-section">
                  <h2 className="client-doc-section-heading">Issue Description & Observations</h2>
                  <div style={{ marginTop: '8px' }}>
                    <div style={{ fontWeight: 700, fontSize: '15px', color: '#000000', marginBottom: '6px' }}>
                      {previewIssue.title}
                    </div>
                    <p style={{ margin: 0, fontSize: '14px', color: '#374151', lineHeight: '1.6', whiteSpace: 'pre-wrap' }}>
                      {previewIssue.description}
                    </p>
                  </div>
                </section>

                {/* Resolution Details */}
                {previewIssue.status === 'Resolved' && (() => {
                  const previewRes = (previewIssue as any).resolution;
                  const previewResolver =
                    previewIssue.resolved_by_name ||
                    (typeof previewIssue.resolved_by === 'object' ? previewIssue.resolved_by?.name : null) ||
                    previewRes?.resolved_by?.name ||
                    (typeof previewRes?.resolved_by === 'string' ? previewRes.resolved_by : null);
                  const previewResolvedAt = previewIssue.resolved_at || previewRes?.resolved_at;
                  const previewSummary =
                    previewIssue.resolution_summary ||
                    previewRes?.resolution_summary ||
                    previewIssue.resolution_notes;
                  const previewRawSteps = previewIssue.resolution_steps || previewRes?.resolution_steps;
                  const previewSteps = Array.isArray(previewRawSteps)
                    ? previewRawSteps.filter((step: unknown) => typeof step === 'string' && (step as string).trim())
                    : [];
                  const previewRemarks =
                    previewIssue.final_remarks ||
                    previewRes?.final_remarks;

                  return (
                    <section className="client-doc-section">
                      <h2 className="client-doc-section-heading">Resolution Details</h2>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '14px', color: '#111827' }}>
                        <div className="client-doc-meta-row">
                          <span className="client-doc-meta-label">Resolved By:</span>
                          <span className="client-doc-meta-value">
                            {previewResolver || 'Not recorded'}
                          </span>
                        </div>
                        {previewResolvedAt && (
                          <div className="client-doc-meta-row">
                            <span className="client-doc-meta-label">Resolved On:</span>
                            <span className="client-doc-meta-value">{formatDate(previewResolvedAt)}</span>
                          </div>
                        )}
                        <div style={{ marginTop: '4px' }}>
                          <span className="client-doc-meta-label">Resolution Summary:</span>
                          <p style={{ margin: '4px 0 0 0', fontSize: '13.5px', color: '#374151', lineHeight: 1.55 }}>
                            {previewSummary || 'Issue marked as resolved.'}
                          </p>
                        </div>
                        {previewSteps.length > 0 && (
                          <div style={{ marginTop: '4px' }}>
                            <span className="client-doc-meta-label">Steps Taken:</span>
                            <ol style={{ margin: '4px 0 0 0', paddingLeft: '20px', fontSize: '13px', color: '#374151', lineHeight: 1.6 }}>
                              {previewSteps.map((step, idx) => (
                                <li key={idx}>{step as string}</li>
                              ))}
                            </ol>
                          </div>
                        )}
                        {previewRemarks && (
                          <div style={{ marginTop: '4px' }}>
                            <span className="client-doc-meta-label">Final Remarks:</span>
                            <p style={{ margin: '4px 0 0 0', fontSize: '13.5px', color: '#374151' }}>
                              {previewRemarks}
                            </p>
                          </div>
                        )}
                        {previewIssue.resolution_evidence && previewIssue.resolution_evidence.length > 0 && (
                          <div style={{ marginTop: '4px' }}>
                            <span className="client-doc-meta-label">Verification Evidence:</span>
                            <ul style={{ margin: '4px 0 0 0', paddingLeft: '20px', fontSize: '13px' }}>
                              {previewIssue.resolution_evidence.map((ev, eIdx) => {
                                const url = typeof ev?.url === 'string' ? safeEvidenceUrl(ev.url) : null;
                                return (
                                  <li key={ev?.id || eIdx}>
                                    {url ? (
                                      <a href={apiUrl(url)} target="_blank" rel="noopener noreferrer" style={{ color: '#ea580c', textDecoration: 'underline' }}>
                                        {ev.name || `Evidence ${eIdx + 1}`}
                                      </a>
                                    ) : (
                                      <span>{ev?.name || 'Attachment unavailable'}</span>
                                    )}
                                  </li>
                                );
                              })}
                            </ul>
                          </div>
                        )}
                      </div>
                    </section>
                  );
                })()}

                {/* Attachment note on Page 1 if images exist */}
                {previewIssue.images && previewIssue.images.length > 0 && (
                  <div style={{ fontSize: '12px', color: '#64748b', fontStyle: 'italic', marginTop: '16px', marginBottom: '8px' }}>
                    📎 Visual site evidence and inspection photos are attached on Page 2 ({previewIssue.images.length} {previewIssue.images.length === 1 ? 'image' : 'images'}).
                  </div>
                )}

                {/* Page 1 Document Footer Sign-off */}
                <footer className="client-doc-footer">
                  <div className="client-doc-footer-left">
                    <div><strong>Prepared By:</strong> {previewIssue.reporter_name || 'Site Engineer'}</div>
                    <div><strong>Record ID:</strong> {previewIssue.id}</div>
                  </div>
                  <div className="client-doc-footer-right">
                    <div><strong>SitePulse Official Daily Site Record</strong>{previewIssue.images?.length ? ' • Page 1 of 2' : ''}</div>
                    <div>Status: <strong>{previewIssue.status}</strong> • Created: {formatDate(previewIssue.created_at)}</div>
                  </div>
                </footer>
              </article>

              {/* ── Page 2: Site Images (Separate Page with Full-Size Uncropped Photos) ── */}
              {previewIssue.images && previewIssue.images.length > 0 && (
                <article className="client-doc-paper client-doc-paper--page2">
                  <div className="client-doc-page-header">
                    <span className="client-doc-page-header-title">Site Issue Report — Visual Site Evidence</span>
                    <span className="client-doc-page-badge">Page 2 of 2</span>
                  </div>

                  <div className="client-doc-meta-section" style={{ marginBottom: '20px' }}>
                    <div className="client-doc-meta-row">
                      <span className="client-doc-meta-label">Project:</span>
                      <span className="client-doc-meta-value">{projectData?.name || projectCode}</span>
                      <span style={{ color: '#94a3b8', margin: '0 8px' }}>•</span>
                      <span className="client-doc-meta-label">Date:</span>
                      <span className="client-doc-meta-value">{formatDate(previewIssue.created_at)}</span>
                      <span style={{ color: '#94a3b8', margin: '0 8px' }}>•</span>
                      <span className="client-doc-meta-label">Location:</span>
                      <span className="client-doc-meta-value">{previewIssue.location || projectData?.location || 'Site Location'}</span>
                    </div>
                  </div>

                  <section className="client-doc-section" style={{ marginBottom: '16px' }}>
                    <h2 className="client-doc-section-heading" style={{ fontSize: '18px' }}>
                      Site Images & Field Evidence
                    </h2>
                    <p style={{ fontSize: '13px', color: '#64748b', margin: '4px 0 18px 0' }}>
                      Verified high-resolution job site inspection photographs and technical observations (showing full uncropped view).
                    </p>

                    <div className="client-doc-full-gallery">
                      {previewIssue.images.map((image, index) => (
                        <div key={`${image.url}-${index}`} className="client-doc-image-card">
                          <div className="client-doc-image-wrapper">
                            <AuthenticatedReportImage
                              url={image.url}
                              alt={cleanImageAlt(image, index)}
                            />
                          </div>
                          <div className="client-doc-image-caption">
                            <strong>Figure {index + 1}:</strong> {cleanImageAlt(image, index)}
                          </div>
                        </div>
                      ))}
                    </div>
                  </section>

                  {/* Page 2 Document Footer Sign-off */}
                  <footer className="client-doc-footer">
                    <div className="client-doc-footer-left">
                      <div><strong>Prepared By:</strong> {previewIssue.reporter_name || 'Site Engineer'}</div>
                      <div><strong>Record ID:</strong> {previewIssue.id}</div>
                    </div>
                    <div className="client-doc-footer-right">
                      <div><strong>SitePulse Official Daily Site Record</strong> • Page 2 of 2</div>
                      <div>Status: <strong>{previewIssue.status}</strong> • Created: {formatDate(previewIssue.created_at)}</div>
                    </div>
                  </footer>
                </article>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Report Issue Modal ── */}
      {showModal && (
        <div className="ir-modal-overlay">
          <div className="ir-modal">
            <div className="ir-modal-header">
              <h2 className="ir-modal-title">Report New Site Issue</h2>
              <p style={{ margin: 0, fontSize: '12px', color: '#888' }}>Log a quality defect, hazard, or project blocker.</p>
            </div>

            <form onSubmit={handleCreateIssue} style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
              <div className="ir-modal-body">
                {/* Title */}
                <div className="pp-form-group">
                  <label className="pp-form-label">Issue Title *</label>
                  <input
                    className="pp-form-input"
                    placeholder="e.g. Scaffolding safety net tear near Grid 4"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                  />
                </div>

                {/* Category & Priority */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div className="pp-form-group">
                    <label className="pp-form-label">Category</label>
                    <select className="pp-form-select" value={category} onChange={(e) => setCategory(e.target.value)}>
                      {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>

                  <div className="pp-form-group">
                    <label className="pp-form-label">Priority</label>
                    <select className="pp-form-select" value={priority} onChange={(e) => setPriority(e.target.value)}>
                      {PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
                    </select>
                  </div>
                </div>

                {/* Location */}
                <div className="pp-form-group">
                  <label className="pp-form-label">Site Location / Grid Ref</label>
                  <input
                    className="pp-form-input"
                    placeholder="e.g. Level 4 West Facade / Grid C-3"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                  />
                </div>

                {/* Description */}
                <div className="pp-form-group">
                  <label className="pp-form-label">Description & Impact *</label>
                  <textarea
                    className="pp-form-textarea"
                    placeholder="Describe what occurred, required corrective actions, or affected trades..."
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                  />
                </div>

                {/* Assignee */}
                <div className="pp-form-group">
                  <label className="pp-form-label">Assign Resolver (Optional)</label>
                  <select className="pp-form-select" value={assignedTo} onChange={(e) => setAssignedTo(e.target.value)}>
                    <option value="">Unassigned</option>
                    {teamMembers.map((m) => (
                      <option key={m.id} value={m.id}>{m.name} ({m.role})</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="ir-modal-footer">
                <button type="button" className="ir-btn-cancel" onClick={() => setShowModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="ir-btn-submit" disabled={submitting}>
                  {submitting ? 'Submitting…' : 'Submit Issue Report'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  );
};

export default IssueReport;
