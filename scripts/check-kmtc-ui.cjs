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

 const codes=['KMTC'];
 const directory=process.env.OCEANSCOPE_AUDIT_UI_DIR;if(!directory)throw Error('Set OCEANSCOPE_AUDIT_UI_DIR to the fresh probe output directory');
 const data=codes.flatMap(code=>JSON.parse(fs.readFileSync(path.join(directory,code+'-routing-ui.json'),'utf8')).map(r=>({...r,carrier:code,carrierCode:code,originPort:r.originText,originPortCode:r.originLocode,destinationPort:r.destinationText,destinationPortCode:r.destinationLocode,transitPorts:r.transitPorts||[],routeNodes:[],tags:[],status:'正常',terminal:r.originFacilityName,destinationTerminal:r.destinationFacilityName,lastUpdated:new Date().toISOString(),source:code+'_LIVE_QUERY'})));
 assert(data.length>0);assert(data.every(r=>typeof r.direct==='boolean'));
 const browser=await chromium.launch({channel:'msedge',headless:true});try{
 const page=await browser.newPage({acceptDownloads:true,viewport:{width:1440,height:1000}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/api/ports/search**',r=>r.fulfill({json:{data:[{id:'CNSHA',name:'Shanghai',localName:'Shanghai',code:'CNSHA',aliases:[],country:'China',city:'Shanghai'},{id:'VNSGN',name:'Hochiminh',localName:'Hochiminh',code:'VNSGN',aliases:[],country:'Vietnam',city:'Hochiminh'}]}}));
 await page.route('**/api/schedules/search**',r=>r.fulfill({json:{data,pagination:{total:data.length},done:true,providers:codes.map(code=>({code,status:'success',resultCount:data.filter(r=>r.carrierCode===code).length,warnings:[]}))}}));
 await page.addInitScript(()=>localStorage.setItem('oceanscope_schedule_recent',JSON.stringify([{id:'ui-test',originPortId:'CNSHA',destinationPortId:'VNSGN',originName:'Shanghai',destinationName:'Hochiminh'}])));
 await page.goto(process.env.OCEANSCOPE_TEST_URL||'http://127.0.0.1:3059/schedules',{waitUntil:'domcontentloaded',timeout:90000});
 await page.getByRole('button',{name:/Shanghai.*Hochiminh/}).click();await page.getByRole('heading',{name:'航线汇总'}).waitFor();await page.getByRole('heading',{name:/^直航/}).waitFor();assert.equal(await page.getByText(/直达／中转待确认/).count(),0);
 const download=page.waitForEvent('download');await page.getByRole('button',{name:/导出 Excel/}).click();const file=await download;assert.equal(await file.failure(),null);const {Workbook}=require('exceljs');const wb=new Workbook();await wb.xlsx.readFile(await file.path());assert.equal(wb.getWorksheet('船期明细').rowCount,data.length+1);const sheet=wb.getWorksheet('船期明细');assert.equal(sheet.getColumn(12).values.filter(v=>v==='直航').length,data.filter(r=>r.direct).length);assert.equal(sheet.getColumn(12).values.filter(v=>v==='中转').length,data.filter(r=>!r.direct).length);assert.equal(errors.length,0,errors.join(';'));console.log(JSON.stringify({passed:true,liveRows:data.length,direct:data.filter(r=>r.direct).length,transit:data.filter(r=>!r.direct).length,excelRows:wb.getWorksheet('船期明细').rowCount-1,scope:'real provider to UI and download; database API stubbed'}));
 }finally{await browser.close()}
})().catch(e=>{console.error(e.message);process.exitCode=1});
