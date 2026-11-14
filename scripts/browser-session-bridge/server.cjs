// Local authenticated browser queue. Does not replace/restart the worker or SSH tunnel.
const http = require('node:http');
const {randomBytes, timingSafeEqual, createHash} = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const tokenPath=path.join(__dirname,'.client-token');
const token = fs.existsSync(tokenPath)?fs.readFileSync(tokenPath,'utf8').trim():randomBytes(32).toString('hex');
fs.writeFileSync(path.join(__dirname, 'local-config.js'), 'const BRIDGE_TOKEN = ' + JSON.stringify(token) + ';\n', {mode: 0o600});
fs.writeFileSync(path.join(__dirname, '.client-token'), token, {mode: 0o600});
const hash = value => createHash('sha256').update(value).digest();
const jobs = new Map();
const server = http.createServer(async (req, res) => {
  const send = (status, data) => {res.writeHead(status, {'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify(data));};
  if (!timingSafeEqual(hash(req.headers.authorization || ''), hash('Bearer ' + token))) return send(401, {});
  try {
    for (const [id, job] of jobs) if (Date.now() - job.created > 180000) jobs.delete(id);
    if (req.method === 'GET' && req.url.split('?')[0] === '/next') {
      const kind=new URL(req.url,'http://127.0.0.1').searchParams.get('kind');
      const job = [...jobs.values()].find(item => !item.claimed && (!kind || item.request.kind===kind));
      if (!job) return send(200, {});
      job.claimed = true; return send(200, job.request);
    }
    if (req.method === 'GET' && /^\/result\/[a-f0-9]{32}$/.test(req.url)) {
      const job = jobs.get(req.url.slice(8));
      if (!job) return send(404, {});
      if(job.result){jobs.delete(req.url.slice(8));return send(200,job.result);}
      return send(202,{});
    }
    let body = '';
    for await (const chunk of req) {body += chunk; if (body.length > 8000000) return send(413, {});}
    const data = JSON.parse(body);
    if (req.method === 'POST' && req.url === '/jobs') {
      if (jobs.size >= 4 || !['cma-query'].includes(data.kind) || !/^[A-Z]{2}[A-Z0-9]{3}$/.test(data.origin||'') || !/^[A-Z]{2}[A-Z0-9]{3}$/.test(data.destination||'') || !/^\d{4}-\d{2}-\d{2}$/.test(data.date||'') || !Number.isInteger(data.weeks) || data.weeks<1 || data.weeks>10) return send(400, {});
      const id = randomBytes(16).toString('hex');
      const request = {id,kind:data.kind,origin:data.origin,destination:data.destination,date:data.date,weeks:data.weeks};
      jobs.set(id, {request,created:Date.now(),claimed:false}); return send(201, {id});
    }
    if (req.method === 'POST' && /^\/result\/[a-f0-9]{32}$/.test(req.url)) {
      const job = jobs.get(req.url.slice(8));
      if (!job || !job.claimed || job.result) return send(409, {});
      job.result = data; return send(200, {});
    }
    send(404, {});
  } catch {send(400, {});}
});
server.listen(18342, '127.0.0.1', () => console.log('Session verifier listening on 127.0.0.1:18342; token not logged'));
