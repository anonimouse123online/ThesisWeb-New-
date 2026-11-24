import { useEffect, useMemo, useState } from 'react';
import { Activity, ArrowRight, BarChart2, Calendar, CalendarClock, CalendarDays, ChevronLeft, ChevronRight, Clock3, GitBranch, History, ListChecks, LockKeyhole, MessageSquareQuote, Printer, RefreshCw, Rows3, Search, TrendingDown, TrendingUp, X } from 'lucide-react';
import { API_BASE_URL, fetchWithAuth } from '../utils/api';
import { getErrorMessage } from '../utils/errors';
import { formatCalendarDate, toDateInputValue } from '../utils/dates';
import { getTaskProgress, getWorkStatus } from '../utils/taskWorkStatus';
import { getScheduleTimelineUnits, projectTaskMatches } from '../utils/scheduleTimeline';
import './Schedule.css';

type Task = { id: string | number; task_name: string; start_date?: string; due_date?: string; status?: string; assignee?: string; description?: string; site_instructions?: string; progress_pct?: number; completion_percentage?: number; estimated_duration_days?: number | null; predecessor_task_ids?: string[]; project_id?: string | number; project_name?: string; project_code?: string; priority?: string; created_at?: string; };
type Project = { id: string | number; name: string; code?: string; start_date?: string; end_date?: string };
type View = 'Gantt Chart' | 'S-Curve' | 'Calendar' | 'Simulator' | 'Resource View';
type ScenarioType = 'Task Date Change' | 'Task delay' | 'Additional manpower' | 'Overtime' | 'Material delay' | 'Weather delay' | 'Construction resequencing' | 'Combined recovery scenario';
type EngineCapabilities = { available?: boolean; status?: string; scheduleRead?: boolean; taskDateSimulation?: boolean; dependencySimulation?: boolean; scenarioPersistence?: boolean; scenarioComparison?: boolean; changeApproval?: boolean; criticalPath?: boolean; manpowerSimulation?: boolean; overtimeSimulation?: boolean; materialDelaySimulation?: boolean; manualWeatherSimulation?: boolean; recovery?: { available?: boolean }; requiresScheduleVersion?: boolean; unavailableReason?: string | null };
type EngineTask = { id: string; name: string; startDate: string; endDate: string; duration: number; progress: number; status?: string; totalFloat?: number; critical?: boolean; warnings?: string[] };
type EngineDependency = { predecessorTaskId: string; successorTaskId: string; type: string; lag: number };
type EngineSchedule = { scheduleVersion: string; completionDate?: string | null; projectStart?: string; projectEnd?: string; tasks: EngineTask[]; dependencies: EngineDependency[]; criticalPath: string[]; constraints?: Array<{taskId?: string;message: string}>; warnings?: Array<{taskId?: string;message: string}>; risk?: Record<string, unknown> };
type EngineSimulation = { scenarioId: string; status: string; originalCompletion?: string; simulatedCompletion?: string; delayWorkingDays?: number | null; affectedTasks?: Array<Record<string, unknown>>; criticalPathBefore?: string[]; criticalPathAfter?: string[]; criticalPathChanges?: {added?: string[];removed?: string[]}; constraintWarnings?: Array<{message?: string}>; scheduleVersion: string; data?: { original?: EngineSchedule; proposed?: EngineSchedule; forecastCompletionDate?: string; durationDifferenceWorkingDays?: number | null; affectedTasks?: Array<Record<string, unknown>>; criticalPathChanges?: {added?: string[];removed?: string[]}; costImpact?: {status?: string;amount?: number|null;currency?: string|null}; explanations?: Array<Record<string, unknown>>; resourceResults?: Array<Record<string, unknown>> } };
type SavedScenario = { id: string; name: string; scenario_type: string; status: string; forecast_completion_date?: string; created_at?: string; modification_reason?: string; task_id?: string; task_name?: string; working_day_difference?: number };
type SavedBaseline = { id: string; version: number; project_completion_date?: string; approved_at?: string };
const tabs: View[] = ['Gantt Chart', 'S-Curve', 'Calendar', 'Resource View'];
const dayMs = 86400000;
const parseDay = (value?: string) => { const normalized = toDateInputValue(value); return normalized ? new Date(`${normalized}T12:00:00`) : null; };
const keyDay = (d: Date) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate()+n, 12);
const daysBetween = (a: Date, b: Date) => Math.round((Date.UTC(b.getFullYear(),b.getMonth(),b.getDate()) - Date.UTC(a.getFullYear(),a.getMonth(),a.getDate())) / dayMs);
const taskStart = (t: Task) => parseDay(t.start_date) || parseDay(t.due_date);
const taskEnd = (t: Task) => parseDay(t.due_date) || taskStart(t);
const statusClass = (status: string) => status.toLowerCase().replace(/\s+/g, '-');

function computeGanttEdgePath(x1: number, y1: number, x2: number, y2: number): string {
  // If successor starts cleanly after predecessor finishes (with comfortable gap for arrow)
  if (x2 >= x1 + 14) {
    const midX = Math.round((x1 + x2) / 2);
    return `M ${x1} ${y1} H ${midX} V ${y2} H ${x2}`;
  }
  // If successor starts before or very close to predecessor finish (loop around lanes)
  const exitX = x1 + 10;
  const entryX = x2 - 10;
  const midY = y1 === y2 ? y1 - 24 : Math.round((y1 + y2) / 2);
  return `M ${x1} ${y1} H ${exitX} V ${midY} H ${entryX} V ${y2} H ${x2}`;
}

function GanttDependencySvg({ tasks, axisStart, scale, unitWidth, selectedId }: { tasks: Task[]; axisStart: Date; scale: 'Day'|'Week'|'Month'; unitWidth: number; selectedId: string | number | null }) {
  const offset = (date: Date) => scale === 'Day'
    ? daysBetween(axisStart, date) * unitWidth
    : scale === 'Week'
      ? Math.floor(daysBetween(axisStart, date) / 7) * unitWidth
      : ((date.getFullYear() - axisStart.getFullYear()) * 12 + date.getMonth() - axisStart.getMonth()) * unitWidth;
  const span = (start: Date, end: Date) => Math.max(14, (scale === 'Day'
    ? daysBetween(start, end) + 1
    : scale === 'Week'
      ? Math.floor(daysBetween(start, end) / 7) + 1
      : (end.getFullYear() - start.getFullYear()) * 12 + end.getMonth() - start.getMonth() + 1) * unitWidth - 4);
  const edges = tasks.flatMap((successor, to) => (successor.predecessor_task_ids || []).flatMap(id => {
    const from = tasks.findIndex(candidate => String(candidate.id) === String(id));
    const predecessor = tasks[from];
    const start = predecessor && taskStart(predecessor), end = predecessor && taskEnd(predecessor);
    const nextStart = taskStart(successor);
    return from < 0 || !start || !end || !nextStart ? [] : [{
      key: `${id}-${successor.id}`,
      from,
      to,
      x1: offset(start) + span(start, end),
      x2: offset(nextStart),
      selected: String(selectedId) === String(id) || String(selectedId) === String(successor.id)
    }];
  }));
  return (
    <svg className="gantt-dependency-svg" width="100%" height={tasks.length * 59} aria-hidden="true">
      <defs>
        <marker id="schedule-arrow" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
          <path d="M0,0.5 L5,3 L0,5.5 Z" fill="#9aa8b1"/>
        </marker>
        <marker id="schedule-arrow-active" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
          <path d="M0,0.5 L5,3 L0,5.5 Z" fill="#df793d"/>
        </marker>
      </defs>
      {edges.map(edge => {
        const y1 = edge.from * 59 + 29.5;
        const y2 = edge.to * 59 + 29.5;
        return (
          <path
            key={edge.key}
            d={computeGanttEdgePath(edge.x1, y1, edge.x2, y2)}
            fill="none"
            stroke={edge.selected ? '#df793d' : '#9aa8b1'}
            strokeWidth={edge.selected ? 2 : 1.5}
            markerEnd={edge.selected ? 'url(#schedule-arrow-active)' : 'url(#schedule-arrow)'}
          />
        );
      })}
    </svg>
  );
}

interface SCurvePoint {
  date: Date;
  dateKey: string;
  label: string;
  isToday: boolean;
  isPastOrToday: boolean;
  plannedPct: number;
  actualPct: number | null;
  variance: number | null;
  spi: number | null;
  status: 'ahead' | 'ontrack' | 'delayed' | 'planned';
}

