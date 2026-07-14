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
  if (schedule.departureReliability >= 92) tags.push("推荐");
  tags.push(schedule.direct ? "直达" : "中转");
  if (schedule.departureReliability >= 90) tags.push("准班率高");
  if (schedule.status === "CUTOFF_SOON") tags.push("即将截关");
  return tags;
}

export function mapSchedule(schedule: ScheduleWithRelations): SailingSchedule {
  return {
    id: schedule.id,
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
    frequency: schedule.frequency,
    terminal: schedule.originTerminal,
    destinationTerminal: schedule.destinationTerminal,
    cutOffTime: iso(schedule.customsCutOffTime),
    siCutOffTime: iso(schedule.siCutOffTime),
    vgmCutOffTime: iso(schedule.vgmCutOffTime),
    cyOpenTime: iso(schedule.cyOpenTime),
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
    terminalRemark: schedule.status === "CANCELLED" ? "该航次已取消，建议选择相邻班期。" : schedule.delayHours ? `当前延误 ${schedule.delayHours} 小时，请关注后续更新。` : "数据库船期，关键节点以模拟数据展示。",
  };
}

export function mapPortOption(port: { id: string; name: string; nameZh: string | null; country: string; countryCode: string | null; region: string; locode: string }) {
  return { id: port.id, name: port.name, localName: port.nameZh ?? port.name, country: port.country, city: port.name, code: port.locode, aliases: [port.name, port.nameZh ?? "", port.locode, port.country, port.region].filter(Boolean) };
}
