const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
function load(file) {
  const out = {};
  new Function('exports', 'require', ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText)(out, name => name.startsWith('@/') ? load(path.join(__dirname, '../src', name.slice(2) + '.ts')) : name.startsWith('.') ? load(path.resolve(path.dirname(file), name) + '.ts') : require(name));
  return out;
}

// Writes ONLY to the isolated local test database; never loads .env.
const assert=require('node:assert/strict');
assert.equal(process.env.DATABASE_URL,'mysql://root@127.0.0.1:33379/oceanscope_expanded_test');
(async()=>{
 const {prisma}=load(path.join(__dirname,'../src/lib/prisma.ts'));
 try{
 await prisma.sailingSchedule.deleteMany({where:{source:{in:['EMC_LIVE_QUERY','YML_LIVE_QUERY','HMM_LIVE_QUERY','KMTC_LIVE_QUERY','PIL_LIVE_QUERY','SITC_LIVE_QUERY']}}});
 const ports={};for(const [code,name]of [['CNSHA','Shanghai'],['USLAX','Los Angeles'],['USLGB','Long Beach'],['CNTAO','Qingdao'],['SGSIN','Singapore'],['JPTYO','Tokyo']])ports[code]=await prisma.port.upsert({where:{locode:code},update:{},create:{name,locode:code,country:code.slice(0,2),region:'test'}});
 const {saveCoscoSchedules}=load(path.join(__dirname,'../src/features/cosco-scraper/server/save-cosco-schedules.ts'));
 const {mapSchedule,scheduleInclude}=load(path.join(__dirname,'../src/features/schedules/server/schedule-mapper.ts'));
 const from=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date()),to=new Date(Date.parse(from)+28*86400000).toISOString().slice(0,10);
 for(const [code,origin,dest]of [['EMC','CNSHA','USLAX'],['YML','CNSHA','USLAX'],['HMM','CNSHA','USLAX'],['KMTC','CNTAO','SGSIN'],['PIL','CNTAO','SGSIN'],['SITC','CNSHA','JPTYO']]){
 const provider=load(path.join(__dirname,'../src/features/shipping/providers',code.toLowerCase(),'provider.ts'))[code+'Provider'];const result=await provider.searchSchedule({originPort:ports[origin],destinationPort:ports[dest],departureDate:from,dateTo:to});assert.equal(result.fromCache,false);assert(result.schedules.length>0,code+': '+result.warnings.join(';'));
 const saved={created:0,updated:0,skipped:0};for(const actual of [...new Set(result.schedules.map(r=>r.destinationLocode))]){const group=result.schedules.filter(r=>r.destinationLocode===actual);const part=await saveCoscoSchedules(group,{mode:'updateDuplicates',source:code+'_LIVE_QUERY',carrierCode:code,carrierName:result.schedules[0].carrierName,originPort:ports[origin],destinationPort:ports[actual]});saved.created+=part.created;saved.updated+=part.updated;saved.skipped+=part.skipped;}assert.equal(saved.skipped,0,code+': unexpectedly dropped real rows');

 const rows=await prisma.sailingSchedule.findMany({where:{source:code+'_LIVE_QUERY'},include:scheduleInclude});const mapped=rows.map(mapSchedule);assert.equal(mapped.length,result.schedules.length,code+": routing variants lost");assert(mapped.every(r=>r.carrierCode===code));console.log(JSON.stringify({code,liveCount:result.schedules.length,saved,uiRows:mapped.length,fromCache:false}));
 }
 }finally{await prisma.$disconnect()}
})().catch(e=>{console.error(e.message);process.exitCode=1});
