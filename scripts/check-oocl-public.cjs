// Run providers from the application without a separate TypeScript runtime.
// This calls real public services; it never writes schedule rows to the database.
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
const root = path.resolve(__dirname, '..');

const resolveFilename = Module._resolveFilename;
Module._resolveFilename = function (request, parent, ...args) {
  return resolveFilename.call(this, request.startsWith('@/') ? path.join(root, 'src', request.slice(2)) : request, parent, ...args);
};
require.extensions['.ts'] = (module, filename) => {
  const source = fs.readFileSync(filename, 'utf8');
  module._compile(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText, filename);
};
const { OOCLProvider } = require('../src/features/shipping/providers/oocl/provider.ts');
async function main() {
  const destination = process.argv[2];
  const name = { USLAX: 'Los Angeles', USLGB: 'Long Beach' }[destination];
  if (!name) throw new Error('Expected USLAX or USLGB');
  const result = await OOCLProvider.searchSchedule({
    originPort: { locode: 'CNSHA', name: 'Shanghai' },
    destinationPort: { locode: destination, name },
    departureDate: '2026-11-03', dateTo: '2026-12-01', forceRefresh: true
  });
  if (result.fromCache !== false) throw new Error('Unexpected cached response');
  const rows = result.schedules.filter(r => r.vesselName && r.voyageNumber && r.etd && r.eta &&
    r.etd.slice(0,10) >= '2026-11-03' && r.etd.slice(0,10) <= '2026-12-01');
  const samples = rows.map(r => ({
    source: r.id.startsWith('oocl-loop-') ? 'PDF' : 'mobile',
    vessel: r.vesselName, voyage: r.voyageNumber, destination: r.destinationText,
    etd: r.etd.slice(0,10), eta: r.eta.slice(0,10)
  }));
  const report = { destination, count: rows.length, samples, warnings: result.warnings, fromCache: false };
  console.log(JSON.stringify(report, null, 2));
  if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY,
    '### Shanghai → ' + name + '\n\n```json\n' + JSON.stringify(report, null, 2) + '\n```\n');
  if (!rows.length) process.exitCode = 1;
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
