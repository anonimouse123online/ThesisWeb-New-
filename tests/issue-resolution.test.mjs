import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { test } from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ts from 'typescript';

const modules = new Map();
function moduleUrl(path) {
  if (modules.has(path.href)) return modules.get(path.href);
  const source = readFileSync(path, 'utf8').replaceAll('import.meta.env', "({ VITE_BACKEND_URL: 'https://sitepulse.test' })");
  let { outputText } = ts.transpileModule(source, {
    compilerOptions: { target: ts.ScriptTarget.ES2023, module: ts.ModuleKind.ESNext, jsx: ts.JsxEmit.ReactJSX },
    fileName: path.pathname,
  });
  outputText = outputText.replace(/from ['"]([^'"]+)['"]/g, (_match, dependency) => {
    let url;
    if (dependency.startsWith('.')) {
      const tsPath = new URL(`${dependency}.ts`, path);
      url = moduleUrl(existsSync(tsPath) ? tsPath : new URL(`${dependency}.tsx`, path));
    } else url = import.meta.resolve(dependency);
    return `from '${url}'`;
  });
  const url = `data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`;
  modules.set(path.href, url);
  return url;
}

const { prepareResolution, resolutionValidationMessage, safeEvidenceUrl } =
  await import(moduleUrl(new URL('../src/utils/issueResolution.ts', import.meta.url)));
const { resolveProjectIssue, fetchIssueStatistics, parseIssueRecords } =
  await import(moduleUrl(new URL('../src/utils/issuesApi.ts', import.meta.url)));
const { default: ResolveIssueModal } = await import(moduleUrl(new URL('../src/components/ResolveIssueModal.tsx', import.meta.url)));
const { default: IssueResolutionDetails } = await import(moduleUrl(new URL('../src/components/IssueResolutionDetails.tsx', import.meta.url)));

const issue = {
  id: 'issue-1', project_code: 'PRJ-1', title: 'Tree obstruction', category: 'Safety Hazard',
  priority: 'High', status: 'Resolved', description: 'Original report', created_at: '2026-10-01T01:00:00Z',
  resolution_summary: 'Obstruction removed', resolution_steps: ['Area inspected', 'Tree removed', 'Final inspection'],
  final_remarks: 'Monitor access', resolved_by: 'admin-id', resolved_by_name: 'Site Admin', resolved_at: '2026-10-06T02:30:00Z',
};

test('blank summaries and whitespace-only steps cannot reach the backend', async () => {
  for (const feedback of [
    { resolution_summary: ' ', resolution_steps: ['Inspected'] },
    { resolution_summary: 'Done', resolution_steps: [] },
    { resolution_summary: 'Done', resolution_steps: [' ', '\n'] },
  ]) {
    assert.throws(() => prepareResolution(feedback), { message: resolutionValidationMessage });
    await assert.rejects(resolveProjectIssue('PRJ-1', 'issue-1', feedback, async () => {
      assert.fail('Invalid feedback must not send a request');
    }, '/confirmed-issue-route/:issueId'), { message: resolutionValidationMessage });
  }
});

test('confirmed route uses PATCH, encoded identity and only trimmed feedback fields', async () => {
  const input = {
    resolution_summary: ' Removed obstruction ', resolution_steps: [' Inspect ', '', '  ', ' Remove '], final_remarks: ' Monitor ',
    title: 'Do not change', resolved_by: 'forged-user', resolved_at: 'forged-time', status: 'Resolved',
  };
  const unchanged = structuredClone(input);
  let requests = 0;
  await resolveProjectIssue('PRJ/1 #2', 'issue/1 #2', input, async (path, options) => {
    requests++;
    assert.equal(path, '/confirmed-project-route/PRJ%2F1%20%232/issue%2F1%20%232');
    assert.equal(options.method, 'PATCH');
    assert.equal(options.headers['Content-Type'], 'application/json');
    assert.deepEqual(JSON.parse(options.body), {
      resolution_summary: 'Removed obstruction', resolution_steps: ['Inspect', 'Remove'], final_remarks: 'Monitor',
    });
    return new Response(null, { status: 204 });
  }, '/confirmed-project-route/:projectCode/:issueId');
  assert.equal(requests, 1);
  assert.deepEqual(input, unchanged);
  assert.deepEqual(prepareResolution({ resolution_summary: 'Done', resolution_steps: ['Inspect'], final_remarks: ' ' }), {
    resolution_summary: 'Done', resolution_steps: ['Inspect'],
  });
});

