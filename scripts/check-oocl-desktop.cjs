const fs=require('fs'),ts=require('typescript'),Module=require('module'),path=require('path'),assert=require('assert/strict');
function load(file){const f=path.resolve(__dirname,'../src/features/shipping/providers/oocl/'+file+'.ts'),m=new Module(f,module);m.filename=f;m.paths=Module._nodeModulePaths(path.dirname(f));m._compile(ts.transpileModule(fs.readFileSync(f,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText,f);return m.exports;}
const {parseOoclDesktopRows}=load('desktop-parser'),{mergeOoclCargoVariants}=load('itinerary');
const row={routeId:'1',origin:'Shanghai',destination:'Los Angeles',dateETD:'2026-11-16T02:00:00Z',dateETA:'2026-11-27T09:00:00Z',transitTime:11,transshipmentPort:0,cargo_nature:{name:'Dry'},services:[{serviceName:'TEST'}],vesselVoyages:[{vesselName:'TEST VESSEL',exVoyageRef:'001E'}],DetailedSchedule:{voyage:[{loadingPort:'Shanghai',dischargePort:'Los Angeles'}]}};
const raw={RouteId:'1',Legs:[{Type:'Voyage',FromETDLocalDateTime:{dateStr:'20261116100000.000'},ToETALocalDateTime:{dateStr:'20261127170000.000'}}]};
const b={...row,routeId:'2',cargo_nature:{name:'Dry/Reefer'}};
const rows=parseOoclDesktopRows([row,b],'2026-11-15','2026-12-12','USLAX',[raw,{...raw,RouteId:'2'}]);assert.equal(rows[0].etd,'2026-11-16T10:00:00.000Z');assert.equal(rows[0].transitDays,11);assert.equal(mergeOoclCargoVariants(rows).length,1);
assert.equal(parseOoclDesktopRows([row],'2026-11-17','2026-12-12','USLAX',[raw]).length,0);
assert.equal(parseOoclDesktopRows([row],'2026-11-15','2026-12-12','USLGB',[raw]).length,0);
assert.throws(()=>parseOoclDesktopRows([row],'2026-11-15','2026-12-12','USLAX',[]),/ROUTE_MISSING/);
const lb={...row,destination:'Long Beach'};assert.equal(parseOoclDesktopRows([lb],'2026-11-15','2026-12-12','USLGB',[raw])[0].destinationLocode,'USLGB');
console.log('PASS OOCL desktop exact local dates, official duration, route association, range/port filtering and cargo-only duplicates');
