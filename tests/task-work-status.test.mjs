import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { test } from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import ts from 'typescript';

// Exercise the actual pages and API helpers without adding a DOM/test dependency.
// Page hooks keep state and effects in a small harness; child components use React.
const hooksUrl = `data:text/javascript;base64,${Buffer.from(`
import React from '${import.meta.resolve('react')}';
export default React;
export const Fragment = React.Fragment;
export const useState = initial => {
  const h = globalThis.taskStatusHarness;
  const i = h.stateCursor++;
  if (!(i in h.states)) h.states[i] = typeof initial === 'function' ? initial() : initial;
  return [h.states[i], next => { h.states[i] = typeof next === 'function' ? next(h.states[i]) : next; }];
};
const same = (a, b) => a && b && a.length === b.length && a.every((v, i) => Object.is(v, b[i]));
export const useCallback = (callback, deps) => {
  const h = globalThis.taskStatusHarness;
  const i = h.memoCursor++;
  if (!same(h.memos[i]?.deps, deps)) h.memos[i] = { deps, callback };
  return h.memos[i].callback;
};
export const useMemo = (calculate, deps) => useCallback(calculate, deps)();
export const useEffect = (effect, deps) => {
  const h = globalThis.taskStatusHarness;
  const i = h.effectCursor++;
  if (!same(h.effectDeps[i], deps)) { h.effectDeps[i] = deps; h.effects.push(effect); }
};
export const useEffectEvent = callback => callback;
`).toString('base64')}`;

