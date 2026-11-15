import {createHash} from "node:crypto";
import type {CoscoSchedulePreview} from "@/features/cosco-scraper/types";
type Voyage={loadingPort?:string;dischargePort?:string;facilityOrigin?:string;facilityDestination?:string;vesselName?:string};
type RawDate={dateStr?:string};
type RawRoute={RouteId:string;CargoCutoffLocalDateTime?:RawDate;CargoAvailabilityLocalDateTime?:RawDate;RouteTimeDimensionByCargoNature?:{SiCutoffLocalDateTime?:RawDate}[];Legs:{Type:string;FromETDLocalDateTime?:RawDate;ToETALocalDateTime?:RawDate}[]};
type Row={routeId:string;origin:string;destination:string;dateETD:string;dateETA:string;transitTime:number;transshipmentPort:number;cy_cutOff?:string;si_cutOff?:string;cargoAvailability?:string;cargo_nature?:{name?:string};services?:{serviceName:string}[];vesselVoyages?:{vesselName:string;exVoyageRef?:string;loadingSvvd?:string}[];DetailedSchedule?:{voyage?:Voyage[]}};
function clean(value:unknown):unknown {if(Array.isArray(value))return value.map(clean);if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).filter(([k])=>!['$$hashKey','routeId','cargo_nature','originHaulage','destinationHaulage'].includes(k)).map(([k,v])=>[k,clean(v)]));return value;}
export function parseOoclDesktopRows(rows:Row[],from:string,to:string,destination:string,routes:RawRoute[]):CoscoSchedulePreview[]{
 const result:CoscoSchedulePreview[]=[];
 for(const row of rows){
  if(row.origin!=='Shanghai')throw new Error('OOCL_DESKTOP_PORT_MISMATCH');
  const code=row.destination==='Los Angeles'?'USLAX':row.destination==='Long Beach'?'USLGB':null;
  if(!code)throw new Error('OOCL_DESKTOP_PORT_MISMATCH');
  if(!Number.isFinite(Date.parse(row.dateETD))||!Number.isFinite(Date.parse(row.dateETA)))throw new Error('OOCL_DESKTOP_DATE_INVALID');
  const raw=routes.find(r=>String(r.RouteId)===String(row.routeId));
  if(!raw)throw new Error('OOCL_DESKTOP_ROUTE_MISSING');
  const local=(value:RawDate|undefined)=>{const t=value?.dateStr;if(!t||!/^\d{14}\.\d+$/.test(t))throw new Error('OOCL_DESKTOP_DATE_INVALID');return `${t.slice(0,4)}-${t.slice(4,6)}-${t.slice(6,8)}T${t.slice(8,10)}:${t.slice(10,12)}:${t.slice(12,14)}.000Z`;};
  const voyages=raw.Legs.filter(l=>l.Type==='Voyage');
  const etd=local(voyages[0]?.FromETDLocalDateTime),eta=local(voyages.at(-1)?.ToETALocalDateTime);
  if(code!==destination||etd.slice(0,10)<from||etd.slice(0,10)>to)continue;
  if(eta<=etd)throw new Error('OOCL_DESKTOP_DATE_INVALID');
  const legs=row.DetailedSchedule?.voyage||[],v=row.vesselVoyages?.[0];
  if(!v?.vesselName||!v.exVoyageRef||!legs.length)throw new Error('OOCL_DESKTOP_DETAILS_INCOMPLETE');
  const evidence=JSON.stringify(clean(row)),rawText=`POL:\t${row.origin}\nFinal Destination Hub:\t${row.destination}\nCargo Nature:\t${row.cargo_nature?.name||''}\nOfficial Desktop: ${evidence}`;
  result.push({id:'oocl-desktop-'+createHash('sha256').update(evidence).digest('hex'),carrierName:'OOCL',vesselName:v.vesselName,voyageNumber:v.exVoyageRef,originText:row.origin,destinationText:row.destination,originLocode:'CNSHA',destinationLocode:code,etd,eta,etdTimeKnown:true,etaTimeKnown:true,serviceName:row.services?.map(x=>x.serviceName).join(' / ')||null,routeName:null,transitDays:Number.isFinite(row.transitTime)?row.transitTime:null,direct:row.transshipmentPort===0?true:row.transshipmentPort>0?false:null,stopCount:Number.isInteger(row.transshipmentPort)?row.transshipmentPort:null,transitPorts:legs.slice(0,-1).map(l=>l.dischargePort).filter((s):s is string=>Boolean(s)),cargoNature:row.cargo_nature?.name||null,originFacilityName:legs[0].facilityOrigin||null,destinationFacilityName:legs.at(-1)?.facilityDestination||null,cutOffTime:row.cy_cutOff?local(raw.CargoCutoffLocalDateTime):null,siCutOffTime:row.si_cutOff?local(raw.RouteTimeDimensionByCargoNature?.[0]?.SiCutoffLocalDateTime):null,availableTime:row.cargoAvailability?local(raw.CargoAvailabilityLocalDateTime):null,rawText});
 }
 return result;
}
