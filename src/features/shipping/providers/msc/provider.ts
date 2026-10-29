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
type MscLeg = { DepartureEquipmentHandlingFacilityName?: string; ArrivalEquipmentHandlingFacilityName?: string };
type MscRoute = {
  EstimatedDepartureDate?: string; EstimatedArrivalDate?: string; VesselName?: string; DepartureVoyageNo?: string;
  TotalTransitTime?: string; RouteScheduleLegDetails?: MscLeg[];
};
type MscGroup = {
  Key?: { MaritimeServiceName?: string; IsDirectRoute?: boolean }; IsDirectRoute?: boolean;
  PortOfLoad?: string; PortOfLoadUnCode?: string; PortOfDischarge?: string; PortOfDischargeUnCode?: string; Routes?: MscRoute[];
};
const PAGE_URL = "https://www.msc.com/en/search-a-schedule";
let session: { expires: number; cookie: string; settingId: string; ports: MscPort[] } | undefined;
let sessionTask: Promise<NonNullable<typeof session>> | undefined;

async function publicFetch(url: string, options: RequestInit = {}) {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const response = await fetch(url, { ...options, signal: AbortSignal.timeout(20000) });
      if (response.status >= 500 && attempt === 0) { await response.body?.cancel(); await new Promise(resolve => setTimeout(resolve, 500)); continue; }
      return response;
    } catch (error) {
      if (attempt === 1) throw error;
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }
  throw new Error("MSC_NETWORK_FAILED");
}

async function publicSession() {
  if (session && session.expires > Date.now()) return session;
  if (sessionTask) return sessionTask;
  sessionTask = (async () => {
    const response = await publicFetch(PAGE_URL);
    if (!response.ok) throw new Error(`MSC_ACCESS_BLOCKED: public page HTTP ${response.status}`);
    const html = await response.text();
    const settingId = html.match(/data-setting-id="([^"]+)"/)?.[1];
    if (!settingId) throw new Error("MSC_RESPONSE_INVALID: public schedule settings absent");
    const cookie = response.headers.getSetCookie().map((value) => value.split(";")[0]).join("; ");
    const portResponse = await publicFetch("https://www.msc.com/api/feature/tools/GetAllAvailableCountriesAndPorts", {
      headers: { Accept: "application/json, text/plain, */*", "X-Requested-With": "XMLHttpRequest", Referer: PAGE_URL, Cookie: cookie }, signal: AbortSignal.timeout(20000),
    });
    if (!portResponse.ok) throw new Error(`MSC_ACCESS_BLOCKED: port list HTTP ${portResponse.status}`);
    const data = await portResponse.json() as { Ports?: MscPort[] };
    if (!Array.isArray(data.Ports)) throw new Error("MSC_RESPONSE_INVALID: port list absent");
    session = { expires: Date.now() + 30 * 60000, cookie, settingId, ports: data.Ports };
    return session;
  })();
  try { return await sessionTask; } finally { sessionTask = undefined; }
}

