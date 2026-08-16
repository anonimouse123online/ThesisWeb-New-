import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import '../components/IssueReport.css';
import { fetchWithAuth } from '../utils/api';
import { showToast } from '../components/Toast';
import ProfileDropdown from '../components/ProfileDropdown';
import Dropdown from '../components/Dropdown';

const API_URL = import.meta.env.VITE_BACKEND_URL;

const CATEGORIES = [
  'Safety Hazard',
  'Material Shortage',
  'Quality Defect',
  'Design Clash',
  'Equipment Breakdown',
  'Weather Delay',
] as const;

const PRIORITIES = ['Critical', 'High', 'Medium', 'Low'] as const;

interface Issue {
  id: string;
  project_code: string;
  title: string;
  category: string;
  priority: 'Critical' | 'High' | 'Medium' | 'Low';
  location?: string;
  description: string;
  status: 'Open' | 'In Progress' | 'Resolved';
  resolution_notes?: string;
  reporter_name?: string;
  assignee_name?: string;
  assigned_to?: string;
  created_at: string;
  resolved_at?: string;
}

interface TeamMember {
  id: string;
  name: string;
  role: string;
}

const IssueReport: React.FC = () => {
  const { projectCode } = useParams<{ projectCode: string }>();
  const navigate = useNavigate();

  const [issues, setIssues]               = useState<Issue[]>([]);
  const [teamMembers, setTeamMembers]     = useState<TeamMember[]>([]);
  const [loading, setLoading]             = useState(true);
  const [search, setSearch]               = useState('');
  const [statusFilter, setStatusFilter]   = useState<string>('All');
  const [categoryFilter, setCategoryFilter] = useState<string>('All');
  const [priorityFilter, setPriorityFilter] = useState<string>('All');
  const [showModal, setShowModal]         = useState(false);

  // Form State
  const [title, setTitle]             = useState('');
  const [category, setCategory]       = useState<string>(CATEGORIES[0]);
  const [priority, setPriority]       = useState<string>('Medium');
  const [location, setLocation]       = useState('');
  const [description, setDescription] = useState('');
  const [assignedTo, setAssignedTo]   = useState('');
  const [submitting, setSubmitting]   = useState(false);

  // Fetch issues
  const fetchIssues = async () => {
    setLoading(true);
    try {
      let queryParams = new URLSearchParams();
      if (statusFilter !== 'All') queryParams.append('status', statusFilter);
      if (categoryFilter !== 'All') queryParams.append('category', categoryFilter);
      if (priorityFilter !== 'All') queryParams.append('priority', priorityFilter);
      if (search.trim()) queryParams.append('search', search.trim());

      const res = await fetchWithAuth(`${API_URL}/projects/${projectCode}/issues?${queryParams.toString()}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.message || 'Failed to fetch issues');
      setIssues(json.data || []);
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  // Fetch project team members for assignee dropdown
  const fetchMembers = async () => {
    try {
      const res = await fetchWithAuth(`${API_URL}/projects/${projectCode}/members`);
      const json = await res.json();
      if (res.ok) setTeamMembers(json.data || []);
    } catch { /* ignore */ }
  };

  useEffect(() => {
    fetchIssues();
    fetchMembers();
  }, [projectCode, statusFilter, categoryFilter, priorityFilter]);

  const handleStatusChange = async (issueId: string, newStatus: string) => {
    try {
      const res = await fetchWithAuth(`${API_URL}/projects/${projectCode}/issues/${issueId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message || 'Failed to update status');

      showToast(`Issue status updated to ${newStatus}.`, 'success');
      fetchIssues();
    } catch (err: any) {
      showToast(err.message, 'error');
    }
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
      setShowModal(false);
      setTitle('');
      setDescription('');
      setLocation('');
      fetchIssues();
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  // Stats calculation
  const totalCount    = issues.length;
  const openCount     = issues.filter(i => i.status === 'Open').length;
  const inProgCount   = issues.filter(i => i.status === 'In Progress').length;
  const resolvedCount = issues.filter(i => i.status === 'Resolved').length;
  const criticalCount = issues.filter(i => i.priority === 'Critical' || i.priority === 'High').length;

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
      {/* ── Nav & Breadcrumb ── */}
      <div className="ir-nav-row">
        <div className="ir-breadcrumb">
          <button className="pp-breadcrumb-link" onClick={() => navigate('/projects')}>
            Projects
          </button>
          <span className="ir-breadcrumb-sep">/</span>
          <button className="pp-breadcrumb-link" onClick={() => navigate(`/projects/${projectCode}`)}>
            {projectCode}
          </button>
          <span className="ir-breadcrumb-sep">/</span>
          <span className="ir-breadcrumb-current">Reported Issues</span>
        </div>
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
            🚨
          </div>
          <div className="ir-stat-info">
            <span className="ir-stat-value">{openCount}</span>
            <span className="ir-stat-label">Open Issues</span>
          </div>
        </div>

        <div className="ir-stat-card">
          <div className="ir-stat-icon" style={{ background: '#fef3c7', color: '#d97706' }}>
            ⏳
          </div>
          <div className="ir-stat-info">
            <span className="ir-stat-value">{inProgCount}</span>
            <span className="ir-stat-label">In Progress</span>
          </div>
        </div>

        <div className="ir-stat-card">
          <div className="ir-stat-icon" style={{ background: '#dcfce7', color: '#16a34a' }}>
            ✅
          </div>
          <div className="ir-stat-info">
            <span className="ir-stat-value">{resolvedCount}</span>
            <span className="ir-stat-label">Resolved</span>
          </div>
        </div>

        <div className="ir-stat-card">
          <div className="ir-stat-icon" style={{ background: '#fee2e2', color: '#991b1b' }}>
            ⚠️
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
            <span className="ir-search-icon">🔍</span>
            <input
              className="ir-search-input"
              placeholder="Search by issue title, location, or notes..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') fetchIssues(); }}
            />
            {search && (
              <button className="ir-search-clear" onClick={() => { setSearch(''); fetchIssues(); }}>
                ✕
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
          {['All', 'Open', 'In Progress', 'Resolved'].map((st) => (
            <button
              key={st}
              className={`ir-filter-pill ${statusFilter === st ? 'ir-filter-pill--active' : ''}`}
              onClick={() => setStatusFilter(st)}
            >
              <span>{st}</span>
              <span className="ir-pill-count">
                {st === 'All' ? totalCount : st === 'Open' ? openCount : st === 'In Progress' ? inProgCount : resolvedCount}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* ── Content Grid ── */}
      {loading ? (
        <p style={{ textAlign: 'center', padding: '3rem', color: '#64748b' }}>Loading issues log…</p>
      ) : issues.length === 0 ? (
        <div style={{
          background: '#fff', borderRadius: '16px', border: '1.5px dashed #cbd5e1',
          padding: '48px 24px', textAlign: 'center', margin: '20px 0',
        }}>
          <span style={{ fontSize: '42px', display: 'block', marginBottom: '8px' }}>🎉</span>
          <h3 style={{ fontSize: '16px', fontWeight: 700, margin: '0 0 6px' }}>No issues found</h3>
          <p style={{ color: '#64748b', fontSize: '13px', margin: 0 }}>
            {statusFilter !== 'All' || categoryFilter !== 'All' ? 'No tickets match the active filters.' : 'All clear! No site issues reported for this project.'}
          </p>
        </div>
      ) : (
        <div className="ir-grid">
          {issues.map((issue) => {
            const statusClass = issue.status === 'Open' ? 'status-open' : issue.status === 'In Progress' ? 'status-in-progress' : 'status-resolved';
            const prioClass = `prio-${issue.priority.toLowerCase()}`;

            return (
              <div key={issue.id} className="ir-card">
                <div>
                  <div className="ir-card-top">
                    <div className="ir-badges-row">
                      <span className={`ir-badge-status ${statusClass}`}>{issue.status}</span>
                      <span className={`ir-badge-priority ${prioClass}`}>{issue.priority}</span>
                    </div>
                    <span className="ir-card-category">{issue.category}</span>
                  </div>

                  <h3 className="ir-card-title" style={{ marginTop: '12px' }}>{issue.title}</h3>
                  <p className="ir-card-desc" style={{ marginTop: '6px' }}>{issue.description}</p>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <div className="ir-card-meta">
                    {issue.location && <span>📍 {issue.location}</span>}
                    <span>👤 Reported by: {issue.reporter_name || 'Site Engineer'}</span>
                    {issue.assignee_name && <span>🛠 Assigned to: {issue.assignee_name}</span>}
                    <span>📅 Date: {formatDate(issue.created_at)}</span>
                  </div>

                  <div className="ir-card-footer">
                    <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 600 }}>Update Status:</span>
                    <select
                      className="ir-status-select"
                      value={issue.status}
                      onChange={(e) => handleStatusChange(issue.id, e.target.value)}
                    >
                      <option value="Open">Open</option>
                      <option value="In Progress">In Progress</option>
                      <option value="Resolved">Resolved</option>
                    </select>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Report Issue Modal ── */}
      {showModal && (
        <div className="ir-modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) setShowModal(false); }}>
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
