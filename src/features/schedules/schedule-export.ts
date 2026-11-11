import { acquisitionDate, sourceLabel } from "./lib/displayTimes";
import type { SailingSchedule } from "./types";
export function scheduleGroups(schedules: SailingSchedule[]) {
 const groups = new Map<string, {carrier:string;service:string|null;mode:string;dates:Set<string>;days:number[];count:number}>();
 for (const row of schedules) {
  const mode = row.direct === true ? "直航" : row.direct === false ? "中转" : "直达／中转待确认";
  const key = JSON.stringify([mode,row.carrier,row.serviceName]);
  const group = groups.get(key) ?? {carrier:row.carrier,service:row.serviceName,mode,dates:new Set<string>(),days:[],count:0};
  group.dates.add(row.etd.slice(0,10)); if (row.transitDays !== null && Number.isFinite(row.transitDays)) group.days.push(row.transitDays);
  group.count++; groups.set(key,group);
 }
 return Array.from(groups.values()).map(g=>({...g,dates:Array.from(g.dates).sort(),minDays:g.days.length?Math.min(...g.days):null,maxDays:g.days.length?Math.max(...g.days):null}));
}
function displayDate(value:string|null|undefined) { if(!value)return null;const date=new Date(value.slice(0,19)+ (value.length>=19 ? "Z" : value.length===10 ? "T00:00:00Z" : ":00Z"));return Number.isFinite(date.getTime())?date:null; }
export async function createScheduleWorkbook(schedules:SailingSchedule[]) {
 const { Workbook } = await import("exceljs");
 const book = new Workbook();
 const sheet = book.addWorksheet("船期明细");
 sheet.addRow(["船司","起运地","起运代码","目的地","目的代码","船名","航次","服务","离港日期/时间","到达日期/时间","航程天数","直航或中转","起运码头","目的码头","截关时间（港口当地）","数据获取时间（北京时间）","数据来源","中转港","中转到港时间","中转离港时间","后续船名 / 航次","航程依据"]);
 const transfers=book.addWorksheet("中转明细");
 transfers.addRow(["船期序号","船司","首程船名","首程航次","中转顺序","中转港","港口代码","到港时间（当地）","离港时间（当地）","后续船名","后续航次","码头"]);
 for (const [index,row] of schedules.entries()) {
  const ports=row.transitPorts??[];
  const excelRow=sheet.addRow([row.carrier,row.originPort,row.originPortCode,row.destinationPort,row.destinationPortCode,row.vesselName,row.voyageNumber,row.serviceName,displayDate(row.etd),displayDate(row.eta),row.transitDays,row.direct===true?"直航":row.direct===false?"中转":null,row.terminal,row.destinationTerminal,displayDate(row.cutOffTime),acquisitionDate(row.lastUpdated),sourceLabel(row.source,row.carrier),ports.map(p=>[p.portName,p.portCode].filter(Boolean).join(" ")).join(" → "),ports.map(p=>p.arrivalTime?.slice(0,16).replace("T"," ")||"").join("\n"),ports.map(p=>p.departureTime?.slice(0,16).replace("T"," ")||"").join("\n"),ports.map(p=>[p.nextVesselName,p.nextVoyageNumber].filter(Boolean).join(" / ")).join("\n"),row.transitDays===null?null:row.transitDaysBasis||"官网公布"]);
  for(const col of [9,10,15,16])excelRow.getCell(col).numFmt=col===16?"yyyy-mm-dd hh:mm:ss":((col===9&&row.etdTimeKnown===false)||(col===10&&row.etaTimeKnown===false)||(col===15&&row.source==="OOCL_LIVE_QUERY"))?"yyyy-mm-dd":"yyyy-mm-dd hh:mm";
  for(const [i,p] of ports.entries()){const r=transfers.addRow([index+1,row.carrier,row.vesselName,row.voyageNumber,i+1,p.portName,p.portCode,displayDate(p.arrivalTime),displayDate(p.departureTime),p.nextVesselName,p.nextVoyageNumber,p.terminal]);for(const col of [8,9])r.getCell(col).numFmt=(col===8?p.arrivalTime:p.departureTime).length<=10?"yyyy-mm-dd":"yyyy-mm-dd hh:mm";}
 }

 const summary=book.addWorksheet("航线汇总"); summary.addRow(["直达／中转","船司","服务","船期条数","已公布开航日期","最短公布航程(天)","最长公布航程(天)"]);
 for (const group of scheduleGroups(schedules)) summary.addRow([group.mode,group.carrier,group.service,group.count,group.dates.join("、"),group.minDays,group.maxDays]);
 const weekly = book.addWorksheet("每周开航汇总");
 weekly.addRow(["开航日", "直达／中转", "船司", "服务", "计划离港日期", "最短公布航程(天)", "最长公布航程(天)"]);
 for (const day of [0,1,2,3,4,5,6,-1]) for (const group of scheduleGroups(schedules.filter(row => departureWeekday(row.etd) === day))) weekly.addRow([departureWeekdays[day] || "日期待确认", group.mode, group.carrier, group.service, group.dates.join("、"), group.minDays, group.maxDays]);
 for(const target of [sheet,summary,weekly,transfers]) { target.getRow(1).font={bold:true,color:{argb:"FFFFFFFF"}};target.getRow(1).fill={type:"pattern",pattern:"solid",fgColor:{argb:"FF2862A4"}};target.getRow(1).height=32;target.views=[{state:"frozen",ySplit:1}];target.autoFilter={from:{row:1,column:1},to:{row:1,column:target.columnCount}};target.columns.forEach(c=>{c.width=26;c.alignment={vertical:"top",wrapText:true};}); }
 return book;
}

export const departureWeekdays = ["周一", "周二", "周三", "周四", "周五", "周六", "周日"];
export function departureWeekday(value: string): number {
 const day = value.slice(0,10);
 if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return -1;
 const date = new Date(day + "T00:00:00Z");
 if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0,10) !== day) return -1;
 return (date.getUTCDay()+6)%7;
}
