// Anonymous live probes: no database, .env, or OceanScope schedule cache.
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
function load(file) {
  const out = {};
  new Function('exports', 'require', ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { esModuleInterop: true, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText)(out, name => name.startsWith('@/') ? load(path.join(__dirname, '../src', name.slice(2) + '.ts')) : name.startsWith('.') ? load(path.resolve(path.dirname(file), name) + '.ts') : require(name));
  return out;
}
const codes = (process.argv[2] || 'EMC,YML,HMM,KMTC,PIL,SITC').split(',');
const from = new Intl.DateTimeFormat('en-CA', {timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
const to = new Date(Date.parse(from) + 28 * 86400000).toISOString().slice(0, 10);
const routes = [ ['CNSHA','Shanghai','USLAX','Los Angeles'], ['CNNGB','Ningbo','DEHAM','Hamburg'], ['CNTAO','Qingdao','SGSIN','Singapore'], ['CNSHA','Shanghai','JPTYO','Tokyo'] ];
(async () => {
  for (const code of codes) {
    const provider = load(path.join(__dirname, '../src/features/shipping/providers', code.toLowerCase(), 'provider.ts'))[code+'Provider'];
    for (const [origin,originName,destination,destinationName] of routes) {
      const result = await provider.searchSchedule({ originPort:{id:origin,name:originName,locode:origin}, destinationPort:{id:destination,name:destinationName,locode:destination}, departureDate:from,dateTo:to });
      console.log(JSON.stringify({code,origin,destination,from,to,count:result.schedules.length,fromCache:result.fromCache,durationMs:result.durationMs,warnings:result.warnings,sample:result.schedules.slice(0,1).map(r=>({vessel:r.vesselName,voyage:r.voyageNumber,origin:r.originLocode,destination:r.destinationLocode,etd:r.etd,eta:r.eta,source:JSON.parse(r.rawText).sourceUrl}))}));
    }
  }
})().catch(error => { console.error(error.message); process.exitCode=1; });
