import type { Port } from "@prisma/client";
import { getCarrierPortMapping } from "@/features/ports/server/port-normalizer";
import type { CoscoSchedulePreview } from "@/features/cosco-scraper/types";
import type { ShippingProvider } from "@/features/shipping/providers/types";

const MAERSK_ROUTING_URL = "https://api.maersk.com.cn/routing-unified/routing/routings-queries";
const MAERSK_LOCATION_URL = "https://api.maersk.com.cn/synergy/reference-data/geography/locations";
const MAERSK_CONSUMER_KEY = process.env.MAERSK_CONSUMER_KEY?.trim() || "";

type MaerskProviderPort = Pick<Port, "id" | "name" | "locode" | "country">;

export type MaerskProviderSearchInput = {
  originPort: MaerskProviderPort;
  destinationPort: MaerskProviderPort;
  departureDate: string;
  dateTo?: string;
};

export type MaerskProviderResult = {
  source: "MAERSK_LIVE";
  schedules: CoscoSchedulePreview[];
  warnings: string[];
  durationMs: number;
  fromCache: boolean;
};

type GeoLocation = {
  unLocCode?: string;
  cityName?: string;
  countryCode?: string;
  maerskGeoLocationId?: string;
  type?: string;
};

type JsonObject = Record<string, unknown>;

async function publicFetch(url: string, options: RequestInit) {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const response = await fetch(url, { ...options, signal: AbortSignal.timeout(15000) });
      if (response.status >= 500 && attempt === 0) { await response.body?.cancel(); continue; }
      return response;
    } catch (error) {
      if (attempt === 1) throw error;
    }
  }
  throw new Error("MAERSK_NETWORK_FAILED");
}

function object(value: unknown): JsonObject | null {
  return value && typeof value === "object" && !Array.isArray(value) ? value as JsonObject : null;
}

function objects(value: unknown): JsonObject[] {
  return Array.isArray(value) ? value.map(object).filter((item): item is JsonObject => Boolean(item)) : [];
}

function stringValue(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}

async function resolveGeoId(port: MaerskProviderPort): Promise<string | null> {
  // 1) 用已导入的 CSV 映射（codeType=GEOID）
  const mapping = await getCarrierPortMapping("MAERSK", port.id, "GEOID");
  if (mapping?.mappingValue) return mapping.mappingValue;
  // 2) 兜底：Maersk 公开地点接口按城市名查询，匹配国家
  try {
    const url = `${MAERSK_LOCATION_URL}?cityName=${encodeURIComponent(port.name)}&pageSize=25&sort=cityName&type=city`;
    const res = await publicFetch(url, { headers: { Accept: "application/json", "Consumer-Key": MAERSK_CONSUMER_KEY } });
    if (!res.ok) return null;
    const data = (await res.json()) as GeoLocation[];
    const country = port.locode.slice(0, 2).toUpperCase();
    const candidates = data.filter(l => l.maerskGeoLocationId && l.countryCode?.toUpperCase() === country);
    const exact = candidates.filter(l => l.unLocCode?.toUpperCase() === port.locode.toUpperCase());
    if (exact.length === 1) return exact[0].maerskGeoLocationId || null;
    const named = candidates.filter(l => l.cityName?.trim().toLowerCase() === port.name.trim().toLowerCase());
    return !exact.length && named.length === 1 ? named[0].maerskGeoLocationId || null : null;
  } catch {
    return null;
  }
}

function parseIsoDuration(duration: string | null | undefined): number | null {
  if (!duration) return null;
  const days = /(\d+)D/.exec(duration);
  return days ? Number(days[1]) : null;
}

function explicitBoolean(value: unknown): boolean | null {
  if (typeof value === "boolean") return value;
  if (typeof value === "string" && /^(true|false)$/i.test(value)) return value.toLowerCase() === "true";
  return null;
}

