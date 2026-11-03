const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
function load(file, dependencies) {
  const target = {};
  const source = fs.readFileSync(path.join(__dirname, '../src/features', file), 'utf8');
  const js = ts.transpileModule(source, {compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
  new Function('exports', 'require', js)(target, name => dependencies[name] || {});
  return target;
}
const details = [
  'Origin:\tQingdao', 'Vessel Voyage:\tTENG YUN HE 426S', 'POL:\tRizhao',
  'Estimated Departure:\t08 Nov (Sun)', 'POD:\tKaohsiung', 'Estimated Arrival:\t13 Nov (Fri)',
  'Final Destination Hub:\tYokohama', 'Estimated Arrival:\t28 Nov (Sat)'
].join('\n');
const { OOCLProvider } = load('shipping/providers/oocl/provider.ts', {
  '@/features/ports/server/source-port-match': load('ports/server/source-port-match.ts', {}),
  './http': { queryOoclHttp: async () => ({texts: [details, details.replace('Qingdao','Shanghai'),
    details.replace('Yokohama','Tokyo'), details.replace('08 Nov','08 Dec')], warnings: []}) }
});
delete process.env.OOCL_USE_LOCAL_WORKER;
(async () => {
  const result = await OOCLProvider.searchSchedule({ originPort:{name:'Qingdao',locode:'CNQIN'},
    destinationPort:{name:'Yokohama',locode:'JPYOK'}, departureDate:'2026-11-03', dateTo:'2026-12-01' });
  assert.equal(result.schedules.length,1);
  const row = result.schedules[0].alternateLoading;
  assert.equal(row.origin,'Qingdao');
  assert.equal(row.loadingPort,'Rizhao');
  assert.equal(row.departure.slice(0,10),'2026-11-08');
  assert.equal(row.arrival.slice(0,10),'2026-11-28');
  console.log('PASS: alternate loading port keeps sea departure and final hub arrival, rejects other cities and dates');
})().catch(error=>{console.error(error);process.exitCode=1});
