const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
function load(file) {
  const out = {};
  new Function('exports', 'require', ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText)(out, name => name.startsWith('@/') ? load(path.join(__dirname, '../src', name.slice(2) + '.ts')) : name.startsWith('.') ? load(path.resolve(path.dirname(file), name) + '.ts') : require(name));
  return out;
}

const assert=require('node:assert/strict');
(async()=>{
 const api=fs.readFileSync(path.join(__dirname,'../src/app/api/schedules/search/route.ts'),'utf8');const section=api.slice(api.indexOf('function latestScheduleSnapshots'),api.indexOf('function sourceMatchesPorts'));const exported={};new Function('exports',ts.transpileModule('export '+section,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText)(exported);const base={source:'YML_LIVE_QUERY',originPortId:'a',destinationPortId:'b',vesselName:'ship',voyageNumber:'001',serviceName:'s',frequency:null,updatedAt:new Date(),rawSourceData:'{}'};assert.equal(exported.latestScheduleSnapshots([{...base,id:'1',sourceReference:'a'},{...base,id:'2',sourceReference:'b'}]).length,2,'API must retain different onward routings');
 const {publishedDate}=load(path.join(__dirname,'../src/features/shipping/providers/public-http.ts'));
 assert.equal(publishedDate('2026-02-30'),null);assert.equal(publishedDate('Contact local office'),null);
 const {mapHmm}=load(path.join(__dirname,'../src/features/shipping/providers/hmm/provider.ts'));
 const route={porLocCd:'CNSHA',pvyLocCd:'USLGB',porLocNm:'Shanghai',pvyLocNm:'Long Beach',totTrstmHrs:338,transit:[{orgLocCd:'CNSHA',destnLocCd:'USLGB',arvlStDt:'2026-11-15 14:00',dpartFnshDt:'2026-11-29 16:00',trsPtnModeCd:'MM',vslNm:'SM BUSAN',cssmObVoyNo:'2607E'}]};
 const rows=mapHmm({grmData:[route]},'CNSHA','USLAX','2026-11-07','2026-12-05');assert.equal(rows.length,1);assert.equal(rows[0].destinationLocode,'USLGB');assert.equal(rows[0].transitDays,null);assert.equal(mapHmm({grmData:[route]},'CNTAO','USLAX','2026-11-07','2026-12-05').length,0);
 const {createScheduleWorkbook,scheduleGroups}=load(path.join(__dirname,'../src/features/schedules/schedule-export.ts'));
 const input=[{...rows[0],carrier:'HMM',originPort:'Shanghai',originPortCode:'CNSHA',destinationPort:'Long Beach',destinationPortCode:'USLGB',terminal:null,destinationTerminal:null,lastUpdated:'2026-11-07T00:00:00Z',source:'HMM_LIVE_QUERY'}, {...rows[0],id:'different',carrier:'=1+1',direct:null,originPort:'Shanghai',destinationPort:'Long Beach',transitDays:null}];
 const book=await createScheduleWorkbook(input);const buffer=await book.xlsx.writeBuffer();const {Workbook}=require('exceljs');const read=new Workbook();await read.xlsx.load(buffer);const sheet=read.getWorksheet('船期明细');assert.equal(sheet.rowCount,3);assert.equal(sheet.getCell('E2').value,'USLGB');assert.equal(sheet.getCell('K2').value,null);assert.equal(sheet.getCell('I2').value,'2026-11-15 14:00');assert.equal(sheet.getCell('A3').value,'=1+1');assert.equal(sheet.getCell('A3').type,3);assert.equal(read.worksheets.length,2);assert.equal(scheduleGroups(input).length,2);console.log('PASS: official date validation, actual Long Beach identity, no fabricated fractional days, Excel round-trip, missing fields blank, formula-looking data stays text, overview groups');
})().catch(e=>{console.error(e);process.exitCode=1});
