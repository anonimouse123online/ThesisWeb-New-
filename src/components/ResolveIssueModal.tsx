import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Plus, X } from 'lucide-react';
import type { Issue } from '../utils/projectIssues';
import { prepareResolution, type ResolutionFeedback } from '../utils/issueResolution';
import { getErrorMessage } from '../utils/errors';
import { showToast } from '../utils/toast';

interface ResolveIssueModalProps {
  issue: Issue;
  resolvedBy: string;
  onClose: () => void;
  onConfirm: (feedback: ResolutionFeedback) => Promise<void>;
}

export default function ResolveIssueModal({ issue, resolvedBy, onClose, onConfirm }: ResolveIssueModalProps) {
  const [summary, setSummary] = useState('');
  const [steps, setSteps] = useState([{ id: 1, text: '' }]);
  const [remarks, setRemarks] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const nextStepId = useRef(2);
  const pending = useRef(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const summaryInput = useRef<HTMLTextAreaElement>(null);
  const canSubmit = Boolean(summary.trim() && steps.some(step => step.text.trim()));

  useEffect(() => {
    const node = dialog.current;
    node?.showModal();
    summaryInput.current?.focus();
    return () => node?.close();
  }, []);

  const close = () => { if (!pending.current) onClose(); };
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (pending.current || !canSubmit) return;
    pending.current = true;
    setSubmitting(true);
    setError('');
    try {
      await onConfirm(prepareResolution({
        resolution_summary: summary,
        resolution_steps: steps.map(step => step.text),
        final_remarks: remarks,
      }));
    } catch (error: unknown) {
      const message = getErrorMessage(error, 'Unable to resolve the issue. Please try again.');
      setError(message);
      showToast(message, 'error');
    } finally {
      pending.current = false;
      setSubmitting(false);
    }
  };

  return (
    <dialog ref={dialog} className="ir-modal ir-resolution-modal" aria-labelledby="ir-resolve-title"
      onCancel={event => { event.preventDefault(); close(); }}
      onClick={event => { if (event.target === event.currentTarget) {
        const bounds = event.currentTarget.getBoundingClientRect();
        if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) close();
      } }}>
      <div className="ir-modal-header ir-resolution-header">
        <h2 className="ir-modal-title" id="ir-resolve-title">Resolve Issue</h2>
        <button type="button" className="ir-resolution-icon-btn" aria-label="Close resolution form" onClick={close} disabled={submitting}><X size={18} /></button>
      </div>
      <form onSubmit={submit} className="ir-resolution-form" aria-busy={submitting}>
        <div className="ir-modal-body">
          <div className="ir-resolution-issue">
            <h3>{issue.title}</h3>
            <p>{issue.category} &bull; {issue.priority} Priority</p>
          </div>
          <fieldset className="ir-resolution-fields" disabled={submitting}>
            <div className="ir-resolution-field">
              <label htmlFor="ir-resolution-summary">Resolution Summary *</label>
              <textarea ref={summaryInput} id="ir-resolution-summary" placeholder="Describe how the issue was resolved..." required
                value={summary} onChange={event => setSummary(event.target.value)} rows={3} />
            </div>
            <div className="ir-resolution-field">
              <span id="ir-resolution-steps-label" className="ir-resolution-label">Steps Taken *</span>
              <div className="ir-resolution-step-inputs" role="group" aria-labelledby="ir-resolution-steps-label" aria-describedby="ir-resolution-step-help">
                {steps.map((step, index) => (
                  <div key={step.id} className="ir-resolution-step-input">
                    <label htmlFor={`ir-resolution-step-${step.id}`}>Step {index + 1}</label>
                    <div className="ir-resolution-step-row">
                      <input id={`ir-resolution-step-${step.id}`} placeholder="Enter action taken..." value={step.text}
                        onChange={event => setSteps(previous => previous.map(item => item.id === step.id ? { ...item, text: event.target.value } : item))} />
                      {index > 0 && <button type="button" className="ir-resolution-icon-btn" aria-label={`Remove step ${index + 1}`}
                        onClick={() => setSteps(previous => previous.filter(item => item.id !== step.id))}><X size={16} /></button>}
                    </div>
                  </div>
                ))}
              </div>
              <p id="ir-resolution-step-help" className="ir-resolution-hint">At least one action is required. Empty extra steps are omitted.</p>
              <button type="button" className="ir-resolution-add-step" onClick={() => {
                const id = nextStepId.current++;
                setSteps(previous => [...previous, { id, text: '' }]);
              }}><Plus size={15} /> Add Step</button>
            </div>
            <div className="ir-resolution-field">
              <label htmlFor="ir-resolution-remarks">Final Remarks / Recommendation</label>
              <textarea id="ir-resolution-remarks" placeholder="Add final observations or recommendations..."
                value={remarks} onChange={event => setRemarks(event.target.value)} rows={3} />
            </div>
          </fieldset>
          <dl className="ir-resolution-metadata">
            <div><dt>Resolved By</dt><dd>{resolvedBy}</dd></div>
            <div><dt>Resolution Date</dt><dd>Automatically recorded upon resolution</dd></div>
          </dl>
          {error && <p className="ir-resolution-error" role="alert">{error}</p>}
        </div>
        <div className="ir-modal-footer">
          <button type="button" className="ir-btn-cancel" onClick={close} disabled={submitting}>Cancel</button>
          <button type="submit" className="ir-btn-submit" disabled={!canSubmit || submitting}>{submitting ? 'Resolving…' : 'Confirm Resolution'}</button>
        </div>
      </form>
    </dialog>
  );
}
