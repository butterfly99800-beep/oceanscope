import type { Prisma, ScheduleStatus } from "@prisma/client";
import type { SailingSchedule, ScheduleStatus as UiScheduleStatus, ScheduleTag } from "@/features/schedules/types";

export const scheduleInclude = {
  carrier: true,
  route: true,
  originPort: true,
  destinationPort: true,
  transitPorts: { include: { port: true }, orderBy: { sequence: "asc" as const } },
  routeNodes: { include: { port: true }, orderBy: { sequence: "asc" as const } },
};

export type ScheduleWithRelations = Prisma.SailingScheduleGetPayload<{ include: typeof scheduleInclude }>;

const statusLabels: Record<ScheduleStatus, UiScheduleStatus> = {
  NORMAL: "正常",
  EXPECTED_DELAY: "预计延误",
  DELAYED: "已延误",
  CUTOFF_SOON: "即将截关",
  CANCELLED: "已取消",
};

function iso(value: Date | null | undefined) {
  return value ? value.toISOString() : "";
}

function datePart(value: Date | null | undefined) {
  return value ? value.toISOString().slice(0, 10) : "";
}

function timePart(value: Date | null | undefined) {
  return value ? value.toISOString().slice(11, 16) : "";
}

function tagsFor(schedule: ScheduleWithRelations): ScheduleTag[] {
  const tags: ScheduleTag[] = [];
  tags.push(schedule.direct ? "直达" : "中转");
  if (schedule.status === "CUTOFF_SOON") tags.push("即将截关");
  return tags;
}

function displayValue(value: string | null | undefined, source: ScheduleWithRelations["source"]) {
  const text = value?.trim() ?? "";
  if (source !== "COSCO_LIVE_QUERY") return text;
  if (/^COSCO\s+(online schedule|live query)$/i.test(text)) return "";
  return text;
}

function displayTerminal(value: string | null | undefined, portName: string, source: ScheduleWithRelations["source"]) {
  const text = displayValue(value, source);
  if (source !== "COSCO_LIVE_QUERY") return text;
  if (!text) return "";
  const lowerText = text.toLowerCase();
  const lowerPort = portName.toLowerCase();
  if (lowerText === lowerPort) return "";
  if (lowerText.startsWith(`${lowerPort},`)) return "";
  return text;
}

function displayCoscoTime(value: Date | null | undefined, fallbackValue: Date, source: ScheduleWithRelations["source"]) {
  if (!value) return "";
  if (source === "COSCO_LIVE_QUERY" && value.getTime() === fallbackValue.getTime()) return "";
  return iso(value);
}

export function mapSchedule(schedule: ScheduleWithRelations): SailingSchedule {
  return {
    id: schedule.id,
    source: schedule.source,
    carrier: schedule.carrier.name,
    carrierCode: schedule.carrier.code,
    serviceName: schedule.serviceName,
    routeName: schedule.routeName,
    vesselName: schedule.vesselName,
    voyageNumber: schedule.voyageNumber,
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
    originalEtd: iso(schedule.originalEtd) || undefined,
    originalEta: iso(schedule.originalEta) || undefined,
    transitDays: schedule.transitDays,
    direct: schedule.direct,
    stopCount: schedule.stopCount,
    frequency: displayValue(schedule.frequency, schedule.source),
    terminal: displayTerminal(schedule.originTerminal, schedule.originPort.name, schedule.source),
    destinationTerminal: displayTerminal(schedule.destinationTerminal, schedule.destinationPort.name, schedule.source),
    cutOffTime: displayCoscoTime(schedule.customsCutOffTime, schedule.etd, schedule.source),
    availableTime: displayCoscoTime(schedule.estimatedBerthingTime, schedule.etd, schedule.source),
    siCutOffTime: displayCoscoTime(schedule.siCutOffTime, schedule.etd, schedule.source),
    vgmCutOffTime: displayCoscoTime(schedule.vgmCutOffTime, schedule.etd, schedule.source),
    cyOpenTime: displayCoscoTime(schedule.cyOpenTime, schedule.etd, schedule.source),
    estimatedBerthingTime: iso(schedule.estimatedBerthingTime),
    departureReliability: schedule.departureReliability,
    scheduleStatus: statusLabels[schedule.status],
    delayHours: schedule.delayHours,
    lastUpdated: iso(schedule.lastUpdatedAt),
    routeNodes: schedule.routeNodes.map((node) => ({
      portName: node.port.name,
      portCode: node.port.locode,
      terminal: node.terminal ?? undefined,
      date: datePart(node.departureTime ?? node.arrivalTime),
      time: timePart(node.departureTime ?? node.arrivalTime),
      type: node.nodeType === "ORIGIN" ? "origin" : node.nodeType === "DESTINATION" ? "destination" : "transit",
    })),
    tags: tagsFor(schedule),
    terminalRemark: schedule.source === "COSCO_LIVE_QUERY" ? "以承运人页面返回字段为准。" : schedule.status === "CANCELLED" ? "该航次已取消，建议选择相邻班期。" : schedule.delayHours ? `当前延误 ${schedule.delayHours} 小时，请关注后续更新。` : "关键节点以承运人公布信息为准。",
  };
}

export function mapPortOption(port: { id: string; name: string; nameZh: string | null; country: string; countryCode: string | null; region: string; locode: string }) {
  const aliases = [port.name, port.nameZh ?? "", port.locode, port.country, port.countryCode ?? "", port.region].filter((item): item is string => Boolean(item));
  return { id: port.id, name: port.name, nameZh: port.nameZh, localName: port.nameZh ?? port.name, country: port.country, countryCode: port.countryCode, region: port.region, city: port.name, code: port.locode, locode: port.locode, type: "\u6e2f\u53e3", aliases };
}
