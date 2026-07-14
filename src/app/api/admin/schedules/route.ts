import { Prisma, ScheduleStatus } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { handlePrismaError, jsonData, jsonError, jsonList, parsePagination, validationError } from "@/features/admin/server/api-utils";

const includeSchedule = { carrier: true, route: true, originPort: true, destinationPort: true, transitPorts: { include: { port: true }, orderBy: { sequence: "asc" as const } } };
type ScheduleRecord = Prisma.SailingScheduleGetPayload<{ include: typeof includeSchedule }>;
const statusLabels: Record<ScheduleStatus, string> = { NORMAL: "正常", EXPECTED_DELAY: "预计延误", DELAYED: "已延误", CUTOFF_SOON: "即将截关", CANCELLED: "已取消" };
const statusValues: Record<string, ScheduleStatus> = { 正常: "NORMAL", 预计延误: "EXPECTED_DELAY", 已延误: "DELAYED", 即将截关: "CUTOFF_SOON", 已取消: "CANCELLED", NORMAL: "NORMAL", EXPECTED_DELAY: "EXPECTED_DELAY", DELAYED: "DELAYED", CUTOFF_SOON: "CUTOFF_SOON", CANCELLED: "CANCELLED" };

const scheduleSchema = z.object({
  carrierId: z.string().min(1, "船公司必填"),
  routeId: z.string().optional().or(z.literal("")),
  serviceName: z.string().min(1, "Service 必填"),
  routeName: z.string().min(1, "航线名称必填"),
  vesselName: z.string().min(1, "船名必填"),
  voyageNumber: z.string().min(1, "航次必填"),
  originPortId: z.string().min(1, "起运港必填"),
  destinationPortId: z.string().min(1, "目的港必填"),
  etd: z.coerce.date(),
  eta: z.coerce.date(),
  transitDays: z.coerce.number().int().positive(),
  direct: z.coerce.boolean().default(false),
  frequency: z.string().min(1, "班期频率必填"),
  originTerminal: z.string().min(1, "起运码头必填"),
  destinationTerminal: z.string().min(1, "目的码头必填"),
  cyOpenTime: z.coerce.date(),
  siCutOffTime: z.coerce.date(),
  vgmCutOffTime: z.coerce.date(),
  customsCutOffTime: z.coerce.date(),
  estimatedBerthingTime: z.coerce.date(),
  departureReliability: z.coerce.number().min(0).max(100),
  status: z.string().transform((value) => statusValues[value] ?? "NORMAL"),
  delayHours: z.coerce.number().int().min(0).default(0),
  originalEtd: z.coerce.date().optional().nullable(),
  originalEta: z.coerce.date().optional().nullable(),
  transitPortIds: z.union([z.array(z.string()), z.string()]).default([]).transform((value) => Array.isArray(value) ? value : value.split(",").map((item) => item.trim()).filter(Boolean)),
}).superRefine((value, context) => {
  if (value.originPortId === value.destinationPortId) context.addIssue({ code: "custom", message: "起运港不能等于目的港", path: ["destinationPortId"] });
  if (value.etd >= value.eta) context.addIssue({ code: "custom", message: "ETD 必须早于 ETA", path: ["eta"] });
  const seen = new Set<string>();
  value.transitPortIds.forEach((portId, index) => {
    if (portId === value.originPortId || portId === value.destinationPortId) context.addIssue({ code: "custom", message: "中转港不能与起运港或目的港重复", path: ["transitPortIds", index] });
    if (seen.has(portId)) context.addIssue({ code: "custom", message: "中转港 sequence 不得重复", path: ["transitPortIds", index] });
    seen.add(portId);
  });
});

