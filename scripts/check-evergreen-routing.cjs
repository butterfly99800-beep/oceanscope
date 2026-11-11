// Anonymous live probes: no database, .env, or OceanScope schedule cache.
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
function load(file) {
  const out = {};
  new Function('exports', 'require', ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { esModuleInterop: true, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText)(out, name => name.startsWith('@/') ? load(path.join(__dirname, '../src', name.slice(2) + '.ts')) : name.startsWith('.') ? load(path.resolve(path.dirname(file), name) + '.ts') : require(name));
  return out;
}

const assert=require('node:assert/strict');
const {evergreenDirectLeg,EMCProvider}=load(path.join(__dirname,'../src/features/shipping/providers/emc/provider.ts'));
const leg=['1','SHANGHAI','LONG BEACH, CA','NOV-15-2026','NOV-26-2026','PCC1','COSCO BELGIUM 089E','11'];
assert.equal(evergreenDirectLeg([leg],'SHANGHAI','LONG BEACH, CA'),true);
assert.equal(evergreenDirectLeg([leg],'SHANGHAI','LOS ANGELES, CA'),null);
assert.equal(evergreenDirectLeg(undefined,'SHANGHAI','LOS ANGELES, CA'),null);
assert.equal(evergreenDirectLeg([[...leg.slice(0,5),'Intermodal','----','0']],'SHANGHAI','LONG BEACH, CA'),null);
console.log('PASS: explicit single sea leg, actual discharge scope, missing and inland legs stay unconfirmed');
if(process.argv.includes('--live')) (async()=>{const r=await EMCProvider.searchSchedule({originPort:{id:'CNSHA',name:'Shanghai',locode:'CNSHA'},destinationPort:{id:'USLAX',name:'Los Angeles',locode:'USLAX'},departureDate:'2026-11-08',dateTo:'2026-12-06'});assert(r.schedules.length>0);console.log(JSON.stringify({fromCache:r.fromCache,count:r.schedules.length,direct:r.schedules.filter(x=>x.direct===true).length,unknown:r.schedules.filter(x=>x.direct===null).length,destinations:[...new Set(r.schedules.map(x=>x.destinationLocode))],warnings:r.warnings}));})().catch(e=>{console.error(e.message);process.exitCode=1});

const {evergreenRouting}=load(path.join(__dirname,'../src/features/shipping/providers/emc/provider.ts'));
const first=['1','QINGDAO','PUSAN','NOV-21-2026','NOV-23-2026','NUE2','COSCO HAMBURG 299E','2'];
const wait=['2','PUSAN','PUSAN','NOV-23-2026','NOV-24-2026','WAITING','----','1'];
const next=['3','PUSAN','SAVANNAH','NOV-24-2026','DEC-24-2026','NUE2','COSCO SHIPPING CAMELLIA 036E','30'];
assert.deepEqual(evergreenRouting([first,wait,next],'QINGDAO','SAVANNAH'),{direct:false,stopCount:1});
assert.equal(evergreenRouting([first,{...next,1:'SINGAPORE'}],'QINGDAO','SAVANNAH').direct,null);
assert.equal(evergreenRouting([first,[...wait.slice(0,2),'SINGAPORE',...wait.slice(3)],next],'QINGDAO','SAVANNAH').direct,null);
