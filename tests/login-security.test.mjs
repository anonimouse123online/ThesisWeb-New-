import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { afterEach, beforeEach, test } from 'node:test';
import ts from 'typescript';

// Compile the real utilities in memory, supplying the build-time Vite environment.
// No generated files, extra test dependencies, or live backend calls are needed.
const moduleUrls = new Map();
function moduleUrl(name) {
  if (moduleUrls.has(name)) return moduleUrls.get(name);
  let source = readFileSync(new URL(`../src/utils/${name}.ts`, import.meta.url), 'utf8');
  source = source.replaceAll('import.meta.env', "({ VITE_BACKEND_URL: 'https://sitepulse.test', VITE_LOGIN_SECURITY_FLOW: 'legacy' })");
  source = source.replace(/from '\.\/([^']+)'/g, (_match, dependency) => `from '${moduleUrl(dependency)}'`);
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: { target: ts.ScriptTarget.ES2023, module: ts.ModuleKind.ESNext },
  });
  const url = `data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`;
  moduleUrls.set(name, url);
  return url;
}
const { collectLoginSecurityContext, createLoginSecurityContext, hasCoordinates } = await import(moduleUrl('loginSecurity'));
const { loginAdmin } = await import(moduleUrl('authService'));
const { parseSecurityLogs, fetchSecurityLogs, locationUrl } = await import(moduleUrl('securityLogs'));

const originals = new Map(['navigator', 'window', 'localStorage', 'fetch'].map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
const user = { id: 1, name: 'Admin', email: 'admin@example.com', role: 'admin' };
const session = { token: 'final-session', user };
let locationCalls;
function navigatorWith(getCurrentPosition) {
  Object.defineProperty(globalThis, 'navigator', {
    configurable: true, value: {
      userAgent: 'Test browser', platform: 'Test platform', language: 'en-PH',
      geolocation: getCurrentPosition ? { getCurrentPosition: (...args) => { locationCalls++; return getCurrentPosition(...args); } } : undefined,
    },
  });
}
function response(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
}
function assertNullLocation(context, status) {
  assert.equal(context.location_permission_status, status);
  assert.equal(context.latitude, null);
  assert.equal(context.longitude, null);
  assert.equal(context.location_accuracy, null);
  assert.equal(context.user_agent, 'Test browser');
  assert.equal('ip_address' in context, false);
}
beforeEach(() => {
  locationCalls = 0;
  Object.defineProperty(globalThis, 'window', { configurable: true, value: { isSecureContext: true, location: { pathname: '/audit-trail', href: '' } } });
  const storage = new Map();
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: {
    getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value), removeItem: key => storage.delete(key),
  } });
  navigatorWith(success => success({ coords: { latitude: 0, longitude: 0, accuracy: 25 } }));
  globalThis.fetch = () => { throw new Error('Unexpected network request'); };
});
afterEach(() => {
  for (const [key, descriptor] of originals) {
    if (descriptor) Object.defineProperty(globalThis, key, descriptor);
    else delete globalThis[key];
  }
});

