const assert = require('node:assert/strict');
const base = process.env.OCEANSCOPE_TEST_URL || 'http://127.0.0.1:3003';
assert(['127.0.0.1', 'localhost'].includes(new URL(base).hostname), 'Smoke tests are restricted to loopback');
(async () => {
  for (const route of ['/', '/login', '/schedules', '/atlas', '/api/auth/providers', '/api/auth/session', '/api/auth/csrf', '/api/ports/search?q=Shanghai', '/api/schedules/search']) {
    const res = await fetch(base + route, { signal: AbortSignal.timeout(15000) });
    assert.equal(res.status, 200, route);
    if (route === '/api/auth/providers') assert.equal((await res.json()).credentials.id, 'credentials');
    else if (route === '/api/auth/session') assert.deepEqual(await res.json(), {});
    else await res.arrayBuffer();
  }
  for (const route of ['/api/account', '/api/admin/users']) {
    const res = await fetch(base + route, { redirect: 'manual', signal: AbortSignal.timeout(15000) });
    assert([401, 403].includes(res.status), route); await res.arrayBuffer();
  }
  const res = await fetch(base + '/account', { redirect: 'manual' });
  assert([302, 303, 307, 308].includes(res.status));
  assert(res.headers.get('location').includes('/login'));
  console.log('PASS: production pages, public APIs, NextAuth endpoints, protected routes');
})().catch(error => { console.error(error.message); process.exitCode = 1; });
