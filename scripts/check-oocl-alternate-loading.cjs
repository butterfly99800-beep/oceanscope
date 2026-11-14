const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
function load(file, dependencies) {
  const target = {};
  const source = fs.readFileSync(path.join(__dirname, '../src/features', file), 'utf8');
  const js = ts.transpileModule(source, {compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
  new Function('exports', 'require', js)(target, name => dependencies[name] || (name === 'node:crypto' ? require(name) : {}));
  return target;
}
const details = [
  'Origin:\tQingdao', 'Vessel Voyage:\tTENG YUN HE 426S', 'POL:\tRizhao',
  'Estimated Departure:\t08 Nov (Sun)', 'POD:\tKaohsiung', 'Estimated Arrival:\t13 Nov (Fri)',
  'Final Destination Hub:\tYokohama', 'Estimated Arrival:\t28 Nov (Sat)'
].join('\n');
const { OOCLProvider } = load('shipping/providers/oocl/provider.ts', {
  '@/features/ports/server/source-port-match': load('ports/server/source-port-match.ts', {}),
  './itinerary': load('shipping/providers/oocl/itinerary.ts', {}),
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

const { mergeOoclCargoVariants } = load('shipping/providers/oocl/itinerary.ts', {});
const cargoBase = {id:'dry',vesselName:'FIRST',voyageNumber:'001E',originText:'Yantian',destinationText:'Los Angeles',etd:'2026-11-20',eta:'2026-12-07',serviceName:'A',transitPorts:[],cargoNature:'DRY',rawText:'POL: Yantian\nPOD: Los Angeles\nCargo Nature: DRY\nVessel Voyage: FIRST 001E'};
const cargoOther={...cargoBase,id:'reefer',cargoNature:'DRY / REEFER',rawText:cargoBase.rawText.replace('Cargo Nature: DRY','Cargo Nature: DRY / REEFER')};
assert.equal(mergeOoclCargoVariants([cargoBase,cargoOther]).length,1);
assert.equal(mergeOoclCargoVariants([cargoBase,cargoOther])[0].cargoNature,'DRY / REEFER');
assert.equal(mergeOoclCargoVariants([cargoBase,{...cargoOther,rawText:cargoOther.rawText+'\nVessel Voyage: SECOND 002E'}]).length,2);
assert.equal(mergeOoclCargoVariants([cargoBase,{...cargoOther,destinationText:'Long Beach'}]).length,2);
assert.equal(mergeOoclCargoVariants([cargoBase,{...cargoOther,eta:'2026-12-08'}]).length,2);

assert.equal(mergeOoclCargoVariants([cargoBase,cargoOther])[0].id,mergeOoclCargoVariants([cargoOther,cargoBase])[0].id);
