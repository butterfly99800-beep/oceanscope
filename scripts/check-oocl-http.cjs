const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const out = {};
new Function('exports', 'require', ts.transpileModule(fs.readFileSync(path.join(__dirname, '../src/features/shipping/providers/oocl/http.ts'), 'utf8'), {compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText)(out, require);
const url = out.OOCL_MOBILE_URL;
const form = contents => `<form id="form" action="/party/sailingschedule/MOBILE/mobile_ss_search.jsf"><input name="jsf_state_64" value="new-state">${contents}</form>`;
const parsed = out.readForm(form('<input name="unchecked" type="checkbox"><input name="disabled" disabled><select name="week"><option>2</option><option selected>4</option></select>'), url);
assert.equal(parsed.fields.week, '4');
assert.equal(parsed.fields.jsf_state_64, 'new-state');
assert.equal(parsed.fields.unchecked, undefined);
assert.equal(parsed.fields.disabled, undefined);
const decorated = out.readForm(form('') + '<script>document.forms["form"].action = act + "?ANONYMOUS_TOKEN=fixture";</script>', url);
assert.equal(new URL(decorated.url).searchParams.get('ANONYMOUS_TOKEN'), 'fixture');
assert.equal(new URL(decorated.url).searchParams.has('ANONYMOUS_BEHAVIOR'), false);
assert.throws(() => out.readForm('<form id="form" action="https://other.example/"></form>', url));
assert(out.requiresVerification('function captchaCheck(){ if (true) { } }'));
assert(!out.requiresVerification('function captchaCheck(){ if (false) { } }'));
assert.equal(out.detailText('<table><tr><td>POL:</td><td>Shanghai</td></tr></table>'), 'POL:\tShanghai');
(async () => {
  let calls = 0;
  const http = { post: async (_url, options) => {
    calls++;
    if (calls === 1) {
      assert.equal(options.form['form:dest_city_id'], 'NLRTM');
      assert.equal(options.form['form:dest_city_key'], 'right-city');
      return {ok:()=>true, url:()=>url, text:async()=>form('<a id="detail" onclick="toDetail(0)">Details</a>')};
    }
    assert.equal(options.form['form:recordIndex'], '0');
    assert.equal(options.form.jsf_state_64, 'new-state');
    return {ok:()=>true, url:()=>url, text:async()=>'<table><tr><td>POL:</td><td>Shanghai</td></tr></table>'};
  }};
  const result = await out.queryOoclHttp({destinationCode:'NLRTM'}, {http, url, html:form(`<a id="wrong" onclick="selectDestination('USRAJ','Rotterdam','wrong-city')">Rotterdam</a><a id="right" onclick="selectDestination('NLRTM','Rotterdam','right-city')">Rotterdam</a>`)});
  assert.equal(calls, 2);
  let limitedCalls = 0;
  await assert.rejects(out.queryOoclHttp({}, {url, html:form('<a id="detail" onclick="toDetail(0)">Details</a>'),
    fields: {jsf_state_64:'live-property'}, http:{post:async(_url,options)=>{
      limitedCalls++;
      assert.equal(options.form.jsf_state_64,'live-property');
      return {ok:()=>false,status:()=>429};
    }}}), /RATE_LIMITED/);
  assert.equal(limitedCalls, 1);
  assert.deepEqual(result.texts, ['POL:\tShanghai']);
  // A broken middle detail must not hide subsequent official routings.
  const allLinks = Array.from({length: 12}, (_, i) => '<a id="d'+i+'" onclick="toDetail('+i+')">Details</a>').join('');
  const attempted = [];
  const many = await out.queryOoclHttp({}, {url, html:form(allLinks), http:{post:async(_url,options)=>{
    const index = Number(options.form['form:recordIndex']);
    attempted.push(index);
    if (index === 5) return {ok:()=>false,status:()=>503};
    return {ok:()=>true,url:()=>url,text:async()=>'<table><tr><td>POL:</td><td>Port '+index+'</td></tr></table>'};
  }}});
  assert.deepEqual(attempted, Array.from({length:12}, (_, i)=>i));
  assert.equal(many.texts.length, 11);
  assert.equal(many.texts.at(-1), 'POL:\tPort 11');
  assert(many.warnings.some(w=>w.includes('detail 5')));
  const empty = await out.queryOoclHttp({}, {http, url, html:form('No result were found')});
  assert.deepEqual(empty.warnings, ['NO_SCHEDULE_FOUND']);
  assert.equal(calls, 2);
  console.log('PASS: JSF fields, exact country/city selection, detail POST, verification detection and genuine empty result');
})().catch(e=>{console.error(e);process.exitCode=1});
