/* Intentionally no cookies, debugger, webRequest or all-sites permissions. */
importScripts('local-config.js');
let busy = false;
let lastStage = 'idle';
let lastKind = "oocl-query";
const base = 'http://127.0.0.1:18342';
const headers = {Authorization: 'Bearer ' + BRIDGE_TOKEN, 'Content-Type': 'application/json'};
chrome.runtime.onMessage.addListener((message, sender, reply) => {
  if (sender.id !== chrome.runtime.id) return;
  if (message.command === 'status') {
    Promise.all([chrome.storage.session.get('enabled'),chrome.tabs.query({url:'https://www.cma-cgm.com/ebusiness/schedules*'}),chrome.tabs.query({url:'https://moc.oocl.com/nj_prs_wss/*'})]).then(([state,cma,oocl])=>reply({status:`${state.enabled?'已启用':'未启用'}；CMA 查询页 ${cma.filter(t=>!t.discarded).length}；OOCL 查询页 ${oocl.filter(t=>!t.discarded).length}；${lastStage}`}));
    return true;
  }
  if (message.command === 'enable') {
    chrome.storage.session.set({enabled:true}).then(() => {
      chrome.alarms.create('poll', {periodInMinutes: 0.5});
      poll(); reply({status: '已启用（浏览器重启后需重新启用）'});
    });
    return true;
  } else if (message.command === 'disable') {
    chrome.storage.session.set({enabled:false}); chrome.alarms.clear('poll'); restoreDiscardPolicy(); reply({status: '已停止'});
  }
});
chrome.alarms.onAlarm.addListener(() => poll());
async function keepQueryTab(tab) {
  const state=await chrome.storage.session.get('discardPolicy');
  const policy=state.discardPolicy||{};
  if(!(tab.id in policy)){policy[tab.id]=tab.autoDiscardable!==false;await chrome.storage.session.set({discardPolicy:policy});}
  await chrome.tabs.update(tab.id,{autoDiscardable:false});
}
async function restoreDiscardPolicy(){
  const {discardPolicy={}}=await chrome.storage.session.get('discardPolicy');
  await Promise.all(Object.entries(discardPolicy).map(([id,value])=>chrome.tabs.update(Number(id),{autoDiscardable:value}).catch(()=>{})));
  await chrome.storage.session.remove('discardPolicy');
}
async function poll() {
  if (busy || !(await chrome.storage.session.get('enabled')).enabled) return;
  busy = true;
  try {
    // Only explicitly enabled CMA public schedule tabs are used.
    const ooclTabs=await chrome.tabs.query({url:'https://moc.oocl.com/nj_prs_wss/*'});
    const cmaTabs = await chrome.tabs.query({url:'https://www.cma-cgm.com/ebusiness/schedules*'});
    const kinds = [ooclTabs.length && 'oocl-query', cmaTabs.length && 'cma-query'].filter(Boolean);
    kinds.sort((a,b) => Number(a===lastKind)-Number(b===lastKind));
    let job = {};
    for (const kind of kinds) {
      const response = await fetch(base + '/next?kind=' + kind, {headers, cache:'no-store'});
      if (!response.ok) throw new Error('Bridge authentication failed');
      job = await response.json();
      if (job.id) {lastKind = kind; break;}
    }
    if (!job.id) return;
    lastStage = job.kind + ': querying';
    let result;
    try {
      if(job.kind==='oocl-query') {
        const tab=ooclTabs.find(t=>!t.discarded);if(!tab)throw new Error('OOCL tab unavailable');
        await keepQueryTab(tab);
        const values=await chrome.scripting.executeScript({target:{tabId:tab.id},world:'MAIN',func:runOoclJob,args:[job]});
        result=values[0]?.result;if(!result)throw new Error('No OOCL response');
        lastStage = result.error ? job.kind + ': failed' : job.kind + ': completed';
        await fetch(base+'/result/'+encodeURIComponent(job.id),{method:'POST',headers,body:JSON.stringify(result)});return;
      }
      if (!['cma-query'].includes(job.kind)) throw new Error('Unsupported job');
      const pattern = 'https://www.cma-cgm.com/ebusiness/schedules*';
      const tabs = (await chrome.tabs.query({url: pattern})).filter(tab=>!tab.discarded).sort((a,b)=>(b.lastAccessed||0)-(a.lastAccessed||0));
      let selected;
      for(const tab of tabs){
        const checks=await chrome.scripting.executeScript({target:{tabId:tab.id},func:(job)=>{
          const f=document.querySelector('#datepicker')?.closest('form');if(!f)return false;
          return true;
        },args:[job]});
        if(checks[0]?.result){selected=tab;break;}
      }
      if (!selected) {
        const notices=await Promise.all(tabs.map(tab=>chrome.scripting.executeScript({target:{tabId:tab.id},func:()=>/We are improving the eBusiness area|unavailable due to scheduled maintenance/i.test(document.body?.innerText||'')})));
        if(notices.some(items=>items[0]?.result))throw new Error('CMA_MAINTENANCE');
        throw new Error('No open official CMA query form is available');
      }
      await keepQueryTab(selected);
      const values = await chrome.scripting.executeScript({target: {tabId: selected.id}, func: runPublicJob, args: [job]});
      result = values[0]?.result;
      if (!result) throw new Error('No result from official tab');
    } catch (error) { result = {error: String(error.message || error)}; }
    lastStage = result?.error ? job.kind + ': failed' : job.kind + ': completed';
    await fetch(base + '/result/' + encodeURIComponent(job.id), {method: 'POST', headers, body: JSON.stringify(result)});
  } catch { /* No credentials or website payloads are logged. */ }
  finally { busy = false; }
}
async function runPublicJob(job) {
 try {
  if (location.origin !== 'https://www.cma-cgm.com' || !['/ebusiness/schedules','/ebusiness/schedules/','/ebusiness/schedules/routing-finder'].includes(location.pathname)) throw new Error('Wrong official page');
  const form = document.querySelector('#datepicker')?.closest('form');
  if (!form) throw new Error('Official query form unavailable');
  const action = new URL(form.action, location.href);
  if(action.origin !== location.origin || action.pathname !== '/ebusiness/schedules/routing-finder') throw new Error('Unexpected official form action');
  const body = new FormData(form);
  const code = name => String(body.get(name) || '').split(';').pop().trim();
  // Same public lookup and fields used by the official SortedAutocomplete widget.
  async function place(code) {
    if (!/^[A-Z]{2}[A-Z0-9]{3}$/.test(code)) throw new Error('Invalid port code');
    const response=await fetch('/api/PortsWithInlands/GetAllPlaces?id='+encodeURIComponent(code),{credentials:'same-origin',cache:'no-store',redirect:'error',signal:AbortSignal.timeout(20000)});
    if(!response.ok)throw new Error('Official place lookup HTTP '+response.status);
    const data=await response.json();
    if(!Array.isArray(data))throw new Error('Official place lookup response invalid');
    const matches=data.filter(p=>String(p.placeCode||'').toUpperCase()===code && String(p.actualName||'').split(';').pop().trim().toUpperCase()===code && p.name && p.capsule);
    const ports=matches.filter(p=>String(p.capsule).toLowerCase()==='port');
    const choices=ports.length?ports:matches;
    const unique=[...new Map(choices.map(p=>[p.actualName+'|'+p.capsule,p])).values()];
    if(unique.length!==1)throw new Error('Official place missing or ambiguous: '+code);
    return unique[0];
  }
  const [origin,destination]=await Promise.all([place(job.origin),place(job.destination)]);
  for(const [suffix,item,visible] of [['POL',origin,'polDescription'],['POD',destination,'podDescription']]) {
    body.set('Actual'+suffix+'Description',item.actualName);
    body.set('Actual'+suffix+'Type',item.capsule);
    body.set(visible,item.name);
  }
  if(code('ActualPOLDescription')!==job.origin||code('ActualPODDescription')!==job.destination)throw new Error('Official location mismatch');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(job.date) || !Number.isInteger(job.weeks) || job.weeks < 1 || job.weeks > 10) throw new Error('Invalid date range');
  const [year, month, day] = job.date.split('-');
  const oldDate = String(body.get('SearchDate') || '');
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  body.set('SearchDate', `${day}-${oldDate.includes('月') ? Number(month) + '月' : months[Number(month)-1]}-${year}`);
  body.set('searchRange', String(job.weeks)); body.set('IsDeparture', 'True');
  const startedAt = new Date().toISOString();
  const response = await fetch(form.action, {method: 'POST', body, credentials: 'same-origin', cache: 'no-store', redirect: 'error', signal:AbortSignal.timeout(90000)});
  if (!response.ok) throw new Error('Official query HTTP ' + response.status);
  const doc = new DOMParser().parseFromString(await response.text(), 'text/html');
  if (/We are improving the eBusiness area|unavailable due to scheduled maintenance/i.test(doc.body?.textContent || '')) throw new Error('CMA_MAINTENANCE');
  const cards = [...doc.querySelectorAll('.cardelem')];
  if (!cards.length) throw new Error('No verified official result cards (empty or verification page)');
  const section = doc.createElement('section');
  for (const item of doc.querySelectorAll('[id^="rs-"]')) section.append(item.parentElement.cloneNode(true));
  for (const card of cards) section.append(card.cloneNode(true));
  section.querySelectorAll('script,input,textarea,iframe').forEach(el => el.remove());
  return {kind: job.kind, fresh: true, sourceUrl: response.url, startedAt, completedAt: new Date().toISOString(), criteria: {origin: job.origin,destination: job.destination,date: job.date,weeks: job.weeks}, count: cards.length, html: section.outerHTML};
 } catch(error) { return {error:String(error.message || error)}; }
}

