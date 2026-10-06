import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ts from 'typescript';

function moduleUrl(path) {
  let { outputText } = ts.transpileModule(readFileSync(path, 'utf8'), {
    compilerOptions: { target: ts.ScriptTarget.ES2023, module: ts.ModuleKind.ESNext, jsx: ts.JsxEmit.ReactJSX },
    fileName: path.pathname,
  });
  outputText = outputText.replace(/^import ['"].*\.css['"];?$/gm, '');
  outputText = outputText.replace(/from ['"]([^'"]+)['"]/g, (_match, dependency) => {
    const url = dependency.startsWith('.') ? moduleUrl(new URL(`${dependency}.ts`, path)) : import.meta.resolve(dependency);
    return `from '${url}'`;
  });
  return `data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`;
}

const { TASK_PHASE_CATEGORIES, getTaskPhases, formatTaskPhases, groupTasksByPhase, legacyTaskPhasePayload, taskPhaseRequiredMessage } =
  await import(moduleUrl(new URL('../src/utils/taskPhases.ts', import.meta.url)));
const { default: TaskPhaseChecklist } = await import(moduleUrl(new URL('../src/components/TaskPhaseChecklist.tsx', import.meta.url)));

test('legacy numbered and plain phase labels display canonical categories without rewriting records', () => {
  for (const [phase, expected] of [
    ['Foundation', 'Site Development'], ['Phase 1 - Foundation', 'Site Development'],
    ['Finishing', 'Architectural'], ['Phase 5 - Finishing', 'Architectural'],
    ['Phase 2 - Structural', 'Structural'], ['Phase 3 - Electrical & Utilities', 'Electrical & Utilities'],
    ['Phase 4 - Plumbing & MEP', 'Plumbing & MEP'],
  ]) {
    const task = { phase };
    assert.deepEqual(getTaskPhases(task), [expected]);
    assert.equal(formatTaskPhases(task), expected);
    assert.equal(task.phase, phase);
  }
});

test('array categories take precedence over the legacy scalar and preserve distinct memberships', () => {
  const task = { phase: 'Phase 5 - Finishing', phases: ['Site Development', 'Structural', 'Foundation', ' Architectural '] };
  const unchanged = structuredClone(task);
  assert.deepEqual(getTaskPhases(task), ['Site Development', 'Structural', 'Architectural']);
  assert.equal(formatTaskPhases(task), 'Site Development • Structural • Architectural');
  assert.deepEqual(task, unchanged);
  assert.deepEqual(getTaskPhases({ phase: 'Foundation', phases: [] }), []);
  assert.deepEqual(getTaskPhases({ phase: 'Foundation', phases: null }), ['Site Development']);
});

test('compatible singleton payloads keep the existing scalar API contract', () => {
  for (const [category, phase] of [
    ['Site Development', 'Phase 1 - Foundation'], ['Structural', 'Phase 2 - Structural'],
    ['Electrical & Utilities', 'Phase 3 - Electrical & Utilities'], ['Plumbing & MEP', 'Phase 4 - Plumbing & MEP'],
    ['Architectural', 'Phase 5 - Finishing'],
  ]) {
    assert.deepEqual(legacyTaskPhasePayload([category]), { phase });
    assert.equal(typeof legacyTaskPhasePayload([category]).phase, 'string');
  }
});

test('empty selections, multiple categories and unsupported singleton categories never produce a lossy payload', () => {
  for (const phases of [[], [' ', '']]) assert.throws(() => legacyTaskPhasePayload(phases), { message: taskPhaseRequiredMessage });
  const multiple = ['Site Development', 'Architectural'];
  assert.throws(() => legacyTaskPhasePayload(multiple), /Multiple construction phase categories cannot be saved yet/);
  assert.deepEqual(multiple, ['Site Development', 'Architectural']);
  for (const phase of ['Construction Phase', 'Turnover Phase', 'Unknown', '__proto__', 'constructor']) {
    assert.throws(() => legacyTaskPhasePayload([phase]), /selected construction phase category cannot be saved yet/);
  }
});

test('grouping includes a task in each applicable category without duplicating it within a group', () => {
  const tasks = [
    { id: 1, phase: 'Phase 1 - Foundation' },
    { id: 2, phases: ['Structural', 'Architectural', 'Structural'] },
    { id: 3, phase: 'Phase 5 - Finishing' },
  ];
  const groups = groupTasksByPhase(tasks);
  assert.deepEqual(groups['Site Development'], [tasks[0]]);
  assert.deepEqual(groups.Structural, [tasks[1]]);
  assert.deepEqual(groups.Architectural, [tasks[1], tasks[2]]);
  assert.deepEqual(groups['Turnover Phase'], []);
  assert.equal(tasks.length, 3);
  assert.equal(new Set(Object.values(groups).flat().map(task => task.id)).size, 3);
});

test('unknown and missing legacy phases stay visible without being falsely assigned Site Development', () => {
  const tasks = [{ phase: 'Special Inspection' }, {}, { phase: '__proto__' }];
  const groups = groupTasksByPhase(tasks);
  assert.deepEqual(groups['Special Inspection'], [tasks[0]]);
  assert.deepEqual(groups.Uncategorized, [tasks[1]]);
  assert.deepEqual(groups['__proto__'], [tasks[2]]);
  assert.deepEqual(groups['Site Development'], []);
  assert.equal(formatTaskPhases({}), 'Not specified');
});

test('checklist renders all seven categories as labeled native checkboxes with existing selections checked', () => {
  const markup = renderToStaticMarkup(createElement(TaskPhaseChecklist, {
    value: ['Site Development', 'Structural'], onChange: () => assert.fail('Rendering must not change selection'),
  }));
  assert.match(markup, /<legend>Construction Phase Category \*<\/legend>/);
  assert.equal((markup.match(/type="checkbox"/g) || []).length, 7);
  assert.equal((markup.match(/checked=""/g) || []).length, 2);
  for (const category of TASK_PHASE_CATEGORIES) assert.ok(markup.includes(category.replaceAll('&', '&amp;')), category);
  assert.doesNotMatch(markup, /Foundation|Finishing|<select/);
  const emptyMarkup = renderToStaticMarkup(createElement(TaskPhaseChecklist, { value: [], onChange() {} }));
  assert.doesNotMatch(emptyMarkup, /checked=""/);
});
