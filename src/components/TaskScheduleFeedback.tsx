import { useEffect, useId, useRef } from 'react';
import { AlertTriangle, CheckCircle2, Info } from 'lucide-react';
import { scheduleIssues, type ScheduleValidation } from '../utils/taskSchedule';

interface Props {
  durationDays: string;
  predecessorIds: string[];
  tasks: Array<{ id: string | number; task_name: string }>;
  currentTaskId?: string | number;
  result?: ScheduleValidation | null;
  projectStartDate?: string;
  projectEndDate?: string;
  onChange: (patch: { estimatedDurationDays?: string; predecessorTaskIds?: string[] }) => void;
  onApplySuggestion?: (suggestion: { startDate?: string; dueDate?: string }) => void;
}

export default function TaskScheduleFeedback({ durationDays, predecessorIds, tasks, currentTaskId, result,
  projectStartDate, projectEndDate, onChange, onApplySuggestion }: Props) {
  const options = tasks.filter(task => String(task.id) !== String(currentTaskId));
  const panelRef = useRef<HTMLDivElement>(null);
  const panelId = useId();
  const errors = result?.status === 'INVALID' ? scheduleIssues(result) : [];

  useEffect(() => {
    if (result?.status !== 'INVALID') return;
    panelRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    panelRef.current?.focus({ preventScroll: true });
  }, [result]);

  const suggestionWithinProject = (suggestion: { startDate?: string; dueDate?: string }) =>
    (!suggestion.startDate || ((!projectStartDate || suggestion.startDate >= projectStartDate) && (!projectEndDate || suggestion.startDate <= projectEndDate))) &&
    (!suggestion.dueDate || ((!projectStartDate || suggestion.dueDate >= projectStartDate) && (!projectEndDate || suggestion.dueDate <= projectEndDate)));

  return (
    <section className="task-schedule-fields" aria-label="Task schedule inputs">
      <div className="task-schedule-row">
        <label className="ct-field" htmlFor={`${panelId}-duration`}>
          <span className="ct-label">Estimated Duration (working days)</span>
          <input id={`${panelId}-duration`} className={`ct-input${errors.some(issue => issue.fields.includes('durationDays')) ? ' task-schedule-input--invalid' : ''}`}
            type="number" min="1" max="3650" step="1" value={durationDays}
            aria-invalid={errors.some(issue => issue.fields.includes('durationDays'))}
            aria-describedby={errors.some(issue => issue.fields.includes('durationDays')) ? `${panelId}-duration-error` : undefined}
            onChange={event => onChange({ estimatedDurationDays: event.target.value })} placeholder="Optional" />
          {errors.some(issue => issue.fields.includes('durationDays')) && <small className="task-schedule-field-error" id={`${panelId}-duration-error`}>Review the duration conflict below.</small>}
        </label>
        <label className="ct-field" htmlFor={`${panelId}-predecessors`}>
          <span className="ct-label">Predecessor Tasks</span>
          <select id={`${panelId}-predecessors`} className={`ct-input task-schedule-predecessors${errors.some(issue => issue.fields.includes('predecessors')) ? ' task-schedule-input--invalid' : ''}`}
            multiple value={predecessorIds}
            aria-invalid={errors.some(issue => issue.fields.includes('predecessors'))}
            aria-describedby={`${panelId}-predecessor-help${errors.some(issue => issue.fields.includes('predecessors')) ? ` ${panelId}-predecessor-error` : ''}`}
            onChange={event => onChange({ predecessorTaskIds: Array.from(event.target.selectedOptions, option => option.value) })}>
            {options.map(task => <option key={task.id} value={String(task.id)}>{task.task_name}</option>)}
          </select>
          <small id={`${panelId}-predecessor-help`}>Optional. Select tasks that must finish before this task starts.</small>
          {errors.some(issue => issue.fields.includes('predecessors')) && <small className="task-schedule-field-error" id={`${panelId}-predecessor-error`}>Review the predecessor conflict below.</small>}
        </label>
      </div>
      {options.length === 0 && <p className="task-schedule-note">No other tasks are available as predecessors for this project.</p>}

      {result && <div ref={panelRef} id={`${panelId}-result`} tabIndex={-1}
        className={`task-schedule-result task-schedule-result--${result.status.toLowerCase()}`}
        role={result.status === 'INVALID' ? 'alert' : 'status'} aria-live={result.status === 'INVALID' ? 'assertive' : 'polite'}>
        {result.status === 'INVALID' ? <AlertTriangle size={17} aria-hidden="true" />
          : result.status === 'WARNING' ? <AlertTriangle size={17} aria-hidden="true" />
          : result.status === 'VALID' ? <CheckCircle2 size={17} aria-hidden="true" />
          : <Info size={17} aria-hidden="true" />}
        <div className="task-schedule-result-body">
          {result.status === 'INVALID' ? <>
            <strong className="task-schedule-result-title">Schedule Cannot Be Saved</strong>
            <p className="task-schedule-result-count">{errors.length > 0
              ? `${errors.length} ${errors.length === 1 ? 'conflict' : 'conflicts'} detected`
              : 'The backend rejected this schedule without returning specific conflict details'}</p>
            {errors.length === 0 && <p className="task-schedule-message">Review the scheduling inputs and try again. No conflict details were provided.</p>}
            {errors.map((issue, index) => <article key={`error-${index}`} className="task-schedule-issue">
              <h4>Error {index + 1}: {issue.title}</h4>
              {issue.title === 'Insufficient Working Days' && result.estimatedDurationDays !== undefined && result.availableWorkingDays !== undefined &&
                <p className="task-schedule-workday-counts"><strong>Required:</strong> {result.estimatedDurationDays} working days <span aria-hidden="true">·</span> <strong>Available:</strong> {result.availableWorkingDays} working days</p>}
              <p className="task-schedule-issue-message">{issue.message}</p>
              <p className="task-schedule-guidance">{issue.guidance}</p>
            </article>)}
          </> : result.status === 'WARNING' ? <>
            <strong className="task-schedule-result-title">Schedule Review Recommended</strong>
            <p className="task-schedule-result-count">{result.warnings.length} {result.warnings.length === 1 ? 'warning' : 'warnings'} · the backend allows this schedule to be saved</p>
            {result.warnings.map((message, index) => <p className="task-schedule-message" key={`warning-${index}`}>{message}</p>)}
          </> : result.status === 'INSUFFICIENT_DATA' ? <>
            <strong className="task-schedule-result-title">More Scheduling Information Needed</strong>
            {result.warnings.map((message, index) => <p className="task-schedule-message" key={`info-${index}`}>{message}</p>)}
            <p className="task-schedule-guidance">The task may be saved, but the backend could not fully evaluate feasibility.</p>
          </> : <>
            <strong className="task-schedule-result-title">Schedule Validated</strong>
            {result.availableWorkingDays !== undefined && result.estimatedDurationDays !== undefined &&
              <p className="task-schedule-message">{result.availableWorkingDays} available working days for {result.estimatedDurationDays} estimated working days.</p>}
          </>}

          {result.suggestions.map((suggestion, index) => {
            const withinProject = suggestionWithinProject(suggestion);
            const suggestedDate = suggestion.dueDate || suggestion.startDate;
            const dateLabel = suggestion.dueDate ? 'Suggested due date' : 'Suggested start date';
            return <div key={`suggestion-${index}`} className="task-schedule-suggestion">
              <div><strong>{withinProject ? `${dateLabel}: ${suggestedDate}` : 'No feasible suggested date within this project timeline'}</strong>
                <p>{withinProject ? suggestion.reason : 'The estimated duration or predecessor timing does not fit before the project deadline. Review the task constraints or project timeline.'}</p></div>
              {withinProject && onApplySuggestion && (suggestion.startDate || suggestion.dueDate) &&
                <button type="button" className="task-schedule-apply" onClick={() => onApplySuggestion(suggestion)}>Apply Suggested Date</button>}
            </div>;
          })}
        </div>
      </div>}
    </section>
  );
}
