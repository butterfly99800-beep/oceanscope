const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
function load(file) {
  const out = {};
  new Function('exports', 'require', ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { esModuleInterop: true, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText)(out, name => name.startsWith('@/') ? load(path.join(__dirname, '../src', name.slice(2) + '.ts')) : name.startsWith('.') ? load(path.resolve(path.dirname(file), name) + '.ts') : require(name));
  return out;
}


const assert=require('node:assert/strict');assert.equal(process.env.DATABASE_URL,'mysql://root@127.0.0.1:33379/oceanscope_expanded_test');
(async()=>{const {prisma}=load(path.join(__dirname,'../src/lib/prisma.ts'));try{
 const {saveCoscoSchedules}=load(path.join(__dirname,'../src/features/cosco-scraper/server/save-cosco-schedules.ts'));
 const {mapSchedule,scheduleInclude}=load(path.join(__dirname,'../src/features/schedules/server/schedule-mapper.ts'));
 const origin=await prisma.port.findUniqueOrThrow({where:{locode:'CNSHA'}});
 const ports=await prisma.port.findMany();
 const destFor=r=>ports.find(p=>r.destinationLocode ? p.locode===r.destinationLocode : p.name.toLowerCase()===r.destinationText.split(',')[0].trim().toLowerCase());
 for(const code of ['MAERSK','HAPAG','HMM','COSCO','OOCL']){
 const rows=JSON.parse(fs.readFileSync(path.join(process.env.OCEANSCOPE_AUDIT_UI_DIR,code+'-routing-ui.json'),'utf8'));
 for(const actual of [...new Set(rows.map(r=>destFor(r)?.id))]){assert(actual,'Unknown actual destination');const destination=ports.find(p=>p.id===actual);const result=await saveCoscoSchedules(rows.filter(r=>destFor(r)?.id===actual),{mode:'updateDuplicates',source:code+'_LIVE_QUERY',carrierCode:code,carrierName:code,originPort:origin,destinationPort:destination});assert.equal(result.skipped,0);}
 const stored=await prisma.sailingSchedule.findMany({where:{source:code+'_LIVE_QUERY'},include:scheduleInclude});
 for(const row of rows){const saved=stored.find(s=>s.sourceReference?.endsWith(row.id)) || stored.find(s=>{const m=mapSchedule(s);return m.vesselName===row.vesselName && m.voyageNumber===row.voyageNumber && m.etd===row.etd && m.destinationPortCode===row.destinationLocode;});assert(saved,code+': missing '+row.id);assert.equal(mapSchedule(saved).direct,row.direct);}
 console.log(JSON.stringify({code,saved:rows.length,classificationReadBack:true}));
 }
}finally{await prisma.$disconnect()}})().catch(e=>{console.error(e.message);process.exitCode=1});
