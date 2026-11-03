import { portClock } from "../port-clock";
import type { Port } from "@prisma/client";
import type { CoscoSchedulePreview } from "@/features/cosco-scraper/types";
import { getCarrierPortMapping } from "@/features/ports/server/port-normalizer";
import type { ShippingProvider } from "@/features/shipping/providers/types";
import { openPublicSession } from "@/features/shipping/providers/public-browser";
import { request } from "playwright";
import { retryPublicRequest } from "../retry-public-request";

type HapagProviderPort = Pick<Port, "id" | "name" | "locode">;

export type HapagProviderSearchInput = {
  originPort: HapagProviderPort;
  destinationPort: HapagProviderPort;
  departureDate: string;
  dateTo?: string;
};

export type HapagProviderResult = {
  source: "HAPAG_LIVE";
  schedules: CoscoSchedulePreview[];
  warnings: string[];
  durationMs: number;
  fromCache: boolean;
};

type JsonObject = Record<string, unknown>;

const HAPAG_ROUTES_URL = process.env.HAPAG_SCHEDULE_API_URL || "https://schedule.api.hlag.cloud/api/routes";

function object(value: unknown): JsonObject | null {
  return value && typeof value === "object" && !Array.isArray(value) ? value as JsonObject : null;
}

function array(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function valueAt(source: JsonObject | null, keys: string[]): unknown {
  if (!source) return null;
  const entries = Object.entries(source);
  for (const key of keys) {
    const hit = entries.find(([candidate]) => candidate.toLowerCase() === key.toLowerCase());
    if (hit && hit[1] !== null && hit[1] !== undefined && hit[1] !== "") return hit[1];
  }
  return null;
}

function stringAt(source: JsonObject | null, keys: string[]): string | null {
  const value = valueAt(source, keys);
  if (typeof value === "string") return value.trim() || null;
  if (typeof value === "number") return String(value);
  const nested = object(value);
  return nested ? stringAt(nested, ["name", "value", "code", "locationName"]) : null;
}

function numberAt(source: JsonObject | null, keys: string[]): number | null {
  const value = valueAt(source, keys);
  const parsed = typeof value === "number" ? value : typeof value === "string" && value.trim() ? Number(value) : NaN;
  return Number.isFinite(parsed) ? parsed : null;
}

function booleanAt(source: JsonObject | null, keys: string[]): boolean | null {
  const value = valueAt(source, keys);
  if (typeof value === "boolean") return value;
  if (typeof value === "string" && /^(true|false)$/i.test(value)) return value.toLowerCase() === "true";
  return null;
}

function isoAt(source: JsonObject | null, keys: string[]): string | null {
  const value = stringAt(source, keys);
  if (!value) return null;
  if (!hasTime(value)) return null;
  return portClock(value)?.iso ?? null;
}

function hasTime(value: string | null) {
  return Boolean(value && /(?:T|\s)\d{1,2}:\d{2}.*(?:Z|[+-]\d{2}:?\d{2})$/.test(value));
}

function locationCode(value: unknown): string | null {
  const text = typeof value === "string" ? value : stringAt(object(value), ["unLocationCode", "UNLocationCode", "locationCode"]);
  return text && /^[A-Z]{5}$/.test(text) ? text : null;
}

function candidateItems(payload: unknown): unknown[] {
  if (Array.isArray(payload)) return payload;
  const root = object(payload);
  for (const key of ["routes", "routings", "items", "data", "results", "routeOptions"]) {
    const candidate = valueAt(root, [key]);
    if (Array.isArray(candidate)) return candidate;
    const nested = object(candidate);
    if (nested) {
      const values = candidateItems(nested);
      if (values.length) return values;
    }
  }
  return [];
}

function mapRoute(item: unknown, index: number): CoscoSchedulePreview | null {
  const route = object(item);
  if (!route) return null;
  const legs = array(valueAt(route, ["legs", "routeLegs", "transportLegs", "segments"])).map(object).filter(Boolean) as JsonObject[];
  const first = legs[0] || route;
  const last = legs[legs.length - 1] || route;
  const etdRaw = stringAt(route, ["etd", "estimatedTimeOfDeparture", "departureDateTime", "departureTime", "placeOfReceiptDateTime"])
    || stringAt(first, ["etd", "estimatedTimeOfDeparture", "departureDateTime", "departureTime"]);
  const etaRaw = stringAt(route, ["eta", "estimatedTimeOfArrival", "arrivalDateTime", "arrivalTime", "placeOfDeliveryDateTime"])
    || stringAt(last, ["eta", "estimatedTimeOfArrival", "arrivalDateTime", "arrivalTime"]);
  const etd = portClock(etdRaw)?.iso;
  const eta = portClock(etaRaw)?.iso;
  if (!etd || !eta) return null;

  const explicitStops = numberAt(route, ["numberOfTransshipments", "transshipmentCount", "stopCount"]);
  const explicitDirect = booleanAt(route, ["direct", "isDirect"]);
  const transitLocations = array(valueAt(route, ["transshipmentLocations", "transitPorts"]))
    .map((entry) => typeof entry === "string" ? entry : stringAt(object(entry), ["name", "locationName", "UNLocationCode"]))
    .filter((entry): entry is string => Boolean(entry));
  const originText = stringAt(route, ["originName", "startLocationName", "placeOfReceiptName", "placeOfReceipt"]) || stringAt(first, ["departureLocation"]);
  const destinationText = stringAt(route, ["destinationName", "endLocationName", "placeOfDeliveryName", "placeOfDelivery"]) || stringAt(last, ["arrivalLocation"]);
  if (!originText || !destinationText) return null;

  return {
    id: `hapag-${stringAt(route, ["id", "routeId", "routingId"]) || `${index}-${etd}`}`,
    carrierName: "HAPAG-LLOYD",
    serviceName: stringAt(route, ["serviceName", "service", "tradeName"]) || stringAt(first, ["serviceName", "service"]),
    routeName: stringAt(route, ["routeName", "routeCode"]) || stringAt(first, ["serviceCode"]),
    vesselName: stringAt(route, ["vesselName", "vessel", "vesselDetails"]) || stringAt(first, ["vesselName", "vessel", "vesselDetails"]),
    voyageNumber: stringAt(route, ["scheduleVoyageNumber", "voyage", "voyageNumber"]) || stringAt(first, ["scheduleVoyageNumber", "voyage", "voyageNumber"]),
    originText,
    destinationText,
    originLocode: locationCode(valueAt(route, ["placeOfReceipt"])) || locationCode(valueAt(first, ["departureLocation"])),
    destinationLocode: locationCode(valueAt(route, ["placeOfDelivery"])) || locationCode(valueAt(last, ["arrivalLocation"])),
    etd,
    eta,
    etdTimeKnown: portClock(etdRaw)?.timeKnown,
    etaTimeKnown: portClock(etaRaw)?.timeKnown,
    transitDays: numberAt(route, ["transitTimeDays", "transitTimeInDays", "transitDays", "durationDays"]),
    direct: explicitDirect,
    stopCount: explicitStops,
    transitPorts: transitLocations,
    cargoNature: null,
    cutOffTime: isoAt(route, ["cargoCutoff", "cutOffTime", "cutoffDateTime"]) || isoAt(first, ["cargoCutoff", "cutOffTime", "cutoffDateTime"]),
    availableTime: null,
    originFacilityName: stringAt(route, ["originTerminal", "originFacilityName"]) || stringAt(object(valueAt(first, ["departureLocation"])), ["name"]),
    destinationFacilityName: stringAt(route, ["destinationTerminal", "destinationFacilityName"]) || stringAt(object(valueAt(last, ["arrivalLocation"])), ["name"]),
    outboundHaulage: stringAt(route, ["startHaulage", "outboundHaulage"]),
    inboundHaulage: stringAt(route, ["endHaulage", "inboundHaulage"]),
    rawText: JSON.stringify(item),
  };
}

async function locode(port: HapagProviderPort) {
  const mapping = await getCarrierPortMapping("HAPAG", port.id, "LOCODE");
  return mapping?.mappingValue || port.locode;
}

async function browserRoutes(input: HapagProviderSearchInput, origin: string, destination: string): Promise<unknown> {
  const context = await openPublicSession("HAPAG").catch((error: unknown) => {
    if (!(error instanceof Error) || !error.message.includes("BROWSER_UNAVAILABLE")) throw error;
    return openPublicSession("HAPAG");
  });
  try {
    const page = await context.newPage();
    const query = new URLSearchParams({ sl: origin, sn: input.originPort.name, el: destination, en: input.destinationPort.name,
      exportHaulage: "MH", importHaulage: "MH", containerType: "45GP", departureDate: input.departureDate.slice(0, 10), usFlag: "false", dg: "false" });
    const responseTask = page.waitForResponse((response) => {
      const url = new URL(response.url());
      return url.hostname === "schedule.api.hlag.cloud" && url.pathname === "/api/routes"
        && url.searchParams.get("startLocation") === origin && url.searchParams.get("endLocation") === destination;
    }, { timeout: 50000 });
    // Observe errors immediately while navigation is still pending.
    void responseTask.catch(() => undefined);
    const entry = await page.goto(`https://www.hapag-lloyd.cn/solutions/schedule/#/?${query}`, { waitUntil: "domcontentloaded", timeout: 20000 });
    if (entry && !entry.ok()) throw new Error(`HAPAG_ACCESS_BLOCKED: official public page HTTP ${entry.status()}`);
    const body = await page.locator("body").innerText();
    if (/Security Check|Managed Challenge|verify you are human/i.test(body)) throw new Error("HAPAG_VERIFICATION_REQUIRED: official public page requires verification");
    const response = await responseTask;
    if (!response.ok()) throw new Error(`HAPAG_ACCESS_BLOCKED: official route query HTTP ${response.status()}`);
    return await response.json();
  } finally { await context.close(); }
}

export const HAPAGProvider: ShippingProvider<HapagProviderSearchInput, HapagProviderResult> = {
  code: "HAPAG",
  async searchSchedule(input) {
    const started = Date.now();
    const [origin, destination] = await Promise.all([locode(input.originPort), locode(input.destinationPort)]);
    const url = new URL(HAPAG_ROUTES_URL);
    url.searchParams.set("startLocation", origin);
    url.searchParams.set("endLocation", destination);
    url.searchParams.set("startDate", input.departureDate.slice(0, 10));
    // Public API enums differ from the website's MH/CH URL abbreviations.
    url.searchParams.set("startHaulage", "MERCHANT");
    url.searchParams.set("endHaulage", "MERCHANT");
    url.searchParams.set("containerType", "45GP");
    const http = await request.newContext();
    try {
      const response = await retryPublicRequest(() => http.get(url.toString(), {
        headers: {
          Accept: "application/json",
          "x-token": "public",
          Origin: "https://www.hapag-lloyd.cn",
          Referer: "https://www.hapag-lloyd.cn/solutions/schedule/",
        },
        timeout: 15000,
        maxRetries: 0,
      }));
      if (response.status() === 429) return { source: "HAPAG_LIVE", schedules: [], warnings: ["HAPAG_RATE_LIMITED"], durationMs: Date.now() - started, fromCache: false };
      if (response.status() === 401 || response.status() === 403) {
        const payload = await browserRoutes(input, origin, destination);
        const schedules = candidateItems(payload).map((item, index) => mapRoute(item, index)).filter((item): item is CoscoSchedulePreview => Boolean(item));
        return { source: "HAPAG_LIVE", schedules, warnings: schedules.length ? [] : ["NO_SCHEDULE_FOUND"], durationMs: Date.now() - started, fromCache: false };
      }
      const contentType = response.headers()["content-type"] || "";
      if (!response.ok() || !contentType.includes("json")) {
        return { source: "HAPAG_LIVE", schedules: [], warnings: [`HAPAG_RESPONSE_INVALID: ${response.status()}`], durationMs: Date.now() - started, fromCache: false };
      }
      const payload: unknown = await response.json();
      const schedules = candidateItems(payload).map((item, index) => mapRoute(item, index)).filter(Boolean) as CoscoSchedulePreview[];
      return { source: "HAPAG_LIVE", schedules, warnings: schedules.length ? [] : ["NO_SCHEDULE_FOUND"], durationMs: Date.now() - started, fromCache: false };
    } catch (error) {
      const message = error instanceof Error ? error.message : "unknown error";
      return { source: "HAPAG_LIVE", schedules: [], warnings: [`HAPAG_QUERY_FAILED: ${message}`], durationMs: Date.now() - started, fromCache: false };
    } finally { await http.dispose(); }
  },
};
