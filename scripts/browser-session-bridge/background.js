/* Intentionally no cookies, debugger, webRequest or all-sites permissions. */
importScripts('local-config.js');
let busy = false;
const base = 'http://127.0.0.1:18342';
const headers = {Authorization: 'Bearer ' + BRIDGE_TOKEN, 'Content-Type': 'application/json'};
chrome.runtime.onMessage.addListener((message, sender, reply) => {
  if (sender.id !== chrome.runtime.id) return;
  if (message.command === 'enable') {
    chrome.storage.session.set({enabled:true}).then(() => {
      chrome.alarms.create('poll', {periodInMinutes: 0.5});
      poll(); reply({status: '已启用（浏览器重启后需重新启用）'});
    });
    return true;
  } else if (message.command === 'disable') {
    chrome.storage.session.set({enabled:false}); chrome.alarms.clear('poll'); reply({status: '已停止'});
  }
});
chrome.alarms.onAlarm.addListener(() => poll());
async function poll() {
  if (busy || !(await chrome.storage.session.get('enabled')).enabled) return;
  busy = true;
  try {
    // Only explicitly enabled CMA public schedule tabs are used.
    const kinds = 'cma-query';
    const response = await fetch(base + '/next?kind=' + kinds, {headers, cache: 'no-store'});
    if (!response.ok) throw new Error('Bridge authentication failed');
    const job = await response.json();
    if (!job.id) return;
    let result;
    try {
      if (!['cma-query'].includes(job.kind)) throw new Error('Unsupported job');
      const pattern = 'https://www.cma-cgm.com/ebusiness/schedules/routing-finder*';
      const tabs = (await chrome.tabs.query({url: pattern})).filter(tab=>!tab.discarded).sort((a,b)=>(b.lastAccessed||0)-(a.lastAccessed||0));
      let selected;
      for(const tab of tabs){
        const checks=await chrome.scripting.executeScript({target:{tabId:tab.id},func:(job)=>{
          const f=document.querySelector('form[action$="/ebusiness/schedules/routing-finder"]');if(!f)return false;
          return true;
        },args:[job]});
        if(checks[0]?.result){selected=tab;break;}
      }
      if (!selected) {
        const notices=await Promise.all(tabs.map(tab=>chrome.scripting.executeScript({target:{tabId:tab.id},func:()=>/We are improving the eBusiness area|unavailable due to scheduled maintenance/i.test(document.body?.innerText||'')})));
        if(notices.some(items=>items[0]?.result))throw new Error('CMA_MAINTENANCE');
        throw new Error('No open official CMA query form is available');
      }
      const values = await chrome.scripting.executeScript({target: {tabId: selected.id}, func: runPublicJob, args: [job]});
      result = values[0]?.result;
      if (!result) throw new Error('No result from official tab');
    } catch (error) { result = {error: String(error.message || error)}; }
    await fetch(base + '/result/' + encodeURIComponent(job.id), {method: 'POST', headers, body: JSON.stringify(result)});
  } catch { /* No credentials or website payloads are logged. */ }
  finally { busy = false; }
}
async function runPublicJob(job) {
 try {
  if (location.origin !== 'https://www.cma-cgm.com' || location.pathname !== '/ebusiness/schedules/routing-finder') throw new Error('Wrong official page');
  const form = document.querySelector('form[action$="/ebusiness/schedules/routing-finder"]');
  if (!form) throw new Error('Official query form unavailable');
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
  const response = await fetch(form.action, {method: 'POST', body, credentials: 'same-origin', cache: 'no-store', redirect: 'error'});
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
