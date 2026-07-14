import { Prisma, ScheduleStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { jsonError, jsonList, parsePagination } from "@/features/admin/server/api-utils";
import { mapSchedule, scheduleInclude } from "@/features/schedules/server/schedule-mapper";

const statusMap: Record<string, ScheduleStatus> = { "正常": "NORMAL", NORMAL: "NORMAL", "预计延误": "EXPECTED_DELAY", EXPECTED_DELAY: "EXPECTED_DELAY", "已延误": "DELAYED", DELAYED: "DELAYED", "即将截关": "CUTOFF_SOON", CUTOFF_SOON: "CUTOFF_SOON", "已取消": "CANCELLED", CANCELLED: "CANCELLED" };

async function resolvePortId(value: string | null) {
  if (!value) return undefined;
  const query = value.trim();
  const port = await prisma.port.findFirst({ where: { OR: [{ id: query }, { locode: query.toUpperCase() }, { name: query }, { nameZh: query }] } });
  return port?.id;
}

function orderBy(sort: string | null): Prisma.SailingScheduleOrderByWithRelationInput {
  if (sort === "earliestArrival") return { eta: "asc" };
  if (sort === "shortestTransit") return { transitDays: "asc" };
  if (sort === "highestReliability") return { departureReliability: "desc" };
  if (sort === "fewestStops") return { stopCount: "asc" };
  return { etd: "asc" };
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const { page, pageSize, skip } = parsePagination(searchParams);
    const [originPortId, destinationPortId] = await Promise.all([resolvePortId(searchParams.get("origin")), resolvePortId(searchParams.get("destination"))]);
    const dateFrom = searchParams.get("dateFrom");
    const dateTo = searchParams.get("dateTo");
    const direct = searchParams.get("direct");
    const carrier = searchParams.get("carrier")?.trim();
    const status = searchParams.get("status")?.trim();
    const minReliability = searchParams.get("minReliability");
    const maxTransitDays = searchParams.get("maxTransitDays");

    const where: Prisma.SailingScheduleWhereInput = {
      ...(originPortId ? { originPortId } : searchParams.get("origin") ? { id: "__none__" } : {}),
      ...(destinationPortId ? { destinationPortId } : searchParams.get("destination") ? { id: "__none__" } : {}),
      ...(direct === "true" ? { direct: true } : direct === "false" ? { direct: false } : {}),
      ...(carrier ? { carrier: { name: { contains: carrier } } } : {}),
      ...(status && statusMap[status] ? { status: statusMap[status] } : {}),
      ...(minReliability ? { departureReliability: { gte: Number(minReliability) } } : {}),
      ...(maxTransitDays ? { transitDays: { lte: Number(maxTransitDays) } } : {}),
      ...((dateFrom || dateTo) ? { etd: { ...(dateFrom ? { gte: new Date(dateFrom) } : {}), ...(dateTo ? { lte: new Date(dateTo) } : {}) } } : {}),
    };
    const [items, total] = await Promise.all([
      prisma.sailingSchedule.findMany({ where, include: scheduleInclude, skip, take: pageSize, orderBy: orderBy(searchParams.get("sort")) }),
      prisma.sailingSchedule.count({ where }),
    ]);
    return jsonList(items.map(mapSchedule), { page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) });
  } catch (error) {
    if (process.env.NODE_ENV !== "production") console.error(error);
    return jsonError("DATABASE_ERROR", "船期查询失败，请稍后重试", 500);
  }
}

