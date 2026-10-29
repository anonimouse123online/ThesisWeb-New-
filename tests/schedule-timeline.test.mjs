import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import ts from 'typescript';

const source = readFileSync(new URL('../src/utils/scheduleTimeline.ts', import.meta.url), 'utf8');
const { outputText } = ts.transpileModule(source, {
  compilerOptions: { target: ts.ScriptTarget.ES2023, module: ts.ModuleKind.ESNext },
  fileName: 'scheduleTimeline.ts',
});
const { getScheduleTimelineUnits, projectTaskMatches } = await import(`data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`);

test('short schedules retain useful date context in each Gantt scale', () => {
  const anchor = new Date('2026-10-29T12:00:00');
  const days = getScheduleTimelineUnits(anchor, 'Day');
  const weeks = getScheduleTimelineUnits(anchor, 'Week');
  const months = getScheduleTimelineUnits(anchor, 'Month');
  assert.equal(days.length, 57);
  assert.ok(days[0] < anchor && days.at(-1) > anchor);
  assert.equal(weeks.length, 25);
  assert.equal(months.length, 25);
});

test('project schedule filtering accepts stable project id or project code only', () => {
  const project = { id: 42, code: 'SP-42' };
  assert.equal(projectTaskMatches({ project_id: '42' }, project), true);
  assert.equal(projectTaskMatches({ project_code: 'SP-42' }, project), true);
  assert.equal(projectTaskMatches({ project_id: 7, project_code: 'OTHER' }, project), false);
  assert.equal(projectTaskMatches({}, undefined), true);
});
