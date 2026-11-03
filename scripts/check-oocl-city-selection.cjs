// Local DOM regression only: no OOCL network request or database connection.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const ts = require('typescript');
const { chromium } = require('playwright');
const out = {};
new Function('exports', 'require', ts.transpileModule(fs.readFileSync(path.join(__dirname, '../src/features/shipping/providers/oocl/http.ts'), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText)(out, require);
(async () => {
  const browser = await chromium.launch({ headless: true, ...(process.platform === 'win32' ? { channel: 'msedge' } : {}) });
  try {
    const page = await browser.newPage();
    await page.setContent(`<div hidden><a onclick="selectDestination('DEHAM','Hamburg','old')">Hamburg, Hamburg, Germany</a></div><a onclick="selectDestination('USHAM','Hamburg','wrong')">Hamburg, New Jersey, United States</a><a id="correct" onclick="selectDestination('DEHAM','Hamburg','2539114')">Hamburg, Hamburg, Germany</a>`);
    const option = page.locator(out.ooclCitySelector('Destination', 'DEHAM'));
    assert.equal(await option.count(), 1);
    assert.equal(await option.getAttribute('id'), 'correct');
    assert.throws(() => out.ooclCitySelector('Destination', "DEHAM']"));
    console.log('PASS: visible official DEHAM selected; same-name US city and hidden clone excluded');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