test('missing or unsafe route configuration never mutates an issue', async () => {
  for (const path of ['', 'https://other.test/:issueId', '//other.test/:issueId', '/issues', '/issues/:id', '/issues/:issueId?status=resolved']) {
    await assert.rejects(resolveProjectIssue('PRJ-1', 'issue-1', {
      resolution_summary: 'Done', resolution_steps: ['Inspection'],
    }, async () => assert.fail('Unverified route must not send a request'), path), /endpoint has not been configured/);
  }
});

test('resolution failures map backend status even when the response is not JSON', async () => {
  const errors = new Map([
    [400, resolutionValidationMessage],
    [403, 'You do not have permission to resolve this issue.'],
    [404, 'Issue not found.'],
    [409, 'This issue has already been resolved.'],
    [500, 'Unable to resolve the issue. Please try again.'],
    [503, 'Unable to resolve the issue. Please try again.'],
  ]);
  for (const [status, message] of errors) {
    for (const body of ['Backend unavailable', JSON.stringify({ message: 'Database implementation detail' })]) {
      await assert.rejects(resolveProjectIssue('PRJ-1', 'issue-1', {
        resolution_summary: 'Done', resolution_steps: ['Inspection'],
      }, async () => new Response(body, { status }), '/confirmed-route/:issueId'), { message });
    }
  }
});

test('network failures are usable, while expired-session handling stays intact', async () => {
  for (const [error, message] of [
    [new TypeError('Failed to fetch'), 'Unable to resolve the issue. Please try again.'],
    [new Error('Session expired or user not found. Please log in again.'), 'Session expired or user not found. Please log in again.'],
  ]) {
    await assert.rejects(resolveProjectIssue('PRJ-1', 'issue-1', {
      resolution_summary: 'Done', resolution_steps: ['Inspection'],
    }, async () => { throw error; }, '/confirmed-route/:issueId'), { message });
  }
});

test('real authenticated helper supplies the existing JWT and API base URL', async () => {
  const originals = new Map(['fetch', 'localStorage', 'window'].map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  let token;
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: {
    getItem: key => key === token?.key ? token.value : null, removeItem() {},
  } });
  Object.defineProperty(globalThis, 'window', { configurable: true, value: {
    location: { pathname: '/projects/PRJ-1/issues/report', href: '' },
  } });
  try {
    for (const key of ['token', 'authToken', 'accessToken']) {
      token = { key, value: 'existing-jwt' };
      globalThis.fetch = async (url, options) => {
        assert.equal(url, 'https://sitepulse.test/confirmed-route/issue-1');
        assert.equal(options.headers.get('Authorization'), 'Bearer existing-jwt');
        assert.equal(options.headers.get('Content-Type'), 'application/json');
        return new Response('{}');
      };
      await resolveProjectIssue('PRJ-1', 'issue-1', { resolution_summary: 'Done', resolution_steps: ['Inspection'] }, undefined, '/confirmed-route/:issueId');
    }
    globalThis.fetch = async () => new Response('{}', { status: 401 });
    await assert.rejects(resolveProjectIssue('PRJ-1', 'issue-1', { resolution_summary: 'Done', resolution_steps: ['Inspection'] }, undefined, '/confirmed-route/:issueId'), /Session expired/);
    assert.equal(globalThis.window.location.href, '/login');
  } finally {
    for (const [key, descriptor] of originals) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else delete globalThis[key];
    }
  }
});

test('project-wide counts use the unfiltered endpoint and reflect a subsequent resolution', async () => {
  const records = [
    { status: 'open', severity: 'high' }, { status: 'in_progress', priority: 'Medium' }, { status: 'resolved', priority: 'Low' },
  ];
  const request = async (path, options) => {
    assert.equal(path, '/projects/PRJ%2F1/issues');
    assert.equal(options.cache, 'no-store');
    return new Response(JSON.stringify({ data: records }));
  };
  assert.deepEqual(await fetchIssueStatistics('PRJ/1', request), { total: 3, open: 1, inProgress: 1, resolved: 1, active: 2, critical: 1 });
  records[0].status = 'resolved';
  assert.deepEqual(await fetchIssueStatistics('PRJ/1', request), { total: 3, open: 0, inProgress: 1, resolved: 2, active: 1, critical: 1 });
  assert.deepEqual(parseIssueRecords({ data: records }).map(record => record.status), ['Resolved', 'In Progress', 'Resolved']);
});