function SCurveSection({
  tasks,
  project,
  summaryStart,
  summaryEnd,
  labelDate,
}: {
  tasks: Task[];
  project?: Project;
  summaryStart: Date | null;
  summaryEnd: Date | null;
  labelDate: (value?: string | null) => string;
}) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  const datedTasks = useMemo(() => tasks.filter(t => taskStart(t) && taskEnd(t)), [tasks]);

  const sCurveData = useMemo(() => {
    if (datedTasks.length === 0) return null;

    const earliestDate = datedTasks.reduce<Date>((min, t) => {
      const s = taskStart(t)!;
      return s < min ? s : min;
    }, taskStart(datedTasks[0])!);

    const latestDate = datedTasks.reduce<Date>((max, t) => {
      const e = taskEnd(t)!;
      return e > max ? e : max;
    }, taskEnd(datedTasks[0])!);

    const pStart = summaryStart && summaryStart < earliestDate ? summaryStart : earliestDate;
    const pEnd = summaryEnd && summaryEnd > latestDate ? summaryEnd : latestDate;
    const totalDays = Math.max(1, daysBetween(pStart, pEnd) + 1);

    const taskWeights = datedTasks.map(t => {
      const s = taskStart(t)!;
      const e = taskEnd(t)!;
      const dur = Math.max(1, daysBetween(s, e) + 1);
      const progress = getTaskProgress(t);
      return { task: t, start: s, end: e, duration: dur, progress };
    });

    const totalDurationWeight = taskWeights.reduce((sum, item) => sum + item.duration, 0) || 1;

    const today = new Date();
    today.setHours(12, 0, 0, 0);

    const sampleCount = Math.min(24, Math.max(12, Math.floor(totalDays / 5)));
    const step = Math.max(1, Math.floor(totalDays / (sampleCount - 1)));

    const dateMap = new Map<string, Date>();
    dateMap.set(keyDay(pStart), pStart);
    dateMap.set(keyDay(pEnd), pEnd);

    for (let i = 1; i < sampleCount - 1; i++) {
      const sampleDate = addDays(pStart, i * step);
      if (sampleDate < pEnd) {
        dateMap.set(keyDay(sampleDate), sampleDate);
      }
    }

    if (today >= pStart && today <= pEnd) {
      dateMap.set(keyDay(today), today);
    }

    const sortedDates = Array.from(dateMap.values()).sort((a, b) => a.getTime() - b.getTime());

    const points: SCurvePoint[] = sortedDates.map(date => {
      const dKey = keyDay(date);
      const isToday = dKey === keyDay(today);
      const isPastOrToday = date <= today;

      let plannedWeightedSum = 0;
      for (const tw of taskWeights) {
        let taskPlanned = 0;
        if (date < tw.start) {
          taskPlanned = 0;
        } else if (date >= tw.end) {
          taskPlanned = 100;
        } else {
          const elapsed = daysBetween(tw.start, date) + 1;
          taskPlanned = Math.min(100, Math.max(0, (elapsed / tw.duration) * 100));
        }
        plannedWeightedSum += (tw.duration / totalDurationWeight) * taskPlanned;
      }
      const plannedPct = Math.min(100, Math.max(0, plannedWeightedSum));

      let actualPct: number | null = null;
      let variance: number | null = null;
      let spi: number | null = null;
      let status: 'ahead' | 'ontrack' | 'delayed' | 'planned' = 'planned';

      if (isPastOrToday) {
        let actualWeightedSum = 0;
        for (const tw of taskWeights) {
          let taskActual = 0;
          if (date < tw.start) {
            taskActual = 0;
          } else if (isToday || date >= today) {
            taskActual = tw.progress;
          } else {
            if (tw.progress > 0) {
              const daysToToday = Math.max(1, daysBetween(tw.start, today) + 1);
              const daysToDate = Math.max(1, daysBetween(tw.start, date) + 1);
              taskActual = Math.min(tw.progress, (daysToDate / daysToToday) * tw.progress);
            } else {
              taskActual = 0;
            }
          }
          actualWeightedSum += (tw.duration / totalDurationWeight) * taskActual;
        }
        actualPct = Math.min(100, Math.max(0, actualWeightedSum));
        variance = actualPct - plannedPct;
        spi = plannedPct > 0 ? actualPct / plannedPct : 1.0;

        if (variance >= 1.0) status = 'ahead';
        else if (variance >= -2.0) status = 'ontrack';
        else status = 'delayed';
      }

      return {
        date,
        dateKey: dKey,
        label: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        isToday,
        isPastOrToday,
        plannedPct,
        actualPct,
        variance,
        spi,
        status,
      };
    });

    let currentPlanned = 0;
    let currentActual = 0;
    for (const tw of taskWeights) {
      let tp = 0;
      if (today < tw.start) tp = 0;
      else if (today >= tw.end) tp = 100;
      else tp = Math.min(100, Math.max(0, ((daysBetween(tw.start, today) + 1) / tw.duration) * 100));
      currentPlanned += (tw.duration / totalDurationWeight) * tp;
      currentActual += (tw.duration / totalDurationWeight) * tw.progress;
    }
    currentPlanned = Math.min(100, Math.max(0, currentPlanned));
    currentActual = Math.min(100, Math.max(0, currentActual));

    const currentVariance = currentActual - currentPlanned;
    const currentSpi = currentPlanned > 0 ? currentActual / currentPlanned : 1.0;

    return {
      pStart,
      pEnd,
      today,
      totalDays,
      points,
      currentPlanned,
      currentActual,
      currentVariance,
      currentSpi,
      totalTasks: datedTasks.length,
      completedTasks: datedTasks.filter(t => getTaskProgress(t) === 100).length,
      inProgressTasks: datedTasks.filter(t => {
        const p = getTaskProgress(t);
        return p > 0 && p < 100;
      }).length,
    };
  }, [datedTasks, summaryStart, summaryEnd]);

  if (!sCurveData || datedTasks.length === 0) {
    return (
      <section className="scurve-empty">
        <BarChart2 size={44} color="#94a3b8" />
        <h3>No Task Schedule Dates Recorded</h3>
        <p>
          The S-Curve requires tasks with valid start and finish dates to compute cumulative planned and actual progress. Add dates to your activities in this project to generate the Earned Value S-Curve.
        </p>
      </section>
    );
  }

  const {
    points,
    today,
    currentPlanned,
    currentActual,
    currentVariance,
    currentSpi,
    totalTasks,
    completedTasks,
  } = sCurveData;

  const getX = (date: Date) => {
    if (sCurveData.totalDays <= 0) return 55;
    const elapsed = daysBetween(sCurveData.pStart, date);
    const ratio = Math.max(0, Math.min(1, elapsed / sCurveData.totalDays));
    return 55 + ratio * 910;
  };

  const getY = (pct: number) => {
    const clamped = Math.max(0, Math.min(100, pct));
    return 25 + 310 * (1 - clamped / 100);
  };

  const plannedPolyline = points.map(p => `${getX(p.date).toFixed(1)},${getY(p.plannedPct).toFixed(1)}`).join(' ');
  const plannedArea = `55,335 ${plannedPolyline} ${getX(points[points.length - 1].date).toFixed(1)},335`;

  const actualPoints = points.filter(p => p.actualPct !== null);
  const actualPolyline = actualPoints.map(p => `${getX(p.date).toFixed(1)},${getY(p.actualPct!).toFixed(1)}`).join(' ');
  const actualArea = actualPoints.length > 0 ? `${getX(actualPoints[0].date).toFixed(1)},335 ${actualPolyline} ${getX(actualPoints[actualPoints.length - 1].date).toFixed(1)},335` : '';

  const todayX = getX(today);
  const showTodayLine = todayX >= 55 && todayX <= 965;

  const activePoint = hoveredIndex !== null && points[hoveredIndex] ? points[hoveredIndex] : points.find(p => p.isToday) || points[points.length - 1];

  const overallStatus = currentVariance >= 1.0 ? 'Ahead of Schedule' : currentVariance >= -2.0 ? 'On Track' : 'Behind Schedule';
  const overallStatusClass = currentVariance >= 1.0 ? 'ahead' : currentVariance >= -2.0 ? 'ontrack' : 'delayed';

  return (
    <section className="scurve-workspace">
      {/* EVM KPI Cards */}
      <div className="scurve-kpi-grid">
        <article className="scurve-kpi-card">
          <div className="scurve-kpi-header">
            <span>Planned Progress (PV)</span>
            <div className="scurve-kpi-icon planned">
              <Calendar size={18} />
            </div>
          </div>
          <div className="scurve-kpi-body">
            <span className="scurve-kpi-value">{currentPlanned.toFixed(1)}%</span>
            <span className="scurve-kpi-badge ontrack">Target</span>
          </div>
          <div className="scurve-kpi-footer">
            Cumulative scheduled progress as of {labelDate(keyDay(today))}
          </div>
        </article>

        <article className="scurve-kpi-card">
          <div className="scurve-kpi-header">
            <span>Actual Accomplished (EV)</span>
            <div className="scurve-kpi-icon actual">
              <BarChart2 size={18} />
            </div>
          </div>
          <div className="scurve-kpi-body">
            <span className="scurve-kpi-value">{currentActual.toFixed(1)}%</span>
            <span className={`scurve-kpi-badge ${overallStatusClass}`}>
              {completedTasks}/{totalTasks} Done
            </span>
          </div>
          <div className="scurve-kpi-footer">
            Cumulative physical completion earned to date
          </div>
        </article>

        <article className="scurve-kpi-card">
          <div className="scurve-kpi-header">
            <span>Schedule Variance (SV)</span>
            <div className={`scurve-kpi-icon variance-${currentVariance >= 0 ? 'ahead' : 'delayed'}`}>
              {currentVariance >= 0 ? <TrendingUp size={18} /> : <TrendingDown size={18} />}
            </div>
          </div>
          <div className="scurve-kpi-body">
            <span className={`scurve-kpi-value ${currentVariance >= 0 ? 'ahead' : 'delayed'}`}>
              {currentVariance >= 0 ? '+' : ''}{currentVariance.toFixed(1)}%
            </span>
            <span className={`scurve-kpi-badge ${overallStatusClass}`}>
              {overallStatus}
            </span>
          </div>
          <div className="scurve-kpi-footer">
            Earned Value vs. Planned Value differential
          </div>
        </article>

        <article className="scurve-kpi-card">
          <div className="scurve-kpi-header">
            <span>Performance Index (SPI)</span>
            <div className="scurve-kpi-icon spi">
              <Activity size={18} />
            </div>
          </div>
          <div className="scurve-kpi-body">
            <span className="scurve-kpi-value">{currentSpi.toFixed(2)}</span>
            <span className={`scurve-kpi-badge ${overallStatusClass}`}>
              {currentSpi >= 1.0 ? 'Efficient' : 'Slippage'}
            </span>
          </div>
          <div className="scurve-kpi-footer">
            {currentSpi >= 1.0 ? 'Progressing at or above planned pace' : 'Schedule slippage detected; intervention advised'}
          </div>
        </article>
      </div>

      {/* S-Curve Interactive Chart Card */}
      <div className="scurve-chart-card">
        <header className="scurve-chart-toolbar">
          <div className="scurve-chart-title">
            <h2>Earned Value S-Curve Analysis</h2>
            <p>
              Cumulative Planned Value (PV) vs. Actual Earned Progress (EV) across {project?.name || 'All project tasks'}
            </p>
          </div>
          <div className="scurve-chart-legend">
            <div className="scurve-legend-item">
              <span className="scurve-legend-line planned" />
              <span>Planned Progress (PV)</span>
            </div>
            <div className="scurve-legend-item">
              <span className="scurve-legend-line actual" />
              <span>Actual Accomplishment (EV)</span>
            </div>
            {showTodayLine && (
              <div className="scurve-legend-item">
                <span className="scurve-legend-line today-marker" />
                <span>Today (Data Date)</span>
              </div>
            )}
            <button className="scurve-print-btn" onClick={() => window.print()} title="Print or export S-Curve report">
              <Printer size={13} /> Export Report
            </button>
          </div>
        </header>

        {/* Milestone Inspector Banner */}
        {activePoint && (
          <div className="scurve-hover-inspector">
            <div className="scurve-hover-date">
              Milestone: {labelDate(activePoint.dateKey)} {activePoint.isToday && '(Today / Current)'}
            </div>
            <div className="scurve-hover-stat">
              Planned (PV): <strong>{activePoint.plannedPct.toFixed(1)}%</strong>
            </div>
            <div className="scurve-hover-stat">
              Actual (EV):{' '}
              <strong>{activePoint.actualPct !== null ? `${activePoint.actualPct.toFixed(1)}%` : 'Pending (Future)'}</strong>
            </div>
            <div className="scurve-hover-stat">
              Variance:{' '}
              <strong style={{ color: activePoint.variance !== null && activePoint.variance >= 0 ? '#059669' : activePoint.variance !== null ? '#dc2626' : '#64748b' }}>
                {activePoint.variance !== null ? `${activePoint.variance >= 0 ? '+' : ''}${activePoint.variance.toFixed(1)}%` : '—'}
              </strong>
            </div>
            <div className="scurve-hover-stat">
              SPI: <strong>{activePoint.spi !== null ? activePoint.spi.toFixed(2) : '—'}</strong>
            </div>
            <span className={`scurve-pill ${activePoint.status}`}>
              {activePoint.status === 'ahead' ? 'Ahead' : activePoint.status === 'ontrack' ? 'On Track' : activePoint.status === 'delayed' ? 'Delayed' : 'Scheduled'}
            </span>
          </div>
        )}

        {/* SVG Curve */}
        <div className="scurve-svg-container">
          <svg viewBox="0 0 1000 380" aria-label="Earned Value S-Curve Graph">
            <defs>
              <linearGradient id="scurve-planned-gradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#4f46e5" stopOpacity="0.25" />
                <stop offset="100%" stopColor="#4f46e5" stopOpacity="0.0" />
              </linearGradient>
              <linearGradient id="scurve-actual-gradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#ea580c" stopOpacity="0.30" />
                <stop offset="100%" stopColor="#ea580c" stopOpacity="0.0" />
              </linearGradient>
            </defs>

            {/* Grid Lines and Y-Axis Labels */}
            {[0, 20, 40, 60, 80, 100].map(pct => {
              const y = getY(pct);
              return (
                <g key={pct}>
                  <line x1="55" y1={y} x2="965" y2={y} stroke="#e2e8f0" strokeDasharray={pct === 0 || pct === 100 ? undefined : '3,3'} strokeWidth={pct === 0 || pct === 100 ? '1.5' : '1'} />
                  <text x="47" y={y + 4} fill="#82919c" fontSize="10" fontWeight="600" textAnchor="end">
                    {pct}%
                  </text>
                </g>
              );
            })}

            {/* Area Fills */}
            <polygon points={plannedArea} fill="url(#scurve-planned-gradient)" />
            {actualArea && <polygon points={actualArea} fill="url(#scurve-actual-gradient)" />}

            {/* Today Line */}
            {showTodayLine && (
              <g>
                <line x1={todayX} y1={25} x2={todayX} y2={335} stroke="#ea580c" strokeWidth="1.8" strokeDasharray="4,4" />
                <rect x={todayX - 38} y={10} width="76" height="18" rx="4" fill="#ea580c" />
                <text x={todayX} y={22} fill="#ffffff" fontSize="9" fontWeight="800" textAnchor="middle" letterSpacing="0.4">
                  TODAY
                </text>
              </g>
            )}

            {/* Planned Line */}
            <polyline points={plannedPolyline} fill="none" stroke="#4f46e5" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" />

            {/* Actual Line */}
            {actualPoints.length > 0 && (
              <polyline points={actualPolyline} fill="none" stroke="#ea580c" strokeWidth="3.8" strokeLinecap="round" strokeLinejoin="round" />
            )}

            {/* Nodes and Hit Targets */}
            {points.map((p, idx) => {
              const cx = getX(p.date);
              const cyPlanned = getY(p.plannedPct);
              const cyActual = p.actualPct !== null ? getY(p.actualPct) : null;
              const isHovered = hoveredIndex === idx;

              return (
                <g key={p.dateKey}>
                  {/* Planned Node */}
                  <circle cx={cx} cy={cyPlanned} r={isHovered ? 6 : p.isToday ? 5 : 3.5} fill="#4f46e5" stroke="#ffffff" strokeWidth="2" />

                  {/* Actual Node */}
                  {cyActual !== null && (
                    <circle cx={cx} cy={cyActual} r={isHovered ? 7 : p.isToday ? 6 : 4} fill="#ea580c" stroke="#ffffff" strokeWidth="2.5" />
                  )}

                  {/* Highlight bar if hovered */}
                  {isHovered && (
                    <line x1={cx} y1={25} x2={cx} y2={335} stroke="#64748b" strokeWidth="1" strokeDasharray="2,2" opacity="0.7" />
                  )}

                  {/* Transparent hover hit target */}
                  <rect
                    x={cx - 15}
                    y={25}
                    width={30}
                    height={310}
                    fill="transparent"
                    style={{ cursor: 'pointer' }}
                    onMouseEnter={() => setHoveredIndex(idx)}
                  />
                </g>
              );
            })}

            {/* X-Axis Milestone Dates */}
            {points.filter((_, idx, arr) => {
              if (idx === 0 || idx === arr.length - 1) return true;
              const step = Math.max(2, Math.floor(arr.length / 7));
              return idx % step === 0;
            }).map(p => {
              const x = getX(p.date);
              return (
                <g key={p.dateKey}>
                  <line x1={x} y1="335" x2={x} y2="340" stroke="#cbd5e1" strokeWidth="1" />
                  <text x={x} y="354" fill="#64748b" fontSize="9" fontWeight="600" textAnchor="middle">
                    {p.label}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>
      </div>

      {/* Milestone Progress Breakdown Table */}
      <div className="scurve-table-card">
        <header className="scurve-table-head">
          <div>
            <h3>Milestone Progress Breakdown</h3>
            <span>Periodic tracking of Planned Value (PV) vs. Actual Earned Accomplishment (EV)</span>
          </div>
          <span className="scurve-pill ontrack">{points.length} Milestones Tracked</span>
        </header>

        <div className="scurve-table-scroll">
          <table className="scurve-table">
            <thead>
              <tr>
                <th>Milestone Date</th>
                <th>Planned Progress (PV)</th>
                <th>Actual Progress (EV)</th>
                <th>Schedule Variance (SV)</th>
                <th>SPI</th>
                <th>Variance Assessment</th>
              </tr>
            </thead>
            <tbody>
              {points.map((p, idx) => (
                <tr
                  key={p.dateKey}
                  className={p.isToday ? 'today-row' : ''}
                  onMouseEnter={() => setHoveredIndex(idx)}
                  style={{ cursor: 'pointer' }}
                >
                  <td>
                    <strong>{labelDate(p.dateKey)}</strong> {p.isToday && <span className="scurve-pill ontrack">Data Date</span>}
                  </td>
                  <td>{p.plannedPct.toFixed(1)}%</td>
                  <td>{p.actualPct !== null ? `${p.actualPct.toFixed(1)}%` : '—'}</td>
                  <td style={{ color: p.variance !== null && p.variance >= 0 ? '#059669' : p.variance !== null ? '#dc2626' : 'inherit' }}>
                    {p.variance !== null ? `${p.variance >= 0 ? '+' : ''}${p.variance.toFixed(1)}%` : '—'}
                  </td>
                  <td>{p.spi !== null ? p.spi.toFixed(2) : '—'}</td>
                  <td>
                    <span className={`scurve-pill ${p.status}`}>
                      {p.status === 'ahead' ? 'Ahead of Schedule' : p.status === 'ontrack' ? 'On Track' : p.status === 'delayed' ? 'Delayed / Slippage' : 'Scheduled Future'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}

export default function Schedule() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectId, setProjectId] = useState('');
  const [selected, setSelected] = useState<string | number | null>(null);
  const [tab, setTab] = useState<View>('Gantt Chart');
  const [calendarView, setCalendarView] = useState<'Month'|'Week'|'Day'>('Month');
  const [cursor, setCursor] = useState(() => new Date());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [zoom, setZoom] = useState(28);
  const [ganttScale, setGanttScale] = useState<'Day'|'Week'|'Month'>('Day');
  const [ganttCursor, setGanttCursor] = useState(() => new Date());
  const [scenarioType, setScenarioType] = useState<ScenarioType>('Task Date Change');
  const [proposedStart, setProposedStart] = useState('');
  const [proposedEnd, setProposedEnd] = useState('');
  const [changeReason, setChangeReason] = useState('');
  const [reasonCategory, setReasonCategory] = useState('Other');
  const [changeRemarks, setChangeRemarks] = useState('');
  const [delayDays, setDelayDays] = useState('');
  const [materialDate, setMaterialDate] = useState('');
  const [weatherDate, setWeatherDate] = useState('');
  const [engineCapabilities, setEngineCapabilities] = useState<EngineCapabilities | null>(null);
  const [engineSchedule, setEngineSchedule] = useState<EngineSchedule | null>(null);
  const [engineLoading, setEngineLoading] = useState(false);
  const [engineError, setEngineError] = useState('');
  const [engineReload, setEngineReload] = useState(0);
  const [simulation, setSimulation] = useState<EngineSimulation | null>(null);
  const [simulationLoading, setSimulationLoading] = useState(false);
  const [simulationError, setSimulationError] = useState('');
  const [savedScenarios, setSavedScenarios] = useState<SavedScenario[]>([]);
  const [changeRequests, setChangeRequests] = useState<Array<Record<string, unknown>>>([]);
  const [scheduleHistory, setScheduleHistory] = useState<Array<Record<string, unknown>>>([]);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [historySearch, setHistorySearch] = useState('');
  const [baselines, setBaselines] = useState<SavedBaseline[]>([]);
  const [recoveryResult, setRecoveryResult] = useState<Record<string, unknown> | null>(null);
  const [currentWorkers, setCurrentWorkers] = useState('');
  const [proposedWorkers, setProposedWorkers] = useState('');
  const [currentOutput, setCurrentOutput] = useState('');
  const [proposedOutput, setProposedOutput] = useState('');
  const [remainingQuantity, setRemainingQuantity] = useState('');
  const [laborCostPerWorkerDay, setLaborCostPerWorkerDay] = useState('');
  const [remainingEffortHours, setRemainingEffortHours] = useState('');
  const [baseProductiveHours, setBaseProductiveHours] = useState('');
  const [extraProductiveHours, setExtraProductiveHours] = useState('');
  const [overtimeDays, setOvertimeDays] = useState('');
  const [overtimeCostPerHour, setOvertimeCostPerHour] = useState('');
  const [materialAffectedIds, setMaterialAffectedIds] = useState<string[]>([]);
  const [activitySearch, setActivitySearch] = useState('');
  const [scenarioSearch, setScenarioSearch] = useState('');
  const [scenarioStatusFilter, setScenarioStatusFilter] = useState('All statuses');
  const [selectedScenarioIds, setSelectedScenarioIds] = useState<string[]>([]);
  const [scenarioComparison, setScenarioComparison] = useState<Array<Record<string, unknown>>>([]);
  const [reviewComments, setReviewComments] = useState('');
  const [approvalConfirm, setApprovalConfirm] = useState(false);
  const [workflowMessage, setWorkflowMessage] = useState('');
  const [dependencyPredecessor, setDependencyPredecessor] = useState('');
  const [dependencySuccessor, setDependencySuccessor] = useState('');
  const [dependencyType, setDependencyType] = useState('FS');
  const [dependencyLag, setDependencyLag] = useState('0');

  useEffect(() => { let active = true; (async () => { try {
    const [pr, tr] = await Promise.all([fetchWithAuth(`${API_BASE_URL}/projects`), fetchWithAuth(`${API_BASE_URL}/tasks`)]);
    if (!pr.ok || !tr.ok) throw new Error('Could not load project schedule data.');
    const [pj, tj] = await Promise.all([pr.json(), tr.json()]);
    const projectList = Array.isArray(pj) ? pj : pj.data || pj.projects || [];
    const taskList = Array.isArray(tj) ? tj : tj.data || tj.tasks || [];
    if (active) { setProjects(projectList); setTasks(taskList); }
  } catch (e) { if (active) setError(getErrorMessage(e)); } finally { if (active) setLoading(false); } })(); return () => { active = false; }; }, []);

  const visibleTasks = useMemo(() => {
    const selectedProject = projects.find(p => String(p.id) === projectId);
    const filtered = tasks.filter(t => projectTaskMatches(t, selectedProject));
    return [...filtered].sort((a, b) => {
      const aTime = a.created_at ? new Date(a.created_at).getTime() : 0;
      const bTime = b.created_at ? new Date(b.created_at).getTime() : 0;
      if (aTime && bTime && aTime !== bTime) return aTime - bTime;
      return 0;
    });
  }, [tasks, projectId, projects]);
  const project = projects.find(p => String(p.id) === projectId);
  const chosen = visibleTasks.find(t => String(t.id) === String(selected));
  const chosenEngineTask = engineSchedule?.tasks.find(task=>String(task.id)===String(chosen?.id));
  const lockedStartDate = toDateInputValue(chosen?.start_date)||chosenEngineTask?.startDate;
  const currentFinishDate = toDateInputValue(chosen?.due_date)||chosenEngineTask?.endDate;
  useEffect(()=>{if(!chosen)return;const engineTask=engineSchedule?.tasks.find(t=>String(t.id)===String(chosen.id));setProposedStart(toDateInputValue(chosen.start_date)||engineTask?.startDate||'');setProposedEnd(toDateInputValue(chosen.due_date)||engineTask?.endDate||'');setChangeReason('');setChangeRemarks('');setSimulation(null);if(tab!=='Simulator')setScenarioType('Task Date Change');},[chosen,engineSchedule]);
  useEffect(()=>{if(tab!=='Simulator')setScenarioType('Task Date Change');},[tab]);
  const predecessors = chosen ? engineSchedule?.dependencies.filter(d=>String(d.successorTaskId)===String(chosen.id)).map(d=>d.predecessorTaskId) ?? chosen.predecessor_task_ids ?? [] : [];
  const successorIds = chosen ? engineSchedule?.dependencies.filter(d=>String(d.predecessorTaskId)===String(chosen.id)).map(d=>String(d.successorTaskId)) : undefined;
  const successors = chosen ? visibleTasks.filter(t => successorIds ? successorIds.includes(String(t.id)) : t.predecessor_task_ids?.some(id => String(id) === String(chosen.id))) : [];
  const related = new Set([String(selected), ...predecessors.map(String), ...successors.map(t => String(t.id))]);
  useEffect(()=>{
    if(!projectId||!project){setEngineCapabilities(null);setEngineSchedule(null);setEngineLoading(false);setEngineError('');setSimulation(null);return;}
    let active=true;
    const base=`${API_BASE_URL}/projects/${encodeURIComponent(project.code||String(project.id))}/schedule`;
    const read=async(path:string)=>{const response=await fetchWithAuth(path);const payload=await response.json().catch(()=>({}));if(!response.ok)throw new Error(payload.message||payload.error||`Request failed (${response.status})`);return payload;};
    setEngineLoading(true);setEngineError('');setEngineCapabilities(null);setEngineSchedule(null);setSimulation(null);setSimulationError('');setRecoveryResult(null);
    (async()=>{try{
      const capabilityPayload=await read(`${base}/capabilities`);const capabilities=capabilityPayload.data as EngineCapabilities;
      if(!active)return;setEngineCapabilities(capabilities);
      if(!capabilities?.available||!capabilities.scheduleRead){setEngineLoading(false);return;}
      const schedulePayload=await read(base);const schedule=schedulePayload.data as EngineSchedule;
      if(!active)return;setEngineSchedule(schedule);
      const optional=await Promise.allSettled([read(`${base}/scenarios`),read(`${base}/change-requests`),read(`${base}/history`),read(`${base}/baselines`)]);
      if(!active)return;
      if(optional[0].status==='fulfilled')setSavedScenarios(Array.isArray(optional[0].value.data)?optional[0].value.data:[]);
      if(optional[1].status==='fulfilled')setChangeRequests(Array.isArray(optional[1].value.data)?optional[1].value.data:[]);
      if(optional[2].status==='fulfilled')setScheduleHistory(Array.isArray(optional[2].value.data)?optional[2].value.data:[]);
      if(optional[3].status==='fulfilled')setBaselines(Array.isArray(optional[3].value.data)?optional[3].value.data:[]);
    }catch(error){if(active)setEngineError(getErrorMessage(error));}finally{if(active)setEngineLoading(false);}})();
    return()=>{active=false;};
  },[projectId,project,engineReload]);
  const dated = visibleTasks.filter(t => taskStart(t) && taskEnd(t));
  const first = dated.reduce<Date | null>((v,t) => !v || taskStart(t)! < v ? taskStart(t) : v, null);
  const last = dated.reduce<Date | null>((v,t) => !v || taskEnd(t)! > v ? taskEnd(t) : v, null);
  const startDate = project?.start_date || (first ? keyDay(first) : '');
  const endDate = project?.end_date || (last ? keyDay(last) : '');
  const summaryStart=parseDay(startDate),summaryEnd=parseDay(endDate);
  const duration = summaryStart && summaryEnd ? daysBetween(summaryStart,summaryEnd)+1 : 0;
  const changeCursor = (amount: number) => setCursor(d => calendarView === 'Month' ? new Date(d.getFullYear(),d.getMonth()+amount,1,12) : addDays(d, amount*(calendarView==='Week'?7:1)));
  const simulatorPreview=simulation?.data?.proposed?.tasks||engineSchedule?.tasks||[];
  const baselinePreview=simulation?.data?.original?.tasks||engineSchedule?.tasks||[];
  const previewDates=simulatorPreview.map(t=>parseDay(t.startDate)).filter((d):d is Date=>Boolean(d));
  const previewEnds=simulatorPreview.map(t=>parseDay(t.endDate)).filter((d):d is Date=>Boolean(d));
  const previewStart=previewDates.reduce<Date|null>((v,d)=>!v||d<v?d:v,null);
  const previewEnd=previewEnds.reduce<Date|null>((v,d)=>!v||d>v?d:v,null);
  const previewSpan=previewStart&&previewEnd?Math.max(1,daysBetween(previewStart,previewEnd)+1):1;
  const ganttTasks=engineSchedule?visibleTasks.map(t=>({...t,predecessor_task_ids:engineSchedule.dependencies.filter(d=>String(d.successorTaskId)===String(t.id)).map(d=>String(d.predecessorTaskId))})):visibleTasks;
  const calendarDays = useMemo(() => {
    if (calendarView === 'Month') { const firstOfMonth = new Date(cursor.getFullYear(),cursor.getMonth(),1,12); const mondayOffset = (firstOfMonth.getDay()+6)%7; const start = addDays(firstOfMonth,-mondayOffset); return Array.from({length:42},(_,i)=>addDays(start,i)); }
    if (calendarView === 'Week') { const mondayOffset=(cursor.getDay()+6)%7; const start=addDays(cursor,-mondayOffset); return Array.from({length:7},(_,i)=>addDays(start,i)); }
    return [cursor];
  }, [cursor,calendarView]);
  const title = calendarView === 'Month' ? cursor.toLocaleDateString(undefined,{month:'long',year:'numeric'}) : calendarView === 'Week' ? `${calendarDays[0]?.toLocaleDateString(undefined,{month:'short',day:'numeric'})} – ${calendarDays[6]?.toLocaleDateString(undefined,{month:'short',day:'numeric',year:'numeric'})}` : cursor.toLocaleDateString(undefined,{weekday:'long',month:'long',day:'numeric',year:'numeric'});
  const labelDate = (value?: string | null) => {
    const iso = value ? formatCalendarDate(value) : '';
    if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return iso || 'Date not set';
    const [year, month, day] = iso.split('-').map(Number);
    return new Date(year, month - 1, day, 12).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };
  const taskStatus = (t: Task) => t.status || getWorkStatus(t);
  const engineBase = project ? `${API_BASE_URL}/projects/${encodeURIComponent(project.code||String(project.id))}/schedule` : '';
  const readPayload = async (response:Response) => { const payload=await response.json().catch(()=>({}));if(!response.ok){const error=new Error(payload.message||payload.error||`Request failed (${response.status})`) as Error&{code?:string;status?:number};error.code=payload.code;error.status=response.status;throw error;}return payload; };
  const runSimulation = async () => {
    if(!engineBase||!engineCapabilities?.taskDateSimulation||!engineSchedule||!chosen)return;
    if(!changeReason.trim()){setSimulationError('Enter a required explanation before simulating.');return;}
    if(!reasonCategory){setSimulationError('Choose a reason for this deadline adjustment.');return;}
    if(taskStatus(chosen).toLowerCase()==='completed'){setSimulationError('Completed activities are protected from ordinary schedule changes.');return;}
    const scenarioTypes:Record<ScenarioType,string>={'Task Date Change':'DATE_CHANGE','Task delay':'TASK_DELAY','Additional manpower':'MANPOWER_CHANGE','Overtime':'OVERTIME','Material delay':'MATERIAL_DELAY','Construction resequencing':'TASK_RESEQUENCING','Weather delay':'WEATHER_INTERRUPTION','Combined recovery scenario':'TASK_DELAY'};
    const engineScenarioType=scenarioTypes[scenarioType];
    if(engineScenarioType==='MANPOWER_CHANGE'&&(!currentWorkers||!proposedWorkers||!currentOutput||!proposedOutput||!remainingQuantity)){setSimulationError('Provide current and proposed workers, output rates, and remaining quantity.');return;}
    if(engineScenarioType==='OVERTIME'&&(!remainingEffortHours||!baseProductiveHours||!extraProductiveHours||!overtimeDays)){setSimulationError('Provide all required effort and overtime productivity assumptions.');return;}
    if(engineScenarioType==='TASK_RESEQUENCING'&&(!dependencyPredecessor||!dependencySuccessor||dependencyPredecessor===dependencySuccessor)){setSimulationError('Choose different predecessor and successor activities.');return;}
    const body:Record<string,unknown>={name:`${chosen.task_name} · ${engineScenarioType}`,description:changeRemarks.trim()||undefined,scenarioType:engineScenarioType,reason:`${reasonCategory}: ${changeReason.trim()}`,expectedScheduleVersion:engineSchedule.scheduleVersion,taskId:String(chosen.id)};
    if(engineScenarioType==='TASK_DELAY')body.delayWorkingDays=Number(delayDays);
    if(engineScenarioType==='DATE_CHANGE'){
      const lockedStart=toDateInputValue(chosen.start_date)||engineSchedule.tasks.find(t=>String(t.id)===String(chosen.id))?.startDate;
      const currentFinish=toDateInputValue(chosen.due_date)||engineSchedule.tasks.find(t=>String(t.id)===String(chosen.id))?.endDate;
      if(!lockedStart||!proposedEnd){setSimulationError('This activity needs a recorded start date and a proposed finish date.');return;}
      if(proposedEnd<lockedStart){setSimulationError("The expected finish date cannot be earlier than the task's start date.");return;}
      if(proposedEnd===currentFinish){setSimulationError('No deadline change has been proposed. Choose a different expected finish date.');return;}
      body.startDate=lockedStart;body.endDate=proposedEnd;
    }
    if(engineScenarioType==='TASK_DELAY'&&(!delayDays||Number(delayDays)<0)){setSimulationError('Enter a non-negative whole working-day delay.');return;}
    if(engineScenarioType==='MANPOWER_CHANGE')body.resourceAssumptions={currentWorkers:Number(currentWorkers),proposedWorkers:Number(proposedWorkers),currentTeamOutputPerDay:Number(currentOutput),proposedTeamOutputPerDay:Number(proposedOutput),remainingQuantity:Number(remainingQuantity),laborCostPerWorkerDay:laborCostPerWorkerDay?Number(laborCostPerWorkerDay):undefined,currency:'PHP'};
    if(engineScenarioType==='OVERTIME')body.overtimeAssumptions={remainingEffortHours:Number(remainingEffortHours),baseProductiveHoursPerDay:Number(baseProductiveHours),extraProductiveHoursPerDay:Number(extraProductiveHours),overtimeDays:Number(overtimeDays),overtimeCostPerHour:overtimeCostPerHour?Number(overtimeCostPerHour):undefined,currency:'PHP'};
    if(engineScenarioType==='MATERIAL_DELAY'){if(!materialDate){setSimulationError('Enter the revised material availability date.');return;}body.revisedMaterialDate=materialDate;body.affectedTaskIds=materialAffectedIds.length?materialAffectedIds:[String(chosen.id)];}
    if(engineScenarioType==='WEATHER_INTERRUPTION'){if(!weatherDate){setSimulationError('Choose a weather interruption date.');return;}body.nonworkingDates=[weatherDate];}
    if(engineScenarioType==='TASK_RESEQUENCING')body.changes=[{operation:'add_dependency',dependency:{predecessorTaskId:dependencyPredecessor,successorTaskId:dependencySuccessor,type:dependencyType,lag:Number(dependencyLag)||0}}];
    setSimulation(null);setSimulationLoading(true);setSimulationError('');
    try{const response=await fetchWithAuth(`${engineBase}/simulations`,{method:'POST',body:JSON.stringify(body)});const payload=await readPayload(response);const result={...(payload.simulation||{}),data:payload.data} as EngineSimulation;
      if(engineScenarioType==='DATE_CHANGE'){
        const proposedTask=result.data?.proposed?.tasks.find(task=>String(task.id)===String(chosen.id));
        const lockedStart=toDateInputValue(chosen.start_date)||engineSchedule.tasks.find(task=>String(task.id)===String(chosen.id))?.startDate;
        if(!proposedTask||toDateInputValue(proposedTask.endDate)!==proposedEnd||toDateInputValue(proposedTask.startDate)!==lockedStart)throw new Error('The schedule engine did not return the requested finish date while preserving this activity’s original start. The proposal was not shown as successful; refresh the schedule and try again or contact your schedule administrator.');
      }
      setSimulation(result);setSelectedScenarioIds(previous=>result.scenarioId?[...new Set([...previous,result.scenarioId])]:previous);setSavedScenarios(previous=>result.scenarioId?[{id:result.scenarioId,name:String(body.name),scenario_type:scenarioType,status:'simulated',forecast_completion_date:result.simulatedCompletion,modification_reason:changeReason.trim(),created_at:new Date().toISOString(),task_id:String(chosen.id),task_name:chosen.task_name},...previous.filter(s=>s.id!==result.scenarioId)]:previous);setRecoveryResult(null);}
    catch(error){const typed=error as Error&{code?:string};setSimulationError(error instanceof Error?error.message:'Simulation failed.');if(typed.code==='STALE_SCHEDULE_VERSION'||typed.code==='SCHEDULE_VERSION_REQUIRED')setEngineReload(value=>value+1);}
    finally{setSimulationLoading(false);}
  };
  const submitScenario = async () => {if(!simulation?.scenarioId||!engineBase)return;try{const response=await fetchWithAuth(`${engineBase}/change-requests`,{method:'POST',body:JSON.stringify({scenarioId:simulation.scenarioId,reason:`${reasonCategory}: ${changeReason.trim()}`})});await readPayload(response);setApprovalConfirm(false);setEngineReload(value=>value+1);setWorkflowMessage('Change request submitted for review.');}catch(error){setWorkflowMessage(error instanceof Error?error.message:'Unable to submit the change request.');}};
  const reviewRequest = async (requestId:string,approve:boolean) => {if(!engineBase)return;try{const response=await fetchWithAuth(`${engineBase}/change-requests/${encodeURIComponent(requestId)}/${approve?'approve':'reject'}`,{method:'POST',body:JSON.stringify({comments:reviewComments.trim()})});await readPayload(response);setReviewComments('');setEngineReload(value=>value+1);setWorkflowMessage(approve?'Change approved and applied.':'Change request rejected.');if(approve){const refreshed=await fetchWithAuth(`${API_BASE_URL}/tasks?project_id=${encodeURIComponent(projectId)}`);if(refreshed.ok){const payload=await refreshed.json();setTasks(Array.isArray(payload)?payload:payload.data||payload.tasks||[]);}}}catch(error){setWorkflowMessage(error instanceof Error?error.message:'Unable to review this change request.');}};
  const compareScenarios = async () => {if(!engineBase||selectedScenarioIds.length<2)return;try{const response=await fetchWithAuth(`${engineBase}/scenarios/compare`,{method:'POST',body:JSON.stringify({scenarioIds:selectedScenarioIds})});const payload=await readPayload(response);setScenarioComparison(Array.isArray(payload.data)?payload.data:[]);}catch(error){setSimulationError(error instanceof Error?error.message:'Scenario comparison failed.');}};
  const simulateRecovery = async () => {if(!engineBase||!engineCapabilities?.recovery?.available||!simulation?.simulatedCompletion)return;const option=scenarioType==='Additional manpower'?{id:'crew-option',type:'MANPOWER_CHANGE',changes:[{taskId:String(chosen?.id),resourceAssumptions:{currentWorkers:Number(currentWorkers),proposedWorkers:Number(proposedWorkers),currentTeamOutputPerDay:Number(currentOutput),proposedTeamOutputPerDay:Number(proposedOutput),remainingQuantity:Number(remainingQuantity),laborCostPerWorkerDay:laborCostPerWorkerDay?Number(laborCostPerWorkerDay):undefined,currency:'PHP'}}]}:null;if(scenarioType==='Additional manpower'&&!currentWorkers||scenarioType==='Additional manpower'&&!proposedWorkers||scenarioType==='Additional manpower'&&!currentOutput||scenarioType==='Additional manpower'&&!proposedOutput||scenarioType==='Additional manpower'&&!remainingQuantity){setSimulationError('Enter measured crew and productivity assumptions before evaluating recovery.');return;}try{const response=await fetchWithAuth(`${engineBase}/recovery-options`,{method:'POST',body:JSON.stringify({forecastCompletionDate:simulation.simulatedCompletion,options:option?[option]:[]})});const payload=await readPayload(response);setRecoveryResult(payload.data);}catch(error){setSimulationError(error instanceof Error?error.message:'Recovery evaluation failed.');}};
  useEffect(()=>{const earliest=visibleTasks.map(taskStart).filter((d):d is Date=>Boolean(d)).sort((a,b)=>a.getTime()-b.getTime())[0];if(earliest)setGanttCursor(earliest);},[projectId,visibleTasks]);

  const formatTimestamp = (iso?: string | null) => {
    if (!iso) return '';
    const d = new Date(iso);
    if (isNaN(d.getTime())) return iso;
    return d.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  };

  const formatTimelineDate = (iso?: string | null) => {
    if (!iso) return '—';
    const clean = String(iso).slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(clean)) return clean;
    const [year, month, day] = clean.split('-').map(Number);
    const mm = String(month).padStart(2, '0');
    const dd = String(day).padStart(2, '0');
    const yy = String(year).slice(-2);
    return `${mm}/${dd}/${yy}`;
  };

  const getDateDeltaDays = (prev?: string | null, next?: string | null) => {
    if (!prev || !next) return null;
    const pStr = String(prev).slice(0, 10);
    const nStr = String(next).slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(pStr) || !/^\d{4}-\d{2}-\d{2}$/.test(nStr)) return null;
    const p = new Date(`${pStr}T00:00:00`).getTime();
    const n = new Date(`${nStr}T00:00:00`).getTime();
    if (isNaN(p) || isNaN(n)) return null;
    const diff = Math.round((n - p) / (1000 * 60 * 60 * 24));
    if (diff === 0) return null;
    return diff > 0 ? `+${diff}d` : `${diff}d`;
  };

  const refreshHistory = async () => {
    if (!project) return;
    try {
      const base = `${API_BASE_URL}/projects/${encodeURIComponent(project.code || String(project.id))}/schedule`;
      const res = await fetchWithAuth(`${base}/history`);
      if (res.ok) {
        const payload = await res.json();
        setScheduleHistory(Array.isArray(payload.data) ? payload.data : []);
      }
    } catch {
      // ignore
    }
  };

  interface ScheduleHistoryItem {
    id?: string;
    request_id?: string | null;
    action?: string | null;
    reason?: string | null;
    created_at?: string | null;
    actor_id?: string | null;
    actor_name?: string | null;
    task_id?: string | null;
    task_name?: string | null;
    previous_start_date?: string | null;
    previous_end_date?: string | null;
    new_start_date?: string | null;
    new_end_date?: string | null;
    previous_duration?: number | null;
    new_duration?: number | null;
    dependency_changes?: unknown;
  }

  interface ScheduleHistoryGroup {
    id: string;
    timestamp: string;
    actorName: string;
    primaryReason: string;
    primaryItem: ScheduleHistoryItem;
    cascadedItems: ScheduleHistoryItem[];
  }

  const groupedHistory = useMemo(() => {
    const rawItems = [...scheduleHistory] as ScheduleHistoryItem[];
    if (!rawItems.length) return [];

    rawItems.sort((a, b) => {
      const tA = a.created_at ? new Date(a.created_at).getTime() : 0;
      const tB = b.created_at ? new Date(b.created_at).getTime() : 0;
      return tB - tA;
    });

    const groups: ScheduleHistoryGroup[] = [];
    const processed = new Set<string>();

    for (let i = 0; i < rawItems.length; i++) {
      const item = rawItems[i];
      const itemId = item.id || String(i);
      if (processed.has(itemId)) continue;

      const itemTime = item.created_at ? new Date(item.created_at).getTime() : 0;
      const cleanReason = (item.reason || '').replace(/^Cascaded:\s*/i, '').trim();

      const relatedBatch: ScheduleHistoryItem[] = [item];
      processed.add(itemId);

      for (let j = i + 1; j < rawItems.length; j++) {
        const other = rawItems[j];
        const otherId = other.id || String(j);
        if (processed.has(otherId)) continue;

        const otherTime = other.created_at ? new Date(other.created_at).getTime() : 0;
        const diff = Math.abs(itemTime - otherTime);
        const otherCleanReason = (other.reason || '').replace(/^Cascaded:\s*/i, '').trim();

        if (diff <= 4000 && (cleanReason === otherCleanReason || !cleanReason || !otherCleanReason)) {
          relatedBatch.push(other);
          processed.add(otherId);
        }
      }

      const primaryIndex = relatedBatch.findIndex(x => x.action !== 'CASCADE_SCHEDULE_UPDATE');
      const primaryItem = primaryIndex >= 0 ? relatedBatch[primaryIndex] : relatedBatch[0];
      const cascadedItems = relatedBatch.filter((_, idx) => idx !== (primaryIndex >= 0 ? primaryIndex : 0));
      const primaryReason = (primaryItem.reason || cleanReason || 'Schedule modification').replace(/^Cascaded:\s*/i, '');

      groups.push({
        id: primaryItem.id || String(Math.random()),
        timestamp: primaryItem.created_at || item.created_at || '',
        actorName: primaryItem.actor_name || item.actor_name || 'Project Member',
        primaryReason,
        primaryItem,
        cascadedItems,
      });
    }

    if (!historySearch.trim()) return groups;
    const q = historySearch.toLowerCase();
    return groups.filter(g => {
      const actorMatch = g.actorName.toLowerCase().includes(q);
      const reasonMatch = g.primaryReason.toLowerCase().includes(q);
      const primaryTaskMatch = (g.primaryItem.task_name || '').toLowerCase().includes(q);
      const cascadedTaskMatch = g.cascadedItems.some(c => (c.task_name || '').toLowerCase().includes(q));
      return actorMatch || reasonMatch || primaryTaskMatch || cascadedTaskMatch;
    });
  }, [scheduleHistory, historySearch]);

  return <main className="main-content schedule-page">
    <header className="schedule-heading"><div><div className="schedule-eyebrow">PROJECT CONTROLS <span>/</span> PLANNING &amp; TIMELINES</div><h1>Project Controls</h1><p>Coordinate site activities, critical path, and S-Curve performance tracking.</p></div><label className="schedule-project-select">Project<select value={projectId} onChange={e=>{setProjectId(e.target.value);setSelected(null);}}><option value="">All projects</option>{projects.map(p=><option key={p.id} value={p.id}>{p.code ? `${p.code} · ` : ''}{p.name}</option>)}</select></label></header>
    <section className="schedule-summary"><div className="schedule-project-mark"><CalendarDays size={20}/></div><div className="schedule-summary-name"><span>{project ? 'PROJECT SCHEDULE' : 'PORTFOLIO OVERVIEW'}</span><strong>{project?.name || 'All project schedules'}</strong></div><div className="schedule-summary-item"><span>{project ? 'PROJECT START' : 'EARLIEST TASK START'}</span><strong>{startDate || '—'}</strong></div><div className="schedule-summary-item"><span>{project ? 'TARGET COMPLETION' : 'LATEST TASK FINISH'}</span><strong>{endDate || '—'}</strong></div><div className="schedule-summary-item"><span>{project ? 'PROJECT DURATION' : 'SCHEDULE SPAN'}</span><strong>{duration ? `${duration} days` : '—'}</strong></div><div className="schedule-summary-status"><i/> {visibleTasks.length ? 'Schedule active' : 'No scheduled tasks'}</div></section>
    <nav className="schedule-tabs" aria-label="Schedule views">
      <div className="schedule-tabs-list">
        {tabs.map(name => (
          <button key={name} className={tab === name ? 'active' : ''} onClick={() => setTab(name)}>
            {name === 'Gantt Chart' ? <Rows3 size={16} /> : name === 'S-Curve' ? <TrendingUp size={16} /> : name === 'Calendar' ? <CalendarDays size={16} /> : <ListChecks size={16} />} {name}
          </button>
        ))}
      </div>
      <button
        type="button"
        className="schedule-history-nav-btn"
        onClick={() => {
          setShowHistoryModal(true);
          refreshHistory();
        }}
        title="Schedule Modification History"
      >
        <History size={16} />
        <span>Schedule History</span>
        {groupedHistory.length > 0 && <span className="history-badge">{groupedHistory.length}</span>}
      </button>
    </nav>
    {loading ? <div className="schedule-state">Loading project schedule...</div> : error ? <div className="schedule-state error">{error}</div> : visibleTasks.length===0 ? <div className="schedule-state"><strong>No tasks to schedule yet</strong><span>Tasks with dates will appear here once they are added to this project.</span></div> : <>
      {tab==='Calendar' && <section className="schedule-card"><div className="schedule-toolbar"><div><h2>Project calendar</h2><span>{visibleTasks.length} activities</span></div><div className="schedule-controls"><button onClick={()=>changeCursor(-1)} aria-label="Previous period"><ChevronLeft/></button><strong>{title}</strong><button onClick={()=>changeCursor(1)} aria-label="Next period"><ChevronRight/></button><button className="today-button" onClick={()=>setCursor(new Date())}>Today</button><div className="view-switch">{(['Month','Week','Day'] as const).map(v=><button key={v} className={calendarView===v?'selected':''} onClick={()=>setCalendarView(v)}>{v}</button>)}</div></div></div>
        <div className={`schedule-calendar ${calendarView.toLowerCase()}`}><div className="calendar-weekdays">{(calendarView==='Day'?[cursor]:calendarDays.slice(0,7)).map(d=><div key={keyDay(d)}>{d.toLocaleDateString(undefined,{weekday:'short'})}<b>{calendarView==='Day'?d.toLocaleDateString(undefined,{month:'short',day:'numeric'}):''}</b></div>)}</div><div className="calendar-grid" style={{gridTemplateColumns:`repeat(${calendarDays.length},minmax(0,1fr))`}}>{calendarDays.map(day=>{const inMonth=day.getMonth()===cursor.getMonth();const today=keyDay(day)===keyDay(new Date());const items=visibleTasks.filter(t=>taskStart(t)&&taskEnd(t)&&taskStart(t)!<=day&&taskEnd(t)!>=day);return <div className={`calendar-cell ${!inMonth&&calendarView==='Month'?'outside':''} ${today?'today':''}`} key={keyDay(day)}><button className="calendar-date" onClick={()=>{setCursor(day);setCalendarView('Day');}}>{day.getDate()}</button>{items.map(t=><button key={t.id} className={`calendar-task ${statusClass(taskStatus(t))} ${String(selected)===String(t.id)?'is-selected':''} ${selected!==null&&related.has(String(t.id))?'is-related':''}`} onClick={()=>setSelected(t.id)} title={`${t.task_name}: ${labelDate(t.start_date)} – ${labelDate(t.due_date)}`}><i/><span>{t.task_name}</span></button>)}</div>})}</div></div>
        <div className="schedule-legend"><span><i className="pending"/>Planned</span><span><i className="ongoing"/>In progress</span><span><i className="completed"/>Completed</span><span><i className="delayed"/>Delayed</span></div>
      </section>}
      {tab==='Gantt Chart' && <section className="schedule-card"><div className="schedule-toolbar"><div><h2>Gantt timeline</h2><span>{dated.length} scheduled activities · {visibleTasks.length-dated.length} without dates</span></div><div className="schedule-controls"><button onClick={()=>setGanttCursor(d=>addDays(d,ganttScale==='Day'?-28:ganttScale==='Week'?-168:-730))} aria-label="Previous timeline">{'<'}</button><button onClick={()=>setGanttCursor(new Date())} className="today-button">Today</button><button onClick={()=>setGanttCursor(d=>addDays(d,ganttScale==='Day'?28:ganttScale==='Week'?168:730))} aria-label="Next timeline">{'>'}</button><div className="view-switch">{(['Day','Week','Month'] as const).map(s=><button key={s} className={ganttScale===s?'selected':''} onClick={()=>setGanttScale(s)}>{s}</button>)}</div><button onClick={()=>setZoom(z=>Math.max(18,z-4))} aria-label="Zoom out">-</button><span className="zoom-label">{zoom}px</span><button onClick={()=>setZoom(z=>Math.min(52,z+4))} aria-label="Zoom in">+</button></div></div>
      {dated.length===0 ? <div className="gantt-empty">No task dates are available for this schedule yet.</div> : (()=>{const unitDates=getScheduleTimelineUnits(ganttCursor,ganttScale);const unitWidth=zoom*(ganttScale==='Day'?1:ganttScale==='Week'?3:4);const axisStart=unitDates[0]||ganttCursor;const totalWidth=unitDates.length*unitWidth;const offset=(date:Date)=>ganttScale==='Day'?daysBetween(axisStart,date)*unitWidth:ganttScale==='Week'?Math.floor(daysBetween(axisStart,date)/7)*unitWidth:((date.getFullYear()-axisStart.getFullYear())*12+date.getMonth()-axisStart.getMonth())*unitWidth;const spanWidth=(a:Date,b:Date)=>Math.max(14, (ganttScale==='Day'?daysBetween(a,b)+1:ganttScale==='Week'?Math.floor(daysBetween(a,b)/7)+1:((b.getFullYear()-a.getFullYear())*12+b.getMonth()-a.getMonth())+1)*unitWidth-4);return <div className="gantt-layout"><div className="gantt-info"><div className="gantt-info-head"><span>ID</span><span>ACTIVITY</span><span>DUR.</span><span>PROGRESS</span></div>{visibleTasks.map(t=>{const a=taskStart(t),b=taskEnd(t),span=a&&b?daysBetween(a,b)+1:0;return <button key={t.id} className={`gantt-info-row ${String(selected)===String(t.id)?'is-selected':''} ${selected!==null&&related.has(String(t.id))?'is-related':''}`} onClick={()=>setSelected(t.id)}><span title={String(t.id)}>{String(t.id).slice(0,8)}</span><span><b>{t.task_name}</b><small>{a?keyDay(a):'No start'} · {b?keyDay(b):'No finish'}</small></span><span>{span?`${span}d`:'—'}</span><span>{getTaskProgress(t)}%</span></button>})}</div><div className="gantt-scroll"><div className="gantt-timeline" style={{'--unit-width':`${unitWidth}px`,width:`${totalWidth}px`} as React.CSSProperties}><div className="gantt-axis">{unitDates.map((d,i)=><div key={i} className={keyDay(d)===keyDay(new Date())?'today':''}><b>{ganttScale==='Month'?d.toLocaleDateString(undefined,{month:'short'}):ganttScale==='Week'?`W${Math.ceil(d.getDate()/7)}`:d.getDate()}</b><span>{ganttScale==='Day'?d.toLocaleDateString(undefined,{month:'short'}):d.getFullYear()}</span></div>)}</div><GanttDependencySvg tasks={ganttTasks} axisStart={axisStart} scale={ganttScale} unitWidth={unitWidth} selectedId={selected}/>{visibleTasks.map(t=>{const a=taskStart(t),b=taskEnd(t),pct=getTaskProgress(t);return <div className={`gantt-lane ${String(selected)===String(t.id)?'is-selected':''}`} key={t.id} onClick={()=>setSelected(t.id)}>{keyDay(new Date())>=keyDay(axisStart)&&keyDay(new Date())<keyDay(addDays(axisStart,ganttScale==='Day'?unitDates.length:ganttScale==='Week'?unitDates.length*7:900))&&<i className="gantt-today-line" style={{left:`${offset(new Date())+unitWidth/2}px`}}/>}{a&&b&&<button className={`gantt-bar ${statusClass(taskStatus(t))}`} style={{left:`${offset(a)}px`,width:`${spanWidth(a,b)}px`}} aria-label={`${t.task_name}, ${daysBetween(a,b)+1} days, ${pct}% complete`} title={`${t.task_name} · ${keyDay(a)} to ${keyDay(b)} · ${pct}%`} onClick={e=>{e.stopPropagation();setSelected(t.id);}}><i style={{width:`${pct}%`}}/><span>{daysBetween(a,b)>2?t.task_name:''}</span></button>}</div>})}</div></div></div>})()}
      <div className="schedule-footnote">Select an activity to inspect dependencies. Timeline includes surrounding dates; use the scale and navigation controls to explore longer schedules. Dependency data is shown in the activity panel when provided by the task API.</div></section>}
      {tab==='S-Curve' && <SCurveSection tasks={visibleTasks} project={project} summaryStart={summaryStart} summaryEnd={summaryEnd} labelDate={labelDate}/>}
      {tab==='Simulator' && <section className={`simulator-workspace ${engineCapabilities?.available&&engineCapabilities.taskDateSimulation&&engineSchedule?'engine-ready':''}`}>
      {engineLoading ? <div className="simulator-diagnostic"><h2>Checking Smart Schedule Engine…</h2><p>Loading this project’s capabilities and current schedule version.</p></div> : engineError ? <div className="simulator-diagnostic error"><h2>Simulator connection failed</h2><p>{engineError}</p><button onClick={()=>setEngineReload(value=>value+1)}>Retry</button></div> : !projectId ? <div className="simulator-diagnostic"><h2>Select a project</h2><p>Choose one project to check its Smart Schedule Engine capabilities and schedule version.</p></div> : !engineCapabilities?.available ? <div className="simulator-diagnostic"><h2>Smart Schedule Engine unavailable</h2><p>{engineCapabilities?.unavailableReason||'The backend reports that this project does not have the required scheduling capabilities.'}</p><p>Capability status: {engineCapabilities?.status||'unknown'}. Check the project scheduling migration, then retry.</p><button onClick={()=>setEngineReload(value=>value+1)}>Retry</button></div> : !engineCapabilities?.taskDateSimulation ? <div className="simulator-diagnostic"><h2>Task simulation capability unavailable</h2><p>The backend did not enable task date simulation for this project.</p><button onClick={()=>setEngineReload(value=>value+1)}>Retry</button></div> : !engineSchedule ? <div className="simulator-diagnostic"><h2>Schedule data unavailable</h2><p>The engine is available, but the project schedule could not be loaded.</p><button onClick={()=>setEngineReload(value=>value+1)}>Retry</button></div> : null}
      <aside className="sim-task-list"><header><strong>Which activity needs a deadline adjustment?</strong><span>{engineSchedule?.tasks.length||0}</span></header><input aria-label="Search activities" value={activitySearch} onChange={e=>setActivitySearch(e.target.value)} placeholder="Search activity"/><div>{(engineSchedule?.tasks||[]).filter(task=>task.name.toLowerCase().includes(activitySearch.toLowerCase())||task.id.toLowerCase().includes(activitySearch.toLowerCase())).map(task=>{const source=visibleTasks.find(t=>String(t.id)===String(task.id));const depCount=engineSchedule?.dependencies.filter(d=>String(d.predecessorTaskId)===task.id||String(d.successorTaskId)===task.id).length||0;return <button key={task.id} className={String(selected)===task.id?'active':''} onClick={()=>setSelected(task.id)}><span><b title={task.id}>{task.id.slice(0,8)}</b><b title={task.name}>{task.name}</b></span><small>{labelDate(task.startDate)} → {labelDate(task.endDate)}</small><small>{task.duration} working days ? {task.progress}% · {source?getWorkStatus(source):task.status||'Unknown'} {depCount?`· ${depCount} dependencies`:''} {task.critical?'· Critical':''}</small></button>})}</div></aside><div className="simulator-main"><div className="simulator-workspace-head"><div><span className="detail-kicker">SCHEDULE DEADLINE PLANNING</span><h2>Smart Schedule Simulator</h2><p>Adjust an activity expected finish date and preview the project impact. Approved dates remain unchanged until approval.</p></div><span className="scenario-badge">DRAFT · NOT SIMULATED</span></div><ol className="deadline-steps" aria-label="Deadline adjustment steps"><li><b>1</b> Choose activity</li><li><b>2</b> Set new finish</li><li><b>3</b> Explain change</li><li><b>4</b> Preview impact</li></ol><div className="simulator-columns"><section className="sim-config"><h3>When should this activity finish?</h3><p className="deadline-intro">Adjust the expected finish and preview the project schedule impact.</p><label>Activity<select value={selected===null?'':String(selected)} onChange={e=>setSelected(e.target.value||null)}><option value="">Select an activity</option>{visibleTasks.map(t=><option key={t.id} value={String(t.id)}>{t.task_name} · {String(t.id).slice(0,8)}</option>)}</select></label>
        {chosen&&scenarioType==='Task Date Change'&&<><section className="current-schedule"><h4>Current Schedule</h4><div><span>Original start <b className="locked-label"><LockKeyhole size={14}/> Locked</b></span><strong>{labelDate(lockedStartDate)}</strong></div><div><span>Current approved finish</span><strong>{labelDate(currentFinishDate)}</strong></div><div><span>Duration</span><strong>{chosenEngineTask?.duration!==undefined?`${chosenEngineTask.duration} working days`:taskStart(chosen)&&taskEnd(chosen)?`${daysBetween(taskStart(chosen)!,taskEnd(chosen)!)+1} calendar days`:'Not available'}</strong></div><div><span>Progress / status</span><strong>{getTaskProgress(chosen)}% · {getWorkStatus(chosen)}</strong></div><p>The original start date is preserved. You can adjust the expected finish date.</p></section><label className="new-finish-field">New Expected Finish Date<input aria-label="New expected finish date" type="date" min={lockedStartDate||undefined} value={proposedEnd} onChange={e=>{setProposedEnd(e.target.value);setSimulation(null);}} disabled={getWorkStatus(chosen).toLowerCase()==='completed'}/></label>{proposedEnd&&proposedEnd<keyDay(new Date())&&<p className="date-warning" role="status">This date is in the past. Review it before previewing the schedule impact.</p>}{proposedEnd&&project?.end_date&&proposedEnd>toDateInputValue(project.end_date)!&&<p className="approved-target-warning" role="status">This proposed activity finish is beyond the approved project target ({labelDate(project.end_date)}). A project deadline extension may need separate approval.</p>}{proposedEnd&&proposedEnd===currentFinishDate&&<p className="date-note">No deadline change has been proposed.</p>}{proposedEnd&&proposedEnd!==currentFinishDate&&<p className="date-comparison">Current finish: <b>{labelDate(chosen.due_date)}</b><span>to</span>Proposed finish: <b>{labelDate(proposedEnd)}</b></p>}</>}


        <details className="advanced-planning"><summary>Advanced Planning Options</summary><p>Optional tools for other supported schedule scenarios.</p><label>Planning action<select value={scenarioType} onChange={e=>{setScenarioType(e.target.value as ScenarioType);setSimulation(null);}}><option value="Task Date Change">Adjust Task Deadline</option>{(['Task delay','Additional manpower','Overtime','Material delay','Weather delay','Construction resequencing','Combined recovery scenario'] as ScenarioType[]).map(x=><option key={x} disabled={x==='Combined recovery scenario'||x==='Task delay'&&!engineCapabilities?.taskDateSimulation||x==='Additional manpower'&&!engineCapabilities?.manpowerSimulation||x==='Overtime'&&!engineCapabilities?.overtimeSimulation||x==='Material delay'&&!engineCapabilities?.materialDelaySimulation||x==='Weather delay'&&!engineCapabilities?.manualWeatherSimulation||x==='Construction resequencing'&&!engineCapabilities?.dependencySimulation}>{x}</option>)}</select></label>{scenarioType==='Task delay'&&<label>Delay (working days)<input type="number" min="0" step="1" value={delayDays} onChange={e=>setDelayDays(e.target.value)} placeholder="Enter proposed delay"/></label>}
        {scenarioType==='Material delay'&&<><label>Revised material availability<input type="date" value={materialDate} onChange={e=>setMaterialDate(e.target.value)}/></label><label>Affected activities<select multiple value={materialAffectedIds} onChange={e=>setMaterialAffectedIds(Array.from(e.target.selectedOptions,option=>option.value))}>{visibleTasks.map(t=><option key={t.id} value={String(t.id)}>{String(t.id).slice(0,8)} · {t.task_name}</option>)}</select></label><p className="model-required">Select tasks constrained by the delivery. If none are selected, the selected activity is used.</p></>}
        {scenarioType==='Weather delay'&&<><label>Nonworking date<input type="date" value={weatherDate} onChange={e=>setWeatherDate(e.target.value)}/></label><p className="model-required">The engine evaluates the entered date against the project working calendar.</p></>}
        {scenarioType==='Additional manpower'&&<><label>Current workers<input type="number" min="1" value={currentWorkers} onChange={e=>setCurrentWorkers(e.target.value)}/></label><label>Proposed workers<input type="number" min="1" value={proposedWorkers} onChange={e=>setProposedWorkers(e.target.value)}/></label><label>Current measured team output / working day<input type="number" min="0.01" step="any" value={currentOutput} onChange={e=>setCurrentOutput(e.target.value)}/></label><label>Proposed measured team output / working day<input type="number" min="0.01" step="any" value={proposedOutput} onChange={e=>setProposedOutput(e.target.value)}/></label><label>Remaining quantity<input type="number" min="0.01" step="any" value={remainingQuantity} onChange={e=>setRemainingQuantity(e.target.value)}/></label><label>Labor cost / additional worker-day (PHP, optional)<input type="number" min="0" value={laborCostPerWorkerDay} onChange={e=>setLaborCostPerWorkerDay(e.target.value)}/></label></>}
{scenarioType==='Overtime'&&<><label>Remaining effort hours<input type="number" min="0.01" value={remainingEffortHours} onChange={e=>setRemainingEffortHours(e.target.value)}/></label><label>Base productive hours / day<input type="number" min="0.01" value={baseProductiveHours} onChange={e=>setBaseProductiveHours(e.target.value)}/></label><label>Extra productive hours / day<input type="number" min="0.01" value={extraProductiveHours} onChange={e=>setExtraProductiveHours(e.target.value)}/></label><label>Overtime workdays<input type="number" min="1" value={overtimeDays} onChange={e=>setOvertimeDays(e.target.value)}/></label><label>Overtime cost / hour (PHP, optional)<input type="number" min="0" value={overtimeCostPerHour} onChange={e=>setOvertimeCostPerHour(e.target.value)}/></label></>}
 {scenarioType==='Construction resequencing'&&<><label>Predecessor<select value={dependencyPredecessor} onChange={e=>setDependencyPredecessor(e.target.value)}><option value="">Select predecessor</option>{visibleTasks.map(t=><option key={t.id} value={String(t.id)}>{String(t.id).slice(0,8)} · {t.task_name}</option>)}</select></label><label>Successor<select value={dependencySuccessor} onChange={e=>setDependencySuccessor(e.target.value)}><option value="">Select successor</option>{visibleTasks.map(t=><option key={t.id} value={String(t.id)}>{String(t.id).slice(0,8)} · {t.task_name}</option>)}</select></label><label>Relationship<select value={dependencyType} onChange={e=>setDependencyType(e.target.value)}>{['FS','SS','FF','SF'].map(x=><option key={x}>{x}</option>)}</select></label><label>Lag / lead (working days)<input type="number" value={dependencyLag} onChange={e=>setDependencyLag(e.target.value)}/></label><p className="model-required">The engine validates the proposed dependency graph; changes are only applied after approval.</p></>}
        </details>

        <h4 className="reason-heading">Why is the deadline changing?</h4><label>Reason category<select value={reasonCategory} onChange={e=>{setReasonCategory(e.target.value);setSimulation(null);}}>{['Material delivery delay','Weather interruption','Insufficient manpower','Equipment breakdown','Additional construction work','Client-requested change','Other'].map(reason=><option key={reason}>{reason}</option>)}</select></label><label>Required explanation <span className="required-mark">Required</span><textarea value={changeReason} onChange={e=>{setChangeReason(e.target.value);setSimulation(null);}} placeholder="Explain why this activity deadline needs to change." rows={3}/></label><label>Additional remarks <textarea value={changeRemarks} onChange={e=>{setChangeRemarks(e.target.value);setSimulation(null);}} placeholder="Optional context or supporting notes." rows={2}/></label><button className="sim-run" onClick={runSimulation} disabled={simulationLoading||!engineCapabilities?.taskDateSimulation||!chosen||!changeReason.trim()||(scenarioType==='Task Date Change'&&proposedEnd===currentFinishDate)||getWorkStatus(chosen).toLowerCase()==='completed'} title={!engineCapabilities?.taskDateSimulation?'Task simulation is unavailable for this project':scenarioType==='Task Date Change'&&proposedEnd===currentFinishDate?'Choose a different finish date':'Preview this proposal with the schedule engine'}>{simulationLoading?'Calculating impact…':'Preview Impact'} <GitBranch size={15}/></button><button type="button" className="sim-reset" onClick={()=>{if(chosen){setProposedStart(toDateInputValue(chosen.start_date)||'');setProposedEnd(currentFinishDate||'');}setChangeReason('');setReasonCategory('Other');setChangeRemarks('');setDelayDays('');setScenarioType('Task Date Change');setSimulation(null);setSimulationError('');}}>Reset</button>{simulationError&&<p className="sim-error" role="alert">{simulationError}</p>}{workflowMessage&&<p className="sim-message" role="status">{workflowMessage}</p>}</section>

        <div className="sim-results"><section className="sim-preview"><header><h3>Schedule preview</h3><span>{simulation?'SIMULATION PREVIEW':'CURRENT SCHEDULE'} · Live task dates remain unchanged</span></header><div className="sim-preview-axis"><span>Activity</span><span>{previewStart?keyDay(previewStart):'Date range unavailable'} → {previewEnd?keyDay(previewEnd):'—'}</span></div>{simulatorPreview.map(task=>{const start=parseDay(task.startDate),finish=parseDay(task.endDate),baseline=baselinePreview.find(x=>String(x.id)===String(task.id)),baseStart=parseDay(baseline?.startDate),baseEnd=parseDay(baseline?.endDate);const left=(d:Date|null)=>previewStart&&d?Math.max(0,daysBetween(previewStart,d)/previewSpan*100):0;const width=(a:Date|null,b:Date|null)=>a&&b?Math.max(.8,(daysBetween(a,b)+1)/previewSpan*100):0;const isAffected=Boolean(simulation?.data?.affectedTasks?.some(x=>String(x.id)===String(task.id)));return <button key={task.id} className={`sim-preview-row ${isAffected?'affected':''} ${task.critical?'critical':''}`} onClick={()=>setSelected(task.id)}><b title={task.id}>{String(task.id).slice(0,8)} · {task.name}</b><span className="sim-preview-track" style={{minWidth:Math.max(720,previewSpan*20)}}>{simulation&&baseStart&&baseEnd&&<i className="baseline-bar" style={{left:`${left(baseStart)}%`,width:`${width(baseStart,baseEnd)}%`}} title="Original schedule"/>}{start&&finish&&<i className={`proposed-bar ${simulation?'simulated':''}`} style={{left:`${left(start)}%`,width:`${width(start,finish)}%`}} title={`${keyDay(start)} to ${keyDay(finish)}`}/>}</span><small>{task.critical?'Critical':`${task.totalFloat??'—'}d float`}</small></button>})}{!engineSchedule?.dependencies.length&&<small className="preview-no-deps">No task dependencies configured for this project.</small>}</section><section className="impact-cards"><h3>Schedule impact</h3><div className="impact-grid"><article><span>What changed?</span><b>{chosen?.task_name||'Selected activity'}</b><small>Current finish: {labelDate(currentFinishDate)} to Proposed finish: {labelDate(simulation?.data?.proposed?.tasks.find(task=>String(task.id)===String(chosen?.id))?.endDate||proposedEnd)} to {simulation?.data?.durationDifferenceWorkingDays!==undefined?`${simulation.data.durationDifferenceWorkingDays} working days duration change`:'Duration change not calculated'}</small></article><article><span>Completion forecast</span><b>{labelDate(simulation?.simulatedCompletion||engineSchedule?.completionDate)}</b><small>{simulation?`${simulation.delayWorkingDays??'—'} working days variance`:'Current backend forecast'}</small></article><article><span>Affected activities</span><b>{simulation?.data?.affectedTasks?.length??'—'}</b><small>{simulation?'Direct and propagated changes':'Run a simulation'}</small></article><article><span>Critical path</span><b>{simulation?.data?.proposed?.criticalPath?.length??engineSchedule?.criticalPath?.length??'—'} tasks</b><small>{simulation?`${simulation.data?.criticalPathChanges?.added?.length||0} added · ${simulation.data?.criticalPathChanges?.removed?.length||0} removed`:'Current engine path'}</small></article><article><span>Cost impact</span><b>{simulation?.data?.costImpact?.status==='calculated'?`${simulation.data.costImpact.currency||''} ${simulation.data.costImpact.amount}`:'Not calculated'}</b><small>Risk score is not recalculated for the preview</small></article><article><span>Schedule warnings</span><b>{simulation?simulation.constraintWarnings?.length??0:'Not calculated'}</b><small>{simulation?.constraintWarnings?.[0]?.message||'No engine warning details returned.'}</small></article></div>{simulation?.simulatedCompletion&&project?.end_date&&toDateInputValue(simulation.simulatedCompletion)!>toDateInputValue(project.end_date)!&&<p className="approved-target-warning" role="status">The simulated project finish exceeds the approved completion target ({labelDate(project.end_date)}). A project deadline extension may need separate approval; the approved target has not changed.</p>}</section><section className="impact-chain"><h3>Dependency impact chain</h3>{chosen?(predecessors.length||successors.length?<div className="impact-chain-list">{predecessors.map(id=>{const t=visibleTasks.find(task=>String(task.id)===String(id));return <button key={id} onClick={()=>t&&setSelected(t.id)}><span>PREDECESSOR</span><b>{t?.task_name||`Task ${id}`}</b><small>{labelDate(t?.start_date)} to {labelDate(t?.due_date)}</small></button>})}<div className="impact-selected"><span>SELECTED ACTIVITY</span><b>{chosen.task_name}</b><small>{labelDate(chosen.start_date)} to {labelDate(chosen.due_date)}</small></div>{successors.map(t=><button key={t.id} onClick={()=>setSelected(t.id)}><span>SUCCESSOR</span><b>{t.task_name}</b><small>{t.start_date||'—'} → {t.due_date||'—'}</small></button>)}</div>:<p>No task dependencies configured for this activity.</p>):<p>Select a task to inspect its recorded predecessor and successor links.</p>}</section>{simulation&&<section className="affected-chain"><h3>Affected dependency chain</h3>{simulation.data?.affectedTasks?.length?simulation.data.affectedTasks.map(item=><article key={String(item.id)} onMouseEnter={()=>setSelected(String(item.id))}><b>{String(item.name||item.id)}</b><span>{String(item.previousStartDate||'—')} → {String(item.previousEndDate||'—')}</span><span>{String(item.startDate||'—')} → {String(item.endDate||'—')}</span><small>{String(item.reason||'Schedule impact calculated by engine')} · Float: {String(item.totalFloat??'—')}</small></article>):<p>{engineSchedule?.dependencies.some(d=>String(d.predecessorTaskId)===String(chosen?.id)||String(d.successorTaskId)===String(chosen?.id))?'No dependent activities were affected by this proposal.':'No dependent activities are configured. SitePulse can calculate the selected task?s impact, but cannot display a dependency chain.'}</p>}</section>}<section className="recovery-options"><h3>Suggested Recovery Options</h3><p>Recovery calculations are produced from explicit engine inputs only.</p><button onClick={simulateRecovery} disabled={!simulation||!engineCapabilities?.recovery?.available}>Evaluate revised-completion / recovery options</button>{recoveryResult&&<pre>{JSON.stringify(recoveryResult,null,2)}</pre>}<div><b>Additional manpower</b><span>Provide measured productivity inputs above, then evaluate.</span></div><div><b>Overtime</b><span>Supported only with validated effort and hourly assumptions.</span></div><div><b>Resequence activities</b><span>Propose a dependency above; engine validates graph before approval.</span></div><div><b>Accept revised completion</b><span>Available through the engine recovery evaluation.</span></div></section></div></div><section className="scenario-comparison"><h3>Scenario comparison</h3><div className="scenario-table-scroll"><table><thead><tr><th>Schedule metric</th><th>Current schedule</th><th>Proposed draft</th><th>Recovery scenario</th></tr></thead><tbody><tr><td>Completion date</td><td>{labelDate(endDate)}</td><td>{labelDate(simulation?.simulatedCompletion)}</td><td>{recoveryResult?'Engine recovery result available':'Not calculated'}</td></tr><tr><td>Duration</td><td>{duration?`${duration} days`:'—'}</td><td>Requires simulation</td><td>Requires simulation</td></tr><tr><td>Critical tasks</td><td>{engineSchedule?.criticalPath.length??'Not calculated'}</td><td>{simulation?.data?.proposed?.criticalPath.length??'Not calculated'}</td><td>Not calculated</td></tr><tr><td>Working-day variance</td><td>Baseline unavailable</td><td>{simulation?.delayWorkingDays!==undefined?`${simulation.delayWorkingDays} working days`:'Not calculated'}</td><td>Not calculated</td></tr><tr><td>Cost impact</td><td>Not calculated</td><td>{simulation?.data?.costImpact?.status==='calculated'?`${simulation.data.costImpact.currency||''} ${simulation.data.costImpact.amount}`:'Not calculated'}</td><td>Not calculated</td></tr></tbody></table></div><p>Approved baseline: {labelDate(baselines[0]?.project_completion_date)||'No baseline recorded'}. Scenarios and history above are loaded from the project schedule API.</p></section></div><aside className="sim-sidecard"><span className="detail-kicker">SELECTED ACTIVITY</span>{chosen?<><h3>{chosen.task_name}</h3><dl><dt>Task ID</dt><dd title={String(chosen.id)}>{String(chosen.id).slice(0,8)}...</dd><dt>Status</dt><dd>{getWorkStatus(chosen)}</dd><dt>Progress</dt><dd>{getTaskProgress(chosen)}%</dd><dt>Original dates</dt><dd>{labelDate(chosen.start_date)} to {labelDate(chosen.due_date)}</dd><dt>Duration</dt><dd>{taskStart(chosen)&&taskEnd(chosen)?`${daysBetween(taskStart(chosen)!,taskEnd(chosen)!)+1} calendar days`:'Not set'}</dd><dt>Critical path</dt><dd>{engineSchedule?.criticalPath.includes(String(chosen.id))?'Critical':'Not critical'}</dd><dt>Predecessors</dt><dd>{predecessors.map(id=>visibleTasks.find(t=>String(t.id)===String(id))?.task_name||String(id).slice(0,8)).join(', ')||'None'}</dd><dt>Successors</dt><dd>{successors.map(t=>t.task_name).join(', ')||'None'}</dd></dl>{getWorkStatus(chosen).toLowerCase()==='completed'&&<p className="protected-task">Completed activities are protected from ordinary schedule proposals.</p>}</>:<p>Select a task from the activity list to see its current schedule.</p>}<h4 className="schedule-actions-title">Schedule Actions</h4><p className="schedule-action-summary">{simulation?.scenarioId?`Scenario ${simulation.scenarioId} - ${simulation.status}`:'Run and review a simulation before requesting approval.'} {simulation?.simulatedCompletion?`Forecast: ${labelDate(simulation.simulatedCompletion)}`:''}</p><button className="sim-submit" onClick={()=>setApprovalConfirm(true)} disabled={!simulation?.scenarioId||!engineCapabilities?.changeApproval} title={!simulation?.scenarioId?'Run a simulation first':'Submit this saved simulation for authorized review'}>Submit for approval</button><p className="scenario-save-status" role="status">{simulation?.scenarioId?`Simulation completed - Scenario ${simulation.scenarioId} saved`:'Run a simulation to save a scenario.'}</p>
{approvalConfirm&&simulation&&<div className="approval-confirm"><h4>Submit schedule change?</h4><p>Request {simulation.scenarioId} will be reviewed. Live dates will remain unchanged until an authorized reviewer approves it.</p><b>{chosen?.task_name}</b><small>{labelDate(chosen?.start_date)} → {proposedStart||labelDate(chosen?.start_date)} · {labelDate(chosen?.due_date)} → {proposedEnd||labelDate(chosen?.due_date)}</small><p>Reason: {changeReason}</p><button onClick={submitScenario}>Confirm submission</button><button onClick={()=>setApprovalConfirm(false)}>Cancel</button></div>}
{simulationError&&<p className="sim-error" role="alert">{simulationError}</p>}{workflowMessage&&<p className="sim-message" role="status">{workflowMessage}</p>}
<section className="saved-scenarios"><h4>Saved Scenarios</h4><input value={scenarioSearch} onChange={e=>setScenarioSearch(e.target.value)} placeholder="Search saved scenarios" aria-label="Filter saved scenarios"/><select aria-label="Filter scenarios by status" value={scenarioStatusFilter} onChange={e=>setScenarioStatusFilter(e.target.value)}><option>All statuses</option>{Array.from(new Set(savedScenarios.map(s=>s.status))).map(status=><option key={status}>{status}</option>)}</select>{savedScenarios.filter(s=>s.name.toLowerCase().includes(scenarioSearch.toLowerCase())&&(scenarioStatusFilter==='All statuses'||s.status===scenarioStatusFilter)).map(s=><label key={s.id}><input type="checkbox" checked={selectedScenarioIds.includes(s.id)} onChange={e=>setSelectedScenarioIds(ids=>e.target.checked?[...ids,s.id]:ids.filter(id=>id!==s.id))}/><span>{s.name}</span><small>{s.status} · {labelDate(s.forecast_completion_date)}</small></label>)}<button onClick={compareScenarios} disabled={!engineCapabilities?.scenarioComparison||selectedScenarioIds.length<2}>Compare selected</button><button type="button" onClick={()=>setSelectedScenarioIds([])} disabled={!selectedScenarioIds.length}>Clear selection</button><small>{!engineCapabilities?.scenarioComparison?'Scenario comparison is unavailable for this project.':selectedScenarioIds.length<2?'Select at least two valid scenarios to compare.':'Ready to compare selected scenarios.'}</small>{scenarioComparison.map(item=><p key={String(item.id)}>{String(item.name||item.id)} · {labelDate(String(item.completionDate||''))} · {String(item.workingDayDifference??'—')} working days</p>)}</section>
<section className="approval-queue"><h4>Change Requests</h4>{changeRequests.length===0?<small>No schedule change requests.</small>:changeRequests.map(request=><article key={String(request.id)}><b>{String(request.status).toUpperCase()} · {String(request.reason||'Schedule change')}</b><small>{String(request.id)} · {labelDate(String(request.created_at||''))}</small>{String(request.status).toLowerCase()==='pending'&&<div><button onClick={()=>reviewRequest(String(request.id),true)}>Approve &amp; apply</button><button onClick={()=>reviewRequest(String(request.id),false)}>Reject</button></div>}</article>)}</section>
<section className="schedule-history"><h4>Schedule History</h4>{scheduleHistory.length===0?<small>No schedule history available.</small>:scheduleHistory.slice(0,8).map(item=><article key={String(item.id)}><b>{String(item.action||item.change_type||'Schedule change')}</b><small>{String(item.actor_name||item.actor_id||'User')} · {labelDate(String(item.created_at||''))}</small><span>{String(item.previous_start_date||'—')} → {String(item.new_start_date||'—')} · {String(item.reason||'')}</span></article>)}</section></aside></section>}
      {tab==='Resource View' && <section className="schedule-card"><div className="schedule-toolbar"><div><h2>Resource allocation</h2><span>Activities grouped by assigned team</span></div></div><div className="resource-list">{Array.from(new Set(visibleTasks.map(t=>t.assignee?.trim()||'Unassigned'))).map(person=><section key={person}><header><div className="resource-avatar">{person==='Unassigned'?'?':person.slice(0,1).toUpperCase()}</div><strong>{person}</strong><span>{visibleTasks.filter(t=>(t.assignee?.trim()||'Unassigned')===person).length} activities</span></header>{visibleTasks.filter(t=>(t.assignee?.trim()||'Unassigned')===person).map(t=><button key={t.id} onClick={()=>{setSelected(t.id);setTab('Gantt Chart')}}><b>{t.task_name}</b><span>{labelDate(t.start_date)} → {labelDate(t.due_date)}</span></button>)}</section>)}</div></section>}
    </>}
    {chosen && tab==='Simulator' && <aside className="schedule-detail"><div><div><span className="detail-kicker">ACTIVITY DETAILS</span><h2>{chosen.task_name}</h2></div><button className="detail-close" onClick={()=>setSelected(null)} aria-label="Close details">x</button></div><p>{chosen.description||chosen.site_instructions||'No task description provided.'}</p><div className="detail-stats"><span>Start<strong>{labelDate(chosen.start_date)}</strong></span><span>Finish<strong>{labelDate(chosen.due_date)}</strong></span><span>Duration<strong>{taskStart(chosen)&&taskEnd(chosen)?`${daysBetween(taskStart(chosen)!,taskEnd(chosen)!)+1} days`:'Not set'}</strong></span><span>Progress<strong>{getTaskProgress(chosen)}%</strong></span></div><div className="detail-status"><span className={`status-dot ${statusClass(taskStatus(chosen))}`}/>{taskStatus(chosen)} {chosen.priority==='High'&&<b>High priority</b>}</div><h3>Dependencies</h3>{predecessors.length||successors.length?<><div className="dependency-list">{predecessors.map(id=>{const t=visibleTasks.find(x=>String(x.id)===String(id));return <button key={id} onClick={()=>t&&setSelected(t.id)}><span>PREDECESSOR</span><b>{t?.task_name||`Task ${id}`}</b><small>{t?labelDate(t.due_date):'Date unavailable'}</small><i>→</i></button>})}{successors.map(t=><button key={t.id} onClick={()=>setSelected(t.id)}><span>SUCCESSOR</span><b>{t.task_name}</b><small>{labelDate(t.start_date)}</small><i>→</i></button>)}</div></>:<p className="dependency-none">No predecessor or successor relationships are recorded.</p>}<div className="detail-assignee"><Clock3 size={15}/><span>Assigned team</span><b>{chosen.assignee||'Not assigned'}</b></div></aside>}

    {showHistoryModal && (
      <div className="schedule-history-overlay" onClick={() => setShowHistoryModal(false)}>
        <div className="schedule-history-modal" onClick={e => e.stopPropagation()}>
          <div className="schedule-history-head">
            <div className="schedule-history-head-left">
              <div className="schedule-history-icon-badge">
                <History size={20} />
              </div>
              <div>
                <h2>Schedule Modification History</h2>
                <p>Audit trail of baseline adjustments, modification reasons, and automatic dependency cascades.</p>
              </div>
            </div>
            <button
              type="button"
              className="schedule-history-close"
              onClick={() => setShowHistoryModal(false)}
              aria-label="Close history modal"
            >
              <X size={18} />
            </button>
          </div>

          <div className="schedule-history-toolbar">
            <div className="schedule-history-search-wrap">
              <Search size={15} className="schedule-history-search-icon" />
              <input
                type="text"
                className="schedule-history-search"
                placeholder="Search by activity name, reason, or team member..."
                value={historySearch}
                onChange={e => setHistorySearch(e.target.value)}
              />
            </div>
            <button
              type="button"
              className="schedule-history-refresh-btn"
              onClick={refreshHistory}
              title="Refresh modification history"
            >
              <RefreshCw size={14} />
              <span>Refresh</span>
            </button>
          </div>

          <div className="schedule-history-body">
            {!project ? (
              <div className="schedule-history-empty">
                <History size={40} className="empty-icon" />
                <h3>Select a Project</h3>
                <p>Please select a project from the top dropdown to inspect its schedule modification history.</p>
              </div>
            ) : groupedHistory.length === 0 ? (
              <div className="schedule-history-empty">
                <History size={40} className="empty-icon" />
                <h3>No Schedule Modifications Recorded</h3>
                <p>
                  {historySearch
                    ? 'No modification events matched your search query.'
                    : 'No schedule changes or adjustments have been recorded for this project yet.'}
                </p>
              </div>
            ) : (
              groupedHistory.map(group => {
                const p = group.primaryItem;
                const primaryDelta = getDateDeltaDays(p.previous_end_date, p.new_end_date);

                return (
                  <div key={group.id} className="schedule-history-group">
                    {/* Meta Header */}
                    <div className="schedule-history-group-head">
                      <div className="schedule-history-group-meta">
                        <div className="schedule-history-avatar">
                          {group.actorName ? group.actorName.charAt(0).toUpperCase() : 'U'}
                        </div>
                        <div className="schedule-history-actor-info">
                          <strong>{group.actorName}</strong>
                          <span className="schedule-history-timestamp">
                            <Clock3 size={13} />
                            {formatTimestamp(group.timestamp)}
                          </span>
                        </div>
                      </div>
                      <span className="schedule-history-event-badge">
                        <CalendarClock size={13} />
                        Schedule Adjusted
                      </span>
                    </div>

                    {/* Reason Callout */}
                    {group.primaryReason && (
                      <div className="schedule-history-reason-box">
                        <div className="schedule-history-reason-label">
                          <MessageSquareQuote size={13} />
                          Reason for Modification
                        </div>
                        <div className="schedule-history-reason-text">"{group.primaryReason}"</div>
                      </div>
                    )}

                    {/* Timeline of Changes Section */}
                    <div className="schedule-history-timeline-section">
                      <div className="schedule-history-section-title">Timeline of Changes</div>

                      {/* Primary Modified Task */}
                      <div className="schedule-history-primary-card">
                        <div className="schedule-history-task-left">
                          <span className="task-role-badge primary">Directly Modified</span>
                          <strong className="schedule-history-task-name">
                            {p.task_name || (p.task_id ? `Task #${String(p.task_id).slice(0, 8)}` : 'Project Schedule')}
                          </strong>
                        </div>

                        <div className="schedule-history-timeline-chip-wrap">
                          {p.previous_start_date && p.new_start_date && p.previous_start_date !== p.new_start_date ? (
                            <div className="timeline-date-chip">
                              <span className="date-prev">{formatTimelineDate(p.previous_start_date)} - {formatTimelineDate(p.previous_end_date)}</span>
                              <ArrowRight size={13} className="timeline-arrow" />
                              <span className="date-next">{formatTimelineDate(p.new_start_date)} - {formatTimelineDate(p.new_end_date)}</span>
                              {primaryDelta && <span className="date-delta">{primaryDelta}</span>}
                            </div>
                          ) : (
                            <div className="timeline-date-chip">
                              <span className="chip-label">Due:</span>
                              <span className="date-prev">{formatTimelineDate(p.previous_end_date)}</span>
                              <ArrowRight size={13} className="timeline-arrow" />
                              <span className="date-next">{formatTimelineDate(p.new_end_date)}</span>
                              {primaryDelta && <span className="date-delta">{primaryDelta}</span>}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Connected Tasks (Auto-Shifted Activities) */}
                      {group.cascadedItems.length > 0 && (
                        <div className="schedule-history-cascaded-wrapper">
                          <div className="schedule-history-cascaded-head">
                            <GitBranch size={13} />
                            <span>Connected Tasks Automatically Moved ({group.cascadedItems.length}):</span>
                          </div>
                          <div className="schedule-history-cascaded-list">
                            {group.cascadedItems.map((cascaded, idx) => {
                              const cascadedDelta = getDateDeltaDays(cascaded.previous_end_date, cascaded.new_end_date);
                              const prevSpan = `${formatTimelineDate(cascaded.previous_start_date)} - ${formatTimelineDate(cascaded.previous_end_date)}`;
                              const nextSpan = `${formatTimelineDate(cascaded.new_start_date)} - ${formatTimelineDate(cascaded.new_end_date)}`;

                              return (
                                <div key={cascaded.id || idx} className="schedule-history-cascaded-item">
                                  <div className="schedule-history-task-left">
                                    <span className="task-role-badge cascaded">Shifted</span>
                                    <strong className="schedule-history-task-name">
                                      {cascaded.task_name || `Task #${String(cascaded.task_id).slice(0, 8)}`}
                                    </strong>
                                  </div>
                                  <div className="schedule-history-timeline-chip-wrap">
                                    <div className="timeline-date-chip cascaded">
                                      <span className="date-prev">{prevSpan}</span>
                                      <ArrowRight size={13} className="timeline-arrow" />
                                      <span className="date-next">{nextSpan}</span>
                                      {cascadedDelta && <span className="date-delta">{cascadedDelta}</span>}
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    )}
  </main>;
}















