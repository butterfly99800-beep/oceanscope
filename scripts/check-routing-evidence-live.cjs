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
const aliases = code => ({CNSHA:['CNSHA','CNSGH'],CNTAO:['CNTAO','CNQIN'],CNNGB:['CNNGB','CNNBO'],USLAX:['USLAX','USLSA']})[code] || [code];
(async () => {
  const codes = (process.argv[2] || 'COSCO,OOCL,CMA,MAERSK,HAPAG,MSC,ONE,EMC,YML,HMM,KMTC,PIL,SITC,ZIM').split(',');
  const originPort = await prisma.port.findFirstOrThrow({ where: { locode: {in: aliases(process.argv[3] || 'CNSHA')} } });
  const destinationPort = await prisma.port.findFirstOrThrow({ where: { locode: {in: aliases(process.argv[4] || 'USLGB')} } });
  const departureDate = process.argv[5] || new Date().toISOString().slice(0, 10);
  for (const code of codes) {
    const provider = require(path.join(root, 'src/features/shipping/providers', code.toLowerCase(), 'provider.ts'))[`${code}Provider`];
    const dateTo = new Date(new Date(`${departureDate}T00:00:00Z`).getTime() + 28 * 86400000).toISOString().slice(0, 10);
    const providerStarted = Date.now();
    const result = await provider.searchSchedule({ originPort, destinationPort, departureDate, dateTo, mode: process.env.SCHEDULE_TEST_MODE || 'api', forceRefresh: true });
    const rows = result.schedules.filter(r=>r.etd.slice(0,10)>=departureDate.slice(0,10) && r.etd.slice(0,10)<=dateTo.slice(0,10));
    if (process.env.OCEANSCOPE_AUDIT_UI_DIR) fs.writeFileSync(path.join(process.env.OCEANSCOPE_AUDIT_UI_DIR,code+"-routing-ui.json"),JSON.stringify(rows));
    const report={checkedAt:new Date().toISOString(),dateFrom:departureDate,dateTo,durationMs:Date.now()-providerStarted,source:result.source,transport:result.transport,audit:result.audit,audits:result.audits,rawCount:result.schedules.length,code,origin:originPort.locode,destination:destinationPort.locode,fromCache:result.fromCache,count:rows.length,direct:rows.filter(r=>r.direct===true).length,transit:rows.filter(r=>r.direct===false).length,unknown:rows.filter(r=>r.direct==null).length,warnings:result.warnings,samples:rows.filter(r=>r.direct==null).slice(0,2).map(r=>({destination:r.destinationLocode,raw:r.rawText})),knownSample:rows[0]?.rawText};
    if (process.env.OCEANSCOPE_AUDIT_FILE) fs.appendFileSync(process.env.OCEANSCOPE_AUDIT_FILE,JSON.stringify(report)+'\n');
    console.log(JSON.stringify({...report,samples:undefined,knownSample:undefined}));

  }
})().catch((error) => { console.error(error); process.exitCode = 1; }).finally(async () => {
  await prisma.$disconnect();
  const { prisma: shared } = require(path.join(root, 'src/lib/prisma.ts'));
  await shared.$disconnect();
});