async function runOoclJob(job) {
 try {
  if(location.origin!=='https://moc.oocl.com')throw Error('Wrong official origin');
  const nodes=[...document.querySelectorAll('[ng-controller],body')];
  const scope=nodes.map(el=>window.angular?.element(el).scope()).find(s=>s?.getResult && s?.user);
  if(!scope)throw Error('Official OOCL search controller unavailable');
  const codes=p=>(p?.Codes||[]).filter(x=>x.Standard==='UNLocode').map(x=>x.Code);
  const origins=codes(scope.user.origin),destinations=codes(scope.user.destination);
  async function lookup(code,name,bound,current) {
    if(codes(current).includes(code))return current;
    if(typeof scope.getLocation!=='function')throw Error('OOCL official location control unavailable');
    for(const term of [...new Set([name,code].filter(Boolean))]) {
      const options=await scope.getLocation(term,bound);
      if(!Array.isArray(options))continue;
      const matches=options.filter(p=>codes(p).includes(code));
      if(matches.length===1)return matches[0];
      if(matches.length>1)throw Error('OOCL official location ambiguous: '+code);
    }
    throw Error('OOCL official location missing: '+code);
  }
  const origin=await lookup(job.origin,job.originName,'OB',scope.user.origin);
  const destination=await lookup(job.destination,job.destinationName,'IB',scope.user.destination);
  const previous=scope.originalResponse,startedAt=new Date().toISOString();
  scope.$applyAsync(()=>{scope.user.origin=origin;scope.user.destination=destination;scope.user.date=job.date;scope.user.weeks=String(job.weeks);scope.user.sailing='sailing.from';scope.getResult();});
  const deadline=Date.now()+100000;
  while(Date.now()<deadline){
   await new Promise(r=>setTimeout(r,500));
   if(scope.originalResponse && scope.originalResponse!==previous){
    if(scope.originalResponse.success!==true){
      const info=String(scope.originalResponse.errorInfo || scope.originalResponse.data?.data?.errorInfo || '');
      throw Error(/captcha|verification|verify|challenge/i.test(info)?'OOCL_VERIFICATION_REQUIRED':/maintenance/i.test(info)?'OOCL_MAINTENANCE':'OOCL_OFFICIAL_REQUEST_FAILED');
    }
    const count=Number(scope.originalResponse.data?.numberOfRouteReturn);
    if(!Number.isInteger(count))throw Error('OOCL official count missing');
    if(count && scope.ProcessedResults?.length!==count)continue;
    return {kind:job.kind,fresh:true,sourceUrl:location.origin+location.pathname,startedAt,completedAt:new Date().toISOString(),criteria:{origin:job.origin,destination:job.destination,date:job.date,weeks:job.weeks},count,locations:{origin:{codes:codes(origin),name:scope.displayEngGeoName(origin.Names)},destination:{codes:codes(destination),name:scope.displayEngGeoName(destination.Names)}},rows:JSON.parse(JSON.stringify(scope.ProcessedResults||[])),routes:JSON.parse(JSON.stringify(scope.originalResponse.data.standardRoutes||[]))};
   }
  }
  throw Error('OOCL official query timeout or verification required');

 } catch(e){return {error:String(e.message||e)}}
}
