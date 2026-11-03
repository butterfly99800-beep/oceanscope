import { createHash } from "node:crypto";
import { portClock } from "../port-clock";
import { launchPublicBrowser } from "../public-browser";
import type { Port } from "@prisma/client";
import type { CoscoSchedulePreview } from "@/features/cosco-scraper/types";
import { getCarrierPortMapping } from "@/features/ports/server/port-normalizer";
import type { ShippingProvider } from "@/features/shipping/providers/types";
import { samePortCode } from "@/features/ports/server/source-port-match";
import { liveDateWindow } from "../live-date-window";

type MscProviderPort = Pick<Port, "id" | "name" | "locode">;
export type MscProviderSearchInput = { originPort: MscProviderPort; destinationPort: MscProviderPort; departureDate: string; dateTo?: string };
export type MscProviderResult = { source: "MSC_LIVE"; schedules: CoscoSchedulePreview[]; warnings: string[]; durationMs: number; fromCache: boolean };
type MscPort = { PortId: number; LocationCode: string; LocationName: string };
type MscLeg = {
  DeparturePortUNCode?: string; ArrivalPortUNCode?: string; DepartureVoyageNo?: string;
  EstimatedDepartureTime?: string; EstimatedArrivalTime?: string;
  DepartureEquipmentHandlingFacilityName?: string; ArrivalEquipmentHandlingFacilityName?: string;
};
type MscRoute = {
  EstimatedDepartureDate?: string; EstimatedArrivalDate?: string; VesselName?: string; DepartureVoyageNo?: string;
  TotalTransitTime?: string; RouteScheduleLegDetails?: MscLeg[];
};
type MscGroup = {
  Key?: { MaritimeServiceName?: string; IsDirectRoute?: boolean }; IsDirectRoute?: boolean;
  PortOfLoad?: string; PortOfLoadUnCode?: string; PortOfDischarge?: string; PortOfDischargeUnCode?: string; Routes?: MscRoute[];
};
const sites = ["https://www.msc.com", "https://www.msccargo.cn"];
type Transport = (url: string, options?: RequestInit) => Promise<Response>;
type Session = { settings: string; ports: MscPort[]; headers: Record<string, string> };
const sessions = new Map<string, { expires: number; value: Promise<Session> }>();
const http: Transport = (url, options) => fetch(url, { ...options, cache: "no-store", signal: AbortSignal.timeout(10000) });

function checked(response: Response, site: string, stage: string) {
  if (!response.ok) {
    const reason = response.status === 429 ? "RATE_LIMITED" : "ACCESS_BLOCKED";
    throw new Error(`MSC_${reason}: ${new URL(site).hostname} ${stage} HTTP ${response.status}`);
  }
  return response;
}

async function openSession(site: string, transport: Transport): Promise<Session> {
  const url = site + "/en/search-a-schedule";
  const page = checked(await transport(url), site, "page");
  const settings = (await page.text()).match(/data-setting-id="([^"]+)"/)?.[1];
  if (!settings) throw new Error("MSC_RESPONSE_INVALID: schedule settings missing");
  const headers = { Accept: "application/json", Referer: url, "X-Requested-With": "XMLHttpRequest", Cookie: page.headers.getSetCookie().map(c => c.split(";")[0]).join("; ") };
  const response = checked(await transport(site + "/api/feature/tools/GetAllAvailableCountriesAndPorts", { headers }), site, "ports");
  const data = await response.json() as { Ports?: MscPort[] };
  if (!Array.isArray(data.Ports)) throw new Error("MSC_RESPONSE_INVALID: official port list missing");
  return { settings, ports: data.Ports, headers };
}

function sessionFor(site: string, transport: Transport) {
  if (transport !== http) return openSession(site, transport);
  const cached = sessions.get(site);
  if (cached && cached.expires > Date.now()) return cached.value;
  const value = openSession(site, http);
  sessions.set(site, { expires: Date.now() + 1800000, value });
  return value;
}