function toRecord(schedule: ScheduleRecord) {
  return {
    id: schedule.id,
    carrierId: schedule.carrierId,
    carrier: schedule.carrier.name,
    routeId: schedule.routeId ?? "",
    serviceName: schedule.serviceName,
    routeName: schedule.routeName,
    vesselName: schedule.vesselName,
    voyageNumber: schedule.voyageNumber,
    originPortId: schedule.originPortId,
    originPort: schedule.originPort.name,
    destinationPortId: schedule.destinationPortId,
    destinationPort: schedule.destinationPort.name,
    transitPortIds: schedule.transitPorts.map((item) => item.portId).join(","),
    transitPorts: schedule.transitPorts.map((item) => `${item.port.name} (${item.port.locode})`).join(" / "),
    etd: schedule.etd.toISOString().slice(0, 16),
    eta: schedule.eta.toISOString().slice(0, 16),
    transitDays: schedule.transitDays,
    direct: schedule.direct ? "直达" : "中转",
    stopCount: schedule.stopCount,
    frequency: schedule.frequency,
    originTerminal: schedule.originTerminal,
    destinationTerminal: schedule.destinationTerminal,
    cyOpenTime: schedule.cyOpenTime.toISOString().slice(0, 16),
    siCutOffTime: schedule.siCutOffTime.toISOString().slice(0, 16),
    vgmCutOffTime: schedule.vgmCutOffTime.toISOString().slice(0, 16),
    customsCutOffTime: schedule.customsCutOffTime.toISOString().slice(0, 16),
    estimatedBerthingTime: schedule.estimatedBerthingTime.toISOString().slice(0, 16),
    departureReliability: schedule.departureReliability,
    status: statusLabels[schedule.status],
    delayHours: schedule.delayHours,
    updatedAt: schedule.updatedAt.toISOString().slice(0, 10),
  };
}

async function ensureRelations(data: z.infer<typeof scheduleSchema>) {
  const [carrier, origin, destination, route, transitPorts] = await Promise.all([
    prisma.carrier.findUnique({ where: { id: data.carrierId } }),
    prisma.port.findUnique({ where: { id: data.originPortId } }),
    prisma.port.findUnique({ where: { id: data.destinationPortId } }),
    data.routeId ? prisma.route.findUnique({ where: { id: data.routeId } }) : Promise.resolve(null),
    data.transitPortIds.length ? prisma.port.findMany({ where: { id: { in: data.transitPortIds } } }) : Promise.resolve([]),
  ]);
  if (!carrier) return jsonError("CARRIER_NOT_FOUND", "船公司不存在", 400);
  if (!origin || !destination) return jsonError("PORT_NOT_FOUND", "起运港或目的港不存在", 400);
  if (data.routeId && !route) return jsonError("ROUTE_NOT_FOUND", "航线不存在", 400);
  if (transitPorts.length !== data.transitPortIds.length) return jsonError("PORT_NOT_FOUND", "中转港不存在", 400);
  return null;
}

