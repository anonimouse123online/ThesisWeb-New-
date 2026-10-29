import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { beforeEach, describe, test } from 'node:test';
import ts from 'typescript';

const urls = new Map();
function moduleUrl(name) {
  if (urls.has(name)) return urls.get(name);
  let source = readFileSync(new URL(`../src/utils/${name}.ts`, import.meta.url), 'utf8');
  source = source.replaceAll('import.meta.env', "({ VITE_BACKEND_URL: 'https://sitepulse.test' })");
  source = source.replace(/from '\.\/([^']+)'/g, (_, dependency) => `from '${moduleUrl(dependency)}'`);
  const { outputText } = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2023, module: ts.ModuleKind.ESNext } });
  const url = `data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`;
  urls.set(name, url);
  return url;
}
const session = await import(moduleUrl('session'));
const { fetchWithAuth } = await import(moduleUrl('api'));
describe('session isolation', () => {
let events, navigation;
function storage() {
  const data = new Map();
  return { getItem: key => data.get(key) ?? null, setItem: (key, value) => data.set(key, value),
    removeItem: key => data.delete(key), clear: () => data.clear() };
}
beforeEach(() => {
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, writable: true, value: storage() });
  Object.defineProperty(globalThis, 'sessionStorage', { configurable: true, writable: true, value: storage() });
  events = new Map(); navigation = [];
  Object.defineProperty(globalThis, 'window', { configurable: true, writable: true, value: { addEventListener: (name, handler) => events.set(name, handler),
    location: { pathname: '/projects', replace: path => navigation.push(path), reload: () => navigation.push('reload') } } });
});
test('logout clears every account cache and alternate token, preserving login preferences', () => {
  for (const key of ['token', 'authToken', 'accessToken', 'user', 'project-details']) localStorage.setItem(key, 'A');
  localStorage.setItem('remember_me', 'true');
  localStorage.setItem('remembered_email', 'a@test');
  sessionStorage.setItem('projects', 'Alpha');
  session.logoutSession();
  for (const key of ['token', 'authToken', 'accessToken', 'user', 'project-details']) assert.equal(localStorage.getItem(key), null);
  assert.equal(sessionStorage.getItem('projects'), null);
  assert.equal(localStorage.getItem('remembered_email'), 'a@test');
  assert.deepEqual(navigation, ['/login']);
});
test('login B starts clean and its next fetch uses only B credentials and no-store', async () => {
  localStorage.setItem('authToken', 'A'); sessionStorage.setItem('projects', 'Alpha');
  session.startSession('B', { id: 'B' });
  globalThis.fetch = async (_url, options) => {
    assert.equal(options.headers.get('Authorization'), 'Bearer B');
    assert.equal(options.cache, 'no-store');
    return Response.json({ data: [] });
  };
  assert.deepEqual(await (await fetchWithAuth('/projects')).json(), { data: [] });
  assert.equal(localStorage.getItem('authToken'), null);
  assert.equal(sessionStorage.getItem('projects'), null);
});
test('late A response cannot render in B or invalidate B with an old 401', async () => {
  for (const status of [200, 401]) {
    session.startSession('A', { id: 'A' });
    let finish;
    globalThis.fetch = () => new Promise(resolve => { finish = resolve; });
    const pending = fetchWithAuth('/projects');
    session.startSession('B', { id: 'B' });
    finish(Response.json({ data: ['Alpha'] }, { status }));
    await assert.rejects(pending, { name: 'AbortError' });
    assert.equal(localStorage.getItem('token'), 'B');
  }
});
test('account switch after fetch but before JSON parsing also discards A data', async () => {
  session.startSession('A', { id: 'A' });
  globalThis.fetch = async () => Response.json({ data: ['Alpha'] });
  const response = await fetchWithAuth('/projects');
  session.startSession('B', { id: 'B' });
  await assert.rejects(response.json(), { name: 'AbortError' });
});
test('cross-tab session changes and browser back-cache restoration reload mounted state', () => {
  session.installSessionIsolation();
  events.get('storage')({ key: 'token' });
  events.get('storage')({ key: null });
  events.get('pageshow')({ persisted: true });
  events.get('pageshow')({ persisted: false });
  assert.deepEqual(navigation, ['reload', 'reload', 'reload']);
});

});
