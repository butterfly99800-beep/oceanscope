import { querySitcBrowser } from "./browser";
import { auditedSchedules } from "../query-audit";
import { retryPublicRequest } from "../retry-public-request";
import type { APIRequestContext } from "playwright";
import type { CoscoSchedulePreview } from "@/features/cosco-scraper/types";
import { canonicalPortCode, samePortCode } from "@/features/ports/server/source-port-match";
import { publicProvider, publishedDate, scheduleId, type PublicScheduleInput } from "../public-http";
const ROOT = "https://ebusiness.sitcline.com";
type Row = { polCode: string; podCode: string; polName: string; podName: string; ctd?: string; cta?: string; weekEtd?: string; weekEta?: string; vesselName?: string; voyageNo?: string; voyageLeg?: string; serviceLineCode?: string; polTerminalName?: string; podTerminalName?: string; underway?: number };
function parseSitc(rows: Row[], origin: string, destination: string, from: string, to: string): CoscoSchedulePreview[] {
 return rows.flatMap(row => {
  if (!samePortCode(row.polCode, origin) || !samePortCode(row.podCode, destination)) return [];
  const etd = publishedDate(row.ctd || row.weekEtd), eta = publishedDate(row.cta || row.weekEta);
  if (!etd || !eta || etd >= eta || etd.slice(0,10) < from || etd.slice(0,10) > to || !row.polName || !row.podName) return [];
  return [{ id: scheduleId("SITC", row), carrierName: "SITC", originLocode: row.polCode, destinationLocode: row.podCode, originText: row.polName, destinationText: row.podName,
   etd, eta, etdTimeKnown: false, etaTimeKnown: false, vesselName: row.vesselName || null, voyageNumber: row.voyageNo ? row.voyageNo + (row.voyageLeg || "") : null,
   serviceName: row.serviceLineCode || null, routeName: null, direct: true, stopCount: 0, transitPorts: [],
   transitDays: Number.isInteger(row.underway) && row.underway! >= 0 ? row.underway! : null,
   originFacilityName: row.polTerminalName || null, destinationFacilityName: row.podTerminalName || null, cutOffTime: null, availableTime: null,
   rawText: JSON.stringify({ sourceUrl: ROOT + "/api/equery/voyageInfo/searchPlan", row, scope: "official direct sailing search", timeBasis: "official local dates; current dates preferred over proforma dates" }) }];
 });
}
async function querySitc(context: APIRequestContext, input: PublicScheduleInput, from: string, to: string, transit: boolean) {
 const codes = [canonicalPortCode(input.originPort.locode), canonicalPortCode(input.destinationPort.locode)];
 const names: string[] = [];
 for (const code of codes) {
  const q = new URLSearchParams({currentPage:"1",pageSize:"100",portCode:"%"+code+"%",portNameCn:"%"+code+"%",portName:"%"+code+"%"});
  const r = await retryPublicRequest(() => context.get(ROOT + "/api/ebusiness/autocomplete/queryListPort?" + q, {timeout:20000}));
  if (r.status() === 429) throw new Error("RATE_LIMITED: SITC HTTP 429");
 if (!r.ok()) throw new Error("ACCESS_BLOCKED: SITC HTTP " + r.status());
  const data = await r.json();
  if (data.code === 429) throw new Error("RATE_LIMITED: SITC request limit");
  const port = data.data?.records?.find((p: {portCode:string}) => samePortCode(p.portCode, code));
  if (!port) throw new Error("PORT_NOT_FOUND: " + code);
  names.push(port.portName);
 }
 const q = new URLSearchParams({pol:names[0],pod:names[1],datefrom:from,dateto:to,type:"false"});
 const r = await retryPublicRequest(() => context.post(ROOT + "/api/equery/voyageInfo/" + (transit ? "searchTsPlan" : "searchPlan") + "?" + q, {timeout:25000}));
 if (r.status() === 429) throw new Error("RATE_LIMITED: SITC HTTP 429");
 if (!r.ok()) throw new Error("ACCESS_BLOCKED: SITC HTTP " + r.status());
 const data = await r.json();
 if (data.code === 429) throw new Error("RATE_LIMITED: SITC request limit");
 if (!data.success || !Array.isArray(data.data?.list)) throw new Error("RESPONSE_INVALID: SITC schedule list missing");
 return transit ? mapSitcTransit(data.data.list, codes[0], codes[1], from, to) : mapSitc(data.data.list, codes[0], codes[1], from, to);
}

