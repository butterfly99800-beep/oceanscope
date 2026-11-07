const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
function load(file) {
  const out = {};
  new Function('exports', 'require', ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { esModuleInterop: true, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText)(out, name => name.startsWith('@/') ? load(path.join(__dirname, '../src', name.slice(2) + '.ts')) : name.startsWith('.') ? load(path.resolve(path.dirname(file), name) + '.ts') : require(name));
  return out;
}

// UI integration check with a real, uncached provider response. Database transport is stubbed, not production acceptance.
const assert=require('node:assert/strict');const {chromium}=require('playwright');
(async()=>{
 const {EMCProvider}=load(path.join(__dirname,'../src/features/shipping/providers/emc/provider.ts'));
 const from=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
 const result=await EMCProvider.searchSchedule({originPort:{id:'CNSHA',name:'Shanghai',locode:'CNSHA'},destinationPort:{id:'USLAX',name:'Los Angeles',locode:'USLAX'},departureDate:from,dateTo:new Date(Date.parse(from)+28*86400000).toISOString().slice(0,10)});
 assert.equal(result.fromCache,false);assert(result.schedules.length>0);
 const data=result.schedules.map(r=>({...r,carrier:'EVERGREEN',carrierCode:'EMC',originPort:r.originText,originPortCode:r.originLocode,destinationPort:r.destinationText,destinationPortCode:r.destinationLocode,transitPorts:[],routeNodes:[],tags:[],status:'正常',terminal:r.originFacilityName,destinationTerminal:r.destinationFacilityName,lastUpdated:new Date().toISOString(),source:'EMC_LIVE_QUERY'}));
 const browser=await chromium.launch({channel:'msedge',headless:true});try{
 const page=await browser.newPage({acceptDownloads:true,viewport:{width:1440,height:1000}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/api/ports/search**',r=>r.fulfill({json:{data:[{id:'CNSHA',name:'Shanghai',localName:'Shanghai',code:'CNSHA',aliases:[],country:'China',city:'Shanghai'},{id:'USLAX',name:'Los Angeles',localName:'Los Angeles',code:'USLAX',aliases:[],country:'USA',city:'Los Angeles'}]}}));
 await page.route('**/api/schedules/search**',r=>r.fulfill({json:{data,pagination:{total:data.length},done:true,providers:[{code:'EMC',status:'success',resultCount:data.length,warnings:[]}]}}));
 await page.addInitScript(()=>localStorage.setItem('oceanscope_schedule_recent',JSON.stringify([{id:'ui-test',originPortId:'CNSHA',destinationPortId:'USLAX',originName:'Shanghai',destinationName:'Los Angeles'}])));
 await page.goto(process.env.OCEANSCOPE_TEST_URL||'http://127.0.0.1:3059/schedules');
 await page.getByRole('button',{name:/Shanghai.*Los Angeles/}).click();await page.getByRole('heading',{name:'航线汇总'}).waitFor();
 const download=page.waitForEvent('download');await page.getByRole('button',{name:/导出 Excel/}).click();const file=await download;assert.equal(await file.failure(),null);const {Workbook}=require('exceljs');const wb=new Workbook();await wb.xlsx.readFile(await file.path());assert.equal(wb.getWorksheet('船期明细').rowCount,data.length+1);assert.equal(errors.length,0,errors.join(';'));console.log(JSON.stringify({passed:true,liveRows:data.length,fromCache:false,excelRows:wb.getWorksheet('船期明细').rowCount-1,scope:'real provider to UI and download; database API stubbed'}));
 }finally{await browser.close()}
})().catch(e=>{console.error(e.message);process.exitCode=1});