const modules = new Map();
function moduleUrl(path) {
  if (modules.has(path.href)) return modules.get(path.href);
  const isPage = /\/(Task|ProjectDetails)\.tsx$/.test(path.pathname);
  let source = readFileSync(path, 'utf8').replaceAll('import.meta.env', "({ VITE_BACKEND_URL: 'https://sitepulse.test' })");
  // Only the page's router reads are stubbed; child components retain router context.
  if (isPage && path.pathname.endsWith('/ProjectDetails.tsx')) {
    source = source.replace(/import \{ useParams, useNavigate, useSearchParams \} from ['"]react-router-dom['"];?/, `
      const useParams = () => ({ projectId: 'PRJ-1' });
      const useNavigate = () => () => {};
      const useSearchParams = () => [new URLSearchParams('tab=tasks'), () => {}];
    `);
  }
  let { outputText } = ts.transpileModule(source, {
    compilerOptions: { target: ts.ScriptTarget.ES2023, module: ts.ModuleKind.ESNext, jsx: ts.JsxEmit.ReactJSX },
    fileName: path.pathname,
  });
  outputText = outputText.replace(/^import ['"].*\.css['"];?$/gm, '');
  outputText = outputText.replace(/from ['"]([^'"]+)['"]/g, (_match, dependency) => {
    let url;
    if (isPage && dependency === 'react') url = hooksUrl;
    else if (dependency.startsWith('.')) {
      const tsPath = new URL(`${dependency}.ts`, path);
      url = moduleUrl(existsSync(tsPath) ? tsPath : new URL(`${dependency}.tsx`, path));
    } else url = import.meta.resolve(dependency);
    return `from '${url}'`;
  });
  const url = `data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`;
  modules.set(path.href, url);
  return url;
}

const { getWorkStatus, getWorkProgress, getTaskProgress, isWorkCompleted } =
  await import(moduleUrl(new URL('../src/utils/taskWorkStatus.ts', import.meta.url)));
const { SubtaskWorkSummary } = await import(moduleUrl(new URL('../src/components/TaskWorkStatus.tsx', import.meta.url)));
const { default: Tasks } = await import(moduleUrl(new URL('../src/pages/Task.tsx', import.meta.url)));
const { default: ProjectDetails } = await import(moduleUrl(new URL('../src/pages/ProjectDetails.tsx', import.meta.url)));

test('saved work status wins over percentage, deadlines, and stale completion flags', () => {
  assert.equal(getWorkStatus({ status: 'pending', progress: 100, completed: true, due_date: '2000-01-01' }), 'Pending');
  assert.equal(getWorkStatus({ status: 'ongoing', progress: 0, due_date: '2000-01-01' }), 'Ongoing');
  for (const status of [' Ongoing ', 'in-progress', 'In Progress', 'in_progress', 'active']) {
    assert.equal(getWorkStatus({ status }), 'Ongoing');
  }
  assert.equal(getWorkStatus({ status: 'blocked' }), 'Blocked');
  assert.equal(getWorkStatus({ status: 'delayed' }), 'Delayed');
  assert.equal(getWorkStatus({ status: 'paused' }), 'Paused');
  assert.equal(getWorkStatus({ progress: 45 }), 'Pending');
});

test('backend progress and legacy progress_pct remain separate from status', () => {
  assert.equal(getTaskProgress({ status: 'ongoing', progress: 45, progress_pct: 0, subtasks: [{ completed: false }] }), 45);
  assert.equal(getTaskProgress({ status: 'pending', progress: 0, progress_pct: 80 }), 0);
  assert.equal(getTaskProgress({ status: 'ongoing', progress_pct: 30 }), 30);
  assert.equal(getWorkProgress({ progress: '60' }), 60);
  assert.equal(getWorkProgress({ progress: '', progress_pct: 35 }), 35);
  assert.equal(getWorkProgress({ progress: 'invalid', progress_pct: 25 }), 25);
  assert.equal(getWorkProgress({ progress: -1 }), 0);
  assert.equal(getWorkProgress({ progress: 110 }), 100);
});

test('legacy checklist completion and saved Completed status stay supported', () => {
  assert.equal(getWorkStatus({ completed: true }), 'Completed');
  assert.equal(getWorkProgress({ completed: true }), 100);
  assert.equal(getWorkStatus({ completed: false }), 'Pending');
  assert.equal(getWorkProgress({ completed: false }), 0);
  assert.equal(isWorkCompleted({ status: 'completed', completed: false }), true);
  assert.equal(isWorkCompleted({ status: 'ongoing', completed: true }), false);
  assert.equal(getTaskProgress({ subtasks: [{ completed: true }, { completed: false }] }), 50);
  assert.equal(getTaskProgress({ status: 'Completed' }), 100);
  assert.equal(getWorkProgress({ status: 'completed', progress: 100 }), 100);
});

test('each subtask renders its own formatted badge and progress with distinct colors', () => {
  const markup = renderToStaticMarkup(createElement('div', null,
    createElement(SubtaskWorkSummary, { subtask: { status: 'ongoing', progress: 60 } }),
    createElement(SubtaskWorkSummary, { subtask: { status: 'pending', progress: 0 } })));
  assert.match(markup, /sp-status-badge--ongoing/);
  assert.match(markup, /sp-status-badge--pending/);
  assert.match(markup, />Ongoing<\/span>/);
  assert.match(markup, />Pending<\/span>/);
  assert.match(markup, /Progress: 60%/);
  assert.match(markup, /Progress: 0%/);
});

function elements(tree, predicate) {
  if (Array.isArray(tree)) return tree.flatMap(child => elements(child, predicate));
  if (!tree || typeof tree !== 'object' || !tree.props) return [];
  return [...(predicate(tree) ? [tree] : []), ...elements(tree.props.children, predicate)];
}

async function mountPage(Page, records) {
  const requests = [];
  let saved = structuredClone(records);
  const project = { id: 'project-1', code: 'PRJ-1', name: 'Fence Project', status: 'Ongoing', budget: '1000', start_date: '2026-01-01', end_date: '2027-01-01', phase: 'Structural' };
  globalThis.localStorage = { getItem: key => key === 'user' ? JSON.stringify({ name: 'Admin', role: 'Admin' }) : 'test-token' };
  globalThis.fetch = async (url, options = {}) => {
    requests.push({ url, options });
    const parsed = new URL(url);
    let data = [];
    if (parsed.pathname === '/projects') data = [project];
    if (parsed.pathname === '/tasks') data = saved;
    if (options.method === 'PATCH') {
      const { subtasks } = JSON.parse(options.body);
      saved = saved.map(task => ({ ...task, subtasks, progress_pct: 50 }));
    }
    return new Response(JSON.stringify({ data }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  };
  const h = { states: [], memos: [], effectDeps: [], effects: [] };
  globalThis.taskStatusHarness = h;
  function Capture() {
    h.tree = Page();
    return h.tree;
  }
  function render() {
    globalThis.taskStatusHarness = h;
    h.stateCursor = h.memoCursor = h.effectCursor = 0;
    return renderToStaticMarkup(createElement(MemoryRouter, null, createElement(Capture)));
  }
  async function refresh() {
    let markup;
    for (let pass = 0; pass < 3; pass++) {
      markup = render();
      for (const effect of h.effects.splice(0)) effect();
      await new Promise(resolve => setImmediate(resolve));
    }
    return markup;
  }
  await refresh();
  return { h, render, refresh, requests };
}

const sampleTask = {
  id: 'task-1', task_name: 'Fence Foundation', assignee: 'Engineer One', phase: 'Structural',
  priority: 'Medium', due_date: '2000-01-01', materials_required: '', site_instructions: '',
  project_code: 'PRJ-1', status: 'ongoing', progress: 45,
  subtasks: [
    { id: 's1', title: 'Excavation', status: 'ongoing', progress: 60, completed: false },
    { id: 's2', title: 'Rebar Preparation', status: 'pending', progress: 0, completed: false },
    { id: 's3', title: 'Survey', completed: true },
  ],
};

for (const [name, Page, rowClass, progressClass] of [
  ['Tasks', Tasks, 'tasks-tr', 'task-progress-bar-fill'],
  ['Project task workspace', ProjectDetails, 'pd-task-row', 'pd-task-progress-bar-fill'],
]) {
  test(`${name}: saved status and progress display before opening details; subtasks are independent`, async () => {
    const page = await mountPage(Page, [sampleTask]);
    let markup = page.render();
    const row = markup.match(new RegExp(`<tr class="${rowClass}[^\"]*">[\\s\\S]*?<\\/tr>`))?.[0];
    assert.ok(row, 'Task row is visible');
    assert.match(row, /Fence Foundation/);
    assert.match(row, />Ongoing<\/span>/);
    assert.match(row, />45%<\/span>/);
    assert.ok(row.includes(progressClass));
    assert.match(row, /width:45%/);
    const expand = elements(page.h.tree, element => element.type === 'button' && element.props['aria-label'] === 'Expand subtasks')[0]
      || elements(page.h.tree, element => element.type === 'tr' && element.props.className === 'tasks-tr')[0];
    expand.props.onClick();
    markup = page.render();
    assert.match(markup, /Excavation/);
    assert.match(markup, /Progress: 60%/);
    assert.match(markup, /Rebar Preparation/);
    assert.match(markup, /Progress: 0%/);
    assert.match(markup, /sp-status-badge--ongoing/);
    assert.match(markup, /sp-status-badge--pending/);
    assert.match(markup, /Survey/);
    assert.match(markup, /Progress: 100%/);
    assert.match(markup, /Completed by field engineer/);
    assert.match(markup, /1 \/ 3 Done \(45%\)/);
  });

  test(`${name}: fresh backend fetch reflects Pending to Ongoing without a progress change`, async () => {
    for (const status of ['pending', 'ongoing']) {
      const page = await mountPage(Page, [{ ...sampleTask, status, progress: 0 }]);
      const row = page.render().match(new RegExp(`<tr class="${rowClass}[^\"]*">[\\s\\S]*?<\\/tr>`))?.[0];
      assert.match(row, new RegExp(`>${status === 'pending' ? 'Pending' : 'Ongoing'}<\\/span>`));
      assert.match(row, />0%<\/span>/);
      assert.ok(page.requests.some(request => new URL(request.url).pathname === '/tasks'));
      assert.ok(page.requests.every(request => !request.options.body));
    }
  });

  test(`${name}: Pending/Ongoing filters match saved statuses and legacy aliases`, async () => {
    const page = await mountPage(Page, [
      { ...sampleTask, status: 'pending', progress: 80 },
      { ...sampleTask, id: 'task-2', task_name: 'Roof Framing', status: 'in-progress', progress: 0 },
    ]);
    const section = Page === Tasks
      ? elements(page.h.tree, element => element.props.className === 'tasks-table-section')
        .find(section => elements(section, element => element.type === 'table').length > 0)
      : page.h.tree;
    const dropdown = elements(section, element => element.props.prefix === 'Status')[0];
    assert.ok(dropdown.props.options.some(option => option.label === 'Pending'));
    assert.ok(dropdown.props.options.some(option => option.label === 'Ongoing'));
    dropdown.props.onChange(Page === Tasks ? 'pending' : 'Pending');
    let markup = page.render();
    assert.match(markup, /Fence Foundation/);
    assert.doesNotMatch(markup, /Roof Framing/);
    dropdown.props.onChange(Page === Tasks ? 'ongoing' : 'Ongoing');
    markup = page.render();
    assert.match(markup, /Roof Framing/);
    assert.doesNotMatch(markup, /Fence Foundation/);
  });

  test(`${name}: completed tasks and individual completed steps retain completion displays`, async () => {
    const completedTask = {
      ...sampleTask, status: 'completed', progress: 100,
      subtasks: sampleTask.subtasks.map(subtask => ({ ...subtask, status: 'completed', completed: true, progress: 100 })),
    };
    const page = await mountPage(Page, [completedTask]);
    const row = page.render().match(new RegExp(`<tr class="${rowClass}[^\"]*">[\\s\\S]*?<\\/tr>`))?.[0];
    assert.match(row, />Completed<\/span>/);
    assert.match(row, /width:100%/);
    const expand = elements(page.h.tree, element => element.props['aria-label'] === 'Expand subtasks')[0]
      || elements(page.h.tree, element => element.type === 'tr' && element.props.className === 'tasks-tr')[0];
    expand.props.onClick();
    const markup = page.render();
    assert.match(markup, /3 \/ 3 Done \(100%\)/);
    assert.equal((markup.match(/class="task-subtask-progress">Progress: 100%/g) || []).length, 3);
    assert.equal((markup.match(/Completed by field engineer/g) || []).length, 3);
  });
}

test('adding/removing a subtask keeps saved task status and existing child work fields', async () => {
  const page = await mountPage(Tasks, [{ ...sampleTask, status: 'pending' }]);
  elements(page.h.tree, element => element.type === 'tr' && element.props.className === 'tasks-tr')[0].props.onClick();
  page.render();
  const panel = elements(page.h.tree, element => typeof element.props.onAddSubtask === 'function')[0];
  await panel.props.onAddSubtask('task-1', 'New execution step');
  let row = page.render().match(/<tr class="tasks-tr[^\"]*">[\s\S]*?<\/tr>/)?.[0];
  assert.match(row, />Pending<\/span>/);
  let patch = page.requests.find(request => request.options.method === 'PATCH');
  assert.deepEqual(JSON.parse(patch.options.body).subtasks.slice(0, 3), sampleTask.subtasks);
  assert.equal(Object.hasOwn(JSON.parse(patch.options.body), 'status'), false);
  assert.equal(page.requests.at(-1).options.body, undefined);
  const updatedPanel = elements(page.h.tree, element => typeof element.props.onDeleteSubtask === 'function')[0];
  await updatedPanel.props.onDeleteSubtask('task-1', 's2');
  row = page.render().match(/<tr class="tasks-tr[^\"]*">[\s\S]*?<\/tr>/)?.[0];
  assert.match(row, />Pending<\/span>/);
  patch = page.requests.filter(request => request.options.method === 'PATCH').at(-1);
  assert.ok(JSON.parse(patch.options.body).subtasks.every(subtask => subtask.id !== 's2'));
  assert.deepEqual(JSON.parse(patch.options.body).subtasks[0], sampleTask.subtasks[0]);
});

test('project subtask edits reload task data while preserving independent work status', async () => {
  const page = await mountPage(ProjectDetails, [{ ...sampleTask, status: 'pending' }]);
  elements(page.h.tree, element => element.props['aria-label'] === 'Expand subtasks')[0].props.onClick();
  page.render();
  const input = elements(page.h.tree, element => element.props.className === 'pd-add-subtask-input')[0];
  input.props.onChange({ target: { value: 'New execution step' } });
  page.render();
  const form = elements(page.h.tree, element => element.props.className === 'pd-add-subtask-form')[0];
  form.props.onSubmit({ preventDefault() {} });
  await new Promise(resolve => setImmediate(resolve));
  let markup = page.render();
  assert.match(markup, /New execution step/);
  let row = markup.match(/<tr class="pd-task-row[^\"]*">[\s\S]*?<\/tr>/)?.[0];
  assert.match(row, />Pending<\/span>/);
  const patch = page.requests.find(request => request.options.method === 'PATCH');
  assert.deepEqual(JSON.parse(patch.options.body).subtasks.slice(0, 3), sampleTask.subtasks);
  assert.equal(Object.hasOwn(JSON.parse(patch.options.body), 'status'), false);
  assert.equal(new URL(page.requests.at(-1).url).pathname, '/tasks');
  const deleteButton = elements(page.h.tree, element => element.props.title === 'Delete subtask')[0];
  await deleteButton.props.onClick();
  markup = page.render();
  assert.doesNotMatch(markup, /Excavation/);
  row = markup.match(/<tr class="pd-task-row[^\"]*">[\s\S]*?<\/tr>/)?.[0];
  assert.match(row, />Pending<\/span>/);
});
