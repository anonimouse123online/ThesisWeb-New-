import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import ts from 'typescript';

const source = readFileSync(new URL('../src/utils/projectIssues.ts', import.meta.url), 'utf8');
const { outputText } = ts.transpileModule(source, {
  compilerOptions: { target: ts.ScriptTarget.ES2023, module: ts.ModuleKind.ESNext },
});
const { isActiveIssue, readActiveIssueCount, parseProjectIssues, fetchActiveIssueCount } =
  await import(`data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`);

// Render the actual badge without adding a separate browser/test dependency.
function moduleUrl(path) {
  const source = readFileSync(path, 'utf8').replaceAll('import.meta.env', "({ VITE_BACKEND_URL: 'https://sitepulse.test' })");
  let { outputText } = ts.transpileModule(source, {
    compilerOptions: { target: ts.ScriptTarget.ES2023, module: ts.ModuleKind.ESNext, jsx: ts.JsxEmit.ReactJSX },
    fileName: path.pathname,
  });
  outputText = outputText.replace(/from ['"]([^'"]+)['"]/g, (_match, dependency) => {
    const url = dependency.startsWith('.')
      ? moduleUrl(new URL(`${dependency}.ts`, path)) : import.meta.resolve(dependency);
    return `from '${url}'`;
  });
  return `data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`;
}
const { default: ProjectIssueBadge } = await import(moduleUrl(new URL('../src/components/ProjectIssueBadge.tsx', import.meta.url)));
const renderBadge = props => renderToStaticMarkup(createElement(MemoryRouter, null,
  createElement(ProjectIssueBadge, { projectCode: 'PRJ-2026-3713', ...props })));

test('badge uses the backend aggregate, warning styling, and the active issues destination', () => {
  const markup = renderBadge({ activeIssueCount: 3 });
  assert.match(markup, /3 Active Issues/);
  assert.match(markup, /pm-issue-badge--warning/);
  assert.match(markup, /href="\/projects\/PRJ-2026-3713\/issues\/report\?status=active"/);
  assert.match(markup, /aria-label="PRJ-2026-3713: 3 Active Issues\. View active issues"/);
  assert.match(markup, />3<\/span>/);
  assert.match(renderBadge({ activeIssueCount: '1' }), /aria-label="PRJ-2026-3713: 1 Active Issue\. View active issues"/);
  assert.match(renderBadge({ activeIssueCount: '1' }), />1<\/span>/);
});

test('zero backend counts render a clickable green No Issues badge', () => {
  const markup = renderBadge({ activeIssueCount: 0 });
  assert.match(markup, /aria-label="PRJ-2026-3713: No Issues\. View active issues"/);
  assert.doesNotMatch(markup, /<span>No Issues<\/span>/);
  assert.match(markup, /pm-issue-badge--clear/);
  assert.doesNotMatch(markup, /pm-issue-badge--warning/);
  assert.match(markup, /href=/);
});

test('missing backend counts begin in a neutral loading state instead of showing No Issues', () => {
  const markup = renderBadge({});
  assert.match(markup, /Checking issues/);
  assert.match(markup, /pm-issue-badge--neutral/);
  assert.match(markup, /aria-busy="true"/);
  assert.doesNotMatch(markup, /No Issues/);
});

test('only open and in progress issue states trigger attention', () => {
  for (const status of ['Open', 'In Progress', ' open ', 'IN PROGRESS', 'in_progress', 'in-progress']) {
    assert.equal(isActiveIssue({ status }), true, status);
  }
  for (const status of ['Resolved', 'Closed', 'Cancelled', 'Submitted', 'Completed', '', null, undefined]) {
    assert.equal(isActiveIssue({ status }), false, String(status));
  }
});

test('backend counts accept zero and database integer strings, rejecting missing or invalid counts', () => {
  for (const [value, expected] of [[0, 0], [2, 2], ['3', 3], [' 0 ', 0]]) {
    assert.equal(readActiveIssueCount(value), expected);
  }
  for (const value of [null, undefined, true, false, '', ' ', -1, 1.5, '2 issues', Infinity, NaN, {}, []]) {
    assert.equal(readActiveIssueCount(value), null);
  }
});

test('existing project endpoint counts unresolved issues and preserves project identity', async () => {
  const controller = new AbortController();
  const records = [
    { title: 'Unpaid tiles', status: 'Open', priority: 'High' },
    { title: 'No manpower', status: 'In Progress', priority: 'Critical' },
    { title: 'Weather delay', status: 'Resolved', priority: 'High' },
    { title: 'Daily site report', status: 'Submitted' },
  ];
  const count = await fetchActiveIssueCount('PRJ/2026 #1', async (url, options) => {
    assert.equal(url, '/projects/PRJ%2F2026%20%231/issues');
    assert.equal(options.signal, controller.signal);
    return new Response(JSON.stringify({ data: records }));
  }, controller.signal);
  assert.equal(count, 2);
});

test('empty lists and resolved-only projects have no active issues, including completed projects', async () => {
  for (const payload of [[], { data: [] }, [{ status: 'Resolved' }], { data: [{ status: 'Closed' }] }]) {
    assert.equal(await fetchActiveIssueCount('PRJ-COMPLETED', async () =>
      new Response(JSON.stringify(payload))), 0);
  }
  assert.equal(await fetchActiveIssueCount('PRJ-COMPLETED', async () =>
    new Response(JSON.stringify([{ status: 'Open' }]))), 1);
});

test('failed and malformed responses never turn into a misleading zero issue count', async () => {
  await assert.rejects(fetchActiveIssueCount('PRJ-1', async () => new Response('{}', { status: 500 })));
  await assert.rejects(fetchActiveIssueCount('PRJ-1', async () => { throw new Error('Offline'); }));
  for (const payload of [{}, { data: null }, { data: {} }, [null], [{ status: 123 }]]) {
    await assert.rejects(fetchActiveIssueCount('PRJ-1', async () => new Response(JSON.stringify(payload))));
  }
});

test('the active view excludes resolved reports using the same rule as the row count', () => {
  const issues = [{ status: 'Open' }, { status: 'Resolved' }, { status: 'In Progress' }];
  assert.deepEqual(parseProjectIssues({ data: issues }).filter(isActiveIssue), [issues[0], issues[2]]);
  assert.deepEqual(parseProjectIssues(issues), issues);
});
