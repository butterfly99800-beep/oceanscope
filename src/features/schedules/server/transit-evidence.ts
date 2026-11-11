import type { ScheduleTransitPort } from "../types";

type RecordValue = Record<string, unknown>;
const obj=(v:unknown):RecordValue=>v!==null&&typeof v==="object"&&!Array.isArray(v)?v as RecordValue:{};
const list=(v:unknown):RecordValue[]=>Array.isArray(v)?v.map(obj):[];
const str=(v:unknown):string=>typeof v==="string"?v.trim():"";
// Operational dates are carrier-local wall clocks, not UTC instants.
const date=(v:unknown):string=>{const s=str(v).replaceAll("/","-");return s.match(/^\d{4}-\d{2}-\d{2}(?:[T ]\d{2}:\d{2}(?::\d{2})?)?/)?.[0].replace(" ","T")??"";};
type Leg={from:string;to:string;name:string;arrival:string;departure:string;vessel:string;voyage:string;terminal:string};
export function transitEvidence(source:string,raw:unknown,fallback:string[]=[]):ScheduleTransitPort[]{
 let root:RecordValue={};try{root=typeof raw==="string"?obj(JSON.parse(raw)):obj(raw);}catch{/* Unstructured official text. */}
 if(source==="OOCL_LIVE_QUERY"&&typeof raw==="string"&&!raw.trim().startsWith("{")){
  const value=(s:string,label:string)=>s.match(new RegExp(label+":"+"[ \t]*([^\n]+)","i"))?.[1]?.trim()||"";
  const blocks=raw.split(/(?=Service:)/).filter(b=>/POL:/.test(b)&&/POD:/.test(b));
  const nodes=blocks.slice(0,-1).flatMap((b,i)=>{const name=value(b,"POD"),next=blocks[i+1];if(!name||name.toLowerCase()!==value(next,"POL").toLowerCase())return [];const vessel=value(next,"Vessel Voyage");return [{portName:name,portCode:"",arrivalTime:"",departureTime:"",waitingHours:null,nextVesselName:vessel&&!/^TBA$/i.test(vessel)?vessel:undefined}];});
  if(nodes.length)return nodes;
 }
 const saved=list(root.oceanScopeTransit);
 if(saved.length)return saved.map(p=>({portName:str(p.portName),portCode:str(p.portCode),arrivalTime:date(p.arrivalTime),departureTime:date(p.departureTime),waitingHours:typeof p.waitingHours==="number"?p.waitingHours:null,nextVesselName:str(p.nextVesselName)||undefined,nextVoyageNumber:str(p.nextVoyageNumber)||undefined,terminal:str(p.terminal)||undefined}));
 const row=obj(root.row);let legs:Leg[]=[];
 const rawLegs=list(root.officialLegs);
 if(source==="HMM_LIVE_QUERY"){
  const all=rawLegs.length?rawLegs:list(row.transit);
  const codes=[row.fstTrshpPortCd,row.scndTrshpPortCd,row.thrdTrshpPortCd].map(str).filter(Boolean);
  return codes.map(code=>{const incoming=all.find(l=>l.destnLocCd===code&&l.orgLocCd!==code);const outgoing=all.find(l=>l.orgLocCd===code&&l.destnLocCd!==code);return {portCode:code,portName:str(incoming?.destnLocNm)||str(outgoing?.orgLocNm),arrivalTime:date(incoming?.dpartFnshDt),departureTime:date(outgoing?.arvlStDt),waitingHours:null,nextVesselName:str(outgoing?.vslNm)||undefined,nextVoyageNumber:str(outgoing?.cssmObVoyNo)||undefined,terminal:str(incoming?.destnFcltyNm)||undefined};});
 }
 if(source==="YML_LIVE_QUERY")legs=rawLegs.map(l=>({from:str(l.locationCodeFrom),to:str(l.locationCodeTo),name:str(l.locationNameTo),arrival:date(l.eta),departure:date(l.etd),vessel:str(l.vesselName),voyage:str(l.comnVoyage),terminal:str(l.terminalNameTo)}));
 if(source==="MSC_LIVE_QUERY")legs=rawLegs.map(l=>({from:str(l.DeparturePortUNCode),to:str(l.ArrivalPortUNCode),name:str(l.ArrivalPortName),arrival:date(l.EstimatedArrivalTime),departure:date(l.EstimatedDepartureTime),vessel:str(l.VesselName),voyage:str(l.DepartureVoyageNo),terminal:str(l.ArrivalEquipmentHandlingFacilityName)}));
 if(source==="ONE_LIVE_QUERY")legs=rawLegs.map(l=>({from:str(l.polYardCode).slice(0,5),to:str(l.podYardCode).slice(0,5),name:str(l.podLocationName),arrival:date(l.arrivalDate),departure:date(l.departureDate),vessel:str(l.vsslName),voyage:str(l.vvdName),terminal:""}));
 if(source==="ZIM_LIVE_QUERY")legs=rawLegs.map(l=>({from:str(l.portDepartureCode),to:str(l.portArrivalCode),name:str(l.portArrivalName),arrival:date(l.arrivalDate),departure:date(l.departureDate),vessel:str(l.vesselName),voyage:str(l.voyage)||str(l.voyageNumber),terminal:str(l.depotToName)}));
 if(source==="SITC_LIVE_QUERY"&&typeof row.port==="string"){
  const codes=row.port.split("->"),names=str(row.portName).split("->"),times=str(row.etdEta).split("->"),vessels=str(row.vesselVoyageLeg).split("->");
  if(names.length===codes.length&&times.length===(codes.length-1)*2)return codes.slice(1,-1).map((code,i)=>({portCode:code,portName:names[i+1],arrivalTime:date(times[2*i+1]),departureTime:date(times[2*i+2]),waitingHours:null,nextVesselName:vessels[i+1]||undefined}));
 }
 if(source==="HAPAG_LIVE_QUERY")legs=list(root.legs).map(l=>({from:str(obj(l.departureLocation).unLocationCode),to:str(obj(l.arrivalLocation).unLocationCode),name:str(obj(l.arrivalLocation).locationName),arrival:date(l.arrivalDateTime),departure:date(l.departureDateTime),vessel:str(obj(l.vesselDetails).name),voyage:str(l.scheduleVoyageNumber),terminal:str(obj(l.arrivalLocation).name)}));
 if(source==="COSCO_LIVE_QUERY")legs=rawLegs.map(l=>({from:str(l.pol),to:str(l.pod),name:str(l.pod),arrival:date(l.eta),departure:date(l.etd),vessel:str(l.vessel),voyage:str(l.extVoyage),terminal:str(l.inboundFacilityName)}));
 if(source==="MAERSK_LIVE_QUERY")legs=list(root.routingLegs).map(l=>{const c=obj(l.carriage),a=obj(c.vesselPortCallStart),b=obj(c.vesselPortCallEnd);return {from:str(obj(obj(a.location).facility).facilityCode),to:str(obj(obj(b.location).facility).facilityCode),name:str(obj(obj(b.location).facility).facilityName),arrival:date(b.estimatedTimeOfArrival),departure:date(a.estimatedTimeOfDeparture),vessel:str(obj(c.vessel).vesselName),voyage:str(a.departureVoyageNumber),terminal:""};});
 // MSC publishes connection nodes: the incoming arrival and outgoing departure are on the same node.
 if(source==="MSC_LIVE_QUERY"&&rawLegs.some(l=>l.ArrivalPortUNCode&&l.ArrivalPortUNCode===l.DeparturePortUNCode))return rawLegs.filter(l=>l.ArrivalPortUNCode&&l.ArrivalPortUNCode===l.DeparturePortUNCode&&l.LastLeg!==true).map(l=>({portCode:str(l.ArrivalPortUNCode),portName:str(l.ArrivalPortName),arrivalTime:date(l.EstimatedArrivalTime),departureTime:date(l.EstimatedDepartureTime),waitingHours:null,nextVesselName:str(obj(l.Vessel).VesselName)||undefined,nextVoyageNumber:str(l.DepartureVoyageNo)||undefined,terminal:str(l.ArrivalEquipmentHandlingFacilityName)||undefined}));
 if(source==="EMC_LIVE_QUERY"&&Array.isArray(root.officialLegs)){
  const d=(v:unknown)=>{const m=str(v).match(/^([A-Z]{3})-(\d{2})-(\d{4})/);const month=m?["JAN","FEB","MAR","APR","MAY","JUN","JUL","AUG","SEP","OCT","NOV","DEC"].indexOf(m[1])+1:0;return m&&month?`${m[3]}-${String(month).padStart(2,"0")}-${m[2]}`:"";};
  legs=root.officialLegs.filter((l):l is string[]=>Array.isArray(l)&&l.length===8&&l[5]!=="WAITING"&&l[1]!==l[2]).map(l=>({from:l[1],to:l[2],name:l[2],departure:d(l[3]),arrival:d(l[4]),vessel:l[6],voyage:"",terminal:""}));
 }
 const result:ScheduleTransitPort[]=[];
 for(let i=0;i<legs.length-1;i++){const a=legs[i],b=legs[i+1];if(!a.to||a.to!==b.from)continue;if(a.vessel&&b.vessel&&a.vessel.trim().toUpperCase()===b.vessel.trim().toUpperCase()&&(source==="MAERSK_LIVE_QUERY"||(a.voyage&&a.voyage===b.voyage)))continue;result.push({portCode:source==="COSCO_LIVE_QUERY"||source==="EMC_LIVE_QUERY"?"":a.to,portName:a.name,arrivalTime:a.arrival,departureTime:b.departure,waitingHours:null,nextVesselName:b.vessel||undefined,nextVoyageNumber:b.voyage||undefined,terminal:a.terminal||undefined});}
 if(result.length)return result;
 return [...new Set(fallback.filter(Boolean))].map(name=>({portName:/^[A-Z]{2}[A-Z0-9]{3}$/.test(name)?"":name,portCode:/^[A-Z]{2}[A-Z0-9]{3}$/.test(name)?name:"",arrivalTime:"",departureTime:"",waitingHours:null}));
}
export function withTransitEvidence(source:string,raw:string,names:string[]):string{
 if(source==="OOCL_LIVE_QUERY")return raw; // Keep the port-verification text format unchanged.
 const transit=transitEvidence(source,raw,names);if(!transit.length)return raw;
 try{const parsed=JSON.parse(raw);const root=Array.isArray(parsed)?{officialPayload:parsed}:obj(parsed);return JSON.stringify({...root,oceanScopeTransit:transit});}catch{return JSON.stringify({officialText:raw,oceanScopeTransit:transit});}
}