test('failed or malformed statistics are rejected instead of showing false zero counts', async () => {
  await assert.rejects(fetchIssueStatistics('PRJ-1', async () => new Response('{}', { status: 500 })));
  await assert.rejects(fetchIssueStatistics('PRJ-1', async () => new Response('{}')));
  await assert.rejects(fetchIssueStatistics('PRJ-1', async () => { throw new Error('Offline'); }));
  assert.deepEqual(await fetchIssueStatistics('PRJ-1', async () => new Response('[]')), { total: 0, open: 0, inProgress: 0, resolved: 0, active: 0, critical: 0 });
});

test('initial resolution form identifies the issue/user and disables empty confirmation', () => {
  const markup = renderToStaticMarkup(createElement(ResolveIssueModal, {
    issue: { ...issue, status: 'Open' }, resolvedBy: 'Signed-in Admin',
    onClose: () => assert.fail('Rendering must not close'), onConfirm: () => assert.fail('Rendering must not submit'),
  }));
  assert.match(markup, /<dialog/);
  for (const text of ['Resolve Issue', 'Tree obstruction', 'Safety Hazard', 'High Priority', 'Resolution Summary *', 'Steps Taken *', 'Step 1', 'Add Step', 'Final Remarks / Recommendation', 'Signed-in Admin', 'Automatically recorded upon resolution', 'Cancel']) {
    assert.ok(markup.includes(text), text);
  }
  assert.match(markup, /<button[^>]*type="submit"[^>]*disabled=""[^>]*>Confirm Resolution<\/button>/);
  assert.doesNotMatch(markup, /type="file"|resolved_by|resolved_at/);
});

test('resolution details render recorded identity, time and numbered timeline separately', () => {
  const original = structuredClone(issue);
  const markup = renderToStaticMarkup(createElement(IssueResolutionDetails, { issue, id: 'resolution-1' }));
  for (const text of ['Resolution Details', 'RESOLVED', 'Site Admin', 'Obstruction removed', 'Area inspected', 'Tree removed', 'Final inspection', 'Monitor access']) {
    assert.ok(markup.includes(text), text);
  }
  assert.match(markup, /<time dateTime="2026-10-06T02:30:00Z"/);
  assert.match(markup, /<ol class="ir-resolution-timeline">/);
  assert.equal((markup.match(/<li>/g) || []).length, 3);
  assert.doesNotMatch(markup, /<input|<textarea|<select|Original report/);
  assert.deepEqual(issue, original);
});

test('older resolved records show existing notes without inventing identity or actions', () => {
  const markup = renderToStaticMarkup(createElement(IssueResolutionDetails, {
    issue: { ...issue, resolution_summary: null, resolution_notes: 'Legacy feedback', resolution_steps: null, final_remarks: null, resolved_by_name: null, resolved_by: 'user-id', resolved_at: null }, id: 'resolution-1',
  }));
  assert.match(markup, /Legacy feedback/);
  assert.match(markup, /Not recorded/);
  assert.match(markup, /No resolution steps were recorded/);
  assert.doesNotMatch(markup, /user-id|Site Admin|Final Remarks/);
});

test('resolution evidence is distinct and executable URLs are never linked', () => {
  const markup = renderToStaticMarkup(createElement(IssueResolutionDetails, { issue: {
    ...issue, resolution_evidence: [{ name: 'Inspection.pdf', url: '/uploads/inspection.pdf' }, { name: 'Unsafe', url: 'javascript:alert(1)' }],
  }, id: 'resolution-1' }));
  assert.match(markup, /href="https:\/\/sitepulse.test\/uploads\/inspection.pdf"/);
  assert.doesNotMatch(markup, /href="javascript:/);
  for (const url of ['javascript:alert(1)', 'data:text/html,evil', 'file:///etc/passwd']) assert.equal(safeEvidenceUrl(url), null);
});
