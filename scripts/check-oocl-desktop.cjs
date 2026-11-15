const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),ts=require('typescript');
function load(file){const out={};new Function('exports','require',ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText)(out,require);return out;}
const {parseOoclDesktopRows}=load(path.join(__dirname,'../src/features/shipping/providers/oocl/desktop-parser.ts'));
// Production-shaped regression: unpublished SI deadline must not discard an inland itinerary.
const row={routeId:'1',origin:'Shanghai',destination:'Toronto',transitTime:22,transshipmentPort:0,si_cutOff:'TO BE ADVISED',vesselVoyages:[{vesselName:'TEST VESSEL',exVoyageRef:'001E'}],DetailedSchedule:{voyage:[{loadingPort:'Shanghai',dischargePort:'Prince Rupert'}]}};
const route={RouteId:'1',RouteTimeDimensionByCargoNature:[{SiCutoffLocalDateTime:{dateStr:'TO BE ADVISED'}}],Legs:[{Type:'Voyage',FromETDLocalDateTime:{dateStr:'20261115132706.000'},ToETALocalDateTime:{dateStr:'20261128090000.000'}},{Type:'InboundIntermodal',CargoAvailabilityLocalDateTime:{dateStr:'20261207090000.000'}}]};
const context={originCode:'CNSHA',originName:'Shanghai',destinationName:'Toronto'};
const [r]=parseOoclDesktopRows([row],'2026-11-15','2026-12-12','CATOR',[route],context);
assert.equal(r.eta,null);assert.equal(r.siCutOffTime,null);assert.equal(r.availableTime,'2026-12-07T09:00:00.000Z');assert.equal(r.transitDays,22);
assert.throws(()=>parseOoclDesktopRows([row],'2026-11-15','2026-12-12','DEHAM',[route],{...context,destinationName:'Hamburg'}),/PORT_MISMATCH/);
assert.equal(parseOoclDesktopRows([row],'2026-11-16','2026-12-12','CATOR',[route],context).length,0);
console.log('PASS OOCL unpublished SI deadline, inland availability never becomes ETA, exact destination and date scope');

const lb={...row,destination:'Long Beach'};
const beach=parseOoclDesktopRows([lb],'2026-11-15','2026-12-12','USLAX',[route],{...context,destinationName:'Los Angeles'});
assert.equal(beach[0].destinationLocode,'USLGB');
assert.throws(()=>parseOoclDesktopRows([lb],'2026-11-15','2026-12-12','DEHAM',[route],{...context,destinationName:'Hamburg'}),/PORT_MISMATCH/);
const {transitEvidence}=load(path.join(__dirname,'../src/features/schedules/server/transit-evidence.ts'));
const raw='Official Desktop Transfers: '+JSON.stringify([{portName:'Busan',arrivalTime:'2026-11-20T12:00:00Z',departureTime:'2026-11-21T13:00:00Z',nextVesselName:'NEXT VESSEL',nextVoyageNumber:'002W'}]);
const [node]=transitEvidence('OOCL_LIVE_QUERY',raw);
assert.equal(node.portName,'Busan');assert.equal(node.arrivalTime,'2026-11-20T12:00:00');assert.equal(node.nextVoyageNumber,'002W');
console.log('PASS official LA query retains Long Beach with its own code; desktop transfer times/vessel round trip');
