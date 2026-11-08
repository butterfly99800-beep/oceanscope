const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const out = {};
new Function('exports','require',ts.transpileModule(fs.readFileSync(path.join(__dirname,'../src/features/shipping/providers/oocl/loop-schedules.ts'),'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,esModuleInterop:true}}).outputText)(out,require);
const table = `Last Update Date: 25-Dec-2026
Vessel Name TEST A Vessel Name TEST B
Vessel/Voyage AAA/001 Vessel/Voyage BBB/002
Port Arr--Dep Port Arr--Dep
Shanghai 28--30 Dec Ningbo 25--26 Dec
Long Beach 10--11 Jan Los Angeles 08--10 Jan`;
const shanghai = {name:'Shanghai',locode:'CNSHA'}, longBeach = {name:'Long Beach',locode:'USLGB'}, losAngeles = {name:'Los Angeles',locode:'USLAX'};
const rows = out.parseLoop(table,'PCC1',shanghai,longBeach,'2026-12-01','2026-12-31');
assert.equal(rows.length,1);
assert.equal(rows[0].vesselName,'TEST A');assert.equal(rows[0].direct,true);assert.equal(rows[0].stopCount,0);
assert.equal(rows[0].eta.slice(0,10),'2027-01-10');
assert.equal(rows[0].etdTimeKnown,false);
assert.equal(out.parseLoop(table,'PCC1',shanghai,losAngeles,'2026-12-01','2026-12-31').length,0);
assert.equal(out.parseLoop(table.replace('Long Beach 10--11 Jan Los Angeles 08--10 Jan','Long Beach 10--11 Jan'),'PCC1',shanghai,longBeach,'2026-12-01','2026-12-31').length,0);
console.log('PASS: OOCL publication date, calendar rollover, vessel columns and incomplete rows');

assert.equal(out.parseLoop(table,'PCC1',{name:'Ningbo',locode:'CNNGB'},losAngeles,'2026-12-01','2026-12-31')[0].vesselName,'TEST B');
