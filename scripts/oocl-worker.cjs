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
const http = require('node:http');
const { timingSafeEqual, createHash } = require('node:crypto');
const { OOCLProvider } = require('../src/features/shipping/providers/oocl/provider.ts');
const { CMAProvider } = require('../src/features/shipping/providers/cma/provider.ts');
const token = process.env.OOCL_WORKER_TOKEN;
if (!token || token.length < 32) throw new Error('Set OOCL_WORKER_TOKEN (at least 32 characters)');
process.env.OOCL_USE_LOCAL_WORKER = 'false';
process.env.CMA_USE_LOCAL_WORKER = 'false';
const digest = value => createHash('sha256').update(value).digest();
let active = 0;
http.createServer(async (req, res) => {
  const finish = (status, body) => { res.writeHead(status, {'Content-Type':'application/json'}); res.end(JSON.stringify(body)); };
  if (req.method !== 'POST' || !['/query', '/cma/query'].includes(req.url)) return finish(404, {});
  if (!timingSafeEqual(digest(req.headers.authorization || ''), digest('Bearer ' + token))) return finish(401, {});
  if (active >= 2) return finish(503, {});
  active++;
  try {
    let body = '';
    for await (const chunk of req) {
      body += chunk;
      if (body.length > 16384) return finish(413, {});
    }
    const input = JSON.parse(body);
    const port = p => p && /^[A-Z]{2}[A-Z0-9]{3}$/.test(p.locode) && typeof p.name === 'string' && p.name.length <= 256;
    if (!port(input.originPort) || !port(input.destinationPort) || !/^\d{4}-\d{2}-\d{2}$/.test(input.departureDate)) return finish(400, {});
    const clean = p => ({ name:p.name, locode:p.locode });
    const provider = req.url === '/cma/query' ? CMAProvider : OOCLProvider;
    const result = await provider.searchSchedule({originPort:clean(input.originPort), destinationPort:clean(input.destinationPort),
      departureDate:input.departureDate, dateTo:input.dateTo});
    finish(200, result);
  } catch { finish(500, {}); } finally { active--; }
}).listen(Number(process.env.OCEANSCOPE_WORKER_PORT || 18341), '127.0.0.1', () => console.log('Schedule worker listening on localhost'));
