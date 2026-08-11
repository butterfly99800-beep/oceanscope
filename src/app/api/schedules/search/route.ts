import { Prisma, ScheduleStatus, type Port } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { jsonError, jsonList, parsePagination } from "@/features/admin/server/api-utils";
import { acquireCoscoScraperLock, releaseCoscoScraperLock } from "@/features/cosco-scraper/server/cosco-scraper-lock";
import { saveCoscoSchedules } from "@/features/cosco-scraper/server/save-cosco-schedules";
import { mapSchedule, scheduleInclude } from "@/features/schedules/server/schedule-mapper";
import { COSCOProvider } from "@/features/shipping/providers/cosco/provider";

const statusMap: Record<string, ScheduleStatus> = { "正常": "NORMAL", NORMAL: "NORMAL", "预计延误": "EXPECTED_DELAY", EXPECTED_DELAY: "EXPECTED_DELAY", "已延误": "DELAYED", DELAYED: "DELAYED", "即将截关": "CUTOFF_SOON", CUTOFF_SOON: "CUTOFF_SOON", "已取消": "CANCELLED", CANCELLED: "CANCELLED" };
const coscoAttemptedAt = new Map<string, number>();

function cacheMinutes() {
  const value = Number(process.env.COSCO_SCHEDULE_CACHE_MINUTES ?? "360");
  return Number.isFinite(value) && value > 0 ? value : 360;
}

function cacheCutoff() {
  return new Date(Date.now() - cacheMinutes() * 60000);
}

function fetchCooldownMs() {
  const value = Number(process.env.COSCO_SCHEDULE_FETCH_COOLDOWN_SECONDS ?? "120");
  return (Number.isFinite(value) && value >= 0 ? value : 120) * 1000;
}

async function resolvePort(value: string | null) {
  if (!value) return undefined;
  const query = value.trim();
  return prisma.port.findFirst({ where: { OR: [{ id: query }, { locode: query.toUpperCase() }, { name: query }, { nameZh: query }] } });
}

function orderBy(sort: string | null): Prisma.SailingScheduleOrderByWithRelationInput {
  if (sort === "earliestArrival") return { eta: "asc" };
  if (sort === "shortestTransit") return { transitDays: "asc" };
  if (sort === "fewestStops") return { stopCount: "asc" };
  return { etd: "asc" };
}

function baseWhere(searchParams: URLSearchParams, originPortId?: string, destinationPortId?: string): Prisma.SailingScheduleWhereInput {
  const dateFrom = searchParams.get("dateFrom");
  const dateTo = searchParams.get("dateTo");
  const direct = searchParams.get("direct");
  const carrier = searchParams.get("carrier")?.trim();
  const status = searchParams.get("status")?.trim();
  const minReliability = searchParams.get("minReliability");
  const maxTransitDays = searchParams.get("maxTransitDays");
  return {
    source: { not: "SEED" },
    ...(originPortId ? { originPortId } : searchParams.get("origin") ? { id: "__none__" } : {}),
    ...(destinationPortId ? { destinationPortId } : searchParams.get("destination") ? { id: "__none__" } : {}),
    ...(direct === "true" ? { direct: true } : direct === "false" ? { direct: false } : {}),
    ...(carrier ? { carrier: { name: { contains: carrier } } } : {}),
    ...(status && statusMap[status] ? { status: statusMap[status] } : {}),
    ...(minReliability ? { departureReliability: { gte: Number(minReliability) } } : {}),
    ...(maxTransitDays ? { transitDays: { lte: Number(maxTransitDays) } } : {}),
    ...((dateFrom || dateTo) ? { etd: { ...(dateFrom ? { gte: new Date(dateFrom) } : {}), ...(dateTo ? { lte: new Date(dateTo) } : {}) } } : {}),
  };
}

function frontendScraperMode() {
  const mode = process.env.COSCO_FRONTEND_SCRAPER_MODE;
  const browserFallbackEnabled = process.env.COSCO_FRONTEND_BROWSER_FALLBACK === "true";
  if (!browserFallbackEnabled) return "api";
  return mode === "browser" || mode === "auto" ? mode : "api";
}

