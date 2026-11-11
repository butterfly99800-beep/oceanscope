import { load } from "cheerio";
import type { APIRequestContext } from "playwright";
import type { CoscoSchedulePreview } from "@/features/cosco-scraper/types";
import { canonicalPortCode } from "@/features/ports/server/source-port-match";
import { publicProvider, publicLocationSearchTerms, publishedDate, responseText, scheduleId, type PublicScheduleInput } from "../public-http";
const ROOT = "https://ss.shipmentlink.com";
export const EMC_PAGE = ROOT + "/tvs2/jsp/TVS2_InteractiveSchedule.jsp";
const ENDPOINT = ROOT + "/tvs2/jsp/TVS2_InteractiveScheduleRouting.jsp";
const MONTHS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
function emcDate(text: string) {
  const m = text.trim().match(/^([A-Z]{3})-(\d{2})-(\d{4})(?: (\d{2}:\d{2}))?$/);
  if (!m || !MONTHS.includes(m[1])) return null;
  return publishedDate(`${m[3]}-${String(MONTHS.indexOf(m[1]) + 1).padStart(2, "0")}-${m[2]}${m[4] ? " " + m[4] : ""}`);
}
async function point(context: APIRequestContext, port: PublicScheduleInput["originPort"]) {
  const code = canonicalPortCode(port.locode);
  for (const search of publicLocationSearchTerms(port.name)) {
  const text = await responseText(context, ROOT + "/servlet/TUF1_AutoCompleteServlet", { scope: "context", search: search.toUpperCase(), action: "preLoad", switchSql: "", datasource: "bkLocations", fromFirst: "true" });
  // The official endpoint returns JSON-shaped arrays with JavaScript hex escapes. Decode escapes, never execute it.
  const rows = JSON.parse(text.replace(/\\x([0-9a-f]{2})/gi, (_, hex) => String.fromCharCode(parseInt(hex, 16)))) as string[][];
  const decoded = rows.map(row => row.map(value => decodeURIComponent(value)));
  const row = decoded.find(row => row[0]?.includes(`(${code})`));
  if (!row) continue;
  return { code, internalCode: row[1], name: row[0] };
  }
  throw new Error(`PORT_NOT_FOUND: official location ${code}`);
}
// Classify only the displayed origin-to-discharge segment, not an omitted inland extension.
export function evergreenDirectLeg(legs: string[][] | undefined, origin: string, destination: string): boolean | null {
 return evergreenRouting(legs,origin,destination).direct;
}
export function evergreenRouting(legs: string[][] | undefined, origin: string, destination: string): {direct:boolean|null;stopCount:number|null} {
 const unknown={direct:null,stopCount:null};
 if(!legs?.length || legs.some(l=>l.length!==8))return unknown;
 const sea=legs.filter(l=>l[5]!=="WAITING");
 if(!sea.length || sea[0][1]!==origin || sea.at(-1)![2]!==destination)return unknown;
 // WAITING rows must stay at the connection port; never silently discard inland legs.
 for(let i=0;i<legs.length;i++) {
  const l=legs[i];if(i>0&&legs[i-1][2]!==l[1])return unknown;
  if(l[5]==="WAITING"){if(l[1]!==l[2])return unknown;continue;}
  if(!l[5]||/intermodal|rail|truck/i.test(l[5])||!l[6]||/^-+$/.test(l[6]))return unknown;
 }
 const vessels=sea.map(l=>l[6].trim().match(/^(.*?)\s+(?=[^\s]*\d)[A-Za-z0-9-]+$/)?.[1]?.toUpperCase());
 if(vessels.some(v=>!v))return unknown;
 const changes=vessels.slice(1).filter((v,i)=>v!==vessels[i]).length;
 return {direct:changes===0,stopCount:changes};
}
export function mapEvergreen(html: string, originCode: string, destinationCode: string, from: string, to: string): CoscoSchedulePreview[] {
  const $ = load(html);
  const table = $("table.ec-table-border-bottom");
  if (!table.length) {
    if (/no (?:sailing |routing |schedule |service |matching )?(?:result|data|found)|not available/i.test($("body").text())) return [];
    throw new Error("RESPONSE_INVALID: Evergreen schedule table missing");
  }
  const results: CoscoSchedulePreview[] = [];
  table.find("tr").each((_, tr) => {
    const cells = $(tr).children("td");
    if (cells.length !== 10 || !/^\d+$/.test(cells.eq(0).text().trim())) return;
    const dates = $(tr).next("tr").children("td");
    const clean = (n: number) => cells.eq(n).text().replace(/\s+/g, " ").trim();
    const etd = emcDate(dates.eq(1).text()), eta = emcDate(dates.eq(4).text());
    if (!etd || !eta || etd >= eta || etd.slice(0, 10) < from || etd.slice(0, 10) > to) return;
    // Keep actual sea discharge port. Never label the sea ETA as arrival at a different inland city.
    let pod = destinationCode;
    if (destinationCode === "USLAX" && /^LONG BEACH\b/.test(clean(5))) pod = "USLGB";
    else if (clean(5) !== clean(6)) return;
    if (clean(1) !== clean(2)) return;
    const params = new URLSearchParams(dates.eq(3).find("[params]").attr("params") ?? "");
    const seq = new URLSearchParams(cells.eq(8).find("[params]").attr("params") ?? "").get("seq");
    const detail = seq ? $(`#detailSeq${seq}`) : null;
    const legs = detail?.find("table.ec-table tr").toArray().filter(row => $(row).children("td").length === 8).map(row => $(row).children("td").toArray().map(cell => $(cell).text().trim()));
    const rawDetail = detail?.text().replace(/\s+/g, " ").trim() ?? "";
    const vesselName = params.get("vslName") || null, voyageNumber = params.get("voyage") || null;
    const days = clean(7);
    results.push({ id: scheduleId("EMC", [originCode, pod, vesselName, voyageNumber, etd, eta, rawDetail]), carrierName: "EVERGREEN", originText: clean(2), destinationText: clean(5), originLocode: originCode, destinationLocode: pod,
      vesselName, voyageNumber, serviceName: clean(4) || null, routeName: null, etd, eta, etdTimeKnown: false, etaTimeKnown: false,
      transitDays: pod === destinationCode && /^\d+$/.test(days) ? Number(days) : null,
      direct: evergreenRouting(legs, clean(2), clean(5)).direct, stopCount: evergreenRouting(legs, clean(2), clean(5)).stopCount, transitPorts: [], originFacilityName: null, destinationFacilityName: null,
      cutOffTime: emcDate(clean(3)), availableTime: null,
      rawText: JSON.stringify({ sourceUrl: ENDPOINT, officialRouting: rawDetail, officialLegs: legs, receipt: clean(1), delivery: clean(6), timeBasis: "official local dates; offset not supplied" }) });
  });
  return results;
}
export const EMCProvider = publicProvider("EMC", EMC_PAGE, async (context, input, from, to) => {
  const origin = await point(context, input.originPort), destination = await point(context, input.destinationPort);
  const schedules: CoscoSchedulePreview[] = [];
  // The official form supports at most four weeks per request; cover longer windows without truncation.
  for (let start = from; start <= to; start = new Date(Date.parse(start) + 28 * 86400000).toISOString().slice(0, 10)) {
    const [year, month, day] = start.split("-");
    const html = await responseText(context, ENDPOINT, { oriLocation: origin.internalCode, oriLocationName: origin.name, desLocation: destination.internalCode, desLocationName: destination.name, departureMonth: month, departureDay: day, departureYear: year, durationWeek: "28", carrier: "V", isReefer: "N", reeferCargo: "N", func: "getSearchResult", oriUseMode: "I", desUseMode: "I", groupRadioOri: "ALL", groupRadioDes: "ALL", desEastWest: "ALL", departureDateShow: `${MONTHS[Number(month)-1]}-${day}-${year}` });
    schedules.push(...mapEvergreen(html, origin.code, destination.code, from, to));
  }
  return Array.from(new Map(schedules.map(row => [row.id, row])).values());
});
