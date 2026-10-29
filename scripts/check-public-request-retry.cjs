const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const out = {};
new Function('exports', ts.transpileModule(fs.readFileSync(path.join(__dirname, '../src/features/shipping/providers/retry-public-request.ts'), 'utf8'), {compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText)(out);
async function check(sequence, expectedCalls, error) {
  let calls = 0;
  const promise = out.retryPublicRequest(async () => { const value=sequence[calls++]; if(value instanceof Error) throw value; return {status:()=>value}; });
  if(error) await assert.rejects(promise); else await promise;
  assert.equal(calls,expectedCalls);
}
(async()=>{
  await check([new Error('Timeout 15000ms exceeded'),200],2);
  await check([503,200],2);
  await check([429],1);
  await check([403],1);
  await check([new Error('Invalid JSON')],1,true);
  await check([new Error('ECONNRESET'),new Error('ECONNRESET')],2,true);
  console.log('PASS: bounded timeout/5xx retry; no retry for 403/429 or parser errors');
})().catch(e=>{console.error(e);process.exitCode=1});
