import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ts from 'typescript';

function moduleUrl(path, stubUseId = false) {
  let { outputText } = ts.transpileModule(readFileSync(path, 'utf8'), {
    compilerOptions: { target: ts.ScriptTarget.ES2023, module: ts.ModuleKind.ESNext, jsx: ts.JsxEmit.ReactJSX },
    fileName: path.pathname,
  });
  outputText = outputText.replace(/^import ['"].*\.css['"];?$/gm, '');
  if (stubUseId) outputText = outputText.replace(/import \{ useId \} from ['"]react['"];?/, "const useId = () => 'task-phase-test';");
  outputText = outputText.replace(/from ['"]([^'"]+)['"]/g, (_match, dependency) => {
    const url = dependency.startsWith('.') ? moduleUrl(new URL(`${dependency}.ts`, path)) : import.meta.resolve(dependency);
    return `from '${url}'`;
  });
  return `data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`;
}

const { TASK_PHASE_CATEGORIES, getTaskPhases, formatTaskPhases, groupTasksByPhase, taskPhasePayload, taskPhaseRequiredMessage } =
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

test('payloads send single, multiple and all seven categories as an array without a scalar phase', () => {
  for (const selected of [['Site Development'], ['Site Development', 'Structural'], [...TASK_PHASE_CATEGORIES]]) {
    const original = [...selected];
    const payload = taskPhasePayload(selected);
    assert.deepEqual(JSON.parse(JSON.stringify(payload)), { construction_phase_categories: original });
    assert.deepEqual(selected, original);
    assert.notEqual(payload.construction_phase_categories, selected);
    assert.equal(Object.hasOwn(payload, 'phase'), false);
  }
});

test('empty and invalid selections are still rejected', () => {
  assert.throws(() => taskPhasePayload([]), { message: taskPhaseRequiredMessage });
  for (const phase of ['', ' ', 'Unknown', '__proto__', 'constructor']) {
    assert.throws(() => taskPhasePayload([phase]), /Please select valid construction phase categories/);
  }
});

test('construction_phase_categories responses retain every selection for checklist initialization', () => {
  const task = { construction_phase_categories: ['Site Development', 'Structural'], phases: ['Turnover Phase'], phase: 'Foundation' };
  const unchanged = structuredClone(task);
  assert.deepEqual(getTaskPhases(task), ['Site Development', 'Structural']);
  assert.deepEqual(getTaskPhases({ construction_phase_categories: [], phases: ['Structural'] }), []);
  assert.deepEqual(task, unchanged);
  const markup = renderToStaticMarkup(createElement(TaskPhaseChecklist, { value: getTaskPhases(task), onChange() {} }));
  assert.match(markup, /<input(?=[^>]*value="Site Development")(?=[^>]*checked="")[^>]*>/);
  assert.match(markup, /<input(?=[^>]*value="Structural")(?=[^>]*checked="")[^>]*>/);
  assert.equal((markup.match(/checked=""/g) || []).length, 2);
});

test('checkbox change handlers retain earlier selections and uncheck only the requested category', async () => {
  const { default: Checklist } = await import(moduleUrl(new URL('../src/components/TaskPhaseChecklist.tsx', import.meta.url), true));
  let selected = [];
  function checkbox(category) {
    const tree = Checklist({ value: selected, onChange: next => { selected = next; } });
    return tree.props.children[2].props.children.find(label => label.key === category).props.children[0];
  }
  checkbox('Site Development').props.onChange({ target: { checked: true } });
  checkbox('Structural').props.onChange({ target: { checked: true } });
  assert.deepEqual(selected, ['Site Development', 'Structural']);
  assert.equal(checkbox('Site Development').props.checked, true);
  assert.equal(checkbox('Structural').props.checked, true);
  assert.deepEqual(taskPhasePayload(selected), { construction_phase_categories: ['Site Development', 'Structural'] });
  checkbox('Structural').props.onChange({ target: { checked: false } });
  assert.deepEqual(selected, ['Site Development']);
  checkbox('Site Development').props.onChange({ target: { checked: false } });
  assert.deepEqual(selected, []);
  assert.throws(() => taskPhasePayload(selected), { message: taskPhaseRequiredMessage });
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
