import { queryZimApi } from "./public-api";
import { load } from "cheerio";
import { existsSync } from "node:fs";
import { mkdtemp,writeFile,unlink,rmdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { execFile } from "node:child_process";
import type { CoscoSchedulePreview } from "@/features/cosco-scraper/types";
import { canonicalPortCode } from "@/features/ports/server/source-port-match";
import { publicProvider,publishedDate,responseText,scheduleId } from "../public-http";
export const ZIM_PAGE="https://www.zim.com/global-network/asia-oceania/china/china-schedules";
const months="Jan Feb Mar Apr May Jun Jul Aug Sep Oct Nov Dec".split(" ");
function day(value:string,year:number,month:number) { const m=value.match(/^(\d{1,2})-([A-Za-z]{3})$/);if(!m)return null;const n=months.findIndex(x=>x.toLowerCase()===m[2].toLowerCase())+1;if(!n)return null;return publishedDate(String(year+(n<month?1:0))+"-"+String(n).padStart(2,"0")+"-"+m[1].padStart(2,"0")); }
export function mapZimPdf(text:string,origin:string,destination:string,from:string,to:string,url:string):CoscoSchedulePreview[] {
 if(destination!=="USLAX" || !["CNSHA","CNYTN"].includes(origin)) return [];
 const shanghai=origin==="CNSHA";
 const section=shanghai?text.split("\f").find(p=>p.includes("ZIM CENTRAL CHINA XPRESS (ZX2)")):text;
 if(!section || !section.includes("LOS ANGELES") || (shanghai?!section.includes("ETD\nSHANGHAI"):!section.includes("ZIM eCommerce Xpress (ZEX)")))throw new Error("RESPONSE_INVALID: ZIM publication layout changed");
 const period=shanghai?section.match(/(20\d{2})\s+([A-Za-z]{3})\. SCHEDULE/):section.match(/Updated ([A-Za-z]{3})\. \d{1,2}, (20\d{2})/);
 if(!period)throw new Error("RESPONSE_INVALID: ZIM publication year missing");
 const year=Number(period[shanghai?1:2]),month=months.findIndex(x=>x.toLowerCase()===period[shanghai?2:1].toLowerCase())+1;
 if(!month)throw new Error("RESPONSE_INVALID: ZIM publication month missing");
 const result:CoscoSchedulePreview[]=[];
 for(const line of section.split(/\r?\n/)) {
  const m=line.match(/^(?:\d{1,2} )?(.+?) V\.([A-Z0-9]+)\s*\([^)]*\)\s+(.+)$/);
  if(!m || /BLANK SAILING|CANCELLED/i.test(line))continue;
  const dates=m[3].trim().split(/\s+/);if(dates.length!==(shanghai?2:8) || dates.some(x=>!/^\d{1,2}-[A-Za-z]{3}$/.test(x)))throw new Error("RESPONSE_INVALID: ZIM sailing row columns changed");
  const etd=day(dates[shanghai?0:6],year,month),eta=day(dates[shanghai?1:7],year,month);
  if(!etd||!eta||etd>=eta||etd.slice(0,10)<from||etd.slice(0,10)>to)continue;
  result.push({id:scheduleId("ZIM",[origin,destination,m[1],m[2],year]),carrierName:"ZIM",originText:shanghai?"Shanghai":"Yantian",destinationText:"Los Angeles",originLocode:origin,destinationLocode:destination,vesselName:m[1],voyageNumber:m[2],serviceName:shanghai?"ZX2":"ZEX",routeName:null,etd,eta,etdTimeKnown:false,etaTimeKnown:false,transitDays:null,direct:null,stopCount:null,transitPorts:[],originFacilityName:null,destinationFacilityName:null,cutOffTime:null,availableTime:null,rawText:JSON.stringify({sourceUrl:url,publicationYear:year,publicationMonth:month,officialRow:line,scope:"official published schedule; not full point-to-point coverage"})});
 }
 return result;
}
function reader(){if(process.env.ZIM_PDFTOTEXT_PATH)return process.env.ZIM_PDFTOTEXT_PATH;if(process.platform==="win32")for(const dir of(process.env.PATH||"").split(path.delimiter)){if(path.isAbsolute(dir)&&path.basename(dir).toLowerCase()==="cmd"){const p=path.resolve(dir,"../mingw64/bin/pdftotext.exe");if(existsSync(p))return p;}}return "pdftotext";}
const provider=publicProvider("ZIM",ZIM_PAGE,async(context,input,from,to)=>{
 const origin=canonicalPortCode(input.originPort.locode),destination=canonicalPortCode(input.destinationPort.locode);
 try { return await queryZimApi(context,input,from,to); } catch (error) {
  if (/RATE_LIMITED/.test(String(error)) || destination!=="USLAX" || !["CNSHA","CNYTN"].includes(origin))throw error;
 }
 const $=load(await responseText(context,ZIM_PAGE));
 const suffix=origin==="CNSHA"?"zim-shipping-gazette-cn-shanghai.pdf":"zim-e-commerce-xpress-zex-schedule.pdf";
 const href=$("a[href]").toArray().map(a=>$(a).attr("href")||"").find(u=>u.endsWith(suffix));
 if(!href)throw new Error("RESPONSE_INVALID: current ZIM publication link missing");
 const url=new URL(href,ZIM_PAGE);if(url.origin!=="https://www.zim.com" || !url.pathname.startsWith("/assets/"))throw new Error("RESPONSE_INVALID: unexpected publication host");
 const response=await context.get(url.href,{timeout:20000});if(!response.ok())throw new Error("ACCESS_BLOCKED: ZIM PDF HTTP "+response.status());const pdf=await response.body();
 if(pdf.length>5000000 || pdf.subarray(0,5).toString()!=="%PDF-")throw new Error("RESPONSE_INVALID: not a ZIM PDF");
 const dir=await mkdtemp(path.join(tmpdir(),"oceanscope-zim-")),file=path.join(dir,"schedule.pdf");
 try{await writeFile(file,pdf);const text=await new Promise<string>((resolve,reject)=>execFile(reader(),["-raw",file,"-"],{encoding:"utf8",timeout:10000,maxBuffer:2000000},(e,t)=>e?reject(new Error("ZIM_PDF_READER_FAILED: install pdftotext")):resolve(t)));return mapZimPdf(text.replace(/\r\n/g,"\n"),origin,destination,from,to,url.href);}finally{await unlink(file).catch(()=>undefined);await rmdir(dir).catch(()=>undefined);}
});
export const ZIMProvider={...provider,async searchSchedule(input:Parameters<typeof provider.searchSchedule>[0]){const result=await provider.searchSchedule(input);return{...result,warnings:result.schedules.some(row=>row.rawText?.includes("official published schedule"))?[...result.warnings,"ZIM_PUBLISHED_ONLY: verified official publication coverage"]:result.warnings};}};
