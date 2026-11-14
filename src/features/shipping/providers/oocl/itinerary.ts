import { createHash } from "node:crypto";
import type { CoscoSchedulePreview } from "@/features/cosco-scraper/types";
/** Cargo eligibility is not a second itinerary. All other official detail evidence must match. */
export function ooclItineraryEvidence(text:string):string {
 return text.replace(/(^|\n)[ \t]*Cargo Nature:[^\n]*/gi,"$1").split(/\r?\n/).map(line=>line.trim().replace(/[ \t]+/g," ")).filter(Boolean).join("\n");
}
export function mergeOoclCargoVariants(rows:CoscoSchedulePreview[]):CoscoSchedulePreview[] {
 const groups=new Map<string,CoscoSchedulePreview>();
 for(const row of rows){
  const key=JSON.stringify([row.vesselName,row.voyageNumber,row.originText,row.destinationText,row.etd,row.eta,row.serviceName,row.transitPorts,ooclItineraryEvidence(row.rawText)]);
  const previous=groups.get(key);
  if(!previous){groups.set(key,{...row,id:`oocl-route-${createHash("sha256").update(key).digest("hex")}`});continue;}
  const cargo=Array.from(new Set([previous.cargoNature,row.cargoNature].flatMap(value=>(value||"").split(/\s*[/,;]\s*/)).filter(Boolean))).sort().join(" / ");
  previous.cargoNature=cargo||null;
  if(cargo)previous.rawText=previous.rawText.replace(/(^|\n)([ \t]*Cargo Nature:)[^\n]*/i,(_,prefix,label)=>prefix+label+" "+cargo);
 }
 return Array.from(groups.values());
}
