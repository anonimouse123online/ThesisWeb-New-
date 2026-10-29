import { getErrorMessage } from '../utils/errors';
import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import '../components/Projects.css';
import { API_BASE_URL, fetchWithAuth } from '../utils/api';
import { formatCurrency } from '../utils/currency';
import { formatCalendarDate } from '../utils/dates';
import Dropdown, { type DropdownOption } from '../components/Dropdown';
import ProfileDropdown from '../components/ProfileDropdown';
import StatusBadge from '../components/StatusBadge';
import ProjectIssueBadge from '../components/ProjectIssueBadge';
import { showToast } from '../utils/toast';
import {
  ArrowRight,
  AlertTriangle,
  Building2,
  Plus,
  ShieldAlert,
  Clock,
  CalendarClock,
  CheckCircle2
} from 'lucide-react';

const BACKEND_URL = API_BASE_URL;

interface ProjectRecord {
  id?: string;
  code: string;
  name: string;
  location: string;
  client: string;
  start_date: string;
  end_date: string;
  original_end_date?: string | null;
  budget: string;
  status: 'Planning' | 'Ongoing' | 'Completed' | 'Pending' | string;
  scope?: string;
  phase?: string;
  task_count?: number;
  completed_task_count?: number;
  resource_count?: number;
  active_issue_count?: number | string | null;
  project_type?: string;
  construction_method?: string;
  schedule_risk_level?: 'low' | 'moderate' | 'high' | 'critical' | null;
}

interface TaskRecord {
  id: string | number;
  task_name: string;
  phase: string;
  assignee: string;
  due_date: string;
  priority: string;
  status: string;
  project_id?: string;
  project_name?: string;
  project_code?: string;
  code?: string;
}

interface ResourceRecord {
  id: number;
  name: string;
  supplier: string;
  category: 'Material' | 'Equipment';
  quantity: number;
  unit: string;
  minThreshold: number;
  unitPrice: number;
  project: string;
  status: string;
}

interface NewProjectForm {
  code: string;
  name: string;
  location: string;
  scope: string;
  client: string;
  budget: string;
  start_date: string;
  end_date: string;
  phase?: string;
  project_type: string;
  construction_method: string;
  schedule_risk_acknowledged: boolean;
}

const emptyForm: NewProjectForm = {
  code: '',
  name: '',
  location: '',
  scope: '',
  client: '',
  budget: '',
  start_date: '',
  end_date: '',
  phase: 'Foundation',
  project_type: '',
  construction_method: 'traditional',
  schedule_risk_acknowledged: false,
};

/* ── Timeline Feasibility Rules (industry standards) ── */
const FEASIBILITY_RULES: Record<string, Record<string, number>> = {
  residential:     { traditional: 90,  modular_prefab: 21, renovation: 14 },
  commercial:      { traditional: 180, modular_prefab: 60, renovation: 30 },
  road_civil:      { traditional: 60,  modular_prefab: 30, renovation: 14 },
  interior_fitout: { traditional: 14,  modular_prefab: 7,  renovation: 7  },
  minor_repairs:   { traditional: 5,   modular_prefab: 3,  renovation: 3  },
};

const PROJECT_TYPE_LABELS: Record<string, string> = {
  residential:     'Residential (House / Apartment)',
  commercial:      'Commercial / Institutional Building',
  road_civil:      'Road, Drainage & Civil Works',
  interior_fitout: 'Interior Fit-out / Renovation',
  minor_repairs:   'Minor Repairs / Specialty Works',
};

const CONSTRUCTION_METHOD_LABELS: Record<string, string> = {
  traditional:    'Traditional (Reinforced Concrete / CHB)',
  modular_prefab: 'Modular / Prefabricated / Steel Frame',
  renovation:     'Renovation / Extension',
};

const PROJECT_TYPE_OPTIONS: DropdownOption[] = [
  {
    value: 'residential',
    label: 'Residential (House / Apartment)',
    sublabel: 'ASTM C31: Min. 90 calendar days concrete curing & sequential build',
  },
  {
    value: 'commercial',
    label: 'Commercial / Institutional Building',
    sublabel: 'Multi-story foundation, deep curing, MEP & facade systems',
  },
  {
    value: 'road_civil',
    label: 'Road, Drainage & Civil Works',
    sublabel: 'Grading, subbase compaction, drainage lines & asphalt/paving',
  },
  {
    value: 'interior_fitout',
    label: 'Interior Fit-out / Renovation',
    sublabel: 'Non-structural partitions, architectural joinery, finishes',
  },
  {
    value: 'minor_repairs',
    label: 'Minor Repairs / Specialty Works',
    sublabel: 'Punch-list fixes, waterproofing, repainting, hardware upgrades',
  },
];

