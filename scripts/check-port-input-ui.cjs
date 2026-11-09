const {chromium}=require('playwright');const assert=require('node:assert/strict');
(async()=>{const b=await chromium.launch({channel:'msedge',headless:true});try{
const p=await b.newPage();const ports=[{id:'db-ningbo',name:'Ningbo',localName:'宁波',code:'CNNBO',country:'China',city:'Ningbo',aliases:['Ningbo']},{id:'db-la',name:'Los Angeles',localName:'洛杉矶',code:'USLAX',country:'USA',city:'Los Angeles',aliases:[]}];
await p.route('**/api/ports/search**',r=>r.fulfill({json:{data:ports}}));
await p.route('**/api/cosco/cities/search**',async r=>{await new Promise(resolve=>setTimeout(resolve,700));await r.fulfill({json:{data:[]}}).catch(()=>{});});
await p.goto(process.env.OCEANSCOPE_TEST_URL||'http://127.0.0.1:3063/schedules');const inputs=p.getByPlaceholder('搜索港口、城市或代码');const origin=inputs.nth(0),destination=inputs.nth(1);
await origin.fill('Ningbo');await origin.locator('..').locator('..').getByRole('button',{name:/Ningbo/}).click();assert.equal(await origin.inputValue(),'Ningbo, China');
let value=await origin.inputValue();await origin.focus();await origin.press('End');while(value){await origin.press('Backspace');value=value.slice(0,-1);assert.equal(await origin.inputValue(),value,'Backspace must never restore resolved label');}
await origin.fill('Ningbo');await origin.locator('..').locator('..').getByRole('button',{name:/Ningbo/}).click();await p.getByRole('button',{name:'清空起运港',exact:true}).click();assert.equal(await origin.inputValue(),'');
await origin.fill('Ningbo');await origin.press('Control+a');await origin.press('Backspace');await p.waitForTimeout(1000);assert.equal(await origin.inputValue(),'','Late response must not restore cleared text');
await origin.fill('Ningbo');await origin.locator('..').locator('..').getByRole('button',{name:/Ningbo/}).click();await destination.fill('Los');await destination.locator('..').locator('..').getByRole('button',{name:/Los Angeles/}).click();await p.getByRole('button',{name:'交换港口'}).click();assert.equal(await origin.inputValue(),'Los Angeles, USA');assert.equal(await destination.inputValue(),'Ningbo, China');
console.log('PASS actual input UI: select, backspace every character, clear button, select-all delete, late responses, swap');
}finally{await b.close()}})().catch(e=>{console.error(e.message);process.exitCode=1});
