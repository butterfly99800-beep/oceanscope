import { chromium } from 'playwright';
import fs from 'node:fs/promises';
import path from 'node:path';

const homeUrl = 'https://elines.coscoshipping.com/ebusiness/';
const outDir = path.resolve('tmp/cosco-debug');
await fs.mkdir(outDir, { recursive: true });

const headless = process.env.COSCO_SCRAPER_HEADLESS !== 'false' && process.env.COSCO_DEBUG_HEADED !== 'true';
const browser = await chromium.launch({ headless, slowMo: headless ? 0 : 300 });
const context = await browser.newContext({ locale: 'en-US', userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36 OceanScopeCoscoDebug/1.0' });
const page = await context.newPage();
const network = [];
const jsonPayloads = [];

function isScheduleUrl(url) {
  return /schedule|sailing|SearchByCity|findSchedule/i.test(url);
}

page.on('response', (response) => {
  const request = response.request();
  const type = request.resourceType();
  if (type === 'xhr' || type === 'fetch') {
      const item = { url: response.url(), method: request.method(), status: response.status(), resourceType: type, contentType: response.headers()['content-type'] ?? '', postData: request.postData() };
    if (isScheduleUrl(item.url) || /schedule|sailing/i.test(item.url)) {
      network.push(item);
      if ((item.contentType || '').includes('json')) {
        response.json().then((payload) => {
          jsonPayloads.push({ url: item.url, method: item.method, status: item.status, payload });
        }).catch(() => undefined);
      }
    }
  }
});

async function snapshotControls(target, label) {
  const controls = await target.locator('a, input, button, select, textarea, [role=button], [role=link], [role=combobox], iframe').evaluateAll((nodes) => nodes.map((node, index) => {
    const element = node;
    const rect = element.getBoundingClientRect();
    const style = window.getComputedStyle(element);
    return {
      index,
      tag: element.tagName.toLowerCase(),
      type: element.getAttribute('type'),
      role: element.getAttribute('role'),
      href: element.getAttribute('href'),
      placeholder: element.getAttribute('placeholder'),
      ariaLabel: element.getAttribute('aria-label'),
      text: (element.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 160),
      value: element.value || '',
      visible: rect.width > 0 && rect.height > 0 && style.visibility !== 'hidden' && style.display !== 'none',
    };
  }));
  await fs.writeFile(path.join(outDir, `${label}-controls.json`), JSON.stringify(controls, null, 2), 'utf8');
  return controls;
}

async function dismissPublicModals(target) {
  const names = [/^OK$/i, /Allow All/i, /Reject All/i, /^Confirm$/i, /^Accept$/i];
  for (let round = 0; round < 4; round += 1) {
    let clicked = false;
    for (const name of names) {
      const roleButton = target.getByRole('button', { name }).first();
      if (await roleButton.isVisible({ timeout: 1000 }).catch(() => false)) {
        await roleButton.click({ timeout: 3000 }).catch(() => undefined);
        clicked = true;
        await target.waitForTimeout(600).catch(() => undefined);
        continue;
      }
      const textButton = target.locator('button, .ivu-btn, [role=button]').filter({ hasText: name }).first();
      if (await textButton.isVisible({ timeout: 1000 }).catch(() => false)) {
        await textButton.click({ timeout: 3000 }).catch(() => undefined);
        clicked = true;
        await target.waitForTimeout(600).catch(() => undefined);
      }
    }
    if (!clicked) break;
  }
}

async function chooseCity(target, placeholder, value) {
  const input = target.getByPlaceholder(placeholder).first();
  await input.click();
  await input.fill('');
  const waitCity = target.waitForResponse((response) => /findCityDistrictByPrefix/i.test(response.url()), { timeout: 10000 }).catch(() => null);
  await input.type(value, { delay: 40 });
  await waitCity;
  await target.waitForTimeout(1000);
  const firstWord = value.split(/[,(\s]/)[0] || value;
  const option = target.locator('.ivu-select-dropdown:not([style*=\'display: none\']) .ivu-select-item, .ivu-select-item').filter({ hasText: new RegExp(firstWord, 'i') }).first();
  if (await option.isVisible({ timeout: 4000 }).catch(() => false)) await option.click();
  else await input.press('Enter').catch(() => undefined);
  await target.waitForTimeout(600);
}

async function runSearch(target) {
  console.log('[COSCO-DEBUG] select origin');
  await chooseCity(target, /^Origin City/i, 'Shanghai');
  console.log('[COSCO-DEBUG] select destination');
  await chooseCity(target, /^Destination City/i, 'Los Angeles');
  const dateInput = target.getByPlaceholder(/Earliest Departure Date/i).first();
  if (await dateInput.isVisible({ timeout: 3000 }).catch(() => false)) {
    console.log('[COSCO-DEBUG] set date');
    await dateInput.click();
    await dateInput.fill(new Date().toISOString().slice(0, 10)).catch(async () => {
      await target.keyboard.type(new Date().toISOString().slice(0, 10));
      await target.keyboard.press('Enter').catch(() => undefined);
    });
  }
  console.log('[COSCO-DEBUG] submit search');
  await target.locator('.sailing-search-by-city-form button.search-btn, button.search-btn').first().click({ force: true });
  await target.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => undefined);
  await target.waitForTimeout(4000);
}

async function findScheduleEntry(target) {
  const candidates = [
    target.getByRole('link', { name: /Sailing Schedules?/i }).first(),
    target.getByText(/Sailing Schedules?/i).first(),
    target.getByRole('link', { name: /^Schedule$/i }).first(),
    target.getByText(/^Schedule$/i).first(),
    target.getByText(/Find Schedule by City Pairs/i).first(),
    target.getByText(/Search by City/i).first(),
    target.getByText(/船期|船期查询/).first(),
  ];
  for (const locator of candidates) {
    if (await locator.isVisible({ timeout: 1200 }).catch(() => false)) return locator;
  }
  return null;
}

try {
  console.log('[COSCO-DEBUG] open homepage');
  await page.goto(homeUrl, { waitUntil: 'domcontentloaded', timeout: 45000 });
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => undefined);
  await dismissPublicModals(page);
  await page.screenshot({ path: path.join(outDir, 'homepage.png'), fullPage: true });
  await fs.writeFile(path.join(outDir, 'homepage.html'), await page.content(), 'utf8');
  const homeControls = await snapshotControls(page, 'homepage');

  console.log('[COSCO-DEBUG] locate schedule entry');
  let popup = null;
  const entry = await findScheduleEntry(page);
  if (!entry) throw new Error('Schedule entry was not found from homepage.');
  const entryText = (await entry.innerText().catch(() => '')).replace(/\s+/g, ' ').trim();
  console.log('[COSCO-DEBUG] entry:', entryText);
  const popupPromise = page.waitForEvent('popup', { timeout: 5000 }).catch(() => null);
  await entry.click({ timeout: 10000 });
  popup = await popupPromise;
  let schedulePage = popup ?? page;
  await schedulePage.waitForLoadState('domcontentloaded', { timeout: 30000 }).catch(() => undefined);
  await schedulePage.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => undefined);

  if (!/find schedule by city pairs/i.test(await schedulePage.locator('body').innerText({ timeout: 5000 }).catch(() => ''))) {
    const cityEntry = await findScheduleEntry(schedulePage);
    if (cityEntry && await cityEntry.isVisible({ timeout: 1500 }).catch(() => false)) await cityEntry.click().catch(() => undefined);
    await schedulePage.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => undefined);
  }

  const finalUrl = schedulePage.url();
  const title = await schedulePage.title();
  const frames = schedulePage.frames().map((frame) => ({ url: frame.url(), name: frame.name() })).filter((frame) => frame.url !== 'about:blank');
  await schedulePage.screenshot({ path: path.join(outDir, 'schedule-page.png'), fullPage: true });
  await fs.writeFile(path.join(outDir, 'schedule-page.html'), await schedulePage.content(), 'utf8');
  const scheduleControls = await snapshotControls(schedulePage, 'schedule-page');
  await runSearch(schedulePage).catch((error) => console.log('[COSCO-DEBUG] query failed:', error.message));
  await schedulePage.screenshot({ path: path.join(outDir, 'schedule-query.png'), fullPage: true }).catch(() => undefined);
  await fs.writeFile(path.join(outDir, 'schedule-query.html'), await schedulePage.content(), 'utf8').catch(() => undefined);
  await fs.writeFile(path.join(outDir, 'schedule-query-body.txt'), await schedulePage.locator('body').innerText({ timeout: 5000 }).catch(() => ''), 'utf8').catch(() => undefined);
  await fs.writeFile(path.join(outDir, 'schedule-network.json'), JSON.stringify(network, null, 2), 'utf8');
  await fs.writeFile(path.join(outDir, 'schedule-json-payloads.json'), JSON.stringify(jsonPayloads, null, 2), 'utf8');
  console.log(JSON.stringify({ homeUrl, entryText, finalUrl, title, redirected: finalUrl !== homeUrl, openedNewPage: Boolean(popup), frames, homeVisibleControls: homeControls.filter((item) => item.visible).slice(0, 60), scheduleVisibleControls: scheduleControls.filter((item) => item.visible).slice(0, 80), network }, null, 2));
} finally {
  if (!headless) await page.waitForTimeout(7000).catch(() => undefined);
  await context.close().catch(() => undefined);
  await browser.close().catch(() => undefined);
}



