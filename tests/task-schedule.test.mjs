import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import ts from 'typescript';

function moduleUrl(path) {
  const { outputText } = ts.transpileModule(readFileSync(path, 'utf8'), {
    compilerOptions: { target: ts.ScriptTarget.ES2023, module: ts.ModuleKind.ESNext },
    fileName: path.pathname,
  });
  return `data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`;
}

const { readScheduleValidation, scheduleValidationFromPayload, scheduleMessage, scheduleIssues } =
  await import(moduleUrl(new URL('../src/utils/taskSchedule.ts', import.meta.url)));

test('reads valid schedule results and optional working-day counts', () => {
  const result = scheduleValidationFromPayload({ schedule_validation: {
    status: 'VALID', warnings: [], errors: [], suggestions: [], availableWorkingDays: 5, estimatedDurationDays: 4,
  } });
  assert.equal(result.status, 'VALID');
  assert.equal(result.availableWorkingDays, 5);
  assert.equal(result.estimatedDurationDays, 4);
});

test('preserves invalid-schedule errors and date suggestions for the task form', () => {
  const payload = { error: 'Task schedule is invalid.', schedule_validation: {
    status: 'INVALID', warnings: [], errors: ['Potentially Unrealistic Schedule: only 4 days are available.'],
    suggestions: [{ dueDate: '2026-11-05', reason: 'Earliest completion.' }],
  } };
  const result = scheduleValidationFromPayload(payload);
  assert.equal(result.status, 'INVALID');
  assert.match(scheduleMessage(payload, 'Fallback'), /Potentially Unrealistic Schedule/);
  assert.deepEqual(result.suggestions[0], { dueDate: '2026-11-05', reason: 'Earliest completion.' });
});

test('keeps missing-data and overlap warnings distinct from invalid schedules', () => {
  assert.equal(readScheduleValidation({ status: 'INSUFFICIENT_DATA', warnings: ['Add a duration.'] }).status, 'INSUFFICIENT_DATA');
  assert.equal(readScheduleValidation({ status: 'WARNING', warnings: ['Assignee overlaps another task.'] }).status, 'WARNING');
  assert.equal(readScheduleValidation({ status: 'BROKEN' }), null);
});

test('classifies each backend scheduling error separately and maps affected fields', () => {
  const issues = scheduleIssues({
    status: 'INVALID',
    warnings: [],
    errors: [
      'Potentially Unrealistic Schedule: Foundation Rebar Preparation requires 5 working days, but only 2 are available.',
      'Schedule Conflict: Foundation Rebar Preparation cannot begin because Cement pouring is scheduled to finish on October 30.',
      'Invalid estimated duration: enter a whole number of working days.',
      'Task dates fall outside the project timeline.',
    ],
    suggestions: [],
  });

  assert.equal(issues.length, 4);
  assert.equal(issues[0].title, 'Insufficient Working Days');
  assert.deepEqual(issues[0].fields, ['startDate', 'dueDate', 'durationDays']);
  assert.equal(issues[1].title, 'Task Dependency Conflict');
  assert.deepEqual(issues[1].fields, ['startDate', 'predecessors']);
  assert.equal(issues[2].title, 'Invalid Estimated Duration');
  assert.deepEqual(issues[2].fields, ['durationDays']);
  assert.equal(issues[3].title, 'Task Date Conflict');
  assert.deepEqual(issues[3].fields, ['startDate', 'dueDate']);
});
