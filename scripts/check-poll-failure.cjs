// Fault-injection UI test only. Not included in live carrier counts.
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  try {
    const page = await browser.newPage();
    await page.addInitScript(() => localStorage.setItem('oceanscope_schedule_recent', JSON.stringify([{ id:'fault-test',originPortId:'CNSHA',destinationPortId:'NLRTM',departureDate:'2020-01-01',searchedAt:new Date().toISOString() }])));
    let requests = 0;
    // Keep this network-failure test independent of any real database contents.
    const ports = [{ id: 'CNSHA', code: 'CNSHA', name: 'Shanghai', localName: 'Shanghai', aliases: [] }, { id: 'NLRTM', code: 'NLRTM', name: 'Rotterdam', localName: 'Rotterdam', aliases: [] }];
    await page.route('**/api/ports/search?*', route => route.fulfill({ json: { data: ports, pagination: { total: 2 } } }));
    await page.route('**/api/schedules/search?*', route => ++requests === 1
      ? route.fulfill({ json: { data: [], pagination: { total: 0 }, done: false, providers: [{ code: 'OOCL', status: 'fetching', resultCount: 0, warnings: [] }] } })
      : route.abort('connectionfailed'));
    await page.goto((process.env.OCEANSCOPE_TEST_URL || 'http://localhost:3003') + '/schedules');
    await page.waitForLoadState('networkidle');
    await page.getByRole('button').filter({ hasText: '→' }).click();
    await page.getByText('部分船司的查询未能完成，请点击重新查询；已返回的结果仍可查看。', { exact: true }).waitFor({ timeout: 25000 });
    const body = await page.locator('body').innerText();
    assert(!body.includes('OOCL：查询中'));
    assert.equal(requests, 4, 'Three failed polls should stop, not loop indefinitely');
    console.log('PASS: three network failures terminate polling and show actionable status');
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
