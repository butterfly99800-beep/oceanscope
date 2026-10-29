// User-operated verification windows. No CAPTCHA is solved by this script.
const { chromium } = require('playwright');
const path = require('node:path');
const fs = require('node:fs');
const root = path.resolve(__dirname, '..');
const executablePath = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(fs.existsSync);
const urls = {
  CMA: 'https://www.cma-cgm.com/ebusiness/schedules',
  HAPAG: 'https://www.hapag-lloyd.cn/solutions/schedule/#/',
};
(async () => {
  const contexts = await Promise.all(Object.keys(urls).map(async (carrier) => {
    const context = await chromium.launchPersistentContext(path.join(root, 'tmp/public-sessions', carrier.toLowerCase()), {
      executablePath, headless: false, viewport: { width: 1440, height: 1000 }, args: ['--window-size=1440,1000'],
    });
    const page = context.pages()[0] || await context.newPage();
    await page.goto(urls[carrier], { waitUntil: 'domcontentloaded', timeout: 60000 }).catch(() => {});
    console.log(`${carrier}: verification window ready. Complete official verification, then close this browser window.`);
    return context;
  }));
  await Promise.all(contexts.map((context) => context.waitForEvent('close', { timeout: 0 })));
})().catch((error) => { console.error(error.message); process.exitCode = 1; });
