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
(async () => {
  const codes = (process.argv[2] || 'MSC,HAPAG,CMA,OOCL,MAERSK,COSCO').split(',');
  const originPort = await prisma.port.findFirstOrThrow({ where: { locode: process.argv[3] || 'CNSHA' } });
  const destinationPort = await prisma.port.findFirstOrThrow({ where: { locode: process.argv[4] || 'USLGB' } });
  const departureDate = process.argv[5] || new Date().toISOString().slice(0, 10);
  await Promise.all(codes.map(async (code) => {
    const provider = require(path.join(root, 'src/features/shipping/providers', code.toLowerCase(), 'provider.ts'))[`${code}Provider`];
    const dateTo = new Date(new Date(`${departureDate}T00:00:00Z`).getTime() + 28 * 86400000).toISOString().slice(0, 10);
    const result = await provider.searchSchedule({ originPort, destinationPort, departureDate, dateTo, mode: process.env.SCHEDULE_TEST_MODE || 'api', forceRefresh: true });
    const sample = result.schedules[0];
    console.log(JSON.stringify({ code, origin: originPort.locode, destination: destinationPort.locode, departureDate, count: result.schedules.length, entryText: result.entryText, fromCache: result.fromCache, queriedAt: result.queriedAt, network: result.debug?.network, durationMs: result.durationMs, warnings: result.warnings, sample: sample ? { ...sample, rawText: undefined, rawSourceBytes: sample.rawText.length } : undefined }, null, 2));
  }));
})().catch((error) => { console.error(error); process.exitCode = 1; }).finally(async () => {
  await prisma.$disconnect();
  const { prisma: shared } = require(path.join(root, 'src/lib/prisma.ts'));
  await shared.$disconnect();
});
