// Keep public queries within four-week windows without dropping later dates.
export function scheduleDateWindows(from:string,to:string) {
  if(!/^\d{4}-\d{2}-\d{2}$/.test(from)||!/^\d{4}-\d{2}-\d{2}$/.test(to)||!Number.isFinite(Date.parse(from))||!Number.isFinite(Date.parse(to))||to<from||Date.parse(to)-Date.parse(from)>=70*86400000)throw new Error("INVALID_DATE_RANGE");
  if(new Date(from).toISOString().slice(0,10)!==from || new Date(to).toISOString().slice(0,10)!==to)throw new Error("INVALID_DATE_RANGE");
  const result: Array<{from:string;to:string}>=[];
  for(let start=Date.parse(from);start<=Date.parse(to);start+=28*86400000)result.push({from:new Date(start).toISOString().slice(0,10),to:new Date(Math.min(start+27*86400000,Date.parse(to))).toISOString().slice(0,10)});
  return result;
}
