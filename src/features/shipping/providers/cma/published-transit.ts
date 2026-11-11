import { request } from "playwright";
import { existsSync } from "node:fs";
import { mkdtemp, writeFile, unlink, rmdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { execFile } from "node:child_process";

const sourceUrl = "https://www.cma-cgm.com/assets/public/documents/EXX%20Flyer%202026Mon.pdf";
function reader() {
  if (process.env.CMA_PDFTOTEXT_PATH || process.env.ZIM_PDFTOTEXT_PATH) return process.env.CMA_PDFTOTEXT_PATH || process.env.ZIM_PDFTOTEXT_PATH!;
  if (process.platform === "win32") for (const dir of (process.env.PATH || "").split(path.delimiter)) {
    if (path.isAbsolute(dir) && path.basename(dir).toLowerCase() === "cmd") {
      const file=path.resolve(dir,"../mingw64/bin/pdftotext.exe");if(existsSync(file))return file;
    }
  }
  return "pdftotext";
}
export function parseExxTransit(text:string): Record<string,number> {
  const normalized=text.replace(/\s+/g," ");
  if (!/EAGLE EXPRESS X/i.test(normalized) || !/TO LOS ANGELES/i.test(normalized)) return {};
  const values: Record<string,number>={};
  for (const [name,code] of [["Shanghai","CNSHA"],["Ningbo","CNNGB"],["Haiphong","VNHPH"]]) {
    const hits=[...normalized.matchAll(new RegExp("(\\d{1,3}) days from "+name,"gi"))].map(m=>Number(m[1]));
    if(hits.length && new Set(hits).size===1 && hits[0]>0) values[code]=hits[0];
  }
  return values;
}
let pending: Promise<{days:Record<string,number>;sourceUrl:string;fetchedAt:string}>|undefined;
export function fetchExxTransit() {
  if(pending)return pending;
  pending=(async()=>{
    const http=await request.newContext({extraHTTPHeaders:{"Cache-Control":"no-cache"}});
    try {
      const response=await http.get(sourceUrl,{timeout:10000});
      if(!response.ok())throw new Error("CMA_TRANSIT_PDF_HTTP_"+response.status());
      const pdf=await response.body();
      if(pdf.length>5000000 || pdf.subarray(0,5).toString()!=="%PDF-")throw new Error("CMA_TRANSIT_PDF_INVALID");
      const dir=await mkdtemp(path.join(tmpdir(),"oceanscope-cma-")),file=path.join(dir,"exx.pdf");
      try {
        await writeFile(file,pdf);
        const text=await new Promise<string>((resolve,reject)=>execFile(reader(),["-layout",file,"-"],{encoding:"utf8",timeout:30000,maxBuffer:2000000},(e,t)=>e?reject(new Error("CMA_TRANSIT_PDF_READER_FAILED")):resolve(t)));
        return {days:parseExxTransit(text),sourceUrl,fetchedAt:new Date().toISOString()};
      }finally{await unlink(file).catch(()=>undefined);await rmdir(dir).catch(()=>undefined);}
    }finally{await http.dispose();}
  })().finally(()=>{pending=undefined;});
  return pending;
}