const CONSTRUCTION_METHOD_OPTIONS: DropdownOption[] = [
  {
    value: 'traditional',
    label: 'Traditional (Reinforced Concrete / CHB)',
    sublabel: 'Cast-in-place concrete; requires standard 14–28d ASTM curing',
  },
  {
    value: 'modular_prefab',
    label: 'Modular / Prefabricated / Steel Frame',
    sublabel: 'Factory prefabrication with accelerated on-site erection',
  },
  {
    value: 'renovation',
    label: 'Renovation / Extension',
    sublabel: 'Alterations utilizing existing structural core & foundation',
  },
];

interface FeasibilityResult {
  isRisky: boolean;
  riskLevel: 'low' | 'moderate' | 'high' | 'critical';
  durationDays: number;
  minimumDays: number;
  projectTypeLabel: string;
  methodLabel: string;
}

const computeFeasibility = (form: NewProjectForm): FeasibilityResult | null => {
  if (!form.project_type || !form.start_date || !form.end_date) return null;
  const startMs = new Date(form.start_date).getTime();
  const endMs = new Date(form.end_date).getTime();
  if (isNaN(startMs) || isNaN(endMs) || endMs <= startMs) return null;

  const durationDays = Math.round((endMs - startMs) / (1000 * 60 * 60 * 24));
  const method = form.construction_method || 'traditional';
  const typeRules = FEASIBILITY_RULES[form.project_type];
  if (!typeRules) return null;

  const minimumDays = typeRules[method] ?? typeRules.traditional;
  const ratio = durationDays / minimumDays;

  let riskLevel: FeasibilityResult['riskLevel'] = 'low';
  if (durationDays < minimumDays) {
    if (ratio < 0.25)      riskLevel = 'critical';
    else if (ratio < 0.5)  riskLevel = 'high';
    else if (ratio < 0.75) riskLevel = 'moderate';
    else                   riskLevel = 'moderate';
  }

  return {
    isRisky: durationDays < minimumDays,
    riskLevel,
    durationDays,
    minimumDays,
    projectTypeLabel: PROJECT_TYPE_LABELS[form.project_type] || form.project_type,
    methodLabel: CONSTRUCTION_METHOD_LABELS[method] || method,
  };
};

const generateRandomProjectCode = (existingProjects: ProjectRecord[] = []) => {
  const existingCodes = new Set(existingProjects.map(p => (p.code || '').toUpperCase()));
  const year = new Date().getFullYear();
  let code = '';
  do {
    const rand = Math.floor(1000 + Math.random() * 9000);
    code = `PRJ-${year}-${rand}`;
  } while (existingCodes.has(code));
  return code;
};

