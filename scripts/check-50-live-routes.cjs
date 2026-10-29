// Real UI -> real application API -> public providers. No mocked responses.
const { chromium } = require('playwright');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const base = process.env.OCEANSCOPE_TEST_URL || 'http://localhost:3003';
const origins = ['CNSHA', 'CNNBO', 'CNQIN', 'CNYTN', 'CNSHK'];
const destinations = ['CATOR', 'NLRTM', 'DEHAM', 'SGSIN', 'USLAX', 'USNYC', 'CAVAN', 'GBSOU', 'AUSYD', 'AEJEA'];
const routes = process.argv.slice(2).length ? process.argv.slice(2).map(x => x.split(':')) : origins.flatMap(o => destinations.map(d => [o, d]));
const reportDir = path.join(__dirname, '../reports');
fs.mkdirSync(reportDir, { recursive: true });
const output = path.join(reportDir, process.env.REPORT_NAME || 'live-50-2026-10-27.jsonl');
const labels = { COSCO: 'COSCO', OOCL: 'OOCL', CMA: 'CMA CGM', MAERSK: 'MAERSK', HAPAG: 'Hapag-Lloyd', MSC: 'MSC' };
(async () => {
  let ready = false;
  const startupDeadline = Date.now() + 90000;
  while (Date.now() < startupDeadline) {
    try {
      const response = await fetch(`${base}/api/ports/search?pageSize=1`, { signal: AbortSignal.timeout(10000) });
      ready = response.ok;
      await response.body?.cancel();
      if (ready) break;
    } catch { /* Wait for the local service before counting a route attempt. */ }
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  assert(ready, 'TEST_SERVER_NOT_READY: no route attempt was counted');
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  try {
    for (const [origin, destination] of routes) {
      if (process.env.SKIP_COMPLETED === 'true' && fs.existsSync(output) && fs.readFileSync(output, 'utf8').split('\n').filter(Boolean).some(line => { const r = JSON.parse(line); return r.browserPass && r.origin === origin && r.destination === destination; })) continue;
      const started = Date.now();
      const record = { origin, destination, startedAt: new Date(started).toISOString(), forceRefresh: true };
      const page = await browser.newPage();
      let result, forced = false;
      const errors = [];
      page.on('pageerror', e => errors.push(e.message));
      await page.addInitScript(({ origin, destination }) => localStorage.setItem('oceanscope_schedule_recent', JSON.stringify([{ id: 'matrix', originPortId: origin, destinationPortId: destination, departureDate: '2020-01-01', directOnly: true, searchedAt: new Date().toISOString() }])), { origin, destination });
      // Change only the real request's cache policy; never substitute provider data.
      await page.route('**/api/schedules/search?*', async route => {
        const url = new URL(route.request().url());
        url.searchParams.delete('retry');
        if (!forced) { url.searchParams.set('refresh', 'true'); forced = true; record.dateFrom = url.searchParams.get('dateFrom'); record.dateTo = url.searchParams.get('dateTo'); }
        else url.searchParams.delete('refresh');
        await route.continue({ url: url.toString() });
      });
      page.on('response', async response => {
        if (new URL(response.url()).pathname !== '/api/schedules/search') return;
        try { const payload = await response.json(); if (payload.done) result = payload; } catch {}
      });
      try {
        await page.goto(`${base}/schedules`, { waitUntil: 'domcontentloaded', timeout: 60000 });
        const history = page.getByRole('button').filter({ hasText: '→' });
        await history.waitFor();
        await page.waitForFunction(() => !document.body.innerText.includes('Location name unavailable'), null, { timeout: 60000 });
        await page.waitForLoadState('networkidle');
        await history.click();
        const deadline = Date.now() + 150000;
        while (!result && Date.now() < deadline) await page.waitForTimeout(1000);
        assert(result?.done, 'Query did not finish within 150 seconds');
        record.providers = result.providers;
        record.counts = result.providerCounts;
        record.total = result.pagination?.total;
        record.samples = Object.keys(labels).map(code => result.data.find(row => row.carrierCode === code)).filter(Boolean).map(row => ({ carrier: row.carrierCode, vessel: row.vesselName, voyage: row.voyageNumber, origin: row.originPortCode, destination: row.destinationPortCode, etd: row.etd, eta: row.eta, lastUpdated: row.lastUpdated, rawSourceAvailable: row.rawSourceAvailable }));
        assert.equal(result.providers.length, 6);
        assert(result.providers.every(p => !['cached', 'pending', 'fetching'].includes(p.status)), 'Cached or unfinished provider');
        assert(result.data.every(row => row.rawSourceAvailable && new Date(row.lastUpdated).getTime() >= started - 1000), 'Missing provenance or stale row');
        for (let n = 0; n < 20; n++) {
          const more = page.getByRole('button', { name: '加载更多', exact: true });
          if (!await more.count()) break;
          await more.click();
          await page.waitForTimeout(100);
        }
        const body = await page.locator('body').innerText();
        if (destination === 'AUSYD' && result.data.some(row => row.carrierCode === 'CMA')) assert(body.includes('CMA CGM / ANL（官网分类）'), 'Missing official ANL classification');
        assert(!body.includes('查询中') && !body.includes('继续加载中'), 'UI left querying after completion');
        for (const [code, count] of Object.entries(result.providerCounts)) {
          if (!count) continue;
          assert(body.includes(`${labels[code]}：${count} 条`), `Missing ${code} badge`);
          const sample = record.samples.find(row => row.carrier === code);
          if (sample?.vessel) assert(body.includes(sample.vessel), `Missing ${code} vessel`);
        }
        assert.equal(errors.length, 0, errors.join('; '));
        record.browserPass = true;
      } catch (error) {
        record.browserPass = false;
        record.error = error.message;
        await page.screenshot({ path: path.join(reportDir, `failure-${origin}-${destination}.png`), fullPage: true }).catch(() => {});
      } finally {
        record.durationMs = Date.now() - started;
        fs.appendFileSync(output, JSON.stringify(record) + '\n');
        console.log('ROUTE_RESULT', JSON.stringify({ origin, destination, browserPass: record.browserPass, durationMs: record.durationMs, counts: record.counts, error: record.error, problems: record.providers?.filter(p => p.status !== 'success') }));
        await page.close();
      }
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