async function list(where: Prisma.SailingScheduleWhereInput, searchParams: URLSearchParams) {
  const { page, pageSize, skip } = parsePagination(searchParams);
  const [items, total] = await Promise.all([
    prisma.sailingSchedule.findMany({ where, include: scheduleInclude, skip, take: pageSize, orderBy: orderBy(searchParams.get("sort")) }),
    prisma.sailingSchedule.count({ where }),
  ]);
  return jsonList(items.map(mapSchedule), { page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) });
}

async function tryFetchAndSave(originPort: Port, destinationPort: Port, searchParams: URLSearchParams) {
  if (process.env.COSCO_SCRAPER_ENABLED !== "true") return false;
  const dateFrom = searchParams.get("dateFrom");
  if (!dateFrom) return false;
  const dateTo = searchParams.get("dateTo")?.slice(0, 10) || "";
  const key = [originPort.id, destinationPort.id, dateFrom.slice(0, 10), dateTo].join("|");
  // 只有上次成功抓取后才进入冷却；失败不冷却，允许立即重试
  const lastSuccess = coscoAttemptedAt.get(key) ?? 0;
  if (Date.now() - lastSuccess < fetchCooldownMs()) return false;
  if (!acquireCoscoScraperLock()) return false;
  try {
    const result = await COSCOProvider.searchSchedule({
      originPort,
      destinationPort,
      departureDate: dateFrom.slice(0, 10),
      dateTo: dateTo || undefined,
      mode: frontendScraperMode(),
      originOverride: searchParams.get("originCity") || undefined,
      destinationOverride: searchParams.get("destinationCity") || undefined,
      originCityUuid: searchParams.get("originCityUuid") || undefined,
      destinationCityUuid: searchParams.get("destinationCityUuid") || undefined,
      forceRefresh: true,
    });
    // 只有成功抓到数据才标记冷却时间
    if (result.schedules.length > 0) {
      coscoAttemptedAt.set(key, Date.now());
    }
    if (!result.schedules.length) return true;
    await saveCoscoSchedules(result.schedules, { mode: "updateDuplicates", originPort, destinationPort });
    return true;
  } finally {
    releaseCoscoScraperLock();
  }
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const [originPort, destinationPort] = await Promise.all([resolvePort(searchParams.get("origin")), resolvePort(searchParams.get("destination"))]);
    const where = baseWhere(searchParams, originPort?.id, destinationPort?.id);

    if (originPort && destinationPort && searchParams.get("dateFrom")) {
      const freshWhere: Prisma.SailingScheduleWhereInput = { ...where, source: "COSCO_LIVE_QUERY", updatedAt: { gte: cacheCutoff() } };
      if (await prisma.sailingSchedule.count({ where: freshWhere })) return list(freshWhere, searchParams);
      const staleWhere: Prisma.SailingScheduleWhereInput = { ...where, source: "COSCO_LIVE_QUERY" };

      try {
        const fetched = await tryFetchAndSave(originPort, destinationPort, searchParams);
        if (fetched) return list(staleWhere, searchParams);
      } catch (error) {
        if (process.env.NODE_ENV !== "production") console.error(error);
        if (await prisma.sailingSchedule.count({ where: staleWhere })) return list(staleWhere, searchParams);
        return jsonError("DATABASE_ERROR", "船期查询暂时不可用，请稍后重试", 503);
      }
      if (await prisma.sailingSchedule.count({ where: staleWhere })) return list(staleWhere, searchParams);
      return jsonError("DATABASE_ERROR", "船期查询暂时不可用，请稍后重试", 503);
    }

    return list(where, searchParams);
  } catch (error) {
    if (process.env.NODE_ENV !== "production") console.error(error);
    return jsonError("DATABASE_ERROR", "船期查询暂时不可用，请稍后重试", 500);
  }
}

