import { samePortCode } from "@/features/ports/server/source-port-match";
export type VerifiedSeaLeg = { sea: boolean; from?: string | null; to?: string | null; vessel?: string | null };
// A port call is not a transfer: count changes of vessel, only for a complete sea-only chain.
export function classifySeaRouting(legs: VerifiedSeaLeg[], origin: string, destination: string) {
 const unknown = {direct:null,stopCount:null} as {direct:boolean|null;stopCount:number|null};
 if (!legs.length || legs.some(l=>!l.sea || !l.from || !l.to || !l.vessel)) return unknown;
 if (!samePortCode(legs[0].from!,origin) || !samePortCode(legs.at(-1)!.to!,destination)) return unknown;
 if (legs.some((l,i)=>i>0 && !samePortCode(legs[i-1].to!,l.from!))) return unknown;
 const vessel=(s:string)=>s.trim().toUpperCase().replace(/\s+/g,' ');
 const changes=legs.slice(1).filter((l,i)=>vessel(l.vessel!)!==vessel(legs[i].vessel!)).length;
 return {direct:changes===0,stopCount:changes};
}
