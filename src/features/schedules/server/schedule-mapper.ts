import { cmaSiDeadline } from "@/features/shipping/providers/port-clock";
import type { Prisma } from "@prisma/client";
import type { SailingSchedule } from "@/features/schedules/types";

export const scheduleInclude = {
  carrier: true,
  route: true,
  originPort: true,
  destinationPort: true,
  transitPorts: { include: { port: true }, orderBy: { sequence: "asc" as const } },
  routeNodes: { include: { port: true }, orderBy: { sequence: "asc" as const } },
};

export type ScheduleWithRelations = Prisma.SailingScheduleGetPayload<{ include: typeof scheduleInclude }>;

function iso(value: Date | null | undefined) {
  return value ? value.toISOString() : "";
}

function isLiveSource(source: ScheduleWithRelations["source"]) {
  return source !== "SEED" && source !== "MANUAL";
}

function displayValue(value: string | null | undefined) {
  const text = value?.trim() ?? "";
  if (!text || /^COSCO\s+(online schedule|live query|unknown)$/i.test(text)) return null;
  if (/^COSCO-\d{8}$/i.test(text)) return null;
  return text;
}

function displayTerminal(value: string | null | undefined, portName: string, source: ScheduleWithRelations["source"]) {
  const text = displayValue(value);
  if (!text || !isLiveSource(source)) return text;
  const lowerText = text.toLowerCase();
  const lowerPort = portName.toLowerCase();
  if (lowerText === lowerPort || lowerText.startsWith(`${lowerPort},`)) return null;
  return text;
}

function displaySourcedTime(value: Date | null | undefined, fallbackValue: Date, source: ScheduleWithRelations["source"]) {
  if (!value) return null;
  if (isLiveSource(source) && value.getTime() === fallbackValue.getTime()) return null;
  return iso(value);
}

export function mapSchedule(schedule: ScheduleWithRelations): SailingSchedule {
  let carrierLabel = schedule.carrier.name;
  let siCutOffTime = schedule.siCutOffTime?.toISOString() ?? null;
  if (schedule.source === "CMA_LIVE_QUERY" && typeof schedule.rawSourceData === "string") {
    try {
      const evidence = JSON.parse(schedule.rawSourceData) as { trade?: string; row?: { SiCutOff?: unknown } };
      siCutOffTime ??= cmaSiDeadline(evidence.row?.SiCutOff);
      if (evidence.trade === "ANL") carrierLabel = "CMA CGM / ANL（官网分类）";
    } catch { /* Existing page-text evidence has no structured trade classification. */ }
  }
  return {
    id: schedule.id,
    source: schedule.source,
    carrier: carrierLabel,
    carrierCode: schedule.carrier.code,
    serviceName: displayValue(schedule.serviceName),
    routeName: schedule.source === "COSCO_LIVE_QUERY" ? null : displayValue(schedule.routeName),
    vesselName: displayValue(schedule.vesselName),
    voyageNumber: displayValue(schedule.voyageNumber),
    originPort: schedule.originPort.name,
    originPortCode: schedule.originPort.locode,
    destinationPort: schedule.destinationPort.name,
    destinationPortCode: schedule.destinationPort.locode,
    transitPorts: schedule.transitPorts.map((item) => ({
      portName: item.port.name,
      portCode: item.port.locode,
      arrivalTime: iso(item.arrivalTime),
      departureTime: iso(item.departureTime),
      waitingHours: item.waitingHours,
      nextVesselName: item.vesselName ?? undefined,
      nextVoyageNumber: item.voyageNumber ?? undefined,
      terminal: item.terminal ?? undefined,
    })),
    etd: iso(schedule.etd),
    eta: iso(schedule.eta),
    etdTimeKnown: schedule.source !== "OOCL_LIVE_QUERY" && schedule.etdTimeKnown,
    etaTimeKnown: schedule.source !== "OOCL_LIVE_QUERY" && schedule.etaTimeKnown,
    originalEtd: iso(schedule.originalEtd) || undefined,
    originalEta: iso(schedule.originalEta) || undefined,
    transitDays: isLiveSource(schedule.source) && !schedule.rawSourceData ? null : schedule.transitDays,
    direct: isLiveSource(schedule.source) && !schedule.rawSourceData ? null : schedule.direct,
    stopCount: isLiveSource(schedule.source) && !schedule.rawSourceData ? null : schedule.stopCount,
    cargoNature: displayValue(schedule.frequency),
    terminal: displayTerminal(schedule.originTerminal, schedule.originPort.name, schedule.source),
    destinationTerminal: displayTerminal(schedule.destinationTerminal, schedule.destinationPort.name, schedule.source),
    siCutOffTime,
    cutOffTime: displaySourcedTime(schedule.customsCutOffTime, schedule.etd, schedule.source),
    availableTime: displaySourcedTime(schedule.estimatedBerthingTime, schedule.etd, schedule.source),
    lastUpdated: iso(schedule.fetchedAt ?? schedule.lastUpdatedAt),
    rawSourceAvailable: Boolean(schedule.rawSourceData),
  };
}

export function mapPortOption(port: { id: string; name: string; nameZh: string | null; country: string; countryCode: string | null; region: string; locode: string }) {
  const aliases = [port.name, port.nameZh ?? "", port.locode, port.country, port.countryCode ?? "", port.region].filter((item): item is string => Boolean(item));
  return { id: port.id, name: port.name, nameZh: port.nameZh, localName: port.nameZh ?? port.name, country: port.country, countryCode: port.countryCode, region: port.region, city: port.name, code: port.locode, locode: port.locode, type: "\u6e2f\u53e3", aliases };
}
