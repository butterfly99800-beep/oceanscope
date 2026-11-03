// Read-only live provider probe. Does not load .env, connect to MySQL, or use schedule cache.
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
function load(file) {
  const out = {};
  new Function('exports', 'require', ts.transpileModule(fs.readFileSync(file, 'utf8'), {compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText)(out, name => name.startsWith('@/') ? load(path.join(__dirname, '../src', name.slice(2)+'.ts')) : name.startsWith('.') ? load(path.resolve(path.dirname(file), name)+'.ts') : require(name));
  return out;
}
const {ONEProvider} = load(path.join(__dirname, '../src/features/shipping/providers/one/provider.ts'));
const from = process.argv[2] || new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
(async()=>{
  const to = new Date(new Date(from).getTime()+28*86400000).toISOString().slice(0,10);
  for (const [origin,destination] of [['CNYTN','USLAX'],['CNSHA','NLRTM'],['CNNGB','DEHAM'],['CNTAO','SGSIN']]) {
    const result=await ONEProvider.searchSchedule({originPort:{id:origin,name:origin,locode:origin},destinationPort:{id:destination,name:destination,locode:destination},departureDate:from,dateTo:to});
    console.log(JSON.stringify({origin,destination,from,to,count:result.schedules.length,longBeach:result.schedules.filter(row=>row.destinationLocode==='USLGB').length,durationMs:result.durationMs,fromCache:result.fromCache,warnings:result.warnings}));
    if(result.warnings.some(w=>w.includes('QUERY_FAILED')))process.exitCode=1;
  }
})().catch(error=>{console.error(error.message);process.exitCode=1});
