import { readFile } from "node:fs/promises";
import { parseCmaGlobalHtml } from "./global-parser";
import { canonicalPortCode } from "@/features/ports/server/source-port-match";
import type { CmaProviderSearchInput, CmaProviderResult } from "./provider";

/** Queue a new official POST in an explicitly enabled browser; never reuse captured HTML. */
export async function queryCmaSession(input:CmaProviderSearchInput):Promise<CmaProviderResult> {
 const started=Date.now();
 const token=process.env.CMA_SESSION_TOKEN || (process.env.CMA_SESSION_TOKEN_FILE ? (await readFile(process.env.CMA_SESSION_TOKEN_FILE,"utf8")).trim():"");
 if(token.length<32)throw new Error("Session token unavailable");
 const base="http://127.0.0.1:18342";
 const headers={Authorization:`Bearer ${token}`,"Content-Type":"application/json"};
 const from=input.departureDate.slice(0,10),to=(input.dateTo||input.departureDate).slice(0,10);
 const days=Math.round((Date.parse(to)-Date.parse(from))/86400000)+1;
 if(!Number.isFinite(days)||days<1||days>70)throw new Error("Invalid date range");
 const criteria={origin:canonicalPortCode(input.originPort.locode),destination:canonicalPortCode(input.destinationPort.locode),date:from,weeks:Math.ceil(days/7)};
 const request=await fetch(`${base}/jobs`,{method:"POST",headers,cache:"no-store",redirect:"error",body:JSON.stringify({kind:"cma-query",...criteria}),signal:AbortSignal.timeout(5000)});
 if(!request.ok)throw new Error("Session queue unavailable");
 const {id}=await request.json();
 if(!/^[a-f0-9]{32}$/.test(id))throw new Error("Invalid job ID");
 while(Date.now()-started<140000){
  const response=await fetch(`${base}/result/${id}`,{headers,cache:"no-store",redirect:"error",signal:AbortSignal.timeout(5000)});
  if(response.status===200){
   const result=await response.json();
   if(result.error||result.kind!=="cma-query"||result.fresh!==true||result.sourceUrl!=="https://www.cma-cgm.com/ebusiness/schedules/routing-finder"||typeof result.html!=="string")throw new Error("Invalid official response");
   for(const key of Object.keys(criteria) as (keyof typeof criteria)[])if(result.criteria?.[key]!==criteria[key])throw new Error("Query criteria mismatch");
   if(!Number.isFinite(Date.parse(result.startedAt))||!Number.isFinite(Date.parse(result.completedAt))||Date.parse(result.startedAt)<started-1000||Date.parse(result.completedAt)<Date.parse(result.startedAt)||Date.parse(result.completedAt)>Date.now()+1000)throw new Error("Stale official response");
   const all=parseCmaGlobalHtml(result.html,from,new Date(Date.parse(from)+(criteria.weeks*7-1)*86400000).toISOString().slice(0,10));
   if(all.length!==result.count)throw new Error("Official card count mismatch");
   if(all.some(row=>row.originLocode!==criteria.origin||row.destinationLocode!==criteria.destination))throw new Error("Official ports mismatch");
   const schedules=all.filter(row=>row.etd&&row.etd.slice(0,10)<=to);
   return {source:"CMA_LIVE",schedules,warnings:schedules.length?[]:["NO_SCHEDULE_FOUND"],durationMs:Date.now()-started,fromCache:false};
  }
  if(response.status!==202)throw new Error("Session job unavailable");
  await new Promise(resolve=>setTimeout(resolve,1000));
 }
 throw new Error("Browser session timeout");
}
