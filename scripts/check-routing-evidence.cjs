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
const {classifySeaRouting}=load(path.join(__dirname,'../src/features/shipping/providers/routing-evidence.ts'));
const one={sea:true,from:'CNSHA',to:'KRPUS',vessel:'A'};
assert.equal(classifySeaRouting([one],'CNSHA','KRPUS').direct,true);
assert.equal(classifySeaRouting([one,{sea:true,from:'KRPUS',to:'USLAX',vessel:'B'}],'CNSHA','USLAX').direct,false);
assert.equal(classifySeaRouting([one,{sea:true,from:'KRPUS',to:'USLAX',vessel:'A'}],'CNSHA','USLAX').direct,true);
assert.equal(classifySeaRouting([one,{sea:false,from:'KRPUS',to:'CATOR'}],'CNSHA','CATOR').direct,null);
assert.equal(classifySeaRouting([one,{sea:true,from:'SGSIN',to:'USLAX',vessel:'B'}],'CNSHA','USLAX').direct,null);
const {mapRoute}=load(path.join(__dirname,'../src/features/shipping/providers/hapag/provider.ts'));
const route={placeOfReceipt:'CNSHA',placeOfDelivery:'USLAX',placeOfReceiptDateTime:'2026-11-08T23:30+08:00',placeOfDeliveryDateTime:'2026-11-20T20:00-08:00',legs:[{modeOfTransport:'VESSEL',departureLocation:{unLocationCode:'CNSHA',locationName:'SHANGHAI'},arrivalLocation:{unLocationCode:'USLAX',locationName:'LOS ANGELES'},vesselDetails:{name:'GERNER MAERSK'}}]};
assert.equal(mapRoute(route,0).direct,true);
assert.equal(mapRoute({...route,legs:[{...route.legs[0],modeOfTransport:'RAIL'}]},0).direct,null);
const {parseSchedules}=load(path.join(__dirname,'../src/features/shipping/providers/maersk/provider.ts'));
const carriage={carriageType:'OCEAN',vessel:{vesselName:'GERNER MAERSK'},vesselPortCallStart:{estimatedTimeOfDeparture:'2026-11-08T23:30:00',location:{facility:{facilityCode:'CNSGHY3'}}},vesselPortCallEnd:{estimatedTimeOfArrival:'2026-11-20T18:00:00',location:{facility:{facilityCode:'USLSATM'}}}};
assert.equal(parseSchedules({routings:[{routingLegs:[{carriage}]}]},'Shanghai','Los Angeles','CNSHA','USLAX')[0].direct,true);
const {mapHmm}=load(path.join(__dirname,'../src/features/shipping/providers/hmm/provider.ts'));
const leg={orgLocCd:'CNSHA',destnLocCd:'KRPUS',orgLocNm:'Shanghai',destnLocNm:'Busan',trsPtnModeCd:'MM',arvlStDt:'2026-11-08T12:00:00',dpartFnshDt:'2026-11-12T12:00:00',vslNm:'A'};
const transfer={porLocCd:'CNSHA',pvyLocCd:'USLGB',porLocNm:'Shanghai',pvyLocNm:'Long Beach',fstTrshpPortCd:'KRPUS',transit:[leg,{...leg,orgLocCd:'KRPUS',destnLocCd:'KRPUS',trsPtnModeCd:'TT',vslNm:null},{...leg,orgLocCd:'KRPUS',destnLocCd:'USLGB',vslNm:'B',dpartFnshDt:'2026-11-30T12:00:00'}]};
assert.equal(mapHmm({grmData:[transfer]},'CNSHA','USLAX','2026-11-08','2026-12-06')[0].direct,false);
console.log('PASS routing evidence: actual carrier field shapes, same-vessel calls, transfers, internal terminal code, inland and disconnected exclusions');

const sea=(from,to,name)=>({carriage:{...carriage,vessel:{vesselName:name},vesselPortCallStart:{...carriage.vesselPortCallStart,location:{facility:{facilityCode:from}}},vesselPortCallEnd:{...carriage.vesselPortCallEnd,location:{facility:{facilityCode:to}}}}});
const classified=legs=>parseSchedules({routings:[{routingLegs:legs}]},'Qingdao','Savannah','CNTAO','USSAV')[0];
assert.equal(classified([sea('CNTSTQQ','KRULSDY','A'),sea('KRULSDY','CNNPOMT','A'),sea('CNNPOMT','USSAVGC','B')]).stopCount,1);
assert.deepEqual(classified([sea('CNTSTQQ','KRULSDY','A'),sea('KRULSDY','CNNPOMT','A'),sea('CNNPOMT','USSAVGC','B')]).transitPorts,['CNNPOMT']);
assert.equal(classified([sea('CNTSTQQ','KRULSDY','A'),sea('OTHER','USSAVGC','B')]).direct,null);
assert.equal(classified([sea('CNTSTQQ','USSAVGC','A')]).direct,true);