const Projects: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  // Active View: 'projects' | 'tasks' | 'resources'
  const activeView = searchParams.get('view') || 'projects';
  const setView = (v: string) => setSearchParams({ view: v });

  const [projects, setProjects] = useState<ProjectRecord[]>([]);
  const [tasks, setTasks] = useState<TaskRecord[]>([]);
  const [resources, setResources] = useState<ResourceRecord[]>([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modal
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState<NewProjectForm>(emptyForm);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const openCreateModal = () => {
    const randomCode = generateRandomProjectCode(projects);
    setForm({
      code: randomCode,
      name: '',
      location: '',
      scope: '',
      client: '',
      budget: '',
      start_date: '',
      end_date: '',
      project_type: '',
      construction_method: 'traditional',
      schedule_risk_acknowledged: false,
    });
    setFormError(null);
    setShowModal(true);
  };

  // Filters
  const [selectedProjectFilter, setSelectedProjectFilter] = useState('All');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');

  // User
  const storedUser = localStorage.getItem('user');
  let userName = 'User';
  let userRole = 'Member';
  try {
    if (storedUser) {
      const parsed = JSON.parse(storedUser);
      userName = parsed.name || parsed.email?.split('@')[0] || 'User';
      userRole = parsed.role || 'Member';
    }
  } catch { /* ignore */ }

  useEffect(() => {
    fetchAllData();
  }, []);

  const fetchAllData = async () => {
    try {
      setLoading(true);
      setError(null);

      const [pRes, tRes, rRes] = await Promise.allSettled([
        fetchWithAuth(`${BACKEND_URL}/projects`),
        fetchWithAuth(`${BACKEND_URL}/tasks`),
        fetchWithAuth(`${BACKEND_URL}/resources`),
      ]);

      if (pRes.status === 'fulfilled' && pRes.value.ok) {
        const pData = await pRes.value.json();
        setProjects(pData.data ?? pData ?? []);
      } else {
        throw new Error('Failed to load projects');
      }

      if (tRes.status === 'fulfilled' && tRes.value.ok) {
        const tData = await tRes.value.json();
        setTasks(tData.tasks || tData.data || []);
      }

      if (rRes.status === 'fulfilled' && rRes.value.ok) {
        const rData = await rRes.value.json();
        setResources(rData.data || []);
      }
    } catch (err: unknown) {
      setError(getErrorMessage(err, '') || 'An unexpected error occurred.');
    } finally {
      setLoading(false);
    }
  };

  const todayStr = new Date().toISOString().split('T')[0];

  const formatBudgetWithCommas = (raw: string) => {
    const clean = raw.replace(/[^\d.]/g, '');
    if (!clean) return '';
    const parts = clean.split('.');
    const integerPart = parts[0].replace(/^0+(?=\d)/, '');
    const formattedInteger = (integerPart || '0').replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    if (parts.length > 1) {
      return `${formattedInteger}.${parts.slice(1).join('').slice(0, 2)}`;
    }
    return formattedInteger;
  };

  const handleCreateProject = async () => {
    const rawBudget = String(form.budget).replace(/,/g, '').trim();
    if (!form.code || !form.name || !form.location || !form.client || !form.start_date || !form.end_date || !rawBudget || !form.scope) {
      setFormError('Please fill in all required fields.');
      return;
    }

    if (!form.project_type) {
      setFormError('Please select a Project Type for timeline feasibility validation.');
      return;
    }

    if (form.start_date < todayStr) {
      setFormError('Start date cannot be earlier than today.');
      return;
    }

    if (form.end_date < form.start_date) {
      setFormError('End date cannot be earlier than the start date.');
      return;
    }

    // Client-side feasibility check
    const feasibility = computeFeasibility(form);
    if (feasibility?.isRisky && !form.schedule_risk_acknowledged) {
      setFormError(`Aggressive timeline detected (${feasibility.durationDays} days vs. recommended ${feasibility.minimumDays} days). Please acknowledge the schedule risk below to proceed.`);
      return;
    }

    try {
      setSubmitting(true);
      setFormError(null);
      const res = await fetchWithAuth(`${BACKEND_URL}/projects`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          budget: rawBudget,
          phase: form.phase || 'Foundation',
        }),
      });

      const data = await res.json();

      // Handle 422 feasibility warning from backend
      if (res.status === 422 && data.feasibility_warning) {
        setFormError(data.message);
        return;
      }

      if (!res.ok) throw new Error(data.message || 'Failed to create project');

      setProjects(prev => [data.data ?? data, ...prev]);
      setShowModal(false);
      setForm(emptyForm);
      showToast('Project created successfully!', 'success');
    } catch (err: unknown) {
      setFormError(getErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  const formatTimeline = (start: string, end: string) => {
    if (!start || !end) return '—';
    const fmt = (d: string) => {
      const dt = new Date(d);
      return `${(dt.getMonth() + 1).toString().padStart(2, '0')}/${dt.getDate().toString().padStart(2, '0')}/${String(dt.getFullYear()).slice(2)}`;
    };
    return (
      <span className="pm-timeline">
        <time dateTime={start}>{fmt(start)}</time>
        <time dateTime={end}>{fmt(end)}</time>
      </span>
    );
  };

  // Filter options
  const projectOptions = [
    { value: 'All', label: 'All Projects' },
    ...projects.map(p => ({ value: p.code, label: `${p.code} — ${p.name}` }))
  ];

  const statusOptions = [
    { value: 'All', label: 'All Statuses' },
    { value: 'Planning', label: 'Planning' },
    { value: 'Pending', label: 'Pending' },
    { value: 'Ongoing', label: 'Ongoing' },
    { value: 'Completed', label: 'Completed' },
  ];

  // Filtered lists
  const filteredProjects = projects.filter(p => {
    const matchProject = selectedProjectFilter === 'All' || p.code === selectedProjectFilter;
    const matchStatus  = selectedStatusFilter === 'All' || p.status.toLowerCase() === selectedStatusFilter.toLowerCase();
    const matchSearch  = !searchQuery || p.name.toLowerCase().includes(searchQuery.toLowerCase()) || p.code.toLowerCase().includes(searchQuery.toLowerCase()) || (p.client && p.client.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchProject && matchStatus && matchSearch;
  });

  const filteredTasks = tasks.filter(t => {
    const pCode = t.project_code || t.code || '';
    const matchProject = selectedProjectFilter === 'All' || pCode === selectedProjectFilter || (t.project_name && t.project_name.toLowerCase().includes(selectedProjectFilter.toLowerCase()));
    const matchStatus  = selectedStatusFilter === 'All' || (t.status || '').toLowerCase() === selectedStatusFilter.toLowerCase();
    const matchSearch  = !searchQuery || t.task_name.toLowerCase().includes(searchQuery.toLowerCase()) || (t.assignee && t.assignee.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchProject && matchStatus && matchSearch;
  });

  const filteredResources = resources.filter(r => {
    const matchProject = selectedProjectFilter === 'All' || (r.project && r.project.toLowerCase().includes(selectedProjectFilter.toLowerCase()));
    const matchSearch  = !searchQuery || r.name.toLowerCase().includes(searchQuery.toLowerCase()) || (r.supplier && r.supplier.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchProject && matchSearch;
  });

  // Calculate project specific task stats
  const getProjectTaskStats = (prjCode: string, prjName: string) => {
    const prjTasks = tasks.filter(t => (t.project_code === prjCode) || (t.project_name === prjName) || (t.code === prjCode));
    const done = prjTasks.filter(t => (t.status || '').toLowerCase().includes('completed')).length;
    const total = prjTasks.length;
    const pct = total > 0 ? Math.round((done / total) * 100) : 0;
    return { done, total, pct };
  };

  const getProjectResourceCount = (prjName: string) => {
    return resources.filter(r => r.project && r.project.toLowerCase() === prjName.toLowerCase()).length;
  };

  const getProjectResourceCost = (prjName: string, prjCode?: string) => {
    return resources
      .filter(r => r.project && (
        r.project.toLowerCase() === prjName.toLowerCase() ||
        (prjCode && r.project.toLowerCase() === prjCode.toLowerCase())
      ))
      .reduce((sum, r) => sum + (Number(r.quantity) || 0) * (Number(r.unitPrice) || 0), 0);
  };

  return (
    <main className={`main-content ${activeView === 'projects' ? 'pm-overview' : ''}`}>
      {/* ── Header ── */}
      <header className="pm-header">
        <div>
          <h1 className="pm-title">Projects Hub</h1>
          <p className="pm-subtitle">Unified management for construction projects, tasks, and site resources</p>
        </div>
        <div className="pm-header-right">
          <ProfileDropdown userName={userName} userRole={userRole} />
        </div>
      </header>

      {/* ── Unified Switcher Tabs ── */}
      <div className="pm-hub-nav-bar">
        <div className="pm-hub-tabs">
          <button
            className={`pm-hub-tab ${activeView === 'projects' ? 'pm-hub-tab--active' : ''}`}
            onClick={() => setView('projects')}
          >
            <Building2 size={16} />
            <span>Projects Overview ({projects.length})</span>
          </button>
        </div>

        <button className="pm-new-btn" onClick={openCreateModal}>
          <Plus size={15} />
          <span>New Project</span>
        </button>
      </div>

      {/* ── View Controls & Filters ── */}
      <div className="pm-card">
        <div className="pm-card-header">
          <div className="flex gap-3 items-center flex-wrap">
            <input
              type="text"
              className="pd-search-input"
              placeholder={`Search ${activeView}…`}
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
            {activeView !== 'projects' && (
              <Dropdown
                options={projectOptions}
                value={selectedProjectFilter}
                onChange={setSelectedProjectFilter}
                prefix="Project"
              />
            )}
            <Dropdown
              options={statusOptions}
              value={selectedStatusFilter}
              onChange={setSelectedStatusFilter}
              prefix="Status"
            />
          </div>
        </div>

        {loading && <p className="pm-state-msg">Loading {activeView}…</p>}
        {error   && <p className="pm-state-msg pm-state-msg--error">{error}</p>}

        {/* ═══════════════════════════════════════════════════════════════════ */}
        {/* ── VIEW 1: PROJECTS OVERVIEW ──────────────────────────────────── */}
        {/* ═══════════════════════════════════════════════════════════════════ */}
        {!loading && !error && activeView === 'projects' && (
          filteredProjects.length === 0 ? (
            <p className="pm-state-msg">No projects match the selected filters.</p>
          ) : (
            <div className="pm-project-table-scroll">
            <table className="pm-table pm-project-table">
              <colgroup>
                <col className="pm-col-code" />
                <col className="pm-col-name" />
                <col className="pm-col-alerts" />
                <col className="pm-col-client" />
                <col className="pm-col-timeline" />
                <col className="pm-col-budget" />
                <col className="pm-col-progress" />
                <col className="pm-col-resources" />
                <col className="pm-col-status" />
                <col className="pm-col-issues" />
                <col className="pm-col-actions" />
              </colgroup>
              <thead>
                <tr>
                  <th>Project Code</th>
                  <th>Name &amp; Location</th>
                  <th>Alerts</th>
                  <th>Client</th>
                  <th>Timeline</th>
                  <th>Budget</th>
                  <th>Progress</th>
                  <th>Resources</th>
                  <th>Status</th>
                  <th>Issues</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredProjects.map((prj) => {
                  const { done, total, pct } = getProjectTaskStats(prj.code, prj.name);
                  const resCount = getProjectResourceCount(prj.name);
                  const initialBudget = parseFloat(String(prj.budget)) || 0;
                  const invCost = getProjectResourceCost(prj.name, prj.code);
                  const remainingBudget = Math.max(0, initialBudget - invCost);

                  const hasRisk = Boolean(prj.schedule_risk_level && prj.schedule_risk_level !== 'low');
                  const isExtended = Boolean(prj.original_end_date && prj.end_date > prj.original_end_date);
                  const extDays = isExtended
                    ? Math.round((new Date(prj.end_date).getTime() - new Date(prj.original_end_date!).getTime()) / (1000 * 60 * 60 * 24))
                    : 0;

                  return (
                    <tr key={prj.code}>
                      <td className="pm-project-code">
                        <span title={prj.code}>{prj.code}</span>
                      </td>
                      <td className="pm-project-name">
                        <div className="pm-td-bold">
                          <span>{prj.name}</span>
                        </div>
                        <div className="pm-td-muted pm-project-location">{prj.location}</div>
                      </td>
                      <td className="pm-project-alerts">
                        {!hasRisk && (!isExtended || extDays <= 0) ? (
                          <span className="pm-td-muted">—</span>
                        ) : (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '5px', flexWrap: 'wrap' }}>
                            {hasRisk && (
                              <span
                                className={`pm-risk-pill pm-risk-pill--${prj.schedule_risk_level}`}
                                title={`Fast-Track Schedule: Created with ${prj.schedule_risk_level!.toUpperCase()} schedule risk acknowledgment`}
                              >
                                <ShieldAlert size={12} />
                              </span>
                            )}
                            {isExtended && extDays > 0 && (
                              <span
                                className="pm-extended-pill"
                                title={`Timeline Extended: Baseline completion date was ${prj.original_end_date} (+${extDays} day${extDays === 1 ? '' : 's'})`}
                              >
                                <CalendarClock size={11} />
                                <span>(+{extDays}D)</span>
                              </span>
                            )}
                          </div>
                        )}
                      </td>
                      <td className="pm-project-client">{prj.client}</td>
                      <td className="pm-td-muted">{formatTimeline(prj.start_date, prj.end_date)}</td>
                      <td className="pm-project-budget">
                        <strong title={invCost > 0 ? `Original Budget: ${formatCurrency(initialBudget)} | Inventory Cost: -${formatCurrency(invCost)} | Remaining: ${formatCurrency(remainingBudget)}` : undefined}>
                          {formatCurrency(remainingBudget)}
                        </strong>
                      </td>
                      <td>
                        <div className="pm-project-progress">
                          <div className="pm-progress-track" role="progressbar" aria-label={`${prj.name} task progress`} aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
                            <div className="pm-progress-fill" style={{ width: `${pct}%` }} />
                          </div>
                          <span className="pm-progress-stats">
                            <span>{done}/{total}</span>
                            <span className="pm-td-muted">{pct}%</span>
                          </span>
                        </div>
                      </td>
                      <td className="pm-project-resources">{resCount} items</td>
                      <td><StatusBadge status={prj.status} showDot={false} className="pm-project-status" /></td>
                      <td>
                        <ProjectIssueBadge projectCode={prj.code} activeIssueCount={prj.active_issue_count} />
                      </td>
                      <td className="pm-project-actions">
                        <button
                          className="pm-view-btn pm-workspace-btn"
                          onClick={() => navigate(`/projects/${prj.code}`)}
                          title="Open Project Workspace"
                        >
                          Workspace <ArrowRight size={13} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            </div>
          )
        )}

        {/* ═══════════════════════════════════════════════════════════════════ */}
        {/* ── VIEW 2: GLOBAL TASKS ───────────────────────────────────────── */}
        {/* ═══════════════════════════════════════════════════════════════════ */}
        {!loading && !error && activeView === 'tasks' && (
          filteredTasks.length === 0 ? (
            <p className="pm-state-msg">No tasks found matching criteria.</p>
          ) : (
            <table className="pm-table">
              <thead>
                <tr>
                  <th>Task Name</th>
                  <th>Project</th>
                  <th>Phase</th>
                  <th>Assignee</th>
                  <th>Due Date</th>
                  <th>Priority</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {filteredTasks.map((t) => (
                  <tr key={t.id}>
                    <td className="pm-td-bold">{t.task_name}</td>
                    <td>
                      <span
                        className="pd-code-badge"
                        style={{ cursor: 'pointer' }}
                        title="Open Project Hub"
                        onClick={() => navigate(`/projects/${t.project_code || t.code}`)}
                      >
                        {t.project_code || t.code || 'PRJ'}
                      </span>{' '}
                      <span style={{ fontSize: '12px', color: '#475569' }}>{t.project_name}</span>
                    </td>
                    <td className="pm-td-muted">{t.phase ? t.phase.replace(/^Phase\s*\d+\s*[-–:]\s*/i, '') : '—'}</td>
                    <td>{t.assignee || 'Unassigned'}</td>
                    <td className="pm-td-muted">
                      {t.due_date ? formatCalendarDate(t.due_date) : '—'}
                    </td>
                    <td>
                      <span className={`pd-priority-badge pd-priority--${(t.priority || 'medium').toLowerCase()}`}>
                        {t.priority || 'Medium'}
                      </span>
                    </td>
                    <td>
                      <StatusBadge status={t.status || 'Pending'} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )
        )}

        {/* ═══════════════════════════════════════════════════════════════════ */}
        {/* ── VIEW 3: GLOBAL RESOURCES ───────────────────────────────────── */}
        {/* ═══════════════════════════════════════════════════════════════════ */}
        {!loading && !error && activeView === 'resources' && (
          filteredResources.length === 0 ? (
            <p className="pm-state-msg">No resources found matching criteria.</p>
          ) : (
            <table className="pm-table">
              <thead>
                <tr>
                  <th>Resource Name</th>
                  <th>Category</th>
                  <th>Project Assigned</th>
                  <th>Supplier</th>
                  <th>Quantity / Unit</th>
                  <th>Threshold</th>
                  <th>Unit Price</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {filteredResources.map((r) => {
                  const isLow = (r.status || '').toLowerCase().includes('low');
                  return (
                    <tr key={r.id}>
                      <td className="pm-td-bold">{r.name}</td>
                      <td>
                        <span className={`pd-res-badge ${r.category === 'Material' ? 'pd-res-badge--mat' : 'pd-res-badge--equip'}`}>
                          {r.category}
                        </span>
                      </td>
                      <td><strong>{r.project || 'General / Unassigned'}</strong></td>
                      <td className="pm-td-muted">{r.supplier || '—'}</td>
                      <td><strong>{r.quantity}</strong> {r.unit}</td>
                      <td className="pm-td-muted">Min {r.minThreshold} {r.unit}</td>
                      <td>{formatCurrency(r.unitPrice)}</td>
                      <td>
                        <StatusBadge status={r.status || (isLow ? 'Low stock' : 'In stock')} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )
        )}
      </div>

      {/* ── Create Project Modal ── */}
      {showModal && (
        <div className="pm-overlay" onClick={() => setShowModal(false)}>
          <div className="pm-modal" onClick={e => e.stopPropagation()}>
            <h2 className="pm-modal-title">Create New Project</h2>

            {formError && (
              <p className="pm-form-error" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <AlertTriangle size={15} /> {formError}
              </p>
            )}

            <div className="pm-form-row pm-form-row--2">
              <div className="pm-form-group">
                <label>Project Name <span className="pm-required">*</span></label>
                <input
                  className="pm-input"
                  value={form.name}
                  onChange={e => setForm({ ...form, name: e.target.value })}
                  placeholder="e.g., Downtown Office Complex"
                />
              </div>
              <div className="pm-form-group">
                <label>Project Code</label>
                <input
                  className="pm-input"
                  value={form.code}
                  readOnly
                  disabled
                  tabIndex={-1}
                  style={{
                    backgroundColor: '#f1f5f9',
                    color: '#334155',
                    fontWeight: 700,
                    letterSpacing: '0.5px',
                    cursor: 'not-allowed',
                    border: '1px solid #cbd5e1',
                    userSelect: 'none'
                  }}
                />
              </div>
            </div>

            <div className="pm-form-row pm-form-row--2">
              <div className="pm-form-group">
                <label>Project Type <span className="pm-required">*</span></label>
                <Dropdown
                  fullWidth
                  options={PROJECT_TYPE_OPTIONS}
                  value={form.project_type}
                  placeholder="— Select Project Type —"
                  onChange={val => setForm(prev => ({ ...prev, project_type: val, schedule_risk_acknowledged: false }))}
                />
                {form.project_type && (
                  <div className="pm-choice-hint">
                    <span>Recommended minimum: <strong>{FEASIBILITY_RULES[form.project_type]?.traditional || 0}+ calendar days</strong></span>
                  </div>
                )}
              </div>
              <div className="pm-form-group">
                <label>Construction Method <span className="pm-required">*</span></label>
                <Dropdown
                  fullWidth
                  options={CONSTRUCTION_METHOD_OPTIONS}
                  value={form.construction_method}
                  placeholder="Select Method"
                  onChange={val => setForm(prev => ({ ...prev, construction_method: val, schedule_risk_acknowledged: false }))}
                />
              </div>
            </div>

            <div className="pm-form-row pm-form-row--1">
              <div className="pm-form-group">
                <label>Location <span className="pm-required">*</span></label>
                <input
                  className="pm-input"
                  value={form.location}
                  onChange={e => setForm({ ...form, location: e.target.value })}
                  placeholder="Full address or site location"
                />
              </div>
            </div>

            <div className="pm-form-row pm-form-row--1">
              <div className="pm-form-group">
                <label>Project Scope <span className="pm-required">*</span></label>
                <textarea
                  className="pm-input pm-textarea"
                  value={form.scope}
                  onChange={e => setForm({ ...form, scope: e.target.value })}
                  placeholder="Detailed description of project scope, deliverables, and requirements"
                  rows={3}
                />
              </div>
            </div>

            <div className="pm-form-row pm-form-row--2">
              <div className="pm-form-group">
                <label>Client Name <span className="pm-required">*</span></label>
                <input
                  className="pm-input"
                  value={form.client}
                  onChange={e => setForm({ ...form, client: e.target.value })}
                  placeholder="Client organization"
                />
              </div>
              <div className="pm-form-group">
                <label>Budget (PHP) <span className="pm-required">*</span></label>
                <input
                  className="pm-input"
                  type="text"
                  inputMode="decimal"
                  value={form.budget}
                  onChange={e => {
                    const formatted = formatBudgetWithCommas(e.target.value);
                    setForm({ ...form, budget: formatted });
                  }}
                  placeholder="0.00"
                />
              </div>
            </div>

            <div className="pm-form-row pm-form-row--2">
              <div className="pm-form-group">
                <label>Start Date <span className="pm-required">*</span></label>
                <input
                  className="pm-input"
                  type="date"
                  min={todayStr}
                  value={form.start_date}
                  onChange={e => {
                    const newStart = e.target.value;
                    setForm(prev => ({
                      ...prev,
                      start_date: newStart,
                      end_date: prev.end_date && prev.end_date < newStart ? newStart : prev.end_date,
                      schedule_risk_acknowledged: false,
                    }));
                  }}
                />
              </div>
              <div className="pm-form-group">
                <label>End Date (Due Date) <span className="pm-required">*</span></label>
                <input
                  className="pm-input"
                  type="date"
                  min={form.start_date || todayStr}
                  value={form.end_date}
                  onChange={e => setForm({ ...form, end_date: e.target.value, schedule_risk_acknowledged: false })}
                />
              </div>
            </div>

            {/* ── Timeline Feasibility Alert ── */}
            {(() => {
              const f = computeFeasibility(form);
              if (!f) return null;

              if (!f.isRisky) {
                return (
                  <div className="pm-feasibility-ok">
                    <CheckCircle2 size={16} />
                    <span>
                      <strong>Timeline is feasible.</strong> {f.durationDays}-day schedule meets the recommended
                      minimum of {f.minimumDays} days for {f.projectTypeLabel.toLowerCase()} ({f.methodLabel.toLowerCase()}).
                    </span>
                  </div>
                );
              }

              const riskColors: Record<string, { bg: string; border: string; text: string; icon: string }> = {
                moderate: { bg: '#fef3c7', border: '#f59e0b', text: '#92400e', icon: '#f59e0b' },
                high:     { bg: '#fee2e2', border: '#ef4444', text: '#991b1b', icon: '#ef4444' },
                critical: { bg: '#fce4ec', border: '#dc2626', text: '#7f1d1d', icon: '#dc2626' },
              };
              const colors = riskColors[f.riskLevel] || riskColors.moderate;

              return (
                <div
                  className="pm-feasibility-alert"
                  style={{
                    background: colors.bg,
                    border: `1.5px solid ${colors.border}`,
                    borderRadius: '12px',
                    padding: '16px 18px',
                    marginBottom: '16px',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                    {f.riskLevel === 'critical' ? (
                      <ShieldAlert size={22} color={colors.icon} style={{ flexShrink: 0, marginTop: '2px' }} />
                    ) : (
                      <AlertTriangle size={22} color={colors.icon} style={{ flexShrink: 0, marginTop: '2px' }} />
                    )}
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 800, fontSize: '13.5px', color: colors.text, marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                        {f.riskLevel} Schedule Risk Detected
                      </div>
                      <p style={{ fontSize: '12.5px', color: colors.text, margin: '0 0 10px 0', lineHeight: '1.6' }}>
                        A <strong>{f.projectTypeLabel.toLowerCase()}</strong> project using <strong>{f.methodLabel.toLowerCase()}</strong> typically
                        requires a minimum of <strong>{f.minimumDays} calendar days</strong> to account for concrete curing
                        (ASTM/DPWH 14–28 days), structural phasing, and sequential task dependencies.
                        Your selected timeline is only <strong>{f.durationDays} day{f.durationDays !== 1 ? 's' : ''}</strong>.
                      </p>
                      <div style={{ display: 'flex', gap: '16px', fontSize: '12px', color: colors.text, marginBottom: '12px', fontWeight: 600 }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <Clock size={13} /> Your Duration: {f.durationDays} days
                        </span>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <Clock size={13} /> Recommended: {f.minimumDays}+ days
                        </span>
                      </div>
                      <label
                        style={{
                          display: 'flex',
                          alignItems: 'flex-start',
                          gap: '10px',
                          cursor: 'pointer',
                          background: 'rgba(255,255,255,0.6)',
                          borderRadius: '8px',
                          padding: '10px 12px',
                          border: `1px solid ${colors.border}40`,
                          fontSize: '12.5px',
                          color: colors.text,
                          fontWeight: 600,
                          lineHeight: '1.5',
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={form.schedule_risk_acknowledged}
                          onChange={e => setForm({ ...form, schedule_risk_acknowledged: e.target.checked })}
                          style={{ marginTop: '3px', accentColor: colors.border, width: '16px', height: '16px', flexShrink: 0 }}
                        />
                        <span>
                          I acknowledge this is a <strong>Fast-Track / Compressed Schedule</strong>.
                          I understand the risks involved including zero task float, potential quality trade-offs,
                          and that this project will be tagged as "{f.riskLevel.toUpperCase()} SCHEDULE RISK".
                        </span>
                      </label>
                    </div>
                  </div>
                </div>
              );
            })()}

            <div className="pm-modal-actions">
              <button
                className="pm-btn-cancel"
                onClick={() => { setShowModal(false); setForm(emptyForm); setFormError(null); }}
              >
                Cancel
              </button>
              <button
                className="pm-btn-create"
                onClick={handleCreateProject}
                disabled={submitting || (computeFeasibility(form)?.isRisky && !form.schedule_risk_acknowledged)}
              >
                {submitting ? 'Creating…' : 'Create Project'}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
};

export default Projects;
