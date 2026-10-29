const fs = require('node:fs');
const path = require('node:path');
const root = path.join(__dirname, '../reports');
const read = name => fs.readFileSync(path.join(root, name), 'utf8').trim().split('\n').filter(Boolean).map(JSON.parse);
const final = read('live-http-oocl-cma-final-2026-10-28.jsonl');
const experiments = read('live-http-oocl-cma-2026-10-28.jsonl');
const diagnostics = JSON.parse(fs.readFileSync(path.join(root, 'cma-entry-diagnostics-2026-10-28.json'), 'utf8'));
const escape = x => String(x ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const codes = ['COSCO','OOCL','CMA','MAERSK','HAPAG','MSC'];
const passed = r => r.browserPass && codes.every(code => r.counts?.[code] > 0);
const table = rows => `<table><thead><tr><th>航线 / 时间</th>${codes.map(c=>`<th>${c}</th>`).join('')}<th>前端及六家结果</th></tr></thead><tbody>${rows.map(r=>`<tr><td>${escape(r.origin)} → ${escape(r.destination)}<small>${escape(r.startedAt)}</small></td>${codes.map(c=>`<td>${r.counts?.[c] ?? '—'}</td>`).join('')}<td>${passed(r)?'通过':'未全部通过'}</td></tr>`).join('')}</tbody></table>`;
const html = `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><title>OOCL / CMA 实时联调报告</title><style>body{font:16px/1.7 system-ui;margin:40px auto;max-width:1150px;color:#18324b;padding:0 24px}h1{font-size:28px}table{border-collapse:collapse;width:100%;margin:20px 0}th,td{padding:10px;border:1px solid #d6e0eb;text-align:left}th{background:#edf5ff}small{display:block;font-size:11px;color:#65768a}aside{padding:16px;background:#fff6df}code{font-size:13px}a{color:#245abd}</style><h1>OOCL / CMA 实时联调报告</h1>
<p>2026-10-28，本地项目实际页面 → 后端 → 官方公开来源。查询日期 2026-10-28 至 2026-11-25。全部强制刷新，不以历史船期缓存充当测试数据；浏览器全部无界面运行，无登录或 API 授权。</p>
<h2>最终联调阶段（包含调整与重复测试）</h2><p>${final.filter(passed).length} / ${final.length} 次查询通过前端验收且六家均有真实结果。检查了页面船司数量、船名样本、终态、原始来源和本轮更新时间。宁波 → 汉堡仍发生 OOCL 跳转失败；扩大重试范围未能修复且导致约 100 秒等待，现已撤回该延时调整。因此不能宣称 OOCL 已稳定或六家每次都能查到。</p>${table(final)}
<h2>实现与边界</h2><ul><li>OOCL 新增完整 HTTP 表单查询路径，保存匿名会话和官方 JSF 状态，精确选择地点；正常空结果不触发浏览器。</li><li>本次 HTTP 入口要求验证，因此最终实测使用后台 Edge 完成表单与地点选择，再通过 HTTP 读取详情。纯 HTTP 全流程尚未获得真实成功验收，不能称为已摆脱浏览器。</li><li>浏览器交接使用实时 FormData；瞬时表单异常最多重试一次，403、429 和验证码不循环重试。</li><li>OOCL 每次最多取前 8 个官方方案详情，实际展示经过港口匹配和去重，前端明确提示部分结果。</li><li>CMA 保持中国公开入口 HTTP 优先，诊断保留 HTTP 与浏览器各阶段失败原因，不再被最后一次失败覆盖。</li></ul>
<h2>CMA 403 证据</h2><table><tr><th>入口</th><th>方式</th><th>状态</th><th>响应特征</th></tr>${diagnostics.map(r=>`<tr><td>${escape(r.url)}</td><td>${escape(r.mode)}</td><td>${escape(r.status)}</td><td>${escape([r.server,r.title,...(r.markers||[])].join(' / '))}</td></tr>`).join('')}</table>
<aside>全球入口 403 带验证码服务标记；中国站同一入口 HTTP 200、Edge 403 WAF 拒绝。能定位到入口访问防护，但响应未披露具体触发规则，不能断言由 IP、频率或某一请求头造成，也未宣称彻底解决官网 403。</aside>
<h2>保留的实验失败</h2><p>城市选择提前交给 HTTP 的实验版本有 ${experiments.filter(r=>!passed(r)).length} / ${experiments.length} 次未达成六家全部成功。最终兜底保留浏览器地点选择，不用后续成功覆盖这些失败。</p>
<p><a href="live-http-oocl-cma-final-2026-10-28.jsonl">最终原始记录</a> · <a href="live-http-oocl-cma-2026-10-28.jsonl">实验原始记录</a> · <a href="cma-entry-diagnostics-2026-10-28.json">403 诊断</a></p>
<p>本地验证：TypeScript、针对性 ESLint、JSF 表单及限流测试、港口匹配测试通过。未做生产部署或长期稳定性测试；本报告不保证所有航线始终有船期。</p></html>`;
fs.writeFileSync(path.join(root, 'oocl-cma-2026-10-28.html'), html);
console.log(JSON.stringify({finalRuns:final.length,allSixPassed:final.filter(passed).length,experimentalRuns:experiments.length,experimentalFailures:experiments.filter(r=>!passed(r)).length}));