type TransitRow = {port: string; portName: string; etdEta: string; vesselVoyageLeg?: string; serviceLineCode?: string; underway?: number};
function parseSitcTransit(rows: TransitRow[], origin: string, destination: string, from: string, to: string): CoscoSchedulePreview[] {
 return rows.flatMap(row => {
  const codes = typeof row.port === "string" ? row.port.split("->") : [];
  const names = typeof row.portName === "string" ? row.portName.split("->") : [];
  const dates = typeof row.etdEta === "string" ? row.etdEta.split("->").map(publishedDate) : [];
  if (codes.length < 3 || names.length !== codes.length || dates.length !== 2*(codes.length-1) || dates.some(d => !d)) return [];
  if (!samePortCode(codes[0],origin) || !samePortCode(codes[codes.length-1],destination)) return [];
  const times = dates as string[];
  if (times.some((d,i) => i > 0 && d < times[i-1])) return [];
  const etd=times[0], eta=times[times.length-1];
  if (etd >= eta || etd.slice(0,10)<from || etd.slice(0,10)>to) return [];
  // The first leg may be an unnamed barge; do not present the later vessel as that leg.
  const firstVessel=row.vesselVoyageLeg?.split("->")[0] || "";
  const named=/^(.+?)\s+(\d+[A-Z]?)$/.exec(firstVessel);
  return [{id:scheduleId("SITC",row),carrierName:"SITC",originLocode:origin,destinationLocode:destination,originText:names[0],destinationText:names[names.length-1],
   etd,eta,etdTimeKnown:/\d{2}:\d{2}/.test(row.etdEta.split("->")[0]),etaTimeKnown:/\d{2}:\d{2}/.test(row.etdEta.split("->").at(-1) || ""),vesselName:named?.[1] || null,voyageNumber:named?.[2] || null,
   serviceName:row.serviceLineCode || null,routeName:row.portName,direct:false,stopCount:codes.length-2,transitPorts:names.slice(1,-1),
   transitDays:Number.isInteger(row.underway) && row.underway!>0 ? row.underway! : null,originFacilityName:null,destinationFacilityName:null,cutOffTime:null,availableTime:null,
   rawText:JSON.stringify({sourceUrl:ROOT+"/api/equery/voyageInfo/searchTsPlan",row,scope:"official connecting itinerary including initial barge when supplied",timeBasis:"official local times; offset not supplied"})}];
 });
}
const directProvider=publicProvider("SITC",ROOT+"/",(c,i,f,t)=>querySitc(c,i,f,t,false),async(p,i,f,t)=>mapSitc(await querySitcBrowser(p,i,f,t,false),canonicalPortCode(i.originPort.locode),canonicalPortCode(i.destinationPort.locode),f,t));
const transitProvider=publicProvider("SITC",ROOT+"/",(c,i,f,t)=>querySitc(c,i,f,t,true),async(p,i,f,t)=>mapSitcTransit(await querySitcBrowser(p,i,f,t,true),canonicalPortCode(i.originPort.locode),canonicalPortCode(i.destinationPort.locode),f,t));
export const SITCProvider={...directProvider,async searchSchedule(input:PublicScheduleInput) {
 const direct=await directProvider.searchSchedule(input);
 if(direct.warnings.some(w=>/PORT_NOT_FOUND|ACCESS_BLOCKED|VERIFICATION_REQUIRED|RATE_LIMITED/.test(w))) return direct;
 const transit=await transitProvider.searchSchedule(input);
 const schedules=[...direct.schedules,...transit.schedules];
 const warnings=[...new Set([...direct.warnings,...transit.warnings])].filter(w=>!schedules.length || w!=="NO_SCHEDULE_FOUND");
 return {...direct,schedules,warnings,audits:[direct.audit,transit.audit],durationMs:direct.durationMs+transit.durationMs};
}};

export function mapSitc(rows:Row[],origin:string,destination:string,from:string,to:string){
 const excluded={port:0,date:0,invalid:0};const result=rows.flatMap(row=>{
  if(!samePortCode(row.polCode,origin)||!samePortCode(row.podCode,destination)){excluded.port++;return [];}
  const etd=publishedDate(row.ctd||row.weekEtd);
  if(etd&&(etd.slice(0,10)<from||etd.slice(0,10)>to)){excluded.date++;return [];}
  const mapped=parseSitc([row],origin,destination,from,to);if(!mapped.length)excluded.invalid++;return mapped;
 });const output=auditedSchedules(result,rows.length,excluded);
 const browserRows=(rows as typeof rows & {browserRows?:number}).browserRows;if(typeof browserRows==="number"&&output.audit){output.audit.browserRows=browserRows;if(browserRows!==rows.length)output.audit.complete=false;}
 return output;
}
export function mapSitcTransit(rows:TransitRow[],origin:string,destination:string,from:string,to:string){
 const excluded={port:0,date:0,invalid:0};const result=rows.flatMap(row=>{
  const codes=row.port?.split("->")||[];if(!samePortCode(codes[0]||"",origin)||!samePortCode(codes.at(-1)||"",destination)){excluded.port++;return [];}
  const etd=publishedDate(row.etdEta?.split("->")[0]);if(etd&&(etd.slice(0,10)<from||etd.slice(0,10)>to)){excluded.date++;return [];}
  const mapped=parseSitcTransit([row],origin,destination,from,to);if(!mapped.length)excluded.invalid++;return mapped;
 });const output=auditedSchedules(result,rows.length,excluded);
 const browserRows=(rows as typeof rows & {browserRows?:number}).browserRows;if(typeof browserRows==="number"&&output.audit){output.audit.browserRows=browserRows;if(browserRows!==rows.length)output.audit.complete=false;}
 return output;
}
