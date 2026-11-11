import { fetchExxTransit } from "./published-transit";
import { collectOfficialPages } from "../official-pages";
import { retryPublicRequest } from "../retry-public-request";
import { cmaSiDeadline } from "../port-clock";
import { chromium, request } from "playwright";
import type { CoscoSchedulePreview } from "@/features/cosco-scraper/types";
import type { CmaProviderSearchInput, CmaProviderResult } from "./provider";
import { canonicalPortCode } from "@/features/ports/server/source-port-match";

export function chinaTrade(locode: string) {
  const country = locode.slice(0, 2);
  // Published by the official ComboBoxTrade form; ANL POD details include AUSYD.
  if (country === "AU") return "ANL";
  if (country === "AE") return "CIMEX";
  if (["US", "CA"].includes(country)) return "TP";
  if (["DE", "NL", "BE", "GB", "FR", "DK", "SE", "FI", "NO", "PL"].includes(country)) return "EU";
  if (["SG", "MY", "TH", "VN", "ID", "PH", "KH"].includes(country)) return "CNC";
  return null;
}

const ENTRY = "https://www.cma-cgm.com.cn/LaraToolkit/ShipScheduleInquery";
type Sailing = { row: Record<string, unknown>; etd: string; destinations: { POD: string; ETA: string; VIA: string }[] };
// Share the same official response for the LA / Long Beach pair, never invent an alternate port.
const cache = new Map<string, { expires: number; value: Promise<Sailing[]> }>();
const inFlight = new Map<string, Promise<Sailing[]>>();

async function checkResponse(response: import("playwright").APIResponse | import("playwright").Response, stage: string) {
  const status = response.status();
  const headers = response.headers();
  if (process.env.SCHEDULE_DEBUG === "true") console.info("CMA public response", { stage, status, server: headers.server, contentType: headers["content-type"] });
  if (response.ok()) return;
  // Record only diagnostic classification, never cookies, session URLs or tokens.
  const body = await response.text().catch(() => "");
  const kind = /captcha|challenge-platform|verify you are human/i.test(body) ? "verification-page"
    : /access denied|forbidden|request blocked/i.test(body) ? "access-denied-page" : "unclassified-response";
  throw new Error(`CMA_${status === 403 ? "ACCESS_BLOCKED" : status === 429 ? "RATE_LIMITED" : "HTTP_ERROR"}: stage=${stage} HTTP_${status} body=${kind}`);
}

async function fetchApiSailings(input: CmaProviderSearchInput): Promise<Sailing[]> {
  // The public site sets an anonymous session during redirects. A stateless fetch
  // loses that cookie and loops; APIRequestContext keeps it without launching a browser.
  const http = await request.newContext();
  const deadline = Date.now() + 40000;
  const timeout = () => {
    const remaining = deadline - Date.now();
    if (remaining <= 0) throw new Error("CMA_API_TIMEOUT");
    return Math.min(10000, remaining);
  };
  try {
    const entry = await retryPublicRequest(() => http.get(ENTRY, { timeout: timeout() }));
    await checkResponse(entry, "http-entry");
    const post = async (path: string, form: Record<string, string>) => {
      const response = await retryPublicRequest(() => http.post(`${ENTRY}/${path}`, { form, timeout: timeout(), headers: { "X-Requested-With": "XMLHttpRequest", Referer: ENTRY } }));
      await checkResponse(response, `http-${path}`);
      const json = await response.json();
      if (json.state !== "S" || !Array.isArray(json.data)) throw new Error("CMA_API_RESPONSE_INVALID");
      return json as { data: Record<string, unknown>[]; recordsFiltered: number };
    };
    const origin = canonicalPortCode(input.originPort.locode);
    const from = input.departureDate.slice(0, 10);
    const to = (input.dateTo || input.departureDate).slice(0, 10);
    const sailings: Sailing[] = [];
    const officialRows = await collectOfficialPages(async page => post("PostListData", { vessel: "", voyage: "", pol: origin, area: "", line: "", service: chinaTrade(input.destinationPort.locode) || "", etdDateFrom: from, etdDateTo: to, Draw: String(page + 1), Page: String(page), Rows: "100", order: "asc", sort: "" }));
      for (const row of officialRows) {
        if (row.PlaceCode !== origin || /OMIT|CANCEL/i.test(`${row.Status || ""} ${row.VesselCode || ""}`)) continue;
        const match = String(row.EtdDate || "").match(/^\/Date\((-?\d+)\)\/$/);
        if (!match) continue;
        const date = new Date(Number(match[1]) + 8 * 3600000);
        const day = date.toISOString().slice(0, 10);
        if (day < from || day > to) continue;
        const cusDate = `${day.replaceAll("-", "/")} ${String(date.getUTCHours() % 12 || 12).padStart(2, "0")}:${String(date.getUTCMinutes()).padStart(2, "0")}:${String(date.getUTCSeconds()).padStart(2, "0")}`;
        const detail = await post("GetNextPort", { placeCode: origin, lineCode: String(row.Line || ""), carrierCode: String(row.CarrierCode || ""), cusDate });
        const destinations = detail.data.flatMap(group => Array.isArray(group.Value) ? group.Value as Sailing["destinations"] : []);
        sailings.push({ row, etd: day, destinations });
      }
    return sailings;
  } finally { await http.dispose(); }
}

