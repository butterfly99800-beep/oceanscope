// End-to-end live validation. Writes actual official results through the application's normal API.
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const base = process.env.OCEANSCOPE_TEST_URL || 'http://localhost:3002';
const routes = process.argv.slice(2).length ? process.argv.slice(2).map(pair => pair.split(':')) : [['CNSHA', 'NLRTM'], ['CNQIN', 'SGSIN'], ['CNYTN', 'USLAX']];
(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  try {
    for (const [origin, destination] of routes) {
      const page = await browser.newPage();
      // Deliberately stale criteria verify that history reuses only the route.
      await page.addInitScript(({ origin, destination }) => localStorage.setItem('oceanscope_schedule_recent', JSON.stringify([{ id: 'live-test', originPortId: origin, destinationPortId: destination, departureDate: '2020-01-01', directOnly: true, searchedAt: new Date().toISOString() }])), { origin, destination });
      await page.goto(`${base}/schedules`, { waitUntil: 'domcontentloaded' });
      const history = page.getByRole('button').filter({ hasText: '→' });
      await history.waitFor();
      await page.waitForFunction(() => !document.body.innerText.includes('Location name unavailable'));
      await page.waitForLoadState('networkidle');
      let result;
      let normalResult;
      let started = Date.now();
      let refreshSeen = false;
      const capture = async response => {
        const responseUrl = new URL(response.url());
        if (responseUrl.pathname !== '/api/schedules/search') return;
        if (responseUrl.searchParams.get('refresh') === 'true') refreshSeen = true;
        try {
          const payload = await response.json();
          if (!refreshSeen) { if (payload.done) normalResult = payload; return; }
          if (payload.done && payload.providers?.every(p => p.status !== 'cached') && payload.data?.every(row => new Date(row.lastUpdated).getTime() >= started - 1000)) result = payload;
        } catch { /* Navigation can cancel an unrelated response. */ }
      };
      page.on('response', capture);
      const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(started));
      const [queryRequest] = await Promise.all([
        page.waitForRequest(r => new URL(r.url()).pathname === '/api/schedules/search'),
        history.click(),
      ]);
      const query = new URL(queryRequest.url()).searchParams;
      assert.equal(query.get('origin'), origin);
      assert.equal(query.get('destination'), destination);
      assert.equal(query.get('dateFrom'), today, 'History reused the old departure date');
      assert.equal(query.get('dateTo'), new Date(new Date(`${today}T00:00:00Z`).getTime() + 28 * 86400000).toISOString().slice(0, 10));
      assert.notEqual(query.get('refresh'), 'true', 'Normal history queries should allow cache');
      assert.notEqual(query.get('direct'), 'true', 'History reused the old direct-only filter');
      console.log('HISTORY_PASS', JSON.stringify({ origin, destination, dateFrom: query.get('dateFrom'), dateTo: query.get('dateTo'), refresh: false }));
      const refresh = page.getByRole('button', { name: '重新查询船期', exact: true });
      await refresh.waitFor();
      await page.waitForFunction(() => !document.querySelector('button[aria-label="重新查询船期"]')?.disabled, null, { timeout: 150000 });
      assert(!(await page.locator('body').innerText()).includes('缓存'), 'Frontend exposes cache label');
      console.log('NORMAL_QUERY_PASS', JSON.stringify({ cachedProviders: normalResult?.providers?.filter(p => p.status === 'cached').map(p => p.code) || [] }));
      started = Date.now();
      await refresh.click();
      while (!result && Date.now() - started < 150000) await page.waitForTimeout(1000);
      page.off('response', capture);
      assert(result?.done, 'Frontend forced live query did not complete without cached data');
      assert.equal(result.providers.length, 7, 'Not all seven providers were checked');
      assert(result.data.every(row => row.rawSourceAvailable), 'Missing raw official evidence');
      console.log('LIVE_RESULT', JSON.stringify({ origin, destination, dateFrom: today, durationMs: Date.now() - started, providers: result.providers, counts: result.providerCounts }));
      if (process.env.REQUIRE_ALL_PROVIDERS === 'true') {
        assert(result.providers.every(p => p.status === 'success' && result.providerCounts[p.code] > 0), 'Some carriers did not return live schedules');
      }
      await page.locator('tbody tr').first().waitFor();
      for (let n = 0; n < 30; n++) {
        const more = page.getByRole('button', { name: '加载更多', exact: true });
        if (!await more.count()) break;
        const previousRows = await page.locator('tbody tr').count();
        await more.click();
        await page.waitForFunction(count => document.querySelectorAll('tbody tr').length > count, previousRows);
      }
      const body = await page.locator('body').innerText();
      const labels = { COSCO: 'COSCO', OOCL: 'OOCL', CMA: 'CMA CGM', MAERSK: 'MAERSK', HAPAG: 'Hapag-Lloyd', MSC: 'MSC', ONE: 'ONE' };
      for (const [code, count] of Object.entries(result.providerCounts)) {
        if (!count) continue;
        assert(body.includes(`${labels[code]}：${count} 条`), `Missing ${code} count in UI`);
        const example = result.data.find(row => row.carrierCode === code && row.vesselName);
        if (example) assert(body.includes(example.vesselName), `Missing ${code} vessel in UI`);
      }
      console.log('BROWSER_PASS', JSON.stringify({ origin, destination, counts: result.providerCounts }));
      await page.close();
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
