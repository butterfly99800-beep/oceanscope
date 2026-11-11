import type { CoscoSchedulePreview } from "@/features/cosco-scraper/types";
export type QueryAudit={scope:"returned-response";browserRows?:number;officialTotal:number|null;received:number;retained:number;excluded:Record<string,number>;unaccounted:number;complete:boolean|null};
export type AuditedSchedules=CoscoSchedulePreview[] & {audit?:QueryAudit};
export function auditedSchedules(rows:CoscoSchedulePreview[],received:number,excluded:Record<string,number>,officialTotal:number|null=null):AuditedSchedules{
 const unaccounted=received-rows.length-Object.values(excluded).reduce((a,b)=>a+b,0);
 const invalid=excluded.invalid??0;
 return Object.assign(rows,{audit:{scope:"returned-response" as const,officialTotal,received,retained:rows.length,excluded,unaccounted,complete:unaccounted!==0||invalid>0?false:officialTotal===null?null:officialTotal===received}});
}
