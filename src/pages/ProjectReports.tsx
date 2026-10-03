import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import '../components/ProjectReports.css';
import StatusBadge from '../components/StatusBadge';
import { API_BASE_URL, fetchWithAuth } from '../utils/api';
import { showToast } from '../components/Toast';
import ProfileDropdown from '../components/ProfileDropdown';
import {
  ClipboardList,
  Calendar,
  ShieldCheck,
  BarChart3,
  Search,
  X,
  FileText,
  HardHat,
  CloudSun,
  Truck,
  Download,
  ArrowLeft,
  Printer
} from 'lucide-react';

const API_URL = API_BASE_URL;

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

interface ClientReportParsed {
  title: string;
  date: string;
  projectName: string;
  location: string;
  manpower?: {
    total?: string;
    breakdown: string[];
  } | null;
  workProgress: string[];
  ongoingScope: string[];
}

const parseClientReport = (
  report: ProjectReportItem,
  defaultProjectName?: string,
  defaultLocation?: string
): ClientReportParsed => {
  const summary = (report.summary || '').trim();
  const lowerSummary = summary.toLowerCase();

  // If summary already follows the client report structure:
  if (lowerSummary.includes('daily site report') || (lowerSummary.includes('work progress') && lowerSummary.includes('ongoing scope'))) {
    const rawLines = summary.split('\n');
    let title = 'Daily Site Report';
    let date = '';
    let projectName = '';
    let location = '';
    let currentSection: 'header' | 'manpower' | 'work_progress' | 'ongoing_scope' = 'header';

    const manpowerLines: string[] = [];
    const workProgressLines: string[] = [];
    const ongoingScopeLines: string[] = [];

    for (const raw of rawLines) {
      const line = raw.trim();
      if (!line) continue;
      const lower = line.toLowerCase();

      if (lower === 'daily site report') {
        title = line;
        currentSection = 'header';
        continue;
      }
      if (lower === 'manpower') {
        currentSection = 'manpower';
        continue;
      }
      if (lower === 'work progress' || lower.startsWith('work progress:')) {
        currentSection = 'work_progress';
        continue;
      }
      if (lower.startsWith('ongoing scope of work') || lower.startsWith('ongoing scope of works')) {
        currentSection = 'ongoing_scope';
        continue;
      }

      if (currentSection === 'header') {
        if (lower.startsWith('date:')) {
          date = line.replace(/^date:\s*/i, '').trim();
        } else if (lower.startsWith('project name:')) {
          projectName = line.replace(/^project name:\s*/i, '').trim();
        } else if (lower.startsWith('location:')) {
          location = line.replace(/^location:\s*/i, '').trim();
        }
      } else if (currentSection === 'manpower') {
        manpowerLines.push(line);
      } else if (currentSection === 'work_progress') {
        workProgressLines.push(line);
      } else if (currentSection === 'ongoing_scope') {
        ongoingScopeLines.push(line);
      }
    }

    if (!date && report.report_date) {
      date = new Date(report.report_date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
    }
    if (defaultProjectName && defaultProjectName.trim()) {
      projectName = defaultProjectName.trim();
    } else if (!projectName) {
      projectName = report.project_code || 'Project';
    }

    if (defaultLocation && defaultLocation.trim()) {
      location = defaultLocation.trim();
    } else if (!location || location.toLowerCase() === 'foundation' || location.toLowerCase() === 'project site') {
      location = defaultLocation || 'Project Site';
    }

    let manpower = null;
    if (manpowerLines.length > 0) {
      let totalStr = '';
      const breakdown: string[] = [];
      for (const mLine of manpowerLines) {
        if (mLine.toLowerCase().startsWith('total:')) {
          totalStr = mLine.replace(/^total:\s*/i, '').trim();
        } else {
          breakdown.push(mLine);
        }
      }
      manpower = { total: totalStr || undefined, breakdown };
    } else if (report.manpower_count && report.manpower_count > 0) {
      manpower = { total: String(report.manpower_count), breakdown: [`- Technicians: ${report.manpower_count}`] };
    }

    return {
      title,
      date,
      projectName,
      location,
      manpower,
      workProgress: workProgressLines.length > 0 ? workProgressLines : ['Site Inspection: 100% Completed'],
      ongoingScope: ongoingScopeLines.length > 0 ? ongoingScopeLines : ['General Site Operations']
    };
  }

  // Handle older SITEPULSE FIELD INSPECTION REPORT
  if (lowerSummary.includes('sitepulse field inspection report') || lowerSummary.includes('work activity:')) {
    let activity = '';
    let progress = '100%';
    let assessment = '';
    const lines = summary.split('\n');
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (line.toLowerCase().startsWith('work activity:')) {
        activity = lines[i + 1]?.trim() || line.replace(/work activity:\s*/i, '').trim();
      } else if (line.toLowerCase().startsWith('engineer-recorded progress:')) {
        progress = lines[i + 1]?.trim() || line.replace(/engineer-recorded progress:\s*/i, '').trim();
      } else if (line.toLowerCase().startsWith('field assessment:')) {
        assessment = lines[i + 1]?.trim() || '';
      }
    }
    const wp = activity
      ? [`${activity}: ${progress.includes('%') ? progress : progress + '%'} Completed`]
      : ['Site Inspection: 100% Completed'];
    const scope = assessment ? [assessment] : ['General Site Operations'];
    return {
      title: 'Daily Site Report',
      date: report.report_date
        ? new Date(report.report_date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
        : 'Today',
      projectName: defaultProjectName || report.project_code || 'Project',
      location: defaultLocation || 'Project Site',
      manpower: (report.manpower_count && report.manpower_count > 0)
        ? { total: String(report.manpower_count), breakdown: [`- Technicians: ${report.manpower_count}`] }
        : null,
      workProgress: wp,
      ongoingScope: scope
    };
  }

  // Fallback for manual web reports
  const formattedDate = report.report_date
    ? new Date(report.report_date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
    : 'Today';
  const wpLines: string[] = [];
  if (report.key_activities) {
    report.key_activities.split('\n').forEach(a => {
      const t = a.trim().replace(/^[-•*]\s*/, '');
      if (t) wpLines.push(t.includes('%') ? t : `${t}: 100% Completed`);
    });
  } else if (summary) {
    summary.split('\n').forEach(s => {
      const t = s.trim().replace(/^[-•*]\s*/, '');
      if (t) wpLines.push(t.includes('%') ? t : `${t}: 100% Completed`);
    });
  }

  const scopeLines: string[] = [];
  if (report.issues_highlighted) {
    report.issues_highlighted.split('\n').forEach(iss => {
      const t = iss.trim().replace(/^[-•*]\s*/, '');
      if (t) scopeLines.push(t);
    });
  }

  return {
    title: 'Daily Site Report',
    date: formattedDate,
    projectName: defaultProjectName || report.project_code || 'Project',
    location: defaultLocation || 'Project Site',
    manpower: (report.manpower_count && report.manpower_count > 0)
      ? { total: String(report.manpower_count), breakdown: [`- Technicians: ${report.manpower_count}`] }
      : null,
    workProgress: wpLines.length ? wpLines : ['Site Inspection: 100% Completed'],
    ongoingScope: scopeLines.length ? scopeLines : ['General Site Operations']
  };
};

const ProjectReports: React.FC = () => {
  const { projectCode } = useParams<{ projectCode: string }>();
  const navigate = useNavigate();

  const [reports, setReports]           = useState<ProjectReportItem[]>([]);
  const [projectData, setProjectData]   = useState<{ name: string; location: string } | null>(null);
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
  const [manpowerCount, setManpowerCount]       = useState<number>(0);
  const [equipmentOnSite, setEquipmentOnSite]   = useState('');
  const [weather, setWeather]                   = useState('');
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
    if (projectCode) {
      fetchReports();
      fetchWithAuth(`${API_URL}/projects/${projectCode}`)
        .then((res) => res.json())
        .then((json) => {
          if (json?.data) {
            setProjectData({
              name: json.data.name || '',
              location: json.data.location || '',
            });
          }
        })
        .catch(() => {});
    }
  }, [projectCode, selectedType]);

  const handleCreateReport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !summary.trim()) {
      showToast('Please provide a title and high-level summary.', 'warning');
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
      setEquipmentOnSite('');
      setWeather('');
      setManpowerCount(0);
      fetchReports();
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleExportPDF = (report: ProjectReportItem) => {
    setViewReport(report);
    setTimeout(() => {
      window.print();
    }, 280);
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
      {/* ── Nav & Profile ── */}
      <div className="pr-nav-row">
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
      </div>

      {/* ── Stat Metrics ── */}
      <div className="pr-stats-grid">
        <div className="pr-stat-card">
          <div className="pr-stat-icon" style={{ background: '#fff7ed', color: '#ea580c' }}>
            <ClipboardList size={22} />
          </div>
          <div className="pr-stat-info">
            <span className="pr-stat-value">{totalCount}</span>
            <span className="pr-stat-label">Total Reports</span>
          </div>
        </div>

        <div className="pr-stat-card">
          <div className="pr-stat-icon" style={{ background: '#fee2e2', color: '#dc2626' }}>
            <Calendar size={22} />
          </div>
          <div className="pr-stat-info">
            <span className="pr-stat-value">{dailyCount}</span>
            <span className="pr-stat-label">Daily Site Logs</span>
          </div>
        </div>

        <div className="pr-stat-card">
          <div className="pr-stat-icon" style={{ background: '#dcfce7', color: '#15803d' }}>
            <ShieldCheck size={22} />
          </div>
          <div className="pr-stat-info">
            <span className="pr-stat-value">{safetyCount}</span>
            <span className="pr-stat-label">Safety & QA Audits</span>
          </div>
        </div>

        <div className="pr-stat-card">
          <div className="pr-stat-icon" style={{ background: '#f3e8ff', color: '#7e22ce' }}>
            <BarChart3 size={22} />
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
          <span className="pr-search-icon"><Search size={16} /></span>
          <input
            className="pr-search-input"
            placeholder="Search report titles or activity notes..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') fetchReports(); }}
          />
          {search && (
            <button className="pr-search-clear" onClick={() => { setSearch(''); fetchReports(); }} aria-label="Clear search">
              <X size={14} />
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
          <FileText size={44} style={{ color: '#94a3b8', display: 'block', margin: '0 auto 10px' }} />
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
                <span style={{ fontSize: '12px', fontWeight: 600, color: '#64748b', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                  <Calendar size={13} /> {formatDate(report.report_date)}
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
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                      <HardHat size={13} /> {report.manpower_count} workers
                    </span>
                    •
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                      <CloudSun size={13} /> {report.weather || 'Clear'}
                    </span>
                  </span>
                </div>

                {report.equipment_on_site && (
                  <div className="pr-detail-item">
                    <span className="pr-detail-label">Equipment on Site</span>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                      <Truck size={13} /> {report.equipment_on_site}
                    </span>
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
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                >
                  <Download size={13} /> Export PDF
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── View Full Report Modal (Client Report Document Format) ── */}
      {viewReport && (() => {
        const doc = parseClientReport(viewReport, projectData?.name, projectData?.location);
        return (
          <div className="client-doc-overlay" onClick={(e) => { if (e.target === e.currentTarget) setViewReport(null); }}>
            <div className="client-doc-modal">
              {/* Top toolbar */}
              <div className="client-doc-topbar no-print">
                <div className="client-doc-topbar-left">
                  <span className={`pr-card-type-badge ${getTypeBadgeClass(viewReport.report_type)}`}>
                    {viewReport.report_type}
                  </span>
                  <span className="client-doc-topbar-title">{viewReport.title}</span>
                  <StatusBadge status={viewReport.status || 'Submitted'} />
                </div>
                <div className="client-doc-topbar-actions">
                  <button
                    className="client-doc-btn-print"
                    onClick={() => window.print()}
                    title="Print or Save as PDF"
                  >
                    <Printer size={15} /> Print / Export PDF
                  </button>
                  <button
                    className="client-doc-btn-close"
                    onClick={() => setViewReport(null)}
                    aria-label="Close"
                  >
                    <X size={18} />
                  </button>
                </div>
              </div>

              {/* Scrollable document viewport */}
              <div className="client-doc-scroll-wrap">
                <article className="client-doc-paper" id="printable-client-report">
                  {/* Document Header Title */}
                  <h1 className="client-doc-title">{doc.title}</h1>

                  {/* Metadata block */}
                  <div className="client-doc-meta-section">
                    <div className="client-doc-meta-row">
                      <span className="client-doc-meta-label">Date:</span>
                      <span className="client-doc-meta-value">{doc.date}</span>
                    </div>
                    <div className="client-doc-meta-row">
                      <span className="client-doc-meta-label">Project Name:</span>
                      <span className="client-doc-meta-value">{doc.projectName}</span>
                    </div>
                    <div className="client-doc-meta-row">
                      <span className="client-doc-meta-label">Location:</span>
                      <span className="client-doc-meta-value">{doc.location}</span>
                    </div>
                  </div>

                  {/* Manpower section: ONLY IF MANPOWER EXISTS */}
                  {doc.manpower && (
                    <section className="client-doc-section">
                      <h2 className="client-doc-section-heading">Manpower</h2>
                      {doc.manpower.total && (
                        <div className="client-doc-manpower-total">
                          <span className="client-doc-meta-label">Total:</span> {doc.manpower.total}
                        </div>
                      )}
                      {doc.manpower.breakdown && doc.manpower.breakdown.length > 0 && (
                        <div className="client-doc-manpower-list">
                          {doc.manpower.breakdown.map((item, idx) => (
                            <div key={idx} className="client-doc-manpower-item">{item}</div>
                          ))}
                        </div>
                      )}
                    </section>
                  )}

                  {/* Work Progress section */}
                  <section className="client-doc-section">
                    <h2 className="client-doc-section-heading">Work Progress</h2>
                    <div className="client-doc-list">
                      {doc.workProgress.map((item, idx) => (
                        <div key={idx} className="client-doc-list-item">{item}</div>
                      ))}
                    </div>
                  </section>

                  {/* Ongoing Scope of works section */}
                  <section className="client-doc-section">
                    <h2 className="client-doc-section-heading">Ongoing Scope of works</h2>
                    <div className="client-doc-list">
                      {doc.ongoingScope.map((item, idx) => (
                        <div key={idx} className="client-doc-list-item">{item}</div>
                      ))}
                    </div>
                  </section>

                  {/* Document Footer Sign-off */}
                  <footer className="client-doc-footer">
                    <div className="client-doc-footer-left">
                      <div><strong>Prepared By:</strong> {viewReport.prepared_by_name || 'Site Engineer'} ({viewReport.prepared_by_role || 'Field Engineer'})</div>
                      <div><strong>Record ID:</strong> {viewReport.id}</div>
                    </div>
                    <div className="client-doc-footer-right">
                      <div><strong>SitePulse Official Daily Site Record</strong></div>
                      <div>Status: <strong>{viewReport.status || 'Submitted'}</strong> • Created: {formatDate(viewReport.created_at)}</div>
                    </div>
                  </footer>
                </article>
              </div>
            </div>
          </div>
        );
      })()}

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
