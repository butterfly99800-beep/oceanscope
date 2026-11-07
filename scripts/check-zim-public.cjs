// Anonymous live probes: no database, .env, or OceanScope schedule cache.
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
function load(file) {
  const out = {};
  new Function('exports', 'require', ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { esModuleInterop: true, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText)(out, name => name.startsWith('@/') ? load(path.join(__dirname, '../src', name.slice(2) + '.ts')) : name.startsWith('.') ? load(path.resolve(path.dirname(file), name) + '.ts') : require(name));
  return out;
}

const assert=require('node:assert/strict');const {mapZimPdf,ZIMProvider}=load(path.join(__dirname,'../src/features/shipping/providers/zim/provider.ts'));
const fixture='2026 Nov. SCHEDULE\nZIM CENTRAL CHINA XPRESS (ZX2)\nETD\nSHANGHAI\nLOS ANGELES\nHAWK I V.18E(ZK2/18E) 10-Nov 24-Nov\nPELICAN I V.18E(ZP1/18E) 17-Nov 1-Dec\n';
const mapped=mapZimPdf(fixture,'CNSHA','USLAX','2026-11-07','2026-12-05','https://www.zim.com/test.pdf');assert.equal(mapped.length,2);assert.equal(mapped[1].eta,'2026-12-01T00:00:00.000Z');assert.equal(mapped[0].transitDays,null);assert.equal(mapped[0].direct,null);assert.equal(mapZimPdf(fixture,'CNSHA','USLGB','2026-11-07','2026-12-05','x').length,0);assert.throws(()=>mapZimPdf(fixture.replace(' 10-Nov 24-Nov',' 10-Nov'),'CNSHA','USLAX','2026-11-07','2026-12-05','x'),/columns changed/);console.log('PASS: ZIM official date columns, missing fields, strict port matching and fail-closed layout changes');
if(process.argv.includes('--live'))(async()=>{for(const [code,name]of [['CNSHA','Shanghai'],['CNYTN','Yantian']]){let r=await ZIMProvider.searchSchedule({originPort:{id:code,locode:code,name},destinationPort:{id:'USLAX',locode:'USLAX',name:'Los Angeles'},departureDate:'2026-11-07',dateTo:'2026-12-05'});console.log(JSON.stringify({origin:code,count:r.schedules.length,warnings:r.warnings,samples:r.schedules.map(s=>({vessel:s.vesselName,voyage:s.voyageNumber,etd:s.etd,eta:s.eta})),fromCache:r.fromCache}));assert(r.schedules.length>0)}})().catch(e=>{console.error(e.message);process.exitCode=1});