async function readRoutes(site: string, transport: Transport, originCodes: string[], destinationCodes: string[], date: string) {
  const session = await sessionFor(site, transport);
  const find = (code: string) => session.ports.find(port => samePortCode(port.LocationCode, code));
  const origin = originCodes.map(find).find(Boolean), destination = destinationCodes.map(find).find(Boolean);
  if (!origin || !destination) throw new Error("MSC_PORT_NOT_FOUND: official port list has no match");
  const url = site + "/api/feature/tools/SearchSailingRoutes";
  const response = checked(await transport(url, {
    method: "POST", headers: { ...session.headers, "Content-Type": "application/json", Origin: site },
    body: JSON.stringify({ FromDate: date, fromPortId: origin.PortId, toPortId: destination.PortId, language: "en", dataSourceId: session.settings }),
  }), site, "schedule");
  const payload = await response.json() as { IsSuccess?: boolean; Data?: MscGroup[] | string };
  const empty = typeof payload?.Data === "string" && /no.*(?:result|route|schedule)|not.*found/i.test(payload.Data);
  if (!(payload?.IsSuccess && Array.isArray(payload.Data)) && !empty) throw new Error("MSC_RESPONSE_INVALID: schedule service failed");
  return { payload, url };
}

async function publicRoutes(origin: string[], destination: string[], date: string) {
  const failures: string[] = [];
  function record(error: unknown) {
    const message = error instanceof Error ? error.message : "MSC_QUERY_FAILED";
    if (/RATE_LIMITED|HTTP 429/.test(message)) throw error;
    failures.push(message);
  }
  for (const site of sites) {
    try { return await readRoutes(site, http, origin, destination, date); }
    catch (error) { sessions.delete(site); record(error); }
  }
  const browser = await launchPublicBrowser();
  try {
    for (const site of sites) {
      const page = await browser.newPage();
      try {
        const entry = await page.goto(site + "/en/search-a-schedule", { waitUntil: "domcontentloaded", timeout: 12000 });
        if (!entry?.ok()) throw new Error(`MSC_ACCESS_BLOCKED: browser page HTTP ${entry?.status()}`);
        const transport: Transport = async (url, options) => {
          if (!options) return new Response(await page.content());
          const result = await page.evaluate(async ({ url, method, body }) => {
            const response = await fetch(url, { method, body, credentials: "same-origin", cache: "no-store", signal: AbortSignal.timeout(10000),
              headers: { Accept: "application/json", "X-Requested-With": "XMLHttpRequest", ...(body ? { "Content-Type": "application/json" } : {}) },
            });
            return { status: response.status, text: await response.text() };
          }, { url, method: options.method || "GET", body: typeof options.body === "string" ? options.body : undefined });
          return new Response(result.text, { status: result.status });
        };
        return await readRoutes(site, transport, origin, destination, date);
      } catch (error) { record(error); }
      finally { await page.close(); }
    }
  } finally { await browser.close(); }
  throw new Error(failures.join("; "));
}

function routeReference(group: MscGroup, route: MscRoute) {
  const legs = route.RouteScheduleLegDetails?.map(leg => [
    leg.DeparturePortUNCode, leg.ArrivalPortUNCode, leg.DepartureVoyageNo, leg.EstimatedDepartureTime,
    leg.EstimatedArrivalTime, leg.DepartureEquipmentHandlingFacilityName, leg.ArrivalEquipmentHandlingFacilityName,
  ]);
  const identity = [group.PortOfLoadUnCode, group.PortOfDischargeUnCode, group.Key?.MaritimeServiceName,
    route.VesselName, route.DepartureVoyageNo, route.EstimatedDepartureDate, route.EstimatedArrivalDate, legs];
  return "msc-" + createHash("sha256").update(JSON.stringify(identity)).digest("hex");
}

