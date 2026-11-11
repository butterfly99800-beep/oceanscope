const fs=require('node:fs'),path=require('node:path'),ts=require('typescript'),assert=require('node:assert/strict');
let httpCalls=0,formCalls=0,closed=0,behavior='fail';
const fakeContext={dispose:async()=>{}};
function load(file){const out={};new Function('exports','require',ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText)(out,name=>{
 if(name==='playwright')return {request:{newContext:async()=>fakeContext}};
 if(name==='./public-browser')return {launchPublicBrowser:async()=>({newContext:async()=>({newPage:async()=>({setDefaultTimeout(){}})}),close:async()=>{closed++}})};
 if(name==='./live-date-window')return {liveDateWindow:()=>({from:'2026-11-11',expired:false})};
 return name.startsWith('.')?load(path.resolve(path.dirname(file),name)+'.ts'):require(name);
});return out;}
(async()=>{const {publicProvider}=load(path.join(__dirname,'../src/features/shipping/providers/public-http.ts'));const {auditedSchedules}=load(path.join(__dirname,'../src/features/shipping/providers/query-audit.ts'));
 const provider=publicProvider('TEST','https://official.invalid',async()=>{httpCalls++;if(behavior==='empty')return [];throw Error(behavior==='rate'?'RATE_LIMITED':'RESPONSE_INVALID');},async()=>{formCalls++;return auditedSchedules([{id:'official-row'}],2,{invalid:1});});
 const input={originPort:{id:'a',name:'A',locode:'CNSHA'},destinationPort:{id:'b',name:'B',locode:'VNSGN'},departureDate:'2026-11-11'};
 const result=await provider.searchSchedule(input);assert.equal(httpCalls,1);assert.equal(formCalls,1);assert.equal(result.transport,'browser-form');assert.equal(result.audit.received,2);assert.equal(result.audit.complete,false);assert(result.warnings.some(w=>w.includes('COUNT_RECONCILIATION_INCOMPLETE')));assert.equal(closed,1);
 behavior='empty';await provider.searchSchedule(input);assert.equal(formCalls,1,'authoritative empty does not trigger browser');behavior='rate';await provider.searchSchedule(input);assert.equal(formCalls,1,'rate limit does not trigger browser');
 const unknown=auditedSchedules([],0,{});assert.equal(unknown.audit.complete,null,'no advertised total must remain unknown');
 const {collectOfficialPages}=load(path.join(__dirname,'../src/features/shipping/providers/official-pages.ts'));
 const many=await collectOfficialPages(async p=>({data:Array.from({length:p<=11?100:17},(_,i)=>(p-1)*100+i),recordsFiltered:1117}));assert.equal(many.length,1117);
 await assert.rejects(()=>collectOfficialPages(async()=>({data:[1],recordsFiltered:2})),/repeated/);
 await assert.rejects(()=>collectOfficialPages(async()=>({data:[],recordsFiltered:2})),/mismatch/);
 await assert.rejects(()=>collectOfficialPages(async p=>({data:[p],recordsFiltered:p+1})),/changed/);
 console.log('PASS pagination beyond ten pages, repeated/empty/changing totals rejected');
 console.log('PASS form fallback: HTTP first, explicit browser form, incomplete count warning, close browser, no retry of genuine empty/429, unknown totals retained');
})().catch(e=>{console.error(e);process.exitCode=1});