async function fetchSailings(input: CmaProviderSearchInput): Promise<Sailing[]> {
  const originCode = canonicalPortCode(input.originPort.locode);
  const trade = chinaTrade(input.destinationPort.locode);
  if (!trade) throw new Error("CMA_CHINA_UNSUPPORTED_TRADE");
  let httpFailure = "";
  try { return await fetchApiSailings(input); } catch (error) {
    httpFailure = error instanceof Error ? error.message.split("\n")[0] : "unknown HTTP error";
    if (error instanceof Error && /HTTP_429|RESULT_LIMIT|PAGINATION_INCOMPLETE/.test(error.message)) throw error;
    if (process.env.SCHEDULE_DEBUG === "true") console.info("CMA API failed; trying headless public page", error instanceof Error ? error.message : "unknown error");
  }
  const browser = await chromium.launch({
    ...(process.platform === "win32" ? { channel: "msedge" } : {}),
    headless: true,
  });
  const timer = setTimeout(() => { void browser.close().catch(() => undefined); }, 55000);
  try {
    const page = await browser.newPage({ timezoneId: "Asia/Shanghai" });
    const response = await page.goto(ENTRY, { waitUntil: "domcontentloaded", timeout: 20000 });
    if (response) await checkResponse(response, "browser-entry");
    await page.locator(`#pol option[value="${originCode}"]`).waitFor({ state: "attached", timeout: 10000 });
    return await page.evaluate(async (criteria) => {
      const post = async (path: string, values: Record<string, string>) => {
        const response = await fetch(`/LaraToolkit/ShipScheduleInquery/${path}`, {
          method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded", "X-Requested-With": "XMLHttpRequest" },
          body: new URLSearchParams(values), signal: AbortSignal.timeout(10000),
        });
        if (!response.ok) throw new Error(`CMA_${response.status === 403 ? "ACCESS_BLOCKED" : response.status === 429 ? "RATE_LIMITED" : "HTTP_ERROR"}: stage=browser-${path} HTTP_${response.status}`);
        const result = await response.json();
        if (result.state !== "S" || !Array.isArray(result.data)) throw new Error("CMA_CHINA_RESPONSE_INVALID");
        return result;
      };
      const sailings: Sailing[] = [];
      // The site's displayed ETD is date-only, formatted in China local time.
      const localDate = (value: unknown) => {
        const match = String(value || "").match(/^\/Date\((-?\d+)\)\/$/);
        if (!match) return null;
        const date = new Date(Number(match[1]) + 8 * 3600000);
        return { day: date.toISOString().slice(0, 10), query: `${date.toISOString().slice(0, 10).replaceAll("-", "/")} ${String(date.getUTCHours() % 12 || 12).padStart(2, "0")}:${String(date.getUTCMinutes()).padStart(2, "0")}:${String(date.getUTCSeconds()).padStart(2, "0")}` };
      };
      for (let pageNumber = 1; pageNumber <= 10; pageNumber++) {
        const list = await post("PostListData", {
          vessel: "", voyage: "", pol: criteria.origin, area: "", line: "", service: criteria.trade,
          etdDateFrom: criteria.from, etdDateTo: criteria.to, Draw: String(pageNumber + 1), Page: String(pageNumber), Rows: "100", order: "asc", sort: "",
        });
        for (const row of list.data) {
          if (row.PlaceCode !== criteria.origin || /OMIT|CANCEL/i.test(`${row.Status || ""} ${row.VesselCode || ""}`)) continue;
          const departure = localDate(row.EtdDate);
          if (!departure || departure.day < criteria.from || departure.day > criteria.to) continue;
          const detail = await post("GetNextPort", { placeCode: row.PlaceCode, lineCode: row.Line, carrierCode: row.CarrierCode || "", cusDate: departure.query });
          const destinations = detail.data.flatMap((group: { Value?: Sailing["destinations"] }) => group.Value || []);
          sailings.push({ row, etd: departure.day, destinations });
        }
        if (pageNumber * 100 >= Number(list.recordsFiltered) || list.data.length < 100) return sailings;
      }
      throw new Error("CMA_CHINA_RESULT_LIMIT: query needs a shorter date range");
    }, { origin: originCode, trade, from: input.departureDate.slice(0, 10), to: (input.dateTo || input.departureDate).slice(0, 10) });
  } catch (error) {
    throw new Error(`${httpFailure}; fallback=${error instanceof Error ? error.message.split("\n")[0] : "unknown browser error"}`);
  } finally { clearTimeout(timer); await browser.close(); }
}

