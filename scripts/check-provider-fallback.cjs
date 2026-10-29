// Deterministic policy tests; synthetic responses are never saved or counted as live data.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const source = fs.readFileSync(path.join(__dirname, '../src/features/cosco-scraper/server/cosco-scraper-fetcher.ts'), 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
async function run(warnings, error) {
  const calls = [];
  const exportsObject = {};
  const response = { schedules: [], warnings };
  new Function('exports', 'require', compiled)(exportsObject, name => name.includes('scraper-cache')
    ? { coscoCacheKey: () => 'test', getCoscoScraperCache: () => { throw Error('forced query read cache'); }, setCoscoScraperCache: () => {} }
    : name.endsWith('scraper-api') ? { scrapeCoscoSchedulesApi: async () => { calls.push('api'); if(error) throw Error(error); return response; } }
      : name.includes('edge-schedule') ? { scrapeCoscoEdge: async () => { calls.push('edge'); return response; } }
        : { scrapeCoscoSchedules: async () => { calls.push('browser'); return response; } });
  try { await exportsObject.fetchCoscoSchedules({ forceRefresh: true }, 'auto'); } catch(e) { if(!error) throw e; }
  return calls;
}
(async () => {
  assert.deepEqual(await run(['COSCO_NO_RESULTS']), ['api']);
  assert.deepEqual(await run(['COSCO_PARSE_INCOMPLETE']), ['api', 'browser']);
  assert.deepEqual(await run([], 'COSCO_ACCESS_BLOCKED'), ['api', 'edge']);
  assert.deepEqual(await run([], 'COSCO_RATE_LIMITED'), ['api']);
  console.log('PASS: API first, authoritative empty stops fallback, parse failure falls back, 403 Edge, 429 stops, force refresh bypasses cache');
})().catch(e => { console.error(e); process.exitCode = 1; });
