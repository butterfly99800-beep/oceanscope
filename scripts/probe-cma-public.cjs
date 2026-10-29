const { request, chromium } = require('playwright');
const fs = require('node:fs');
const urls = ['https://www.cma-cgm.com/ebusiness/schedules/routing-finder', 'https://www.cma-cgm.com.cn/LaraToolkit/ShipScheduleInquery'];
(async () => {
  const records = [];
  const browser = await chromium.launch({channel:'msedge',headless:true});
  try {
    for (const url of urls) {
      const http = await request.newContext();
      const page = await browser.newPage();
      for (const mode of ['http','headless-edge']) {
        const record = {url,mode,at:new Date().toISOString()};
        try {
          const response = mode === 'http' ? await http.get(url,{timeout:20000}) : await page.goto(url,{timeout:20000,waitUntil:'domcontentloaded'});
          const body = await response.text();
          const headers = response.headers();
          const title = body.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1]?.slice(0,100);
          const markers = ['datadome','captcha-delivery.com','cloudflare','akamai','perimeterx'].filter(marker=>body.toLowerCase().includes(marker));
          Object.assign(record,{status:response.status(),server:headers.server,contentType:headers['content-type'],title,markers,verification:/captcha|challenge-platform|verify you are human/i.test(body),accessDenied:/access denied|forbidden|request blocked/i.test(body)});
        } catch(e) {record.error=e.message.split('\n')[0]}
        records.push(record);
        console.log(JSON.stringify(record));
      }
      await page.close(); await http.dispose();
    }
  } finally {await browser.close()}
  fs.writeFileSync('reports/cma-entry-diagnostics-2026-10-28.json',JSON.stringify(records,null,2));
})().catch(e=>{console.error(e);process.exitCode=1});