export async function searchChinaPublic(input: CmaProviderSearchInput): Promise<CmaProviderResult> {
  const started = Date.now();
  const key = `${input.originPort.locode}:${chinaTrade(input.destinationPort.locode)}:${input.departureDate}:${input.dateTo}`;
  let entry = cache.get(key);
  const fromCache = Boolean(!input.forceRefresh && entry && entry.expires > started);
  if (!fromCache) {
    for (const [key, value] of cache) if (value.expires <= started) cache.delete(key);
    // Coalesce simultaneous refreshes only; never substitute a completed cached query.
    let value = inFlight.get(key);
    if (!value) {
      value = fetchSailings(input).finally(() => { inFlight.delete(key); });
      inFlight.set(key, value);
    }
    entry = { expires: started + 60000, value };
    cache.set(key, entry);
  }
  try {
    const sailings = await entry!.value;
    if (process.env.SCHEDULE_DEBUG === "true") console.info("CMA official destination names", JSON.stringify({ rows: sailings.length, destinations: [...new Set(sailings.flatMap((item) => item.destinations.map((port) => port.POD)))] }));
    const target = input.destinationPort.name.split(",")[0].trim().toUpperCase();
    const schedules: CoscoSchedulePreview[] = [];
    const warnings: string[] = [];
    let invalidDates = 0;
    const published = canonicalPortCode(input.destinationPort.locode) === "USLAX" && sailings.some(s => s.row.Line === "EXX")
      ? await fetchExxTransit().catch(error => { warnings.push("CMA_TRANSIT_INFO_UNAVAILABLE: " + (error instanceof Error ? error.message.split("\n")[0] : "PDF unavailable")); return null; }) : null;
    for (const { row, etd, destinations } of sailings) {
      for (const destination of destinations) {
        const portName = destination.POD?.split(",")[0].trim().toUpperCase();
        if ((portName !== target && portName !== canonicalPortCode(input.destinationPort.locode)) || !/^\d{4}-\d{2}-\d{2}$/.test(destination.ETA)) continue;
        if (destination.ETA <= etd) { invalidDates++; continue; }
        const publishedDays = row.Line === "EXX" && !destination.VIA ? published?.days[canonicalPortCode(input.originPort.locode)] : undefined;
        const text = (value: unknown) => typeof value === "string" && value.trim() ? value.trim() : null;
        schedules.push({
          id: `cma-cn-${row.Id}-${destination.POD}`, carrierName: "CMA CGM", serviceName: text(row.Line), routeName: null,
          vesselName: text(row.VesselCode), voyageNumber: text(row.CarrierVoyage), originText: String(row.POLName), destinationText: destination.POD,
          originLocode: String(row.PlaceCode), destinationLocode: input.destinationPort.locode,
          etd: `${etd}T12:00:00.000Z`, eta: `${destination.ETA}T12:00:00.000Z`, etdTimeKnown: false, etaTimeKnown: false,
          transitDays: publishedDays ?? null, direct: null, stopCount: null, transitPorts: destination.VIA ? [destination.VIA] : [],
          cargoNature: null, cutOffTime: null, siCutOffTime: cmaSiDeadline(row.SiCutOff), availableTime: null, originFacilityName: text(row.TerminalEngName) || text(row.TerminalName), destinationFacilityName: null,
          outboundHaulage: null, inboundHaulage: null,
          rawText: JSON.stringify({ sourceUrl: ENTRY, trade: chinaTrade(input.destinationPort.locode), fetchedAt: new Date().toISOString(), row, destination, publishedTransit: publishedDays ? { days: publishedDays, sourceUrl: published!.sourceUrl, fetchedAt: published!.fetchedAt, basis: "官网表定航程" } : undefined }),
        });
      }
    }
    if(invalidDates) warnings.push(`COUNT_RECONCILIATION_INCOMPLETE: CMA official ETA is not after ETD for ${invalidDates} rows; invalid rows excluded`, "CMA_SOURCE_DATE_INVALID");
    if(!schedules.length && !warnings.length)warnings.push("NO_SCHEDULE_FOUND");
    return { source: "CMA_LIVE", schedules, warnings, durationMs: Date.now() - started, fromCache };
  } catch (error) {
    cache.delete(key);
    return { source: "CMA_LIVE", schedules: [], warnings: [`CMA_CHINA_PUBLIC_FAILED: ${error instanceof Error ? error.message.split("\n")[0] : "unknown error"}`], durationMs: Date.now() - started, fromCache: false };
  }
}
