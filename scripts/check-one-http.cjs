const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
function load(file) {
  const out = {};
  new Function('exports', 'require', ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText)(out, name => {
    if (name.startsWith('@/')) return load(path.join(__dirname, '../src', name.slice(2) + '.ts'));
    if (name.startsWith('.')) return load(path.resolve(path.dirname(file), name) + '.ts');
    return require(name);
  });
  return out;
}
const one = load(path.join(__dirname, '../src/features/shipping/providers/one/provider.ts'));
const row = {porCode:'CNYTN01',delCode:'USLGB02',porName:'YANTIAN',delName:'LONG BEACH',polDepartureDateTime:'2099-01-03 08:00',delArrivalDate:'2099-01-20',sailInfo:[{vsslName:'TEST VESSEL',vvdName:'TEST VESSEL 001E',arrivalDate:'2099-01-20 12:30'}]};
const map = rows => one.mapOneSchedules({scheduleLines:rows},'CNYTN','USLAX','2099-01-01','2099-01-31');
const result = map([row,row]);
assert.equal(result.length,1);
assert.equal(result[0].destinationLocode,'USLGB');
assert.equal(result[0].voyageNumber,'001E');
for (const key of ['direct','stopCount','transitDays','cutOffTime','availableTime','serviceName']) assert.equal(result[0][key],null);
assert.equal(result[0].eta,'2099-01-20T12:30:00.000Z');
assert.equal(map([{...row,delCode:'USOAK01'}]).length,0);
assert.equal(map([{...row,porCode:'CNSHK01'}]).length,0);
assert.equal(map([{...row,polDepartureDateTime:'2099-02-01 12:00'}]).length,0);
assert.equal(one.oneDate('2099-02-30'),null);
assert.throws(()=>one.mapOneSchedules({error:'blocked'},'CNYTN','USLAX','2099-01-01','2099-01-31'));
(async()=>{
 const original = global.fetch; const calls=[];
 global.fetch=async url=>{calls.push(url);return new Response(JSON.stringify(url.includes('/search?')?{points:[{code:new URL(url).searchParams.get('pointName'),termCd:'Y',name:'official'}]}:{scheduleLines:[row]}),{status:200})};
 try {
 const r=await one.ONEProvider.searchSchedule({originPort:{id:'a',name:'Yantian',locode:'CNYTN'},destinationPort:{id:'b',name:'Los Angeles',locode:'USLAX'},departureDate:'2099-01-01',dateTo:'2099-01-31'});
 assert.equal(r.schedules.length,1);assert.equal(calls.length,3);assert.equal(new URL(calls[2]).searchParams.get('tsFlag'),'');assert.equal(r.fromCache,false);
 global.fetch=async()=>new Response(JSON.stringify({points:[]}),{status:200});
 const absent=await one.ONEProvider.searchSchedule({originPort:{id:'a',name:'unknown',locode:'ZZZZZ'},destinationPort:{id:'b',name:'unknown',locode:'ZZZZZ'},departureDate:'2099-01-01'});
 assert.equal(absent.schedules.length,0);assert(absent.warnings.some(x=>x.includes('ONE_PORT_NOT_FOUND')));
 } finally {global.fetch=original;}
 console.log('PASS: ONE HTTP first, exact official codes, Long Beach retention, no fabricated fields, invalid data rejected');
})().catch(error=>{console.error(error);process.exitCode=1});
