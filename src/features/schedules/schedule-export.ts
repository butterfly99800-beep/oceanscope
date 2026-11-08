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
function displayDate(value:string|null|undefined,known?:boolean) { return value ? (known ? value.slice(0,16).replace("T"," ") : value.slice(0,10)) : null; }
export async function createScheduleWorkbook(schedules:SailingSchedule[]) {
 const { Workbook } = await import("exceljs");
 const book = new Workbook();
 const sheet = book.addWorksheet("船期明细");
 sheet.addRow(["船司","起运地","起运代码","目的地","目的代码","船名","航次","服务","离港日期/时间","到达日期/时间","航程天数","直航或中转","起运码头","目的码头","截关时间","数据获取时间","数据来源"]);
 for (const row of schedules) sheet.addRow([row.carrier,row.originPort,row.originPortCode,row.destinationPort,row.destinationPortCode,row.vesselName,row.voyageNumber,row.serviceName,displayDate(row.etd,row.etdTimeKnown),displayDate(row.eta,row.etaTimeKnown),row.transitDays,row.direct===true?"直航":row.direct===false?"中转":null,row.terminal,row.destinationTerminal,row.cutOffTime,row.lastUpdated,row.source === "ZIM_LIVE_QUERY" ? "ZIM 官网已发布船期表" : row.source]);
 const summary=book.addWorksheet("航线汇总"); summary.addRow(["直达／中转","船司","服务","船期条数","已公布开航日期","最短公布航程(天)","最长公布航程(天)"]);
 for (const group of scheduleGroups(schedules)) summary.addRow([group.mode,group.carrier,group.service,group.count,group.dates.join("、"),group.minDays,group.maxDays]);
 const weekly = book.addWorksheet("每周开航汇总");
 weekly.addRow(["开航日", "直达／中转", "船司", "服务", "计划离港日期", "最短公布航程(天)", "最长公布航程(天)"]);
 for (const day of [0,1,2,3,4,5,6,-1]) for (const group of scheduleGroups(schedules.filter(row => departureWeekday(row.etd) === day))) weekly.addRow([departureWeekdays[day] || "日期待确认", group.mode, group.carrier, group.service, group.dates.join("、"), group.minDays, group.maxDays]);
 for(const target of [sheet,summary,weekly]) { target.getRow(1).font={bold:true};target.views=[{state:"frozen",ySplit:1}];target.autoFilter={from:{row:1,column:1},to:{row:1,column:target.columnCount}};target.columns.forEach(c=>{c.width=24;}); }
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
