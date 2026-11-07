import type { CoscoSchedulePreview } from "@/features/cosco-scraper/types";
import { canonicalPortCode, samePortCode } from "@/features/ports/server/source-port-match";
import { publicProvider, publishedDate, scheduleId } from "../public-http";
const ROOT = "https://ebusiness.sitcline.com";
type Row = { polCode: string; podCode: string; polName: string; podName: string; ctd?: string; cta?: string; weekEtd?: string; weekEta?: string; vesselName?: string; voyageNo?: string; voyageLeg?: string; serviceLineCode?: string; polTerminalName?: string; podTerminalName?: string; underway?: number };
export function mapSitc(rows: Row[], origin: string, destination: string, from: string, to: string): CoscoSchedulePreview[] {
 return rows.flatMap(row => {
  if (!samePortCode(row.polCode, origin) || !samePortCode(row.podCode, destination)) return [];
  const etd = publishedDate(row.ctd || row.weekEtd), eta = publishedDate(row.cta || row.weekEta);
  if (!etd || !eta || etd >= eta || etd.slice(0,10) < from || etd.slice(0,10) > to || !row.polName || !row.podName) return [];
  return [{ id: scheduleId("SITC", row), carrierName: "SITC", originLocode: row.polCode, destinationLocode: row.podCode, originText: row.polName, destinationText: row.podName,
   etd, eta, etdTimeKnown: false, etaTimeKnown: false, vesselName: row.vesselName || null, voyageNumber: row.voyageNo ? row.voyageNo + (row.voyageLeg || "") : null,
   serviceName: row.serviceLineCode || null, routeName: null, direct: true, stopCount: 0, transitPorts: [],
   transitDays: !row.ctd && !row.cta && Number.isInteger(row.underway) ? row.underway! : null,
   originFacilityName: row.polTerminalName || null, destinationFacilityName: row.podTerminalName || null, cutOffTime: null, availableTime: null,
   rawText: JSON.stringify({ sourceUrl: ROOT + "/api/equery/voyageInfo/searchPlan", row, scope: "official direct sailing search", timeBasis: "official local dates; current dates preferred over proforma dates" }) }];
 });
}
const directProvider = publicProvider("SITC", ROOT + "/", async (context, input, from, to) => {
 const codes = [canonicalPortCode(input.originPort.locode), canonicalPortCode(input.destinationPort.locode)];
 const names: string[] = [];
 for (const code of codes) {
  const q = new URLSearchParams({currentPage:"1",pageSize:"100",portCode:"%"+code+"%",portNameCn:"%"+code+"%",portName:"%"+code+"%"});
  const r = await context.get(ROOT + "/api/ebusiness/autocomplete/queryListPort?" + q, {timeout:20000});
  if (!r.ok()) throw new Error("ACCESS_BLOCKED: SITC HTTP " + r.status());
  const data = await r.json();
  if (data.code === 429) throw new Error("VERIFICATION_REQUIRED: SITC request verification");
  const port = data.data?.records?.find((p: {portCode:string}) => samePortCode(p.portCode, code));
  if (!port) throw new Error("PORT_NOT_FOUND: " + code);
  names.push(port.portName);
 }
 const q = new URLSearchParams({pol:names[0],pod:names[1],datefrom:from,dateto:to,type:"false"});
 const r = await context.post(ROOT + "/api/equery/voyageInfo/searchPlan?" + q, {timeout:25000});
 if (!r.ok()) throw new Error("ACCESS_BLOCKED: SITC HTTP " + r.status());
 const data = await r.json();
 if (data.code === 429) throw new Error("VERIFICATION_REQUIRED: SITC request verification");
 if (!data.success || !Array.isArray(data.data?.list)) throw new Error("RESPONSE_INVALID: SITC schedule list missing");
 return mapSitc(data.data.list, codes[0], codes[1], from, to);
});

export const SITCProvider = { ...directProvider, async searchSchedule(input: Parameters<typeof directProvider.searchSchedule>[0]) { const result = await directProvider.searchSchedule(input); return { ...result, warnings: [...result.warnings, "SITC_DIRECT_ONLY: official direct sailings; transshipment not yet verified"] }; } };
