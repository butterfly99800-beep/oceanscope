import type { CoscoSchedulePreview } from "@/features/cosco-scraper/types";

function stableId(text: string) {
  let hash = 0;
  for (let index = 0; index < text.length; index += 1) {
    hash = (hash * 31 + text.charCodeAt(index)) >>> 0;
  }
  return `cosco-${hash.toString(16)}`;
}

export function normalizeCoscoText(value: string | null | undefined) {
  return (value ?? "").replace(/\s+/g, " ").trim();
}

export function parseCoscoDate(value: string | null | undefined) {
  const text = normalizeCoscoText(value);
  const match = text.match(/(20\d{2})[-/.](\d{1,2})[-/.](\d{1,2})(?:\s+(\d{1,2}):(\d{2}))?/);
  if (!match) return null;
  const [, year, month, day, hour = "00", minute = "00"] = match;
  return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}T${hour.padStart(2, "0")}:${minute}:00.000Z`;
}

function extractLocode(text: string) {
  const match = text.match(/\b[A-Z]{5}\b/);
  return match?.[0] ?? null;
}

function normalizePortCode(code: string | null | undefined, portName: string | null | undefined) {
  const value = normalizeCoscoText(code).toUpperCase();
  const name = normalizeCoscoText(portName).toLowerCase();
  const known: Record<string, string> = {
    SHA: "CNSHA",
    NGB: "CNNGB",
    YTN: "CNYTN",
    SHK: "CNSHK",
    TAO: "CNTAO",
    XMN: "CNXMN",
    SIN: "SGSIN",
    LGB: "USLGB",
    LAX: "USLAX",
    LSA: "USLAX",
    RTM: "NLRTM",
    HAM: "DEHAM",
    PUS: "KRPUS",
  };
  if (value.length === 5) return value;
  if (known[value]) return known[value];
  if (name.includes("shanghai")) return "CNSHA";
  if (name.includes("long beach")) return "USLGB";
  if (name.includes("los angeles")) return "USLAX";
  return null;
}

function parseTransitDays(text: string) {
  const match = text.match(/(?:Transit|Duration|航程|运输时长)\D{0,12}(\d{1,3})/i) ?? text.match(/(\d{1,3})\s*(?:days|day|天)/i);
  return match ? Number(match[1]) : null;
}

type JsonRecord = Record<string, unknown>;

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asString(value: unknown) {
  return typeof value === "string" ? normalizeCoscoText(value) : "";
}

function asNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function findScheduleArrays(value: unknown): JsonRecord[][] {
  if (Array.isArray(value)) {
    const records = value.filter(isRecord);
    if (records.some((item) => "vessel" in item && "etd" in item && "eta" in item)) return [records];
    return value.flatMap(findScheduleArrays);
  }
  if (!isRecord(value)) return [];
  return Object.values(value).flatMap(findScheduleArrays);
}

export function mapJsonPayloadsToCoscoSchedules(payloads: unknown[], origin: string, destination: string): CoscoSchedulePreview[] {
  const arrays = payloads.flatMap(findScheduleArrays);
  const records = arrays.flat();
  const seen = new Set<string>();
  const schedules: CoscoSchedulePreview[] = [];

  for (const item of records) {
    const vesselName = asString(item.vessel);
    const etd = parseCoscoDate(asString(item.etd));
    const eta = parseCoscoDate(asString(item.eta));
    if (!vesselName || !etd || !eta) continue;

    const serviceName = asString(item.service) || null;
    const extVoyage = asString(item.extVoyage);
    const voyageNumber = extVoyage || asString(item.voyage) || null;
    const originText = asString(item.pol) || origin;
    const destinationText = asString(item.pod) || destination;
    const transitDays = asNumber(item.transitTime);
    const cargoNature = asString(item.cargoNature) || null;
    const cutOffTime = parseCoscoDate(asString(item.cutOff));
    const availableTime = parseCoscoDate(asString(item.available));
    const originFacilityName = asString(item.outboundFacilityName) || null;
    const destinationFacilityName = asString(item.inboundFacilityName) || null;
    const outboundHaulage = asString(item.outboundHaulage) || null;
    const inboundHaulage = asString(item.inboundHaulage) || null;
    const key = [vesselName, serviceName, voyageNumber, originText, destinationText, etd].join("|");
    if (seen.has(key)) continue;
    seen.add(key);

    const deList1 = Array.isArray(item.deList1) ? item.deList1.filter(isRecord) : [];
    const deList2 = Array.isArray(item.deList2) ? item.deList2.filter(isRecord) : [];
    const transitPorts = [...deList1, ...deList2]
      .map((port) => asString(port.portName) || asString(port.pod) || asString(port.pol))
      .filter(Boolean);

    schedules.push({
      id: `${stableId(key)}-${schedules.length}`,
      carrierName: "COSCO SHIPPING",
      serviceName,
      routeName: `${originText} -> ${destinationText}`,
      vesselName,
      voyageNumber,
      originText,
      destinationText,
      originLocode: normalizePortCode(asString(item.polPortCode), originText) ?? extractLocode(origin),
      destinationLocode: normalizePortCode(asString(item.podPortCode), destinationText) ?? extractLocode(destination),
      etd,
      eta,
      transitDays,
      direct: transitPorts.length === 0,
      stopCount: transitPorts.length,
      transitPorts,
      cargoNature,
      cutOffTime,
      availableTime,
      originFacilityName,
      destinationFacilityName,
      outboundHaulage,
      inboundHaulage,
      rawText: JSON.stringify({ vesselName, serviceName, voyageNumber, originText, destinationText, etd, eta, transitDays, cargoNature, cutOffTime, availableTime, originFacilityName, destinationFacilityName, outboundHaulage, inboundHaulage }),
    });
  }

  return schedules.slice(0, 80);
}

export function mapDomRowsToCoscoSchedules(rows: string[], origin: string, destination: string): CoscoSchedulePreview[] {
  return rows
    .map(normalizeCoscoText)
    .filter((row) => row.length > 40 && /20\d{2}[-/.]\d{1,2}[-/.]\d{1,2}/.test(row))
    .slice(0, 80)
    .map((row, index) => {
      const dates = Array.from(row.matchAll(/20\d{2}[-/.]\d{1,2}[-/.]\d{1,2}(?:\s+\d{1,2}:\d{2})?/g)).map((item) => parseCoscoDate(item[0])).filter((item): item is string => Boolean(item));
      const vesselBlock = row.match(/(?:\d{2}:\d{2}(?:\([A-Za-z.]+\))?\s+)([A-Z][A-Z0-9 .'-]{2,60})\s*\/([A-Z0-9-]{2,20})\/([A-Z0-9-]{2,30})/);
      const vesselName = vesselBlock ? normalizeCoscoText(vesselBlock[1]) : null;
      const serviceName = vesselBlock ? normalizeCoscoText(vesselBlock[2]) : null;
      const voyageNumber = vesselBlock ? normalizeCoscoText(vesselBlock[3]) : null;
      const etd = dates.length >= 3 ? dates[1] : dates[0] ?? null;
      const eta = dates.length >= 3 ? dates[2] : dates[1] ?? null;
      const direct = /\bDirect\b|直达/i.test(row) ? true : /\bTransit\b|中转|via/i.test(row) ? false : null;
      const transitDays = parseTransitDays(row);

      return {
        id: `${stableId(row)}-${index}`,
        carrierName: "COSCO SHIPPING",
        serviceName,
        routeName: `${origin} -> ${destination}`,
        vesselName,
        voyageNumber,
        originText: origin,
        destinationText: destination,
        originLocode: extractLocode(origin) ?? (origin.toLowerCase().includes("shanghai") ? "CNSHA" : null),
        destinationLocode: extractLocode(destination) ?? (destination.toLowerCase().includes("los angeles") ? "USLAX" : destination.toLowerCase().includes("long beach") ? "USLGB" : null),
        etd,
        eta,
        transitDays,
        direct,
        stopCount: direct === true ? 0 : direct === false ? null : null,
        transitPorts: [],
        cargoNature: null,
        cutOffTime: null,
        availableTime: null,
        originFacilityName: null,
        destinationFacilityName: null,
        outboundHaulage: null,
        inboundHaulage: null,
        rawText: row,
      } satisfies CoscoSchedulePreview;
    })
    .filter((item) => item.vesselName && item.etd && item.eta);
}
