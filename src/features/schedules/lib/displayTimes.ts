// Carrier operational times are stored as published local wall clocks.
export function formatScheduleTime(value:string|null|undefined,timeKnown=true){return value?value.slice(0,timeKnown?16:10).replace("T"," "):"";}
export function acquisitionDate(value:string|null|undefined):Date|null{if(!value)return null;const n=Date.parse(value);return Number.isFinite(n)?new Date(n+8*3600000):null;}
export function formatAcquisitionTime(value:string|null|undefined){return acquisitionDate(value)?.toISOString().slice(0,19).replace("T"," ")??"";}
export function sourceLabel(source:string|undefined,carrier:string){return source?.endsWith("_LIVE_QUERY")?`${carrier} 官网`:source==="MANUAL"?"人工录入":source==="SEED"?"演示数据":"";}
