import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import '../components/ProjectReports.css';
import { fetchWithAuth } from '../utils/api';
import { showToast } from '../components/Toast';
import ProfileDropdown from '../components/ProfileDropdown';

const API_URL = import.meta.env.VITE_BACKEND_URL;

const REPORT_TYPES = [
  'Daily Site Log',
  'Milestone Report',
  'Safety Inspection',
  'Material Quality Audit',
] as const;

interface ProjectReportItem {
  id: string;
  project_code: string;
  title: string;
  report_type: string;
  report_date: string;
  summary: string;
  key_activities?: string;
  issues_highlighted?: string;
  manpower_count: number;
  equipment_on_site?: string;
  weather?: string;
  status: string;
  prepared_by_name?: string;
  prepared_by_role?: string;
  created_at: string;
}

const ProjectReports: React.FC = () => {
  const { projectCode } = useParams<{ projectCode: string }>();
  const navigate = useNavigate();

  const [reports, setReports]           = useState<ProjectReportItem[]>([]);
  const [loading, setLoading]           = useState(true);
  const [search, setSearch]             = useState('');
  const [selectedType, setSelectedType] = useState<string>('All');
  const [showModal, setShowModal]       = useState(false);
  const [viewReport, setViewReport]     = useState<ProjectReportItem | null>(null);

  // Form State
  const [title, setTitle]                       = useState('');
  const [reportType, setReportType]             = useState<string>(REPORT_TYPES[0]);
  const [reportDate, setReportDate]             = useState(new Date().toISOString().split('T')[0]);
  const [summary, setSummary]                   = useState('');
  const [keyActivities, setKeyActivities]       = useState('');
  const [issuesHighlighted, setIssuesHighlighted] = useState('');
  const [manpowerCount, setManpowerCount]       = useState<number>(35);
  const [equipmentOnSite, setEquipmentOnSite]   = useState('1x Tower Crane, 2x Concrete Pumps');
  const [weather, setWeather]                   = useState('Sunny, 30°C');
  const [submitting, setSubmitting]             = useState(false);

  const fetchReports = async () => {
    setLoading(true);
    try {
      let queryParams = new URLSearchParams();
      if (selectedType !== 'All') queryParams.append('type', selectedType);
      if (search.trim()) queryParams.append('search', search.trim());

      const res = await fetchWithAuth(`${API_URL}/projects/${projectCode}/reports?${queryParams.toString()}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.message || 'Failed to fetch reports');
      setReports(json.data || []);
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReports();
  }, [projectCode, selectedType]);

  const handleCreateReport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !summary.trim()) {
      showToast('Title and Summary are required.', 'warning');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetchWithAuth(`${API_URL}/projects/${projectCode}/reports`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          report_type: reportType,
          report_date: reportDate,
          summary: summary.trim(),
          key_activities: keyActivities.trim(),
          issues_highlighted: issuesHighlighted.trim(),
          manpower_count: manpowerCount,
          equipment_on_site: equipmentOnSite.trim(),
          weather: weather.trim(),
        }),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.message || 'Failed to create report');

      showToast('Project report created successfully!', 'success');
      setShowModal(false);
      setTitle('');
      setSummary('');
      setKeyActivities('');
      setIssuesHighlighted('');
      fetchReports();
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleExportPDF = (report: ProjectReportItem) => {
    showToast(`Exporting "${report.title}" as PDF Document...`, 'success');
  };

  // Metrics
  const totalCount    = reports.length;
  const dailyCount    = reports.filter(r => r.report_type === 'Daily Site Log').length;
  const safetyCount   = reports.filter(r => r.report_type === 'Safety Inspection' || r.report_type === 'Material Quality Audit').length;
  const milestoneCount= reports.filter(r => r.report_type === 'Milestone Report').length;

  const formatDate = (dateStr: string) =>
    new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

  const getTypeBadgeClass = (type: string) => {
    if (type === 'Daily Site Log') return 'type-daily';
    if (type === 'Milestone Report') return 'type-milestone';
    if (type === 'Safety Inspection') return 'type-safety';
    return 'type-material';
  };

  return (
    <main className="pr-page">
      {/* ── Breadcrumbs & Nav ── */}
      <div className="pr-nav-row">
        <div className="pr-breadcrumb">
          <button className="pp-breadcrumb-link" onClick={() => navigate('/projects')}>
            Projects
          </button>
          <span className="pr-breadcrumb-sep">/</span>
          <button className="pp-breadcrumb-link" onClick={() => navigate(`/projects/${projectCode}`)}>
            {projectCode}
          </button>
          <span className="pr-breadcrumb-sep">/</span>
          <span className="pr-breadcrumb-current">Project Reports</span>
        </div>
        <ProfileDropdown />
      </div>

      {/* ── Header ── */}
      <div className="pr-header">
        <div className="pr-header-left">
          <div className="pr-title-wrap">
            <h1 className="pr-title">Site Logs & Inspection Reports</h1>
            <span className="pr-count-badge">{totalCount} Reports</span>
          </div>
          <p className="pr-subtitle">
            {projectCode} • Executive summaries, QA audits, safety observations, and daily site journals
          </p>
        </div>

        <button className="pr-create-btn" onClick={() => setShowModal(true)}>
          <span>+ Generate New Report</span>
        </button>
      </div>

      {/* ── Stat Metrics ── */}
      <div className="pr-stats-grid">
        <div className="pr-stat-card">
          <div className="pr-stat-icon" style={{ background: '#dbeafe', color: '#1d4ed8' }}>
            📋
          </div>
          <div className="pr-stat-info">
            <span className="pr-stat-value">{totalCount}</span>
            <span className="pr-stat-label">Total Reports</span>
          </div>
        </div>

        <div className="pr-stat-card">
          <div className="pr-stat-icon" style={{ background: '#fee2e2', color: '#dc2626' }}>
            📅
          </div>
          <div className="pr-stat-info">
            <span className="pr-stat-value">{dailyCount}</span>
            <span className="pr-stat-label">Daily Site Logs</span>
          </div>
        </div>

        <div className="pr-stat-card">
          <div className="pr-stat-icon" style={{ background: '#dcfce7', color: '#15803d' }}>
            🛡️
          </div>
          <div className="pr-stat-info">
            <span className="pr-stat-value">{safetyCount}</span>
            <span className="pr-stat-label">Safety & QA Audits</span>
          </div>
        </div>

        <div className="pr-stat-card">
          <div className="pr-stat-icon" style={{ background: '#f3e8ff', color: '#7e22ce' }}>
            📊
          </div>
          <div className="pr-stat-info">
            <span className="pr-stat-value">{milestoneCount}</span>
            <span className="pr-stat-label">Milestone Reports</span>
          </div>
        </div>
      </div>

      {/* ── Toolbar ── */}
      <div className="pr-toolbar">
        {/* Search */}
        <div className="pr-search-wrap">
          <span className="pr-search-icon">🔍</span>
          <input
            className="pr-search-input"
            placeholder="Search report titles or activity notes..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') fetchReports(); }}
          />
          {search && (
            <button className="pr-search-clear" onClick={() => { setSearch(''); fetchReports(); }}>
              ✕
            </button>
          )}
        </div>

        {/* Filter Pills */}
        <div className="pr-toolbar-filters">
          {['All', ...REPORT_TYPES].map((type) => (
            <button
              key={type}
              className={`pr-filter-pill ${selectedType === type ? 'pr-filter-pill--active' : ''}`}
              onClick={() => setSelectedType(type)}
            >
              {type}
            </button>
          ))}
        </div>
      </div>

      {/* ── Reports List ── */}
      {loading ? (
        <p style={{ textAlign: 'center', padding: '3rem', color: '#64748b' }}>Loading project reports…</p>
      ) : reports.length === 0 ? (
        <div style={{
          background: '#fff', borderRadius: '16px', border: '1.5px dashed #cbd5e1',
          padding: '48px 24px', textAlign: 'center', margin: '20px 0',
        }}>
          <span style={{ fontSize: '42px', display: 'block', marginBottom: '8px' }}>📋</span>
          <h3 style={{ fontSize: '16px', fontWeight: 700, margin: '0 0 6px' }}>No reports found</h3>
          <p style={{ color: '#64748b', fontSize: '13px', margin: 0 }}>
            {selectedType !== 'All' ? 'No reports under the selected category.' : 'No site inspection or daily reports created yet.'}
          </p>
        </div>
      ) : (
        <div className="pr-list">
          {reports.map((report) => (
            <div key={report.id} className="pr-card">
              <div className="pr-card-header">
                <div>
                  <span className={`pr-card-type-badge ${getTypeBadgeClass(report.report_type)}`}>
                    {report.report_type}
                  </span>
                  <h3 className="pr-card-title">{report.title}</h3>
                </div>
                <span style={{ fontSize: '12px', fontWeight: 600, color: '#64748b' }}>
                  📅 {formatDate(report.report_date)}
                </span>
              </div>

              <p className="pr-card-summary">{report.summary}</p>

              <div className="pr-card-details-grid">
                <div className="pr-detail-item">
                  <span className="pr-detail-label">Prepared By</span>
                  <span>{report.prepared_by_name || 'Site Engineer'} ({report.prepared_by_role || 'Field Engineer'})</span>
                </div>

                <div className="pr-detail-item">
                  <span className="pr-detail-label">Manpower & Weather</span>
                  <span>👷 {report.manpower_count} workers • ⛅ {report.weather || 'Clear'}</span>
                </div>

                {report.equipment_on_site && (
                  <div className="pr-detail-item">
                    <span className="pr-detail-label">Equipment on Site</span>
                    <span>🚜 {report.equipment_on_site}</span>
                  </div>
                )}
              </div>

              {report.key_activities && (
                <div style={{ fontSize: '12.5px', color: '#475569', background: '#f8fafc', padding: '10px 14px', borderRadius: '8px' }}>
                  <strong>Key Activities:</strong> {report.key_activities}
                </div>
              )}

              <div className="pr-card-actions">
                <button
                  className="pr-btn-view"
                  onClick={() => setViewReport(report)}
                >
                  View Full Document
                </button>
                <button
                  className="pr-btn-export"
                  onClick={() => handleExportPDF(report)}
                >
                  ⬇ Export PDF
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── View Full Report Modal ── */}
      {viewReport && (
        <div className="ir-modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) setViewReport(null); }}>
          <div className="ir-modal" style={{ maxWidth: '640px' }}>
            <div className="ir-modal-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <span className={`pr-card-type-badge ${getTypeBadgeClass(viewReport.report_type)}`}>
                  {viewReport.report_type}
                </span>
                <h2 className="ir-modal-title" style={{ marginTop: '6px' }}>{viewReport.title}</h2>
              </div>
              <button
                style={{ background: 'none', border: 'none', fontSize: '18px', cursor: 'pointer', color: '#888' }}
                onClick={() => setViewReport(null)}
              >
                ✕
              </button>
            </div>

            <div className="ir-modal-body" style={{ gap: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#64748b', borderBottom: '1px solid #f1f5f9', paddingBottom: '8px' }}>
                <span>Date: <strong>{formatDate(viewReport.report_date)}</strong></span>
                <span>Preparer: <strong>{viewReport.prepared_by_name || 'Site Engineer'}</strong></span>
                <span>Status: <strong>{viewReport.status}</strong></span>
              </div>

              <div>
                <h4 style={{ margin: '0 0 4px', fontSize: '13px', color: '#111827' }}>Executive Summary</h4>
                <p style={{ margin: 0, fontSize: '13px', color: '#475569', lineHeight: 1.6 }}>{viewReport.summary}</p>
              </div>

              {viewReport.key_activities && (
                <div>
                  <h4 style={{ margin: '0 0 4px', fontSize: '13px', color: '#111827' }}>Key Activities Completed</h4>
                  <p style={{ margin: 0, fontSize: '13px', color: '#475569', lineHeight: 1.6 }}>{viewReport.key_activities}</p>
                </div>
              )}

              {viewReport.issues_highlighted && (
                <div>
                  <h4 style={{ margin: '0 0 4px', fontSize: '13px', color: '#dc2626' }}>Observations & Issues Noted</h4>
                  <p style={{ margin: 0, fontSize: '13px', color: '#dc2626', lineHeight: 1.6 }}>{viewReport.issues_highlighted}</p>
                </div>
              )}

              <div style={{ background: '#f8fafc', padding: '12px', borderRadius: '8px', fontSize: '12px', color: '#475569' }}>
                <div><strong>Active Manpower:</strong> {viewReport.manpower_count} workers on shift</div>
                {viewReport.equipment_on_site && <div style={{ marginTop: '4px' }}><strong>Heavy Equipment:</strong> {viewReport.equipment_on_site}</div>}
                <div style={{ marginTop: '4px' }}><strong>Site Weather:</strong> {viewReport.weather || 'Clear'}</div>
              </div>
            </div>

            <div className="ir-modal-footer">
              <button className="ir-btn-cancel" onClick={() => setViewReport(null)}>
                Close
              </button>
              <button className="ir-btn-submit" onClick={() => handleExportPDF(viewReport)}>
                Download Printable PDF
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Generate Report Modal ── */}
      {showModal && (
        <div className="ir-modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) setShowModal(false); }}>
          <div className="ir-modal" style={{ maxWidth: '580px' }}>
            <div className="ir-modal-header">
              <h2 className="ir-modal-title">Generate Project Report</h2>
              <p style={{ margin: 0, fontSize: '12px', color: '#888' }}>Submit a daily site log, inspection audit, or milestone report.</p>
            </div>

            <form onSubmit={handleCreateReport} style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
              <div className="ir-modal-body">
                {/* Title */}
                <div className="pp-form-group">
                  <label className="pp-form-label">Report Title *</label>
                  <input
                    className="pp-form-input"
                    placeholder="e.g. Daily Structural Inspection Log - Level 5"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                  />
                </div>

                {/* Type & Date */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div className="pp-form-group">
                    <label className="pp-form-label">Report Type</label>
                    <select className="pp-form-select" value={reportType} onChange={(e) => setReportType(e.target.value)}>
                      {REPORT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>

                  <div className="pp-form-group">
                    <label className="pp-form-label">Report Date</label>
                    <input
                      type="date"
                      className="pp-form-input"
                      value={reportDate}
                      onChange={(e) => setReportDate(e.target.value)}
                    />
                  </div>
                </div>

                {/* Executive Summary */}
                <div className="pp-form-group">
                  <label className="pp-form-label">Executive Summary *</label>
                  <textarea
                    className="pp-form-textarea"
                    placeholder="Provide a high-level summary of the day or inspection period..."
                    value={summary}
                    onChange={(e) => setSummary(e.target.value)}
                  />
                </div>

                {/* Key Activities */}
                <div className="pp-form-group">
                  <label className="pp-form-label">Key Activities Completed</label>
                  <textarea
                    className="pp-form-textarea"
                    placeholder="List specific milestones, poured volume, rebar installations, or subcontractor work..."
                    value={keyActivities}
                    onChange={(e) => setKeyActivities(e.target.value)}
                  />
                </div>

                {/* Manpower & Equipment */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div className="pp-form-group">
                    <label className="pp-form-label">Total Manpower Count</label>
                    <input
                      type="number"
                      min="1"
                      className="pp-form-input"
                      value={manpowerCount}
                      onChange={(e) => setManpowerCount(parseInt(e.target.value) || 0)}
                    />
                  </div>

                  <div className="pp-form-group">
                    <label className="pp-form-label">Weather Conditions</label>
                    <input
                      className="pp-form-input"
                      placeholder="Sunny, 31°C"
                      value={weather}
                      onChange={(e) => setWeather(e.target.value)}
                    />
                  </div>
                </div>

                {/* Equipment */}
                <div className="pp-form-group">
                  <label className="pp-form-label">Equipment on Site</label>
                  <input
                    className="pp-form-input"
                    placeholder="e.g. 1x Tower Crane, 2x Ready-Mix Trucks"
                    value={equipmentOnSite}
                    onChange={(e) => setEquipmentOnSite(e.target.value)}
                  />
                </div>
              </div>

              <div className="ir-modal-footer">
                <button type="button" className="ir-btn-cancel" onClick={() => setShowModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="ir-btn-submit" disabled={submitting}>
                  {submitting ? 'Generating…' : 'Publish Report'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  );
};

export default ProjectReports;