function toIso(value: string | undefined | null): string | null {
  if (!value) return null;
  const date = new Date(/(?:Z|[+-]\d{2}:?\d{2})$/.test(value) ? value : `${value.slice(0, 10)}T12:00:00Z`);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function buildBody(geoFrom: string, geoTo: string, earliestDate: string, latestDate: string) {
  return {
    requestType: "DATED_SCHEDULES",
    includeFutureSchedules: true,
    routingCondition: "PREFERRED",
    exportServiceType: null,
    importServiceType: null,
    brandCode: "MSL",
    startLocation: { dataObject: "CITY", alternativeCodes: [{ alternativeCodeType: "GEO_ID", alternativeCode: geoFrom }], cityCode: "" },
    endLocation: { dataObject: "CITY", alternativeCodes: [{ alternativeCodeType: "GEO_ID", alternativeCode: geoTo }], cityCode: "" },
    timeRange: { routingsBasedOn: "DEPARTURE_DATE", earliestTime: earliestDate, latestTime: latestDate },
    cargo: { cargoType: "DRY", isTemperatureControlRequired: false },
    carriage: {},
    equipment: { equipmentSizeCode: "40", equipmentTypeCode: "HDRY", constructionMaterial: "", isEmpty: false, isShipperOwned: false },
    IsUseOfInternetMarkedRoutesOnly: false,
  };
}

function cappedLatestDate(dateFrom: string, requestedDateTo?: string) {
  const start = new Date(`${dateFrom}T00:00:00Z`);
  const requested = new Date(`${requestedDateTo || dateFrom}T23:59:59Z`);
  const maximum = new Date(start.getTime() + 14 * 86400000);
  const chosen = Number.isNaN(requested.getTime()) || requested > maximum ? maximum : requested;
  return chosen.toISOString().slice(0, 10);
}

export function parseSchedules(json: unknown, originText: string, destinationText: string, originLocode: string, destinationLocode: string): CoscoSchedulePreview[] {
  const out: CoscoSchedulePreview[] = [];
  const routings = objects(object(json)?.routings);
  routings.forEach((routing, i) => {
    const legs = objects(routing.routingLegs);
    if (!legs.length) return;
    const first = legs[0];
    const last = legs[legs.length - 1];
    const firstCarriage = object(first.carriage);
    const lastCarriage = object(last.carriage);
    const start = object(firstCarriage?.vesselPortCallStart) || object(firstCarriage?.railScheduleLocationStart);
    const end = object(lastCarriage?.vesselPortCallEnd) || object(lastCarriage?.railScheduleLocationEnd);
    if (!start || !end) return;
    const ocean = legs.map(leg => object(leg.carriage)).find(carriage => carriage?.carriageType === "OCEAN");
    const oceanStart = object(ocean?.vesselPortCallStart);
    const vessel = object(ocean?.vessel);
    const depSvc = object(oceanStart?.departureService);
    const arrSvc = object(end.arrivalService);
    const etd = toIso(stringValue(start.estimatedTimeOfDeparture));
    const eta = toIso(stringValue(end.estimatedTimeOfArrival));
    if (!etd || !eta) return;
    const transitPorts: string[] = [];
    for (let k = 1; k < legs.length; k++) {
      const carriage = object(legs[k].carriage);
      const portCall = object(carriage?.vesselPortCallStart);
      const location = object(portCall?.location);
      const facility = object(location?.facility);
      const mid = stringValue(facility?.facilityCode);
      if (mid) transitPorts.push(mid);
    }
    out.push({
      id: `maersk-${i}-${etd}`,
      carrierName: "MAERSK",
      serviceName: stringValue(depSvc?.serviceName) || stringValue(arrSvc?.serviceName),
      routeName: stringValue(depSvc?.serviceCode),
      vesselName: stringValue(vessel?.vesselName),
      voyageNumber: stringValue(oceanStart?.departureVoyageNumber),
      originText,
      destinationText,
      originLocode,
      destinationLocode,
      etd,
      eta,
      etdTimeKnown: /(?:Z|[+-]\d{2}:?\d{2})$/.test(stringValue(start.estimatedTimeOfDeparture) || ""),
      etaTimeKnown: /(?:Z|[+-]\d{2}:?\d{2})$/.test(stringValue(end.estimatedTimeOfArrival) || ""),
      transitDays: parseIsoDuration(stringValue(routing.estimatedTransitTime)),
      direct: explicitBoolean(routing.isDirect) ?? explicitBoolean(routing.direct),
      stopCount: typeof routing.numberOfTransshipments === "number" ? routing.numberOfTransshipments : null,
      transitPorts,
      rawText: JSON.stringify(routing),
    });
  });
  return out;
}

export const MAERSKProvider: ShippingProvider<MaerskProviderSearchInput, MaerskProviderResult> = {
  code: "MAERSK",
  async searchSchedule(input) {
    const started = Date.now();
    const warnings: string[] = [];
    if (!MAERSK_CONSUMER_KEY) return { source: "MAERSK_LIVE", schedules: [], warnings: ["MAERSK_CONFIG_REQUIRED: configure the website client key privately."], durationMs: Date.now() - started, fromCache: false };
    const [geoFrom, geoTo] = await Promise.all([resolveGeoId(input.originPort), resolveGeoId(input.destinationPort)]);
    if (!geoFrom || !geoTo) {
      return { source: "MAERSK_LIVE", schedules: [], warnings: [...warnings, "MAERSK Geo ID could not be resolved for origin/destination."], durationMs: Date.now() - started, fromCache: false };
    }
    const date = input.departureDate.slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return { source: "MAERSK_LIVE", schedules: [], warnings: [...warnings, "MAERSK departure date is invalid."], durationMs: Date.now() - started, fromCache: false };
    }
    const schedules: CoscoSchedulePreview[] = [];
    try {
      const requestedEnd = input.dateTo?.slice(0, 10) || date;
      // Public service accepts limited windows. Cover the user's full range without overlapping days.
      for (let cursor = date; cursor <= requestedEnd;) {
      const latestDate = cappedLatestDate(cursor, requestedEnd);
      const body = buildBody(geoFrom, geoTo, `${cursor}T00:00:00Z`, `${latestDate}T23:59:59Z`);
      const res = await publicFetch(MAERSK_ROUTING_URL, {
        method: "POST",
        signal: AbortSignal.timeout(20000),
        headers: { "Content-Type": "application/json", "Consumer-Key": MAERSK_CONSUMER_KEY, "api-version": "1", Accept: "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const text = await res.text();
        if (res.status === 422 && /No Product Found/i.test(text)) {
          cursor = new Date(new Date(`${latestDate}T00:00:00Z`).getTime() + 86400000).toISOString().slice(0, 10);
          continue;
        }
        return { source: "MAERSK_LIVE", schedules, warnings: [...warnings, `MAERSK API responded ${res.status}: ${text.slice(0, 500)}`], durationMs: Date.now() - started, fromCache: false };
      }
      const json = await res.json();
      const parsed = parseSchedules(json, input.originPort.name, input.destinationPort.name, input.originPort.locode, input.destinationPort.locode);
      if (objects(object(json)?.routings).length > parsed.length) warnings.push("MAERSK_PARSE_INCOMPLETE: some official routings could not be parsed safely");
      schedules.push(...parsed);
      cursor = new Date(new Date(`${latestDate}T00:00:00Z`).getTime() + 86400000).toISOString().slice(0, 10);
      }
      if (!schedules.length && !warnings.length) warnings.push("MAERSK returned no routings for the given criteria.");
      return { source: "MAERSK_LIVE", schedules, warnings, durationMs: Date.now() - started, fromCache: false };
    } catch (error) {
      const message = error instanceof Error ? error.message : "unknown error";
      return { source: "MAERSK_LIVE", schedules, warnings: [...warnings, `MAERSK schedule query failed: ${message}`], durationMs: Date.now() - started, fromCache: false };
    }
  },
};