async function replaceChildren(scheduleId: string, data: z.infer<typeof scheduleSchema>) {
  await prisma.scheduleTransitPort.deleteMany({ where: { scheduleId } });
  await prisma.scheduleRouteNode.deleteMany({ where: { scheduleId } });
  await prisma.scheduleRouteNode.create({ data: { scheduleId, portId: data.originPortId, sequence: 1, nodeType: "ORIGIN", departureTime: data.etd, terminal: data.originTerminal } });
  for (const [index, portId] of data.transitPortIds.entries()) {
    const arrivalTime = new Date(data.etd.getTime() + Math.max(2, Math.round(data.transitDays * ((index + 1) / (data.transitPortIds.length + 1)))) * 86400000);
    const departureTime = new Date(arrivalTime.getTime() + 30 * 3600000);
    await prisma.scheduleTransitPort.create({ data: { scheduleId, portId, sequence: index + 1, arrivalTime, departureTime, waitingHours: 30, vesselName: data.vesselName, voyageNumber: data.voyageNumber } });
    await prisma.scheduleRouteNode.create({ data: { scheduleId, portId, sequence: index + 2, nodeType: "TRANSIT", arrivalTime, departureTime } });
  }
  await prisma.scheduleRouteNode.create({ data: { scheduleId, portId: data.destinationPortId, sequence: data.transitPortIds.length + 2, nodeType: "DESTINATION", arrivalTime: data.eta, terminal: data.destinationTerminal } });
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const { page, pageSize, skip, sortOrder } = parsePagination(searchParams);
    const search = searchParams.get("search")?.trim();
    const status = searchParams.get("status")?.trim();
    const direct = searchParams.get("direct");
    const where: Prisma.SailingScheduleWhereInput = {
      ...(search ? { OR: [{ vesselName: { contains: search } }, { voyageNumber: { contains: search } }, { serviceName: { contains: search } }, { routeName: { contains: search } }] } : {}),
      ...(searchParams.get("carrierId") ? { carrierId: searchParams.get("carrierId") ?? undefined } : {}),
      ...(searchParams.get("originPortId") ? { originPortId: searchParams.get("originPortId") ?? undefined } : {}),
      ...(searchParams.get("destinationPortId") ? { destinationPortId: searchParams.get("destinationPortId") ?? undefined } : {}),
      ...(status && statusValues[status] ? { status: statusValues[status] } : {}),
      ...(direct === "true" ? { direct: true } : direct === "false" ? { direct: false } : {}),
      ...((searchParams.get("dateFrom") || searchParams.get("dateTo")) ? { etd: { ...(searchParams.get("dateFrom") ? { gte: new Date(searchParams.get("dateFrom") ?? "") } : {}), ...(searchParams.get("dateTo") ? { lte: new Date(searchParams.get("dateTo") ?? "") } : {}) } } : {}),
    };
    const sortBy = searchParams.get("sortBy") ?? "etd";
    const sortable = new Set(["etd", "eta", "transitDays", "departureReliability", "updatedAt"]);
    const [items, total] = await Promise.all([
      prisma.sailingSchedule.findMany({ where, include: includeSchedule, skip, take: pageSize, orderBy: { [sortable.has(sortBy) ? sortBy : "etd"]: sortOrder } }),
      prisma.sailingSchedule.count({ where }),
    ]);
    return jsonList(items.map(toRecord), { page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) });
  } catch (error) { return handlePrismaError(error); }
}

export async function POST(request: Request) {
  try {
    const parsed = scheduleSchema.safeParse(await request.json());
    if (!parsed.success) return validationError(parsed.error);
    const relationError = await ensureRelations(parsed.data);
    if (relationError) return relationError;
    const data = parsed.data;
    const schedule = await prisma.sailingSchedule.create({ data: { carrierId: data.carrierId, routeId: data.routeId || null, serviceName: data.serviceName, routeName: data.routeName, vesselName: data.vesselName, voyageNumber: data.voyageNumber, originPortId: data.originPortId, destinationPortId: data.destinationPortId, etd: data.etd, eta: data.eta, transitDays: data.transitDays, direct: data.direct, stopCount: data.transitPortIds.length, frequency: data.frequency, originTerminal: data.originTerminal, destinationTerminal: data.destinationTerminal, cyOpenTime: data.cyOpenTime, siCutOffTime: data.siCutOffTime, vgmCutOffTime: data.vgmCutOffTime, customsCutOffTime: data.customsCutOffTime, estimatedBerthingTime: data.estimatedBerthingTime, departureReliability: data.departureReliability, status: data.status, delayHours: data.delayHours, originalEtd: data.originalEtd, originalEta: data.originalEta, lastUpdatedAt: new Date() } });
    await replaceChildren(schedule.id, parsed.data);
    const full = await prisma.sailingSchedule.findUniqueOrThrow({ where: { id: schedule.id }, include: includeSchedule });
    return jsonData(toRecord(full), { status: 201 });
  } catch (error) { return handlePrismaError(error); }
}

