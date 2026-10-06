import { useId } from 'react';
import { TASK_PHASE_CATEGORIES } from '../utils/taskPhases';
import './TaskPhaseChecklist.css';

export default function TaskPhaseChecklist({ value, onChange, disabled = false }: {
  value: string[];
  onChange: (phases: string[]) => void;
  disabled?: boolean;
}) {
  const id = useId();
  return (
    <fieldset className="task-phase-checklist" disabled={disabled} aria-describedby={`${id}-hint`}>
      <legend>Construction Phase Category *</legend>
      <p className="task-phase-hint" id={`${id}-hint`}>Select all applicable categories. At least one is required.</p>
      <div className="task-phase-options">
        {TASK_PHASE_CATEGORIES.map(category => (
          <label key={category} className={`task-phase-option${value.includes(category) ? ' task-phase-option--checked' : ''}`}>
            <input type="checkbox" name="phases" value={category} checked={value.includes(category)} onChange={event => {
              const next = event.target.checked ? [...value, category] : value.filter(phase => phase !== category);
              onChange(TASK_PHASE_CATEGORIES.filter(phase => next.includes(phase)));
            }} />
            <span>{category}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
