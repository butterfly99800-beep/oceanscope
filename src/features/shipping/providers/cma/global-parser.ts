import { load } from "cheerio";
import type { CoscoSchedulePreview } from "@/features/cosco-scraper/types";
const MONTHS = ["jan","feb","mar","apr","may","jun","jul","aug","sep","oct","nov","dec"];
function date(value: string | undefined): string | null {
 if(!value)return null;
 const us=value.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
 if(us)return `${us[3]}-${us[1].padStart(2,"0")}-${us[2].padStart(2,"0")}T12:00:00.000Z`;
 const local=value.match(/(\d{1,2})-([A-Za-z]{3}|\d{1,2}月)-(\d{4})(?:,?\s+(\d{1,2}):(\d{2})\s*(AM|PM)?)?/i);
 if(!local)return null;
 const month=local[2].endsWith("月")?Number(local[2].slice(0,-1)):MONTHS.indexOf(local[2].toLowerCase())+1;
 if(month<1||month>12)return null;
 let hour=Number(local[4]||12);
 if(local[6])hour=hour%12+(local[6].toUpperCase()==="PM"?12:0);
 return `${local[3]}-${String(month).padStart(2,"0")}-${local[1].padStart(2,"0")}T${String(hour).padStart(2,"0")}:${local[5]||"00"}:00.000Z`;
}
/** Read official result cards, independent of the selected English/Chinese UI language. */
export function parseCmaGlobalHtml(html:string,from:string,to:string):CoscoSchedulePreview[] {
 const $=load(html);const rows:CoscoSchedulePreview[]=[];
 $(".cardelem").each((index,element)=>{
  const card=$(element),summary=card.find('[id^="bottom-card-"] > .wrap-card').first();
  const scope=summary.length?summary:card;
  const dep=scope.find(".DepartureDatesCls").first(),arr=scope.find(".ArrivalDatesCls").last();
  const etd=date(dep.attr("data-event-date")),eta=date(arr.attr("data-event-date"));
  if(!etd||!eta||etd.slice(0,10)<from||etd.slice(0,10)>to)return;
  const port=(node:typeof dep)=>{const link=node.find("a[href*='/port/details']").first();let description="";
   try{description=new URL(link.attr("href")||"","https://www.cma-cgm.com").searchParams.get("ActualPOLDescription")||"";}catch{}
   const parts=description.split(/\s*;\s*/);return {name:parts[0]||null,code:parts[2]||null};};
  const origin=port(dep),destination=port(arr);if(!origin.name||!destination.name)return;
  const values=new Map<string,string>();scope.find("dt").each((_,el)=>{values.set($(el).text().trim().toLowerCase(),$(el).next("dd").text().trim());});
  const get=(...labels:string[])=>labels.map(l=>values.get(l)).find(Boolean)||null;
  const voyageLink=scope.find("a[href*='voyageReference=']").first();
  const transit=scope.find('[id^="Transit_"]').attr("data-value");
  const route=scope.find('[id="Direct"]').text().trim();
  const serviceClass=(card.attr("class")||"").match(/solution_(\d+)/)?.[1];
  const service=serviceClass?$(`#rs-${serviceClass}`).parent().text().match(/Service\s+(.+)/i)?.[1]?.trim():null;
  const voyage=voyageLink.text().trim()||get("voyage ref.","航次");
  rows.push({id:`cma-${voyage||index}-${etd}`,carrierName:"CMA CGM",serviceName:service||get("service","服务"),routeName:null,
   vesselName:get("main vessel","大船","vessel","船名"),voyageNumber:voyage,originText:origin.name,destinationText:destination.name,
   originLocode:origin.code,destinationLocode:destination.code,etd,eta,etdTimeKnown:false,etaTimeKnown:false,
   transitDays:transit!==undefined&&transit.trim()!==""&&Number.isFinite(Number(transit))?Number(transit):null,
   direct:/^(direct|直接|直达)$/i.test(route)?true:/tranship|transship|中转/i.test(route)?false:null,
   stopCount:null,transitPorts:[],cargoNature:null,cutOffTime:date(get("port cut-off","port cut off","港口截关")||undefined),availableTime:null,
   originFacilityName:dep.find("a[href*='/terminal/detail/']").first().text().trim()||null,
   destinationFacilityName:arr.find("a[href*='/terminal/detail/']").first().text().trim()||null,
   outboundHaulage:null,inboundHaulage:null,
   rawText:JSON.stringify({sourceUrl:"https://www.cma-cgm.com/ebusiness/schedules/routing-finder",pageText:card.text().replace(/\s+/g," ").trim()})});
 });return rows;
}
