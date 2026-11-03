import { createHash } from "node:crypto";
import type { Port } from "@prisma/client";
import type { CoscoSchedulePreview } from "@/features/cosco-scraper/types";
import { canonicalPortCode, samePortCode } from "@/features/ports/server/source-port-match";
import { launchPublicBrowser } from "../public-browser";
import { liveDateWindow } from "../live-date-window";
import type { ShippingProvider } from "../types";

export const ONE_PAGE = "https://www.one-line.com/one-ecom/schedule/point-to-point-schedule";
const API = "https://ecomm.one-line.com/api/v1/schedule/point-to-point";
type Input = { originPort: Pick<Port, "id" | "name" | "locode">; destinationPort: Pick<Port, "id" | "name" | "locode">; departureDate: string; dateTo?: string };
type Point = { code: string; name: string; termCd: string };
type Leg = { vvd?: string; vvdName?: string; vsslName?: string; serviceLaneName?: string; departureDate?: string; arrivalDate?: string; polYardCode?: string; podYardCode?: string };
type Journey = { polYardName?: string; podYardName?: string };
export type OneLine = {
  sailInfo?: Leg[]; journeys?: Journey[]; porCode?: string; delCode?: string; porName?: string; delName?: string;
  porDepartureDate?: string; delArrivalDate?: string; polDepartureDateTime?: string; displayTransitDays?: string;
  transshipmentType?: string; totalTransshipment?: number; cct?: string; lastCyAvailableDate?: string;
};
type JsonRequest = (url: string) => Promise<unknown>;

// ONE dates have no UTC offset. Preserve the published local wall-clock value,
// matching OceanScope's existing schedule storage/display convention; never infer an offset.
export function oneDate(value?: string): string | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}(?: \d{2}:\d{2})?$/.test(value)) return null;
  const text = value.length === 10 ? `${value}T00:00:00.000Z` : `${value.replace(" ", "T")}:00.000Z`;
  const date = new Date(text);
  return !Number.isNaN(date.getTime()) && date.toISOString() === text ? text : null;
}
function locode(value?: string) { return value && /^[A-Z]{2}[A-Z0-9]{3}(?:[A-Z0-9]{2})?$/.test(value) ? value.slice(0, 5) : null; }
export function mapOneSchedules(payload: unknown, origin: string, destination: string, from: string, to: string): CoscoSchedulePreview[] {
  const data = payload as { scheduleLines?: OneLine[] } | null;
  if (!data || !Array.isArray(data.scheduleLines)) throw new Error("ONE_RESPONSE_INVALID: official service did not return scheduleLines");
  const result: CoscoSchedulePreview[] = [];
  const seen = new Set<string>();
  for (const row of data.scheduleLines) {
    const first = row.sailInfo?.[0], last = row.sailInfo?.at(-1);
    const pol = locode(row.porCode), pod = locode(row.delCode);
    if (!pol || !pod || !samePortCode(pol, origin) || !(samePortCode(pod, destination) || destination === "USLAX" && pod === "USLGB")) continue;
    const departure = row.polDepartureDateTime || first?.departureDate || row.porDepartureDate;
    const arrival = last?.arrivalDate || row.delArrivalDate;
    const etd = oneDate(departure), eta = oneDate(arrival);
    if (!etd || !eta || etd >= eta || etd.slice(0, 10) < from || etd.slice(0, 10) > to || !row.porName || !row.delName) continue;
    const voyage = first?.vsslName && first.vvdName?.startsWith(`${first.vsslName} `) ? first.vvdName.slice(first.vsslName.length + 1) : null;
    const id = 'one-' + createHash('sha256').update(JSON.stringify([pol,pod,row.sailInfo,etd,eta])).digest('hex').slice(0,40);
    if (seen.has(id)) continue;
    seen.add(id);
    result.push({ id, carrierName: "ONE", originText: row.porName, destinationText: row.delName, originLocode: pol, destinationLocode: pod,
      vesselName: first?.vsslName || null, voyageNumber: voyage, serviceName: first?.serviceLaneName || null, routeName: null,
      etd, eta, etdTimeKnown: Boolean(departure?.includes(" ")), etaTimeKnown: Boolean(arrival?.includes(" ")),
      transitDays: typeof row.displayTransitDays === "string" && /^\d+(\.\d+)?$/.test(row.displayTransitDays) ? Number(row.displayTransitDays) : null,
      direct: row.transshipmentType === "DIRECT" ? true : row.transshipmentType === "TRANSSHIPMENT" ? false : null,
      stopCount: Number.isInteger(row.totalTransshipment) && row.totalTransshipment! >= 0 ? row.totalTransshipment! : null,
      transitPorts: [], originFacilityName: row.journeys?.[0]?.polYardName || null, destinationFacilityName: row.journeys?.at(-1)?.podYardName || null,
      cutOffTime: oneDate(row.cct), availableTime: oneDate(row.lastCyAvailableDate),
      rawText: JSON.stringify({ officialLegs: row.sailInfo ?? [], sourceUrl: API, timeBasis: "official port-local time; offset not supplied", row }),
    });
  }
  return result;
}

