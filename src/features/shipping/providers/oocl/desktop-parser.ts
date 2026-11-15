import {createHash} from "node:crypto";
import type {CoscoSchedulePreview} from "@/features/cosco-scraper/types";
type RawDate={dateStr?:string};
type Facility={Name?:string;Type?:string};
type Leg={Type:string;LoadingPort?:{Name?:string};DischargePort?:{Name?:string};VesselName?:string;ExternalVoyageReference?:string;FromETDLocalDateTime?:RawDate;ToETALocalDateTime?:RawDate;CargoAvailabilityLocalDateTime?:RawDate;DestinationFacility?:Facility};
type RawRoute={RouteId:string;CargoCutoffLocalDateTime?:RawDate;CargoAvailabilityLocalDateTime?:RawDate;RouteTimeDimensionByCargoNature?:{SiCutoffLocalDateTime?:RawDate}[];Legs:Leg[]};
type Voyage={loadingPort?:string;dischargePort?:string;facilityOrigin?:string;facilityDestination?:string;vesselName?:string};
type Row={routeId:string;origin:string;destination:string;transitTime:number;transshipmentPort:number;cy_cutOff?:string;si_cutOff?:string;cargoAvailability?:string;cargo_nature?:{name?:string};services?:{serviceName:string}[];vesselVoyages?:{vesselName:string;exVoyageRef?:string}[];DetailedSchedule?:{voyage?:Voyage[]}};
type LocationEvidence={originCode:string;originName:string;destinationName:string};
function clean(value:unknown):unknown {
 if(Array.isArray(value))return value.map(clean);
 if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).filter(([k])=>!['$$hashKey','routeId','cargo_nature','originHaulage','destinationHaulage'].includes(k)).map(([k,v])=>[k,clean(v)]));
 return value;
}
function local(value:RawDate|undefined):string|null {
 const t=value?.dateStr;
 if(!t || /^(TO BE ADVISED|TBA)$/i.test(t.trim()))return null;
 if(!/^\d{14}\.\d+$/.test(t))throw new Error('OOCL_DESKTOP_DATE_INVALID');
 const iso=`${t.slice(0,4)}-${t.slice(4,6)}-${t.slice(6,8)}T${t.slice(8,10)}:${t.slice(10,12)}:${t.slice(12,14)}.000Z`;
 if(!Number.isFinite(Date.parse(iso)))throw new Error('OOCL_DESKTOP_DATE_INVALID');
 return iso;
}
const city=(name:string)=>name.split(',')[0].trim().toLowerCase();
export function parseOoclDesktopRows(rows:Row[],from:string,to:string,destination:string,routes:RawRoute[],locations?:LocationEvidence):CoscoSchedulePreview[]{
 const result:CoscoSchedulePreview[]=[];
 const expected=locations??{originCode:'CNSHA',originName:'Shanghai',destinationName:destination==='USLAX'?'Los Angeles':destination==='USLGB'?'Long Beach':''};
 if(!expected.originName||!expected.destinationName)throw new Error('OOCL_DESKTOP_LOCATION_EVIDENCE_MISSING');
 const byId=new Map(routes.map(r=>[String(r.RouteId),r]));
 for(const row of rows){
  const actualDestination=destination==='USLAX'&&city(row.destination)==='long beach'?'USLGB':destination;
  const nearbyLongBeach=destination==='USLAX'&&actualDestination==='USLGB';
  if(city(row.origin)!==city(expected.originName)||(!nearbyLongBeach&&city(row.destination)!==city(expected.destinationName)))throw new Error('OOCL_DESKTOP_PORT_MISMATCH');
  const raw=byId.get(String(row.routeId));
  if(!raw)throw new Error('OOCL_DESKTOP_ROUTE_MISSING');
  const voyages=raw.Legs.filter(l=>l.Type==='Voyage');
  const inland=raw.Legs.filter(l=>l.Type==='InboundIntermodal').at(-1);
  const etd=local(voyages[0]?.FromETDLocalDateTime);
  // Inbound intermodal availability is not an ETA. Never substitute the sea-port ETA.
  const eta=local(inland ? inland.ToETALocalDateTime : voyages.at(-1)?.ToETALocalDateTime);
  if(!etd)throw new Error('OOCL_DESKTOP_DATE_INVALID');
  if(etd.slice(0,10)<from||etd.slice(0,10)>to)continue;
  if(eta&&eta<=etd)throw new Error('OOCL_DESKTOP_DATE_INVALID');
  const legs=row.DetailedSchedule?.voyage||[],v=row.vesselVoyages?.[0];
  if(!v?.vesselName||!v.exVoyageRef||!legs.length)throw new Error('OOCL_DESKTOP_DETAILS_INCOMPLETE');
  const transfers=voyages.slice(0,-1).flatMap((leg,i)=>{
   const next=voyages[i+1],name=leg.DischargePort?.Name;
   if(!name||name.toLowerCase()!==next.LoadingPort?.Name?.toLowerCase())return [];
   return [{portName:name,portCode:'',arrivalTime:local(leg.ToETALocalDateTime),departureTime:local(next.FromETDLocalDateTime),nextVesselName:next.VesselName,nextVoyageNumber:next.ExternalVoyageReference,terminal:leg.DestinationFacility?.Name}];
  });
  const evidence=JSON.stringify(clean(row)),rawText=`POL:\t${row.origin}\nFinal Destination Hub:\t${row.destination}\nCargo Nature:\t${row.cargo_nature?.name||''}\nOfficial Desktop: ${evidence}\nOfficial Desktop Transfers: ${JSON.stringify(transfers)}`;
  result.push({id:'oocl-desktop-'+createHash('sha256').update(evidence).digest('hex'),carrierName:'OOCL',vesselName:v.vesselName,voyageNumber:v.exVoyageRef,originText:row.origin,destinationText:row.destination,originLocode:expected.originCode,destinationLocode:actualDestination,etd,eta,etdTimeKnown:true,etaTimeKnown:Boolean(eta),serviceName:row.services?.map(x=>x.serviceName).join(' / ')||null,routeName:null,transitDays:Number.isFinite(row.transitTime)?row.transitTime:null,direct:row.transshipmentPort===0?true:row.transshipmentPort>0?false:null,stopCount:Number.isInteger(row.transshipmentPort)?row.transshipmentPort:null,transitPorts:legs.slice(0,-1).map(l=>l.dischargePort).filter((s):s is string=>Boolean(s)),cargoNature:row.cargo_nature?.name||null,originFacilityName:legs[0].facilityOrigin||null,destinationFacilityName:inland?.DestinationFacility?.Name||legs.at(-1)?.facilityDestination||null,cutOffTime:row.cy_cutOff?local(raw.CargoCutoffLocalDateTime):null,siCutOffTime:row.si_cutOff?local(raw.RouteTimeDimensionByCargoNature?.[0]?.SiCutoffLocalDateTime):null,availableTime:inland?local(inland.CargoAvailabilityLocalDateTime):row.cargoAvailability?local(raw.CargoAvailabilityLocalDateTime):null,rawText});
 }
 return result;
}