test('granted location collects a single fresh fix, browser metadata, and coordinates equal to zero', async () => {
  navigatorWith((success, _error, options) => {
    assert.deepEqual(options, { enableHighAccuracy: false, timeout: 10_000, maximumAge: 0 });
    success({ coords: { latitude: 0, longitude: 0, accuracy: 25 } });
  });
  const context = await collectLoginSecurityContext();
  assert.equal(context.location_permission_status, 'GRANTED');
  assert.equal(context.latitude, 0);
  assert.equal(context.longitude, 0);
  assert.equal(context.location_accuracy, 25);
  assert.equal(context.platform, 'Test platform');
  assert.equal(context.language, 'en-PH');
  assert.equal(locationCalls, 1);
  assert.equal('ip_address' in context, false);
});
for (const [code, status] of [[1, 'DENIED'], [2, 'UNAVAILABLE'], [3, 'TIMEOUT']]) {
  test(`geolocation error ${code} sends ${status} with null coordinates`, async () => {
    navigatorWith((_success, error) => error({ code }));
    assertNullLocation(await collectLoginSecurityContext(), status);
  });
}
test('unsupported, insecure, throwing, and invalid geolocation resolve safely', async () => {
  navigatorWith();
  assertNullLocation(await collectLoginSecurityContext(), 'UNAVAILABLE');
  navigatorWith(() => { throw new Error('Unavailable'); });
  assertNullLocation(await collectLoginSecurityContext(), 'UNAVAILABLE');
  navigatorWith(success => success({ coords: { latitude: 999, longitude: 20, accuracy: 10 } }));
  assertNullLocation(await collectLoginSecurityContext(), 'UNAVAILABLE');
  window.isSecureContext = false;
  locationCalls = 0;
  assertNullLocation(await collectLoginSecurityContext(), 'UNAVAILABLE');
  assert.equal(locationCalls, 0);
});
test('unanswered prompt has a deadline and ignores a late success', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  let successCallback;
  navigatorWith(success => { successCallback = success; });
  const pending = collectLoginSecurityContext();
  t.mock.timers.tick(15_000);
  const context = await pending;
  assertNullLocation(context, 'TIMEOUT');
  successCallback({ coords: { latitude: 10, longitude: 123, accuracy: 10 } });
  assertNullLocation(context, 'TIMEOUT');
  assert.equal(locationCalls, 1);
});
test('default login validates credentials, requests location, and submits context with its existing JWT', async () => {
  const order = [];
  navigatorWith(success => { order.push('location'); success({ coords: { latitude: 0, longitude: 0, accuracy: 25 } }); });
  globalThis.fetch = async (url, options) => {
    if (url.endsWith('/auth/login')) {
      order.push('login');
      assert.deepEqual(JSON.parse(options.body), { email: 'admin@example.com', password: 'secret' });
      return response(session);
    }
    order.push('context');
    assert.equal(url, 'https://sitepulse.test/auth/login/security-context');
    assert.equal(options.headers.Authorization, 'Bearer final-session');
    const body = JSON.parse(options.body);
    assert.equal(body.security_context.location_permission_status, 'GRANTED');
    assert.equal('password' in body, false);
    assert.equal('ip_address' in body.security_context, false);
    return new Response(null, { status: 204 });
  };
  assert.deepEqual(await loginAdmin(' Admin@Example.com ', 'secret'), session);
  assert.deepEqual(order, ['login', 'location', 'context']);
  assert.equal(locationCalls, 1);
});
test('default login continues with denied location when the old backend has no security endpoint', async () => {
  navigatorWith((_success, error) => error({ code: 1 }));
  globalThis.fetch = async (url, options) => {
    if (url.endsWith('/auth/login')) return response(session);
    assertNullLocation(JSON.parse(options.body).security_context, 'DENIED');
    return response({}, 404);
  };
  assert.deepEqual(await loginAdmin(user.email, 'secret'), session);
  assert.equal(locationCalls, 1);
});
test('default login preserves successful authentication if optional logging is offline', async () => {
  globalThis.fetch = async url => {
    if (url.endsWith('/auth/login')) return response(session);
    throw new Error('Logging offline');
  };
  assert.deepEqual(await loginAdmin(user.email, 'secret'), session);
});
for (const flow of ['legacy', 'two-step']) {
  test(`${flow} waits for the location choice after verification and can skip without requesting geolocation`, async () => {
    const order = [];
    globalThis.fetch = async (url, options) => {
      if (url.endsWith('/auth/login') || url.endsWith('/verify')) {
        order.push('verified');
        return response(url.endsWith('/verify') ? { login_attempt_token: 'attempt', user } : session);
      }
      order.push('context');
      assertNullLocation(JSON.parse(options.body).security_context, 'DENIED');
      return response(session);
    };
    const requestLocation = async () => {
      order.push('choice');
      assert.equal(localStorage.getItem('token'), null);
      return createLoginSecurityContext('DENIED');
    };
    assert.deepEqual(await loginAdmin(user.email, 'secret', undefined, flow, requestLocation), session);
    assert.deepEqual(order, ['verified', 'choice', 'context']);
    assert.equal(locationCalls, 0);
  });
}
test('two-step verifies, requests location, then finalizes, without persisting an attempt or sending the password twice', async () => {
  const order = [];
  navigatorWith(success => { order.push('location'); success({ coords: { latitude: 10, longitude: 123, accuracy: 25 } }); });
  globalThis.fetch = async (url, options) => {
    const body = JSON.parse(options.body);
    if (url.endsWith('/verify')) {
      order.push('verify');
      assert.deepEqual(body, { email: 'admin@example.com', password: 'secret' });
      return response({ login_attempt_token: 'attempt', user });
    }
    order.push('finalize');
    assert.equal(url, 'https://sitepulse.test/auth/login/security-context');
    assert.equal(body.login_attempt_token, 'attempt');
    assert.equal(body.security_context.location_permission_status, 'GRANTED');
    assert.equal('password' in body, false);
    assert.equal('ip_address' in body.security_context, false);
    assert.equal(localStorage.getItem('token'), null);
    assert.equal(localStorage.getItem('user'), null);
    return response(session);
  };
  const stages = [];
  assert.deepEqual(await loginAdmin(user.email, 'secret', stage => stages.push(stage), 'two-step'), session);
  assert.deepEqual(order, ['verify', 'location', 'finalize']);
  assert.deepEqual(stages, ['verifying', 'location', 'finalizing']);
});
for (const [code, status] of [[1, 'DENIED'], [2, 'UNAVAILABLE'], [3, 'TIMEOUT']]) {
  test(`two-step continues finalization with ${status}`, async () => {
    navigatorWith((_success, error) => error({ code }));
    globalThis.fetch = async (url, options) => {
      if (url.endsWith('/verify')) return response({ login_attempt_token: 'attempt', user });
      assertNullLocation(JSON.parse(options.body).security_context, status);
      return response(session);
    };
    assert.deepEqual(await loginAdmin(user.email, 'secret', undefined, 'two-step'), session);
  });
}
test('invalid credentials, non-admin, or malformed verification never request location', async () => {
  for (const result of [
    response({ error: 'private stack trace' }, 401),
    response({ login_attempt_token: 'attempt', user: { ...user, role: 'engineer' } }),
    response({ user }),
  ]) {
    globalThis.fetch = async () => result;
    await assert.rejects(loginAdmin(user.email, 'secret', undefined, 'two-step'), error => !error.message.includes('private stack trace'));
  }
  assert.equal(locationCalls, 0);
});
test('failed finalization never falls back to legacy login or stores a session', async () => {
  const urls = [];
  globalThis.fetch = async url => {
    urls.push(url);
    return url.endsWith('/verify') ? response({ login_attempt_token: 'attempt', user }) : response({ error: 'private details' }, 500);
  };
  await assert.rejects(loginAdmin(user.email, 'secret', undefined, 'two-step'), /temporarily unavailable/);
  assert.equal(urls.length, 2);
  assert.equal(urls.some(url => url.endsWith('/auth/login')), false);
  assert.equal(localStorage.getItem('token'), null);
});
test('final user profile drops accidental backend password and refresh-token fields', async () => {
  globalThis.fetch = async () => response({ ...session, user: { ...user, password: 'private', refresh_token: 'private' } });
  assert.deepEqual(await loginAdmin(user.email, 'secret'), session);
});
test('offline, non-JSON, malformed sessions, rate limits, and non-admin final sessions produce safe errors', async () => {
  const cases = [
    async () => { throw new Error('Sensitive network details'); },
    async () => new Response('<html>private stack</html>'),
    async () => response({ user }),
    async () => response({ token: 'jwt', user: { ...user, role: 'engineer' } }),
    async () => response({ error: 'private details' }, 429),
  ];
  for (const fetchCase of cases) {
    globalThis.fetch = fetchCase;
    await assert.rejects(loginAdmin(user.email, 'secret'), error => !/private|Sensitive/.test(error.message));
  }
  assert.equal(locationCalls, 0);
});
test('audit normalization preserves backend classifications and IP, ignores tokens, and handles zero/null coordinates', () => {
  const result = parseSecurityLogs({ data: [
    { id: 1, security_status: 'SUSPICIOUS', security_reason: 'Server reason', ip_address: '192.0.2.10', latitude: '0', longitude: '0', token: 'do-not-display' },
    { id: 2, latitude: null, longitude: null },
    { id: 3, latitude: '', longitude: '123' },
  ], pagination: { page: 1, total_pages: 2, total: 30 } });
  assert.equal(result.logs[0].security_status, 'SUSPICIOUS');
  assert.equal(result.logs[0].security_reason, 'Server reason');
  assert.equal(result.logs[0].ip_address, '192.0.2.10');
  assert.equal('token' in result.logs[0], false);
  assert.match(locationUrl(result.logs[0]), /query=0%2C0$/);
  assert.equal(locationUrl(result.logs[1]), null);
  assert.equal(locationUrl(result.logs[2]), null);
  assert.equal(result.logs[1].security_status, null);
  assert.deepEqual(result.pagination, { page: 1, total_pages: 2, total: 30 });
  assert.equal(hasCoordinates(91, 0), false);
  assert.equal(hasCoordinates(0, 181), false);
});
test('audit reader accepts unpaginated, nested, and created_at fields without inventing location', () => {
  const row = { id: 'a', user: { name: 'Admin', email: user.email }, created_at: '2026-10-03T00:00:00Z', security_context: { latitude: '10', longitude: '123', location_permission_status: 'GRANTED', user_agent: 'Browser' } };
  for (const payload of [[row], { logs: [row] }, { data: [row] }]) {
    const result = parseSecurityLogs(payload);
    assert.equal(result.logs[0].user_name, 'Admin');
    assert.equal(result.logs[0].location, null);
    assert.equal(result.logs[0].timestamp, row.created_at);
    assert.equal(result.logs[0].user_agent, 'Browser');
    assert.deepEqual(result.pagination, { page: 1, total_pages: 1, total: 1 });
  }
  assert.throws(() => parseSecurityLogs({ error: 'private details' }), /could not be read/);
});
test('security log requests use the existing JWT helper and server pagination', async () => {
  localStorage.setItem('token', 'existing-jwt');
  globalThis.fetch = async (url, options) => {
    assert.equal(url, 'https://sitepulse.test/security/login-logs?page=2&limit=25');
    assert.equal(options.headers.get('Authorization'), 'Bearer existing-jwt');
    assert.equal(options.cache, 'no-store');
    return response({ data: [], pagination: { page: 2, total_pages: 3, total: 60 } });
  };
  assert.equal((await fetchSecurityLogs(2)).pagination.page, 2);
});
test('security log 401 retains existing session-clearing and redirect behavior', async () => {
  for (const key of ['token', 'user', 'authToken', 'accessToken']) localStorage.setItem(key, 'stored');
  globalThis.fetch = async () => response({}, 401);
  await assert.rejects(fetchSecurityLogs(1));
  for (const key of ['token', 'user', 'authToken', 'accessToken']) assert.equal(localStorage.getItem(key), null);
  assert.equal(window.location.href, '/login');
});
test('log errors are sanitized and 403 does not clear the session', async () => {
  localStorage.setItem('token', 'existing-jwt');
  for (const [status, expected] of [[403, /permission/], [404, /not available/], [500, /temporarily unavailable/]]) {
    globalThis.fetch = async () => response({ error: 'Private stack trace' }, status);
    await assert.rejects(fetchSecurityLogs(1), expected);
    assert.equal(localStorage.getItem('token'), 'existing-jwt');
  }
  globalThis.fetch = async () => new Response('Private stack trace');
  await assert.rejects(fetchSecurityLogs(1), /could not be read/);
});