async function httpJson(url: string): Promise<unknown> {
  for (let attempt = 0; attempt < 2; attempt++) {
    let response: Response;
    try { response = await fetch(url, { headers: { Accept: "application/json", Referer: ONE_PAGE }, signal: AbortSignal.timeout(12000), cache: "no-store" }); }
    catch { if (!attempt) continue; throw new Error("ONE_NETWORK_FAILED: public HTTP request failed"); }
    if (response.status >= 500 && !attempt) { await response.body?.cancel(); continue; }
    if (!response.ok) throw new Error(`ONE_ACCESS_BLOCKED: official HTTP ${response.status}`);
    try { return await response.json(); } catch { throw new Error("ONE_RESPONSE_INVALID: official response was not JSON"); }
  }
  throw new Error("ONE_QUERY_FAILED");
}
async function query(input: Input, from: string, to: string, request: JsonRequest) {
  const points = await Promise.all([input.originPort, input.destinationPort].map(async port => {
    const code = canonicalPortCode(port.locode.toUpperCase());
    const data = await request(`${API}/search?${new URLSearchParams({ pointName: code, userCountryCode: "" })}`) as { points?: Point[] };
    if (!Array.isArray(data?.points)) throw new Error("ONE_RESPONSE_INVALID: official location list missing");
    // CY/door is explicitly returned by ONE. Do not select another city by similarity.
    const point = data.points.find(p => p.code === code && p.termCd === "Y");
    if (!point) throw new Error(`ONE_PORT_NOT_FOUND: official CY location not found for ${code}`);
    return point;
  }));
  const params = new URLSearchParams({ porCode: points[0].code, delCode: points[1].code, fromDate: from, toDate: to, rcvTermCode: points[0].termCd, deTermCode: points[1].termCd, tsFlag: "" });
  return mapOneSchedules(await request(`${API}?${params}`), points[0].code, points[1].code, from, to);
}
async function browserQuery(input: Input, from: string, to: string) {
  const browser = await launchPublicBrowser({ channel: "msedge" });
  try {
    const context = await browser.newContext();
    const page = await context.newPage();
    await page.goto(ONE_PAGE, { waitUntil: "domcontentloaded", timeout: 20000 });
    // Normal anonymous browser session only: do not solve or bypass verification.
    return await query(input, from, to, async url => {
      const response = await context.request.get(url, { timeout: 15000, headers: { Accept: "application/json", Referer: ONE_PAGE } });
      if (!response.ok()) throw new Error(`ONE_ACCESS_BLOCKED: browser HTTP ${response.status()}`);
      return response.json();
    });
  } finally { await browser.close(); }
}
export const ONEProvider: ShippingProvider<Input, { source: "ONE_LIVE"; schedules: CoscoSchedulePreview[]; warnings: string[]; durationMs: number; fromCache: boolean }> = {
  code: "ONE",
  async searchSchedule(input) {
    const started = Date.now(), window = liveDateWindow(input.departureDate, input.dateTo);
    const result = { source: "ONE_LIVE" as const, schedules: [] as CoscoSchedulePreview[], warnings: [] as string[], durationMs: 0, fromCache: false };
    try {
      if (window.expired) throw new Error("ONE_QUERY_FAILED: requested range is in the past");
      const to = input.dateTo?.slice(0,10) || new Date(new Date(window.from).getTime() + 28*86400000).toISOString().slice(0,10);
      if (window.adjusted) result.warnings.push(`ONE_DATE_ADJUSTED: only ${window.from} onwards was queried`);
      try { result.schedules = await query(input, window.from, to, httpJson); }
      catch (error) {
        const message = error instanceof Error ? error.message : "ONE_QUERY_FAILED";
        if (!/ONE_NETWORK_FAILED|ONE_RESPONSE_INVALID|ONE_ACCESS_BLOCKED.*(?:403|5\d\d)/.test(message)) throw error;
        result.schedules = await browserQuery(input, window.from, to);
      }
      if (!result.schedules.length) result.warnings.push("NO_SCHEDULE_FOUND");
    } catch (error) { result.warnings.push(`ONE_QUERY_FAILED: ${error instanceof Error ? error.message.split("\n")[0] : "unknown failure"}`); }
    result.durationMs = Date.now() - started;
    return result;
  },
};
