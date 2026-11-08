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
  void portName;
  if (value.length === 5) return value;
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

function asBoolean(value: unknown) {
  if (typeof value === "boolean") return value;
  if (typeof value === "string" && /^(true|false)$/i.test(value.trim())) return value.trim().toLowerCase() === "true";
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
  const groups: JsonRecord[][] = [];
  for (const records of arrays) {
    let current: JsonRecord[] | null = null;
    for (const record of records) {
      const sequence = asNumber(record.legSequence);
      if (sequence === null || sequence === 1) {
        current = [record];
        groups.push(current);
      } else if (current) current.push(record);
      // An orphan continuation is never a standalone end-to-end schedule.
    }
  }
  const seen = new Set<string>();
  const schedules: CoscoSchedulePreview[] = [];

  for (const legs of groups) {
    if (legs.some((leg, index) => index > 0 && (asNumber(leg.legSequence) !== index + 1
      || asString(legs[index - 1].pod) !== asString(leg.pol)
      || !parseCoscoDate(asString(leg.etd)) || !parseCoscoDate(asString(legs[index - 1].eta))
      || parseCoscoDate(asString(leg.etd))! < parseCoscoDate(asString(legs[index - 1].eta))!))) continue;
    const first = legs[0];
    const last = legs[legs.length - 1];
    const item: JsonRecord = { ...first, pod: last.pod, podPortCode: last.podPortCode, eta: last.eta,
      available: last.available, inboundFacilityName: last.inboundFacilityName,
      inboundHaulage: last.inboundHaulage ?? first.inboundHaulage };
    const vesselName = asString(item.vessel);
    const etdText = asString(item.etd);
    const etaText = asString(item.eta);
    const etd = parseCoscoDate(etdText);
    const eta = parseCoscoDate(etaText);
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
    const legIdentity = legs.length > 1 ? JSON.stringify(legs.map(leg => [leg.vessel, leg.extVoyage || leg.voyage, leg.pol, leg.pod])) : "";
    const key = [vesselName, serviceName, voyageNumber, originText, destinationText, etd, legIdentity].join("|");
    if (seen.has(key)) continue;
    seen.add(key);

    const deList1 = Array.isArray(item.deList1) ? item.deList1.filter(isRecord) : [];
    const deList2 = Array.isArray(item.deList2) ? item.deList2.filter(isRecord) : [];
    const transitPorts = [...legs.slice(0, -1).map(leg => asString(leg.pod)), ...[...deList1, ...deList2]
      .map((port) => asString(port.portName) || asString(port.pod) || asString(port.pol))
      .filter(Boolean)];
    const completeSingleLeg = legs.length === 1 && asNumber(first.legSequence) === 1
      && Array.isArray(first.deList1) && first.deList1.length === 0
      && Array.isArray(first.deList2) && first.deList2.length === 0;
    const direct = asBoolean(item.direct) ?? asBoolean(item.isDirect) ?? (transitPorts.length ? false : completeSingleLeg ? true : null);
    const explicitStopCount = asNumber(item.stopCount) ?? asNumber(item.transshipmentCount);

    schedules.push({
      id: `${stableId(key)}-${schedules.length}`,
      carrierName: "COSCO SHIPPING",
      serviceName,
      routeName: null,
      vesselName,
      voyageNumber,
      originText,
      destinationText,
      originLocode: normalizePortCode(asString(item.polPortCode), originText),
      destinationLocode: normalizePortCode(asString(item.podPortCode), destinationText),
      etd,
      eta,
      etdTimeKnown: /\d{1,2}:\d{2}/.test(etdText),
      etaTimeKnown: /\d{1,2}:\d{2}/.test(etaText),
      transitDays,
      direct,
      stopCount: explicitStopCount ?? (transitPorts.length ? transitPorts.length : direct === true ? 0 : null),
      transitPorts,
      cargoNature,
      cutOffTime,
      availableTime,
      originFacilityName,
      destinationFacilityName,
      outboundHaulage,
      inboundHaulage,
      rawText: legs.length > 1 ? JSON.stringify({ officialLegs: legs }) : JSON.stringify(first),
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
      const dateTexts = Array.from(row.matchAll(/20\d{2}[-/.]\d{1,2}[-/.]\d{1,2}(?:\s+\d{1,2}:\d{2})?/g)).map((item) => item[0]);
      const dates = dateTexts.map((item) => parseCoscoDate(item)).filter((item): item is string => Boolean(item));
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
        routeName: null,
        vesselName,
        voyageNumber,
        originText: origin,
        destinationText: destination,
        originLocode: extractLocode(origin),
        destinationLocode: extractLocode(destination),
        etd,
        eta,
        etdTimeKnown: /\d{1,2}:\d{2}/.test(dateTexts[dates.length >= 3 ? 1 : 0] ?? ""),
        etaTimeKnown: /\d{1,2}:\d{2}/.test(dateTexts[dates.length >= 3 ? 2 : 1] ?? ""),
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
