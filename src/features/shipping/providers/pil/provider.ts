import { queryPilBrowser } from "./browser";
import { auditedSchedules } from "../query-audit";
import { retryPublicRequest } from "../retry-public-request";
import { load } from "cheerio";
import type { CoscoSchedulePreview } from "@/features/cosco-scraper/types";
import { canonicalPortCode, samePortCode } from "@/features/ports/server/source-port-match";
import { publicProvider, publishedDate, responseText, scheduleId } from "../public-http";
export const PIL_PAGE = "https://www.pilship.com/digital-solutions/?id=schedules&label=pointToPoint&tab=customer";
const ROOT = "https://www.pilship.com";
const API = ROOT + "/wp-content/themes/hello-theme-child-master/pil-api/";
function pilDate(value: string) {
  const match = value.match(/^(\d{2})-([A-Za-z]{3})-(\d{4})/);
  const month = match ? ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"].indexOf(match[2].toLowerCase()) + 1 : 0;
  return match && month ? publishedDate(`${match[3]}-${String(month).padStart(2, "0")}-${match[1]}`) : null;
}
export function mapPil(payload: unknown, origin: string, destination: string, from: string, to: string): CoscoSchedulePreview[] {
  const data = payload as { success?: boolean; browserRows?:number; schedulePointToPoint?: { err?: number; main?: string } };
  if (!data?.success || typeof data.schedulePointToPoint?.main !== "string") throw new Error("RESPONSE_INVALID: PIL schedule table missing");
  const $ = load(data.schedulePointToPoint.main);
  if (!$("#table_p2p").length) {
    if (/no (?:result|data|schedule)/i.test($.text())) return auditedSchedules([],0,{});
    throw new Error("RESPONSE_INVALID: PIL schedule table missing");
  }
  const schedules: CoscoSchedulePreview[] = [];
  const excluded={port:0,date:0,invalid:0};
  $('tr[id^="schedule_"]').each((_, tr) => {
    const cells = $(tr).children("td");
    if (cells.length !== 12) {excluded.invalid++;return;}
    const value = (index: number) => cells.eq(index).text().replace(/\s+/g, " ").trim();
    const link = cells.eq(11).find("a[name=bookinfo]").attr("href");
    if (!link) {excluded.invalid++;return;}
    const params = new URL(link, ROOT).searchParams;
    if (!samePortCode(params.get("POL") ?? "", origin) || !samePortCode(params.get("POD") ?? "", destination)) {excluded.port++;return;}
    const etd = pilDate(value(2)), eta = pilDate(value(3));
    if (!etd || !eta || etd >= eta) {excluded.invalid++;return;}
    if(etd.slice(0,10)<from||etd.slice(0,10)>to){excluded.date++;return;}
    const detail = $("#schedule_info_" + $(tr).attr("id")?.replace("schedule_", ""));
    const seaLegs = detail.find(".fa-ship").length;
    const connectionDate=(text:string)=>{const m=text.match(/(\d{2})-([A-Za-z]{3})/);if(!m)return "";const candidates=[Number(etd.slice(0,4)),Number(eta.slice(0,4))].filter((v,i,a)=>a.indexOf(v)===i).map(y=>pilDate(`${m[1]}-${m[2]}-${y}`)).filter((v):v is string=>!!v&&v>=etd&&v<=eta);return candidates.length===1?candidates[0].slice(0,10):"";};
    const connections=detail.find("tr").toArray().flatMap(node=>{const current=$(node);if(!current.find(".fa-anchor").length)return [];const nextShip=current.nextAll("tr").filter((_,r)=>$(r).find(".fa-ship").length>0).first().children("td");const vessel=nextShip.eq(2).text().trim(),voyage=nextShip.eq(3).text().trim();return [{portName:current.children("td").last().text().trim(),portCode:"",arrivalTime:connectionDate(current.prev("tr").text()),departureTime:connectionDate(current.next("tr").text()),waitingHours:null,nextVesselName:/^(Water|Truck|Rail)$/i.test(vessel)?undefined:vessel||undefined,nextVoyageNumber:/^(Water|Truck|Rail)$/i.test(voyage)?undefined:voyage||undefined}];});

    const vesselName = value(6) || null, voyageNumber = value(9) || null;
    schedules.push({ id: scheduleId("PIL", [origin, destination, vesselName, voyageNumber, etd, eta, detail.text()]), carrierName: "PIL", originText: value(1), destinationText: value(4), originLocode: origin, destinationLocode: destination,
      vesselName, voyageNumber, serviceName: value(7) || null, routeName: null, etd, eta, etdTimeKnown: false, etaTimeKnown: false,
      transitDays: /^\d+$/.test(value(10)) ? Number(value(10)) : null, direct: seaLegs ? seaLegs === 1 : null, stopCount: seaLegs ? seaLegs - 1 : null,
      transitPorts: connections.map(p=>p.portName), originFacilityName: null, destinationFacilityName: null, cutOffTime: null, availableTime: null,
      rawText: JSON.stringify({ sourceUrl: API + "schedules-point2point.php", localVoyage: value(8), oceanScopeTransit: connections, officialRouting: detail.text().replace(/\s+/g, " ").trim(), timeBasis: "official local dates; offset not supplied" }) });
  });
  const result=auditedSchedules(schedules,$('tr[id^="schedule_"]').length,excluded);
  if(typeof data.browserRows==="number"&&result.audit){result.audit.browserRows=data.browserRows;if(data.browserRows!==result.audit.received)result.audit.complete=false;}
  return result;
}
export const PILProvider = publicProvider("PIL", PIL_PAGE, async (context, input, from, to) => {
  const html = await responseText(context, PIL_PAGE);
  const configText = html.match(/var pil_params\s*=\s*(\{[^;]+\});/)?.[1];
  if (!configText) throw new Error("RESPONSE_INVALID: PIL public page configuration missing");
  const config = JSON.parse(configText) as { n: string };
  const locations = JSON.parse(await responseText(context, ROOT + "/wp-admin/admin-ajax.php?" + new URLSearchParams({ action: "generate_voyage_port_dropdown_json", n: config.n })));
  const ports = locations.data?.port_arrays as { port_value: string }[] | undefined;
  if (!Array.isArray(ports)) throw new Error("RESPONSE_INVALID: PIL location list missing");
  const origin = canonicalPortCode(input.originPort.locode), destination = canonicalPortCode(input.destinationPort.locode);
  for (const code of [origin, destination]) if (!ports.some(port => port.port_value === code)) throw new Error(`PORT_NOT_FOUND: official location ${code}`);
  const timestamp = String(Date.now());
  const nonce = JSON.parse(await responseText(context, API + "common/get-n.php?timestamp=" + timestamp));
  if (!nonce.success || typeof nonce.n !== "string") throw new Error("RESPONSE_INVALID: PIL anonymous session missing");
  // PIL requires ISO dates. Compact dates trigger a rejection page rather than a JSON validation error.
  const params = new URLSearchParams({ port_code_origin: origin, port_code_destination: destination, p2p_selectedstartdate: from, p2p_selectedenddate: to, n: nonce.n, timestamp });
  const response = await retryPublicRequest(() => context.get(API + "schedules-point2point.php?" + params, { headers: { Referer: PIL_PAGE, "X-Requested-With": "XMLHttpRequest" }, timeout: 30000 }));
  if (response.status() === 429) throw new Error("RATE_LIMITED: official HTTP 429");
  if (!response.ok()) throw new Error(`ACCESS_BLOCKED: official HTTP ${response.status()}`);
  const body = await response.text();
  if (/Request Rejected|requested URL was rejected/i.test(body)) throw new Error("ACCESS_BLOCKED: PIL official request rejected");
  if (body.trim() === "No data available") return auditedSchedules([],0,{});
  return mapPil(JSON.parse(body), origin, destination, from, to);
},async(page,input,from,to)=>mapPil(await queryPilBrowser(page,input,from,to),canonicalPortCode(input.originPort.locode),canonicalPortCode(input.destinationPort.locode),from,to));
