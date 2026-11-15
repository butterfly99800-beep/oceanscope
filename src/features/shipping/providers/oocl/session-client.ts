import { readFile } from "node:fs/promises";
import {parseOoclDesktopRows} from "./desktop-parser";
import { canonicalPortCode } from "@/features/ports/server/source-port-match";
import type { OoclProviderSearchInput, OoclProviderResult } from "./provider";

/** Queue a new official POST in an explicitly enabled browser; never reuse captured HTML. */
export async function queryOoclSession(input:OoclProviderSearchInput):Promise<OoclProviderResult> {
 const started=Date.now();
 const token=process.env.OOCL_SESSION_TOKEN || (process.env.OOCL_SESSION_TOKEN_FILE ? (await readFile(process.env.OOCL_SESSION_TOKEN_FILE,"utf8")).trim():"");
 if(token.length<32)throw new Error("Session token unavailable");
 const base="http://127.0.0.1:18342";
 const headers={Authorization:`Bearer ${token}`,"Content-Type":"application/json"};
 const from=input.departureDate.slice(0,10),to=(input.dateTo||input.departureDate).slice(0,10);
 const days=Math.round((Date.parse(to)-Date.parse(from))/86400000)+1;
 if(!Number.isFinite(days)||days<1||days>70)throw new Error("Invalid date range");
 const criteria={origin:canonicalPortCode(input.originPort.locode),destination:canonicalPortCode(input.destinationPort.locode),date:from,weeks:Math.ceil(days/7)};
 const request=await fetch(`${base}/jobs`,{method:"POST",headers,cache:"no-store",redirect:"error",body:JSON.stringify({kind:"oocl-query",...criteria}),signal:AbortSignal.timeout(5000)});
 if(!request.ok)throw new Error("Session queue unavailable");
 const {id}=await request.json();
 if(!/^[a-f0-9]{32}$/.test(id))throw new Error("Invalid job ID");
 while(Date.now()-started<140000){
  const response=await fetch(`${base}/result/${id}`,{headers,cache:"no-store",redirect:"error",signal:AbortSignal.timeout(5000)});
  if(response.status===200){
   const result=await response.json();
   if(result.error === "CMA_MAINTENANCE")throw new Error("CMA_MAINTENANCE");
   if(result.error||result.kind!=="oocl-query"||result.fresh!==true||result.sourceUrl!=="https://moc.oocl.com/nj_prs_wss/"||!Array.isArray(result.rows))throw new Error("Invalid official response");
   for(const key of Object.keys(criteria) as (keyof typeof criteria)[])if(result.criteria?.[key]!==criteria[key])throw new Error("Query criteria mismatch");
   if(!Number.isFinite(Date.parse(result.startedAt))||!Number.isFinite(Date.parse(result.completedAt))||Date.parse(result.startedAt)<started-1000||Date.parse(result.completedAt)<Date.parse(result.startedAt)||Date.parse(result.completedAt)>Date.now()+1000)throw new Error("Stale official response");
   if(result.rows.length!==result.count)throw new Error("Official row count mismatch");
   const schedules=parseOoclDesktopRows(result.rows,from,to,criteria.destination,result.routes);
   return {source:"OOCL_LIVE",schedules,warnings:schedules.length?[]:["NO_SCHEDULE_FOUND"],durationMs:Date.now()-started,fromCache:false};
  }
  if(response.status!==202)throw new Error("Session job unavailable");
  await new Promise(resolve=>setTimeout(resolve,1000));
 }
 throw new Error("Browser session timeout");
}
