export async function collectOfficialPages<T>(read:(page:number)=>Promise<{data:T[];recordsFiltered:number}>):Promise<T[]>{
 const rows:T[]=[];const seen=new Set<string>();let total:number|undefined;
 for(let page=1;;page++){
  const response=await read(page);const count=Number(response.recordsFiltered);
  if(!Array.isArray(response.data)||!Number.isSafeInteger(count)||count<0)throw new Error("PAGINATION_INCOMPLETE: invalid official total");
  if(total!==undefined&&count!==total)throw new Error("PAGINATION_INCOMPLETE: official total changed during query");total=count;
  const signature=JSON.stringify(response.data);
  if(response.data.length&&seen.has(signature))throw new Error("PAGINATION_INCOMPLETE: repeated official page");seen.add(signature);
  rows.push(...response.data);if(rows.length===total)return rows;
  if(rows.length>total||!response.data.length)throw new Error("PAGINATION_INCOMPLETE: official row count mismatch");
 }
}
