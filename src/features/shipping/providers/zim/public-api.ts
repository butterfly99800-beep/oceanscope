import { auditedSchedules } from "../query-audit";
import { load } from "cheerio";
import type { APIRequestContext } from "playwright";
import type { CoscoSchedulePreview } from "@/features/cosco-scraper/types";
import { canonicalPortCode } from "@/features/ports/server/source-port-match";
import { publicLocationSearchTerms, publishedDate, responseText, scheduleId, type PublicScheduleInput } from "../public-http";
const PAGE="https://www.zim.com/schedules/point-to-point";
const API="https://apigw.zim.com";
type Location={code:string;name:string;locationType:string};
type Leg={portDepartureCode?:string;portArrivalCode?:string;portDepartureName?:string;portArrivalName?:string;departureDate?:string;arrivalDate?:string;vesselName?:string;voyage?:string;voyageNumber?:string;line?:string;ptPOrder?:number;daysAtSea?:string;depotFromName?:string;depotToName?:string;containerClosingDate?:string;docClosingDate?:string;vgmClosingDate?:string};
// ZIM's public widget displays these timestamps as local wall-clock values.
const date=(v:unknown)=>typeof v==="string"?publishedDate(v.replace(/(?:Z|[+-]\d{2}:\d{2})$/,"")):null;
function parseZimApi(payload:unknown, origin:Location,destination:Location,originCode:string,destinationCode:string,from:string,to:string):CoscoSchedulePreview[]{
 const data=payload as {isSuccess?:boolean;routes?:Leg[][]};
 if(data?.isSuccess===false)throw new Error("RESPONSE_INVALID: ZIM official query rejected");
 if(!Array.isArray(data?.routes))throw new Error("RESPONSE_INVALID: ZIM route array missing");
 return data.routes.flatMap(unsorted=>{
  if(!Array.isArray(unsorted)||!unsorted.length)return [];
  const legs=[...unsorted].sort((a,b)=>(a.ptPOrder??0)-(b.ptPOrder??0));const first=legs[0],last=legs.at(-1)!;
  if(first.portDepartureCode!==origin.code.split(";")[0]||last.portArrivalCode!==destination.code.split(";")[0])return [];
  const etd=date(first.departureDate),eta=date(last.arrivalDate);
  if(!etd||!eta||etd>=eta||etd.slice(0,10)<from||etd.slice(0,10)>to)return [];
  if(legs.some((l,i)=>!date(l.departureDate)||!date(l.arrivalDate)||date(l.departureDate)!>=date(l.arrivalDate)!||(i>0&&(legs[i-1].portArrivalCode!==l.portDepartureCode||date(legs[i-1].arrivalDate)!>date(l.departureDate)!))))return [];
  const sea=legs.every(l=>l.vesselName&&!/^(land trans|feeder)/i.test(l.vesselName));
  const changes=legs.filter((l,i)=>i>0&&(l.vesselName!==legs[i-1].vesselName||l.voyageNumber!==legs[i-1].voyageNumber)).length;const classified=sea&&legs.every(l=>l.voyageNumber);
  return [{id:scheduleId("ZIM",[originCode,destinationCode,legs]),carrierName:"ZIM",originLocode:originCode,destinationLocode:destinationCode,originText:first.portDepartureName||origin.name,destinationText:last.portArrivalName||destination.name,
   etd,eta,etdTimeKnown:true,etaTimeKnown:true,vesselName:first.vesselName||null,voyageNumber:first.voyage||first.voyageNumber||null,serviceName:first.line||null,routeName:null,
   direct:classified?changes===0:null,stopCount:classified?changes:null,transitPorts:legs.slice(0,-1).map(l=>l.portArrivalName).filter((x):x is string=>!!x),
   transitDays:legs.length===1&&/^\d+$/.test(first.daysAtSea||"")?Number(first.daysAtSea):null,originFacilityName:first.depotFromName||null,destinationFacilityName:last.depotToName||null,
   cutOffTime:date(first.containerClosingDate),siCutOffTime:date(first.docClosingDate),availableTime:null,
   rawText:JSON.stringify({sourceUrl:API+"/digitalSchedules/PointToPoint/v2",officialLegs:legs,officialOrigin:origin,officialDestination:destination,timeBasis:"official widget local wall-clock dates"})}];
 });
}
export async function queryZimApi(context:APIRequestContext,input:PublicScheduleInput,from:string,to:string){
 const $=load(await responseText(context,PAGE));const configText=$("[apim-products]").first().attr("apim-products");
 if(!configText)throw new Error("RESPONSE_INVALID: ZIM public widget configuration missing");
 const config=JSON.parse(configText)["digital-website"];
 if(config?.path!==API||typeof config.subscriptionKey!=="string")throw new Error("RESPONSE_INVALID: ZIM public widget host mismatch");
 // Anonymous browser configuration is obtained live, never persisted or logged.
 async function get(endpoint:string,params:Record<string,string>){return JSON.parse(await responseText(context,API+endpoint+"?"+new URLSearchParams({...params,"subscription-key":config.subscriptionKey})));}
 async function point(port:PublicScheduleInput["originPort"]):Promise<Location>{
  const code=canonicalPortCode(port.locode);
  const verified:Record<string,string>={CNSHA:"CNSNH",CNYTN:"CNOJA",DEHAM:"GEHAM",VNSGN:"VNHCM"};
  for(const name of publicLocationSearchTerms(port.name)){
   const data=await get("/digitalMasterData/Locations/v1/p2p-route",{searchTerm:name,pageIndex:"1",pageSize:"100"});
   if(!Array.isArray(data.results))throw new Error("RESPONSE_INVALID: ZIM locations missing");
   const result=data.results.find((p:Location)=>p.code.split(";")[0]===(verified[code]||code));if(result)return result;
  }
  throw new Error("PORT_NOT_FOUND: ZIM official location "+code);
 }
 const origin=await point(input.originPort),destination=await point(input.destinationPort);
 const start=new Date(from);const month=start.toLocaleString("en-US",{month:"long",timeZone:"UTC"});
 const payload=await get("/digitalSchedules/PointToPoint/v2",{PortCode:origin.code,PortDestinationCode:destination.code,Direction:"true",FromDate:start.getUTCDate()+"-"+month+"-"+start.getUTCFullYear(),WeeksAhead:String(Math.ceil((Date.parse(to)-Date.parse(from))/604800000)),CountryCode:"CN"});
 return mapZimApi(payload,origin,destination,canonicalPortCode(input.originPort.locode),canonicalPortCode(input.destinationPort.locode),from,to);
}

export function mapZimApi(payload:unknown,origin:Location,destination:Location,originCode:string,destinationCode:string,from:string,to:string){
 const data=payload as {isSuccess?:boolean;routes?:Leg[][]};if(data?.isSuccess===false||!Array.isArray(data?.routes))return parseZimApi(payload,origin,destination,originCode,destinationCode,from,to);
 const excluded={port:0,date:0,invalid:0};const result=data.routes.flatMap(legs=>{
  if(!Array.isArray(legs)||!legs.length){excluded.invalid++;return [];}
  const sorted=[...legs].sort((a,b)=>(a.ptPOrder??0)-(b.ptPOrder??0));
  if(sorted[0].portDepartureCode!==origin.code.split(";")[0]||sorted.at(-1)!.portArrivalCode!==destination.code.split(";")[0]){excluded.port++;return [];}
  const etd=date(sorted[0].departureDate);if(etd&&(etd.slice(0,10)<from||etd.slice(0,10)>to)){excluded.date++;return [];}
  const rows=parseZimApi({routes:[legs]},origin,destination,originCode,destinationCode,from,to);if(!rows.length)excluded.invalid++;return rows;
 });return auditedSchedules(result,data.routes.length,excluded);
}