export const MSCProvider: ShippingProvider<MscProviderSearchInput, MscProviderResult> = {
  code: "MSC",
  async searchSchedule(input) {
    const started = Date.now();
    const window = liveDateWindow(input.departureDate, input.dateTo);
    if (window.expired) return { source: "MSC_LIVE", schedules: [], warnings: ["MSC_QUERY_FAILED: requested date range is entirely in the past"], durationMs: 0, fromCache: false };
    const warnings = window.adjusted ? [`MSC_DATE_ADJUSTED: 官网不支持过去日期，仅实时查询 ${window.from} 起、原结束日期内的船期；过去日期未覆盖。`] : [];
    try {
      const [originMapping,destinationMapping]=await Promise.all([getCarrierPortMapping("MSC",input.originPort.id,"LOCODE"),getCarrierPortMapping("MSC",input.destinationPort.id,"LOCODE")]);
      const {payload,url}=await publicRoutes([input.originPort.locode, ...(originMapping ? [originMapping.mappingValue] : [])],
        [input.destinationPort.locode, ...(destinationMapping ? [destinationMapping.mappingValue] : [])], window.from);
      if (process.env.SCHEDULE_DEBUG === "true") console.info("MSC response", JSON.stringify(payload).slice(0, 1500));
      if (!payload || typeof payload !== "object" || typeof payload.IsSuccess !== "boolean") throw new Error("MSC_RESPONSE_INVALID: empty public service response");
      if (!payload.IsSuccess || !Array.isArray(payload.Data)) {
        const noResults = typeof payload.Data === "string" && /no.*(?:result|route|schedule)|not.*found/i.test(payload.Data);
        return { source: "MSC_LIVE", schedules: [], warnings: [noResults ? "NO_SCHEDULE_FOUND" : "MSC_RESPONSE_INVALID: official service did not return routes"], durationMs: Date.now() - started, fromCache: false };
      }
      const schedules: CoscoSchedulePreview[] = [];
      let incomplete = false;
      for (const group of payload.Data) for (const route of group.Routes || []) {
        const departure = portClock(route.EstimatedDepartureDate), arrival = portClock(route.EstimatedArrivalDate);
        const etd = departure?.iso, eta = arrival?.iso;
        if (!etd || !eta || !group.PortOfLoad || !group.PortOfDischarge) { incomplete = true; continue; }
        if (etd.slice(0, 10) < window.from || (input.dateTo && etd.slice(0, 10) > input.dateTo.slice(0, 10))) continue;
        const legs = route.RouteScheduleLegDetails || [];
        const days = route.TotalTransitTime?.match(/^(\d+(?:\.\d+)?)\s*days?$/i)?.[1];
        schedules.push({
          id: routeReference(group, route), carrierName: "MSC", serviceName: group.Key?.MaritimeServiceName || null, routeName: null,
          vesselName: route.VesselName || null, voyageNumber: route.DepartureVoyageNo || null,
          originText: group.PortOfLoad, destinationText: group.PortOfDischarge,
          originLocode: group.PortOfLoadUnCode || null, destinationLocode: group.PortOfDischargeUnCode || null,
          etd, eta, etdTimeKnown: departure.timeKnown, etaTimeKnown: arrival.timeKnown, transitDays: days ? Number(days) : null,
          direct: group.IsDirectRoute ?? group.Key?.IsDirectRoute ?? null, stopCount: null, transitPorts: [],
          originFacilityName: legs[0]?.DepartureEquipmentHandlingFacilityName || null,
          destinationFacilityName: legs.at(-1)?.ArrivalEquipmentHandlingFacilityName || null,
          cutOffTime: null, availableTime: null, rawText: JSON.stringify({ officialLegs: legs, sourceUrl: url, group: { ...group, Routes: undefined }, route }),
        });
      }
      if (incomplete) warnings.push("MSC_PARSE_INCOMPLETE: official route is missing dates or ports");
      else if (!schedules.length) warnings.push("NO_SCHEDULE_FOUND");
      return { source: "MSC_LIVE", schedules, warnings, durationMs: Date.now() - started, fromCache: false };
    } catch (error) {
      return { source: "MSC_LIVE", schedules: [], warnings: [error instanceof Error ? error.message : "MSC_QUERY_FAILED"], durationMs: Date.now() - started, fromCache: false };
    }
  },
};
