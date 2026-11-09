import type { CoscoSchedulePreview } from "@/features/cosco-scraper/types";
import { canonicalPortCode } from "@/features/ports/server/source-port-match";
import { publicProvider, publicLocationSearchTerms, publishedDate, responseText, scheduleId, type PublicScheduleInput } from "../public-http";
export const KMTC_PAGE = "https://m.ekmtc.com/index.html#/schedule";
const API = "https://api.ekmtc.com";
type Point = { ctrCd: string; plcCd: string; plcNm: string; plcEnmOnly: string };
type Row = Record<string, unknown>;
const text = (value: unknown) => typeof value === "string" && value !== "null" && value.trim() ? value.trim() : null;
export function kmtcDate(value: unknown, time?: unknown): string | null {
  if (typeof value !== "string" || !/^\d{8}(?:\d{4}(?:\d{2})?)?$/.test(value)) return null;
  const clock = value.length > 8 ? value.slice(8, 12) : typeof time === "string" && /^\d{4}$/.test(time) ? time : null;
  return publishedDate(`${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}${clock ? ` ${clock.slice(0, 2)}:${clock.slice(2)}` : ""}`);
}
export function mapKmtc(payload: unknown, origin: Point, destination: Point, originCode: string, destinationCode: string, from: string, to: string): CoscoSchedulePreview[] {
  const rows = (payload as { listSchedule?: Row[] })?.listSchedule;
  if (!Array.isArray(rows)) throw new Error("RESPONSE_INVALID: KMTC listSchedule missing");
  const schedules: CoscoSchedulePreview[] = [];
  for (const row of rows) {
    if (row.polCtrCd !== origin.ctrCd || row.pol !== origin.plcCd || row.podCtrCd !== destination.ctrCd || row.pod !== destination.plcCd) continue;
    const etd = kmtcDate(row.etd, row.etdTm), eta = kmtcDate(row.eta, row.etaTm);
    if (!etd || !eta || etd >= eta || etd.slice(0, 10) < from || etd.slice(0, 10) > to) continue;
    const stops = text(row.tsDegree), days = text(row.ttransDds);
    schedules.push({ id: scheduleId("KMTC", [originCode, destinationCode, row.vslCd, row.voyNo, etd, eta, row.info]), carrierName: "KMTC", originText: text(row.polNm) || origin.plcNm, destinationText: text(row.podNm) || destination.plcNm, originLocode: originCode, destinationLocode: destinationCode,
      vesselName: text(row.vslNm), voyageNumber: text(row.voyNo), serviceName: text(row.rteCd), routeName: text(row.rteCdNm), etd, eta,
      etdTimeKnown: typeof row.etdTm === "string" && /^\d{4}$/.test(row.etdTm), etaTimeKnown: typeof row.etaTm === "string" && /^\d{4}$/.test(row.etaTm),
      transitDays: days && /^\d+$/.test(days) ? Number(days) : null, direct: row.ts === "N" ? true : row.ts === "Y" ? false : null,
      stopCount: stops && /^\d+$/.test(stops) ? Number(stops) : null, transitPorts: [],
      originFacilityName: text(row.otrmlNm), destinationFacilityName: text(row.itrmlNm), cutOffTime: kmtcDate(row.bkgCgoCls), siCutOffTime: kmtcDate(row.bkgDocCls), availableTime: kmtcDate(row.eirOpenCls),
      rawText: JSON.stringify({ sourceUrl: API + "/schedule/schedule/leg/search-schedule", row, timeBasis: "official port-local time; offset not supplied" }) });
  }
  return schedules;
}
export const KMTCProvider = publicProvider("KMTC", KMTC_PAGE, async (context, input, from, to) => {
  async function point(port: PublicScheduleInput["originPort"]) {
    const code = canonicalPortCode(port.locode);
    for (const search of publicLocationSearchTerms(port.name)) {
    const rows = JSON.parse(await responseText(context, API + "/common/commons/places?" + new URLSearchParams({ plcNm: search }))) as Point[];
    if (!Array.isArray(rows)) throw new Error("RESPONSE_INVALID: KMTC locations missing");
    const candidates = rows.filter(row => row.ctrCd === code.slice(0, 2));
    const exact = candidates.find(row => row.ctrCd + row.plcCd === code);
    const byName = candidates.filter(row => row.plcEnmOnly?.toLowerCase() === port.name.split(",")[0].trim().toLowerCase());
    const selected = exact ?? (byName.length === 1 ? byName[0] : undefined);
    if (!selected) continue;
    return selected;
    }
    throw new Error(`PORT_NOT_FOUND: official location ${code}`);
  }
  const origin = await point(input.originPort), destination = await point(input.destinationPort);
  const params = new URLSearchParams({ mobileYN: "Y", startCtrCd: origin.ctrCd, startPlcCd: origin.plcCd, startPlcName: origin.plcNm, destCtrCd: destination.ctrCd, destPlcCd: destination.plcCd, destPlcName: destination.plcNm, searchYear: from.slice(0, 4), searchMonth: from.slice(5, 7), srchDt: from.replaceAll("-", ""), startDate: from.replaceAll("-", ""), endDate: to.replaceAll("-", ""), totStartDate: from.replaceAll("-", ""), totEndDate: to.replaceAll("-", ""), bound: "O", rf: "N", calendarOrList: "L", chkBkg: "N", vslType01: "01", vslType03: "03", filterDirect: "Y", filterTs: "Y", eiCatCd: "O", searchYN: "Y", filterTranMax: "0", filterTranMin: "0", main: "N", legIdx: "0" });
  const payload = JSON.parse(await responseText(context, API + "/schedule/schedule/leg/search-schedule?" + params));
  return mapKmtc(payload, origin, destination, canonicalPortCode(input.originPort.locode), canonicalPortCode(input.destinationPort.locode), from, to);
});