function iso(value?: string) {
  if (!value) return null;
  const date = new Date(`${value.slice(0, 10)}T12:00:00Z`);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

export const MSCProvider: ShippingProvider<MscProviderSearchInput, MscProviderResult> = {
  code: "MSC",
  async searchSchedule(input) {
    const started = Date.now();
    const window = liveDateWindow(input.departureDate, input.dateTo);
    if (window.expired) return { source: "MSC_LIVE", schedules: [], warnings: ["MSC_QUERY_FAILED: requested date range is entirely in the past"], durationMs: 0, fromCache: false };
    const warnings = window.adjusted ? [`MSC_DATE_ADJUSTED: 官网不支持过去日期，仅实时查询 ${window.from} 起、原结束日期内的船期；过去日期未覆盖。`] : [];
    try {
      const [originMapping, destinationMapping, publicData] = await Promise.all([
        getCarrierPortMapping("MSC", input.originPort.id, "LOCODE"),
        getCarrierPortMapping("MSC", input.destinationPort.id, "LOCODE"), publicSession(),
      ]);
      const origin = publicData.ports.find((port) => samePortCode(port.LocationCode, originMapping?.mappingValue || input.originPort.locode));
      const destination = publicData.ports.find((port) => samePortCode(port.LocationCode, destinationMapping?.mappingValue || input.destinationPort.locode));
      if (!origin || !destination) throw new Error("MSC_PORT_NOT_FOUND: official port list has no exact UN/LOCODE match");
      const response = await publicFetch("https://www.msc.com/api/feature/tools/SearchSailingRoutes", {
        method: "POST", signal: AbortSignal.timeout(30000),
        headers: { "Content-Type": "application/json", Accept: "application/json", "X-Requested-With": "XMLHttpRequest", Origin: "https://www.msc.com", Referer: PAGE_URL, Cookie: publicData.cookie },
        body: JSON.stringify({ FromDate: window.from, fromPortId: origin.PortId, toPortId: destination.PortId, language: "en", dataSourceId: publicData.settingId }),
      });
      if (!response.ok) { session = undefined; throw new Error(`MSC_ACCESS_BLOCKED: public schedule HTTP ${response.status}`); }
      const payload = await response.json() as { IsSuccess?: boolean; Data?: MscGroup[] | string };
      if (process.env.SCHEDULE_DEBUG === "true") console.info("MSC response", JSON.stringify(payload).slice(0, 1500));
      if (!payload || typeof payload !== "object" || typeof payload.IsSuccess !== "boolean") throw new Error("MSC_RESPONSE_INVALID: empty public service response");
      if (!payload.IsSuccess || !Array.isArray(payload.Data)) {
        const noResults = typeof payload.Data === "string" && /no.*(?:result|route|schedule)|not.*found/i.test(payload.Data);
        return { source: "MSC_LIVE", schedules: [], warnings: [noResults ? "NO_SCHEDULE_FOUND" : "MSC_RESPONSE_INVALID: official service did not return routes"], durationMs: Date.now() - started, fromCache: false };
      }
      const schedules: CoscoSchedulePreview[] = [];
      for (const group of payload.Data) for (const route of group.Routes || []) {
        const etd = iso(route.EstimatedDepartureDate); const eta = iso(route.EstimatedArrivalDate);
        if (!etd || !eta || !group.PortOfLoad || !group.PortOfDischarge) continue;
        if (etd.slice(0, 10) < window.from || (input.dateTo && etd.slice(0, 10) > input.dateTo.slice(0, 10))) continue;
        const legs = route.RouteScheduleLegDetails || [];
        const days = route.TotalTransitTime?.match(/^(\d+(?:\.\d+)?)\s*days?$/i)?.[1];
        schedules.push({
          id: `msc-${group.PortOfLoadUnCode}-${group.PortOfDischargeUnCode}-${route.DepartureVoyageNo || schedules.length}-${etd}`, carrierName: "MSC", serviceName: group.Key?.MaritimeServiceName || null, routeName: null,
          vesselName: route.VesselName || null, voyageNumber: route.DepartureVoyageNo || null,
          originText: group.PortOfLoad, destinationText: group.PortOfDischarge,
          originLocode: group.PortOfLoadUnCode || null, destinationLocode: group.PortOfDischargeUnCode || null,
          etd, eta, etdTimeKnown: false, etaTimeKnown: false, transitDays: days ? Number(days) : null,
          direct: group.IsDirectRoute ?? group.Key?.IsDirectRoute ?? null, stopCount: null, transitPorts: [],
          originFacilityName: legs[0]?.DepartureEquipmentHandlingFacilityName || null,
          destinationFacilityName: legs.at(-1)?.ArrivalEquipmentHandlingFacilityName || null,
          cutOffTime: null, availableTime: null, rawText: JSON.stringify({ sourceUrl: response.url, group: { ...group, Routes: undefined }, route }),
        });
      }
      return { source: "MSC_LIVE", schedules, warnings: [...warnings, ...(schedules.length ? [] : ["NO_SCHEDULE_FOUND"])], durationMs: Date.now() - started, fromCache: false };
    } catch (error) {
      return { source: "MSC_LIVE", schedules: [], warnings: [error instanceof Error ? error.message : "MSC_QUERY_FAILED"], durationMs: Date.now() - started, fromCache: false };
    }
  },
};
