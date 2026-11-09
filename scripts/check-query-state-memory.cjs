const assert=require('node:assert/strict');
const fs=require('node:fs');const ts=require('typescript');const api={};
new Function('exports',ts.transpileModule(fs.readFileSync('src/features/schedules/lib/pruneQueryStates.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText)(api);
const states=new Map(Array.from({length:1000},(_,i)=>[String(i),{done:true,startedAt:i}]));
states.set('active',{done:false,startedAt:0});states.set('polling',{done:true,startedAt:0});
api.pruneQueryStates(states,1000,10000,'polling');assert.equal(states.size,202);assert(states.has('active'));assert(states.has('polling'));assert(states.has('999'));assert(!states.has('0'));
api.pruneQueryStates(states,20000,10000,'polling');assert.equal(states.size,2);
console.log('PASS completed query state cap/expiry, active jobs and current polling retained');
