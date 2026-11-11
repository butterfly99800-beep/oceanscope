// Run providers from the application without a separate TypeScript runtime.
// This calls real public services; it never writes schedule rows to the database.
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
const root = path.resolve(__dirname, '..');
require('@next/env').loadEnvConfig(root);
const resolveFilename = Module._resolveFilename;
Module._resolveFilename = function (request, parent, ...args) {
  return resolveFilename.call(this, request.startsWith('@/') ? path.join(root, 'src', request.slice(2)) : request, parent, ...args);
};
require.extensions['.ts'] = (module, filename) => {
  const source = fs.readFileSync(filename, 'utf8');
  module._compile(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText, filename);
};
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const codes=['COSCO','OOCL','CMA','MAERSK','HAPAG','MSC','ONE','EMC','YML','HMM','KMTC','PIL','SITC','ZIM'];
const routes=[['CNSHA','VNSGN'],['CNSHA','SGSIN'],['CNQIN','USSAV'],['CNSHA','CATOR'],['CNYTN','USLAX']];
const out=process.env.OCEANSCOPE_MATRIX_OUTPUT;if(!out)throw Error('Set OCEANSCOPE_MATRIX_OUTPUT');
const rounds=Number(process.env.OCEANSCOPE_MATRIX_ROUNDS||30);if(!Number.isInteger(rounds)||rounds<1||rounds>100)throw Error('rounds must be 1..100');
const departureDate=process.env.OCEANSCOPE_MATRIX_DATE||new Date().toISOString().slice(0,10);if(!/^\d{4}-\d{2}-\d{2}$/.test(departureDate)||!Number.isFinite(Date.parse(departureDate)))throw Error('invalid date');if(new Date(departureDate).toISOString().slice(0,10)!==departureDate)throw Error('invalid calendar date');const dateTo=new Date(Date.parse(departureDate)+28*86400000).toISOString().slice(0,10);const results=[];
// Refuse to mix a fresh audit with an earlier run.
fs.closeSync(fs.openSync(out,'wx'));
(async()=>{
 for(let round=1;round<=rounds;round++){
  const [origin,destination]=routes[(round-1)%routes.length];
  const originPort=await prisma.port.findFirstOrThrow({where:{locode:origin}}),destinationPort=await prisma.port.findFirstOrThrow({where:{locode:destination}});
  const queue=[...codes];await Promise.all(Array.from({length:4},async()=>{while(queue.length){const code=queue.shift(),started=Date.now();let row;try{
   const provider=require(path.join(root,'src/features/shipping/providers',code.toLowerCase(),'provider.ts'))[code+'Provider'];
   const result=await provider.searchSchedule({originPort,destinationPort,departureDate,dateTo,mode:'api',forceRefresh:true});
   row={round,code,origin,destination,departureDate,dateTo,at:new Date().toISOString(),count:result.schedules.length,fromCache:result.fromCache,warnings:result.warnings.map(w=>w.split(':')[0]),durationMs:Date.now()-started,transport:result.transport,audit:result.audit,sample:result.schedules.slice(0,1).map(s=>({vessel:s.vesselName,voyage:s.voyageNumber,etd:s.etd,eta:s.eta,origin:s.originLocode,destination:s.destinationLocode}))};
  }catch(e){row={round,code,origin,destination,departureDate,dateTo,count:0,error:e.name,durationMs:Date.now()-started};}
  results.push(row);fs.appendFileSync(out,JSON.stringify(row)+'\n');
 }}));console.log(JSON.stringify({round,origin,destination,positive:results.filter(r=>r.round===round&&r.count>0).length,total:codes.length}));
 }
})().catch(e=>{console.error(e.message);process.exitCode=1}).finally(async()=>{await prisma.$disconnect();await require(path.join(root,'src/lib/prisma.ts')).prisma.$disconnect()});
