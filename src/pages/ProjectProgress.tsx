import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import '../components/ProjectProgress.css';
import { API_BASE_URL, fetchWithAuth } from '../utils/api';
import { showToast } from '../components/Toast';
import ProfileDropdown from '../components/ProfileDropdown';
import { TrendingUp, Building2, HardHat, FileEdit, Check, Pin, CloudSun, ArrowLeft } from 'lucide-react';

const API_URL = API_BASE_URL;

const PHASES = [
  'Foundation',
  'Structural',
  'Electrical & Utilities',
  'Plumbing & MEP',
  'Finishing',
] as const;

interface ProgressLog {
  id: string;
  phase: string;
  progress_pct: number;
  summary: string;
  work_completed?: string;
  manpower: number;
  weather: string;
  created_at: string;
  logged_by_name?: string;
  logged_by_role?: string;
}

interface TaskPhaseBreakdown {
  phase: string;
  total_tasks: string;
  completed_tasks: string;
  in_progress_tasks: string;
}

const ProjectProgress: React.FC = () => {
  const { projectCode } = useParams<{ projectCode: string }>();
  const navigate = useNavigate();

  const [loading, setLoading]       = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [projectName, setProjectName] = useState('');
  const [currentPhase, setCurrentPhase] = useState<string>('Foundation');
  const [overallProgress, setOverallProgress] = useState<number>(0);
  const [, setTaskBreakdown] = useState<TaskPhaseBreakdown[]>([]);
  const [logs, setLogs] = useState<ProgressLog[]>([]);

  // Form State for new progress update
  const [formPhase, setFormPhase] = useState<string>('Foundation');
  const [formPct, setFormPct] = useState<number>(0);
  const [formSummary, setFormSummary] = useState('');
  const [formWork, setFormWork] = useState('');
  const [formManpower, setFormManpower] = useState<number>(0);
  const [formWeather, setFormWeather] = useState('');

  const fetchProgressData = async () => {
    setLoading(true);
    try {
      const res = await fetchWithAuth(`${API_URL}/projects/${projectCode}/progress`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.message || 'Failed to load progress data');

      const data = json.data;
      setProjectName(data.project?.name || '');
      const pPhase = data.project?.phase ? data.project.phase.replace(/^Phase\s*\d+\s*[-–:]\s*/i, '') : 'Foundation';
      setCurrentPhase(pPhase);
      setOverallProgress(data.project?.progress_pct ?? 0);
      setFormPhase(pPhase);
      setFormPct(data.project?.progress_pct ?? 50);
      setTaskBreakdown(data.taskBreakdown || []);
      setLogs(data.logs || []);
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProgressData();
  }, [projectCode]);

  const handleLogSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formSummary.trim()) {
      showToast('Please provide a brief progress summary.', 'warning');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetchWithAuth(`${API_URL}/projects/${projectCode}/progress`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phase: formPhase,
          progress_pct: formPct,
          summary: formSummary.trim(),
          work_completed: formWork.trim(),
          manpower: formManpower,
          weather: formWeather,
        }),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.message || 'Failed to update progress');

      showToast('Progress update logged successfully!', 'success');
      setFormSummary('');
      setFormWork('');
      fetchProgressData();
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

  return (
    <main className="pp-page">
      {/* ── Nav & Profile ── */}
      <div className="pp-nav-row">
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
          Back to Previous
        </button>
        <ProfileDropdown />
      </div>

      {/* ── Header ── */}
      <div className="pp-header">
        <div className="pp-header-left">
          <div className="pp-title-wrap">
            <h1 className="pp-title">Construction Progress Tracker</h1>
            <span className="pp-phase-badge">{currentPhase}</span>
          </div>
          <p className="pp-subtitle">
            {projectName ? `${projectName} (${projectCode})` : projectCode} • Log site milestones and track completion status
          </p>
        </div>
      </div>

      {/* ── Top Metric Cards ── */}
      <div className="pp-metrics-grid">
        <div className="pp-metric-card">
          <div className="pp-metric-icon" style={{ background: '#fff0e8', color: '#f05a28' }}>
            <TrendingUp size={22} />
          </div>
          <div className="pp-metric-info">
            <span className="pp-metric-value">{overallProgress}%</span>
            <span className="pp-metric-label">Overall Completion</span>
          </div>
        </div>

        <div className="pp-metric-card">
          <div className="pp-metric-icon" style={{ background: '#fff7ed', color: '#ea580c' }}>
            <Building2 size={22} />
          </div>
          <div className="pp-metric-info">
            <span className="pp-metric-value" style={{ fontSize: '16px' }}>{currentPhase ? currentPhase.replace(/^Phase\s*\d+\s*[-–:]\s*/i, '') : '—'}</span>
            <span className="pp-metric-label">Milestone Phase</span>
          </div>
        </div>

        <div className="pp-metric-card">
          <div className="pp-metric-icon" style={{ background: '#dcfce7', color: '#16a34a' }}>
            <HardHat size={22} />
          </div>
          <div className="pp-metric-info">
            <span className="pp-metric-value">{logs[0]?.manpower || 35}</span>
            <span className="pp-metric-label">Active Manpower Today</span>
          </div>
        </div>

        <div className="pp-metric-card">
          <div className="pp-metric-icon" style={{ background: '#f3e8ff', color: '#7e22ce' }}>
            <FileEdit size={22} />
          </div>
          <div className="pp-metric-info">
            <span className="pp-metric-value">{logs.length}</span>
            <span className="pp-metric-label">Progress Entries Logged</span>
          </div>
        </div>
      </div>

      {/* ── 2-Column Content ── */}
      <div className="pp-content-grid">

        {/* ── LEFT: Log New Update ── */}
        <div className="pp-panel">
          <h2 className="pp-panel-title">
            <span>Log Progress Update</span>
            <span style={{ fontSize: '12px', color: '#64748b', fontWeight: 500 }}>Live Entry</span>
          </h2>

          <form onSubmit={handleLogSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {/* Phase */}
            <div className="pp-form-group">
              <label className="pp-form-label">Current Construction Phase</label>
              <select
                className="pp-form-select"
                value={formPhase}
                onChange={(e) => setFormPhase(e.target.value)}
              >
                {PHASES.map((p) => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </div>

            {/* Percentage Slider */}
            <div className="pp-form-group">
              <label className="pp-form-label">
                <span>Progress Percentage</span>
                <span style={{ color: '#f05a28', fontWeight: 800 }}>{formPct}%</span>
              </label>
              <div className="pp-slider-wrap">
                <input
                  type="range"
                  min="0"
                  max="100"
                  className="pp-slider"
                  value={formPct}
                  onChange={(e) => setFormPct(parseInt(e.target.value))}
                />
                <span className="pp-slider-val">{formPct}%</span>
              </div>
            </div>

            {/* Summary */}
            <div className="pp-form-group">
              <label className="pp-form-label">Progress Summary *</label>
              <input
                className="pp-form-input"
                placeholder="e.g. Level 5 slab rebar tie-in & inspection passed"
                value={formSummary}
                onChange={(e) => setFormSummary(e.target.value)}
              />
            </div>

            {/* Detailed Work */}
            <div className="pp-form-group">
              <label className="pp-form-label">Detailed Work Completed</label>
              <textarea
                className="pp-form-textarea"
                placeholder="Describe key work completed, poured volume, structural checks, or inspections..."
                value={formWork}
                onChange={(e) => setFormWork(e.target.value)}
              />
            </div>

            {/* Manpower & Weather */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div className="pp-form-group">
                <label className="pp-form-label">Workers on Site</label>
                <input
                  type="number"
                  min="1"
                  className="pp-form-input"
                  value={formManpower}
                  onChange={(e) => setFormManpower(parseInt(e.target.value) || 0)}
                />
              </div>
              <div className="pp-form-group">
                <label className="pp-form-label">Weather / Conditions</label>
                <input
                  className="pp-form-input"
                  placeholder="Sunny, 30°C"
                  value={formWeather}
                  onChange={(e) => setFormWeather(e.target.value)}
                />
              </div>
            </div>

            {/* Submit */}
            <button
              type="submit"
              className="pp-submit-btn"
              disabled={submitting}
              style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
            >
              {submitting ? 'Saving Update…' : <><Check size={16} /> Save Progress Update</>}
            </button>
          </form>
        </div>

        {/* ── RIGHT: Breakdown & Timeline ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>

          {/* Phase Breakdown */}
          <div className="pp-panel">
            <h2 className="pp-panel-title">
              <span>Phase Milestones</span>
              <span style={{ fontSize: '12px', color: '#64748b', fontWeight: 500 }}>Target Schedule</span>
            </h2>

            <div className="pp-phases-list">
              {PHASES.map((p, idx) => {
                // Calculate percentage based on active phase
                const cleanCurrent = (currentPhase || '').replace(/^Phase\s*\d+\s*[-–:]\s*/i, '');
                const currentIdx = PHASES.indexOf(cleanCurrent as any);
                let phasePct = 0;
                if (idx < currentIdx) phasePct = 100;
                else if (idx === currentIdx) phasePct = overallProgress;
                else phasePct = 0;

                return (
                  <div key={p} className="pp-phase-item">
                    <div className="pp-phase-header">
                      <span>{p}</span>
                      <span style={{ color: phasePct === 100 ? '#16a34a' : '#f05a28', display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                        {phasePct}% {phasePct === 100 && <Check size={13} />}
                      </span>
                    </div>
                    <div className="pp-phase-bar-bg">
                      <div
                        className="pp-phase-bar-fill"
                        style={{
                          width: `${phasePct}%`,
                          background: phasePct === 100 ? '#16a34a' : undefined,
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Progress Timeline Logs */}
          <div className="pp-panel">
            <h2 className="pp-panel-title">
              <span>Progress History</span>
              <span style={{ fontSize: '12px', color: '#64748b', fontWeight: 500 }}>{logs.length} entries</span>
            </h2>

            {loading ? (
              <p style={{ color: '#64748b', fontSize: '13px', textAlign: 'center' }}>Loading timeline…</p>
            ) : logs.length === 0 ? (
              <p style={{ color: '#64748b', fontSize: '13px', textAlign: 'center', padding: '1rem' }}>
                No progress updates logged yet. Use the form to submit the first milestone.
              </p>
            ) : (
              <div className="pp-timeline">
                {logs.map((item) => (
                  <div key={item.id} className="pp-log-card">
                    <div className="pp-log-top">
                      <span className="pp-log-phase">{item.phase}</span>
                      <span style={{ fontWeight: 700, color: '#f05a28' }}>{item.progress_pct}%</span>
                    </div>
                    <p className="pp-log-summary">{item.summary}</p>
                    {item.work_completed && (
                      <p className="pp-log-work" style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                        <Pin size={13} style={{ color: '#ea580c' }} /> {item.work_completed}
                      </p>
                    )}
                    <div className="pp-log-footer">
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                          <HardHat size={13} /> {item.manpower} workers
                        </span>
                        •
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                          <CloudSun size={13} /> {item.weather}
                        </span>
                      </span>
                      <span>{formatDate(item.created_at)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>

      </div>
    </main>
  );
};

export default ProjectProgress;
