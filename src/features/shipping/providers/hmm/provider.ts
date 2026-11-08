import { load } from "cheerio";
import type { CoscoSchedulePreview } from "@/features/cosco-scraper/types";
import { canonicalPortCode, samePortCode } from "@/features/ports/server/source-port-match";
import { publicProvider, publishedDate, responseText, scheduleId } from "../public-http";
export const HMM_PAGE = "https://www.hmm21.com/e-service/general/schedule/ScheduleMain.do";
const BASE = "https://www.hmm21.com/e-service/general/schedule/";
type Leg = { orgLocCd?: string; destnLocCd?: string; orgLocNm?: string; destnLocNm?: string; orgFcltyNm?: string; destnFcltyNm?: string; trsPtnModeCd?: string; arvlStDt?: string; dpartFnshDt?: string; vslNm?: string; cssmObVoyNo?: string; vslSvcLoopCd?: string };
type Route = { fstTrshpPortCd?: string; scndTrshpPortCd?: string; thrdTrshpPortCd?: string; porLocCd?: string; pvyLocCd?: string; porLocNm?: string; pvyLocNm?: string; transit?: Leg[]; totTrstmHrs?: number; portCtofDt?: string; sigCtofDt?: string };
export function mapHmm(payload: unknown, origin: string, destination: string, from: string, to: string): CoscoSchedulePreview[] {
  const data = payload as { grmData?: Route[]; RTN_DATA?: { grmData?: Route[] } };
  const rows = data?.grmData ?? data?.RTN_DATA?.grmData;
  if (!Array.isArray(rows)) throw new Error("RESPONSE_INVALID: HMM schedule rows missing");
  const schedules: CoscoSchedulePreview[] = [];
  for (const row of rows) {
    if (!row.porLocCd || !row.pvyLocCd || !samePortCode(row.porLocCd, origin) || !(samePortCode(row.pvyLocCd, destination) || destination === "USLAX" && row.pvyLocCd === "USLGB")) continue;
    const legs = row.transit ?? [], first = legs[0], last = legs.at(-1);
    if (!first || !last || first.orgLocCd !== row.porLocCd || last.destnLocCd !== row.pvyLocCd) continue;
    const etd = publishedDate(first.arvlStDt), eta = publishedDate(last.dpartFnshDt);
    if (!etd || !eta || etd >= eta || etd.slice(0, 10) < from || etd.slice(0, 10) > to || !row.porLocNm || !row.pvyLocNm) continue;
    const sea = legs.filter(leg => ["MM", "FF"].includes(leg.trsPtnModeCd ?? ""));
    const onlySea = sea.length === legs.length;
    const publishedTransfers = [row.fstTrshpPortCd, row.scndTrshpPortCd, row.thrdTrshpPortCd].filter((v): v is string => typeof v === "string" && /^[A-Z]{2}[A-Z0-9]{3}$/.test(v));
    schedules.push({ id: scheduleId("HMM", [row.porLocCd, row.pvyLocCd, legs]), carrierName: "HMM", originText: row.porLocNm, destinationText: row.pvyLocNm, originLocode: row.porLocCd, destinationLocode: row.pvyLocCd,
      etd, eta, etdTimeKnown: true, etaTimeKnown: true, vesselName: sea[0]?.vslNm || null, voyageNumber: sea[0]?.cssmObVoyNo || null, serviceName: sea[0]?.vslSvcLoopCd || null, routeName: null,
      transitDays: typeof row.totTrstmHrs === "number" && row.totTrstmHrs > 0 && Number.isInteger(row.totTrstmHrs / 24) ? row.totTrstmHrs / 24 : null,
      direct: publishedTransfers.length ? false : onlySea ? sea.length === 1 : null, stopCount: publishedTransfers.length || (onlySea ? sea.length - 1 : null), transitPorts: sea.slice(0, -1).map(leg => leg.destnLocNm).filter((name): name is string => Boolean(name)),
      originFacilityName: first.orgFcltyNm || null, destinationFacilityName: last.destnFcltyNm || null, cutOffTime: publishedDate(row.portCtofDt), siCutOffTime: publishedDate(row.sigCtofDt), availableTime: null,
      rawText: JSON.stringify({ sourceUrl: BASE + "selectPointToPointList.do", officialLegs: legs, row, timeBasis: "official port-local time; offset not supplied" }) });
  }
  return schedules;
}
export const HMMProvider = publicProvider("HMM", HMM_PAGE, async (context, input, from, to) => {
  const origin = canonicalPortCode(input.originPort.locode), destination = canonicalPortCode(input.destinationPort.locode);
  const $ = load(await responseText(context, HMM_PAGE));
  const csrf = $('meta[name="_csrf"]').attr("content") || $('input[name="_csrf"]').attr("value");
  if (!csrf) throw new Error("RESPONSE_INVALID: anonymous HMM session token missing");
  const post = async (path: string, data: Record<string, unknown>) => {
    const response = await context.post(BASE + path, { headers: { "X-CSRF-TOKEN": csrf }, data, timeout: 45000 });
    if (!response.ok()) throw new Error(`ACCESS_BLOCKED: official HTTP ${response.status()}`);
    const result = await response.json();
    if (result.RTN_STS !== "OK") throw new Error("QUERY_FAILED: HMM rejected query");
    return result;
  };
  const schedules: CoscoSchedulePreview[] = [];
  for (let start = from; start <= to; start = new Date(Date.parse(start) + 28 * 86400000).toISOString().slice(0, 10)) {
    const result = await post("apiPointToPointList.do", { srchPointFromCd: origin, srchCityFrom: "CY", srchPointToCd: destination, srchCityTo: "CY", srchSelPriority: "ALL", srchSailDate: start.replaceAll("-", ""), srchSelWeeks: "4", srchViewType: "L", srchSelSortBy: "1", srchPorFcltyCd: "", srchPvyFcltyCd: "", paramToday: from.replaceAll("-", "") });
    const grm = result.RTN_DATA?.RTN_DATA?.resultData ?? result.RTN_DATA?.resultData;
    if (!grm || grm.resultCode !== "S") throw new Error("RESPONSE_INVALID: HMM query result missing");
    if (!grm.GrmNo) continue;
    const rows = await post("selectPointToPointList.do", { srchViewType: "L", isNew: true, srchGrmNo: grm.GrmNo, grmSeqs: grm.GrmSeq });
    schedules.push(...mapHmm(rows, origin, destination, from, to));
  }
  return Array.from(new Map(schedules.map(row => [row.id, row])).values());
});
