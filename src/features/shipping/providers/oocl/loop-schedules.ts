import { mkdtemp, writeFile, unlink, rmdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import type { CoscoSchedulePreview } from "@/features/cosco-scraper/types";

const loops = ["PCC1", "PCN1", "PCN3", "PCS1"];
const root = "https://www.oocl.com/SiteCollectionDocuments/OOCL/eServices/Sailing%20Schedule%20by%20Service/";
const months = "Jan Feb Mar Apr May Jun Jul Aug Sep Oct Nov Dec".split(" ");
const pending = new Map<string, Promise<string>>();
function documentText(code: string) {
  const active = pending.get(code);
  if (active) return active;
  const task = (async () => {
    const url = root + code + "_LT.pdf";
    const r = await fetch(url, {cache:"no-store", signal:AbortSignal.timeout(15000)});
    if (!r.ok) throw new Error(`OOCL_PDF_HTTP_${r.status}`);
    const pdf = Buffer.from(await r.arrayBuffer());
    if (pdf.length > 5000000 || pdf.subarray(0,5).toString() !== "%PDF-") throw new Error("OOCL_PDF_RESPONSE_INVALID");
    const dir = await mkdtemp(path.join(tmpdir(), "oceanscope-oocl-"));
    const file = path.join(dir, "schedule.pdf");
    try {
      await writeFile(file, pdf);
      return await new Promise<string>((resolve,reject) => {
        execFile(process.env.OOCL_PDFTOTEXT_PATH || "pdftotext", ["-raw",file,"-"], {encoding:"utf8",timeout:10000,maxBuffer:2000000}, (error,out) => error ? reject(new Error("OOCL_PDF_READER_FAILED: check pdftotext")) : resolve(out));
      });
    } finally { await unlink(file).catch(()=>undefined); await rmdir(dir).catch(()=>undefined); }
  })().finally(()=>pending.delete(code));
  pending.set(code,task);
  return task;
}
type Call = {port:string;arrival:string;departure:string;raw:string};
function parseDate(day:number, month:number, reference:Date) {
  const candidates = [-1,0,1].map(offset=>new Date(Date.UTC(reference.getUTCFullYear()+offset,month,day,12))).filter(d=>d.getUTCDate()===day && Math.abs(+d-+reference)<180*86400000);
  return candidates.length===1 ? candidates[0].toISOString().slice(0,10) : null;
}
export function parseLoop(text:string, loop:string, destination:"USLAX"|"USLGB", from:string,to:string) {
  const stamp = text.match(/Last Update Date:\s*(\d{2})-([A-Za-z]{3})-(\d{4})/);
  if (!stamp || months.indexOf(stamp[2])<0) throw new Error("OOCL_PDF_RESPONSE_INVALID: publication date missing");
  const reference = new Date(Date.UTC(+stamp[3],months.indexOf(stamp[2]),+stamp[1],12));
  const rows:CoscoSchedulePreview[]=[];
  const portName=destination==='USLAX'?'Los Angeles':'Long Beach';
  for(const block of text.split(/^Vessel Name /m).slice(1)) {
    const [header,voyages,labels,...lines]=block.split(/\r?\n/);
    const names=header.split(/\s+Vessel Name\s+/).map(x=>x.trim());
    const vv=voyages?.split(/Vessel\/Voyage\s+/).slice(1).map(x=>x.trim());
    if (!vv || vv.length!==names.length || !labels?.includes('Arr--Dep')) continue;
    const columns:Call[][]=names.map(()=>[]);
    for(const line of lines) {
      const pattern=/\s*([A-Za-z][A-Za-z .,'()-]*?)\s+(\d{2})--(\d{2})\s+([A-Z][a-z]{2})/g;
      const cells=[...line.matchAll(pattern)];
      // Text extraction removes empty columns. Never shift remaining cells onto another vessel.
      if(cells.length!==names.length || line.replace(pattern,'').trim()) {
        for(const column of columns) column.push({port:'',arrival:'',departure:'',raw:''});
        continue;
      }
      cells.forEach((c,i)=>{const m=months.indexOf(c[4]);if(m<0)return;const dep=parseDate(+c[3],m,reference),arr=parseDate(+c[2],m-(+c[2]>+c[3]?1:0),reference);if(dep&&arr)columns[i].push({port:c[1].trim(),arrival:arr,departure:dep,raw:c[0].trim()});});
    }
    columns.forEach((calls,i)=>{if(/TO BE ADVISED|TBA|TBD/i.test(names[i]) || !vv[i])return;
      for(let j=0;j<calls.length;j++){const a=calls[j];if(a.port!=='Shanghai'||a.departure<from||a.departure>to)continue;
        const onward=calls.slice(j+1);const nextShanghai=onward.findIndex(x=>!x.port||x.port==='Shanghai');const b=(nextShanghai>=0?onward.slice(0,nextShanghai):onward).find(x=>x.port===portName);if(!b||b.arrival<=a.departure)continue;
        const raw=`POL:\t${a.port}\nFinal Destination Hub:\t${b.port}\nVessel/Voyage:\t${vv[i]}\nVessel Name:\t${names[i]}\n${loop}\n${a.raw}\n${b.raw}\nSource: ${root}${loop}_LT.pdf\n${stamp[0]}`;
        rows.push({id:'oocl-loop-'+createHash('sha256').update([loop,vv[i],a.departure,destination].join('|')).digest('hex'),carrierName:'OOCL',serviceName:loop,routeName:null,vesselName:names[i],voyageNumber:vv[i],originText:a.port,destinationText:b.port,originLocode:'CNSHA',destinationLocode:destination,etd:a.departure+'T12:00:00.000Z',eta:b.arrival+'T12:00:00.000Z',etdTimeKnown:false,etaTimeKnown:false,transitDays:null,direct:null,stopCount:null,transitPorts:[],rawText:raw});
      }
    });
  }
  return rows;
}
export async function queryShanghaiLoops(destination:"USLAX"|"USLGB",from:string,to:string) {
  const results=await Promise.allSettled(loops.map(async loop=>parseLoop(await documentText(loop),loop,destination,from,to)));
  return {schedules:results.flatMap(r=>r.status==='fulfilled'?r.value:[]),warnings:results.flatMap(r=>r.status==='rejected'?[String(r.reason)]:[])};
}
