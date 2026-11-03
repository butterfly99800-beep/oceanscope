import { Prisma, ScheduleDataSource, ScheduleStatus, type Port } from "@prisma/client";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { matchesSourcePort, samePortCode } from "@/features/ports/server/source-port-match";
import { jsonError, parsePagination } from "@/features/admin/server/api-utils";
import { acquireCoscoScraperLock, releaseCoscoScraperLock } from "@/features/cosco-scraper/server/cosco-scraper-lock";
import { saveCoscoSchedules } from "@/features/cosco-scraper/server/save-cosco-schedules";
import type { CoscoSchedulePreview } from "@/features/cosco-scraper/types";
import { mapSchedule, scheduleInclude } from "@/features/schedules/server/schedule-mapper";
import { COSCOProvider } from "@/features/shipping/providers/cosco/provider";
import { OOCLProvider } from "@/features/shipping/providers/oocl/provider";
import { CMAProvider } from "@/features/shipping/providers/cma/provider";
import { MAERSKProvider } from "@/features/shipping/providers/maersk/provider";
import { HAPAGProvider } from "@/features/shipping/providers/hapag/provider";
import { MSCProvider } from "@/features/shipping/providers/msc/provider";

import { ONEProvider } from "@/features/shipping/providers/one/provider";

const statusMap: Record<string, ScheduleStatus> = { "正常": "NORMAL", NORMAL: "NORMAL", "预计延误": "EXPECTED_DELAY", EXPECTED_DELAY: "EXPECTED_DELAY", "已延误": "DELAYED", DELAYED: "DELAYED", "即将截关": "CUTOFF_SOON", CUTOFF_SOON: "CUTOFF_SOON", "已取消": "CANCELLED", CANCELLED: "CANCELLED" };
// 记录每个(起运|目的|日期)键的实时抓取状态，用于前端轮询补全。
// done=false 表示仍有船司在后台抓取，前端应继续轮询；done=true 表示本轮抓取已结束。
type ProviderFetchStatus = {
  code: string;
  status: "pending" | "fetching" | "cached" | "success" | "no_results" | "unavailable" | "error";
  resultCount: number;
  warnings: string[];
};
type LiveFetchState = { done: boolean; startedAt: number; forceRefresh?: boolean; providers: ProviderFetchStatus[] };
const liveFetchStates = new Map<string, LiveFetchState>();
const liveSources: ScheduleDataSource[] = [
  ScheduleDataSource.COSCO_LIVE_QUERY,
  ScheduleDataSource.OOCL_LIVE_QUERY,
  ScheduleDataSource.CMA_LIVE_QUERY,
  ScheduleDataSource.MAERSK_LIVE_QUERY,
  ScheduleDataSource.HAPAG_LIVE_QUERY,
  ScheduleDataSource.MSC_LIVE_QUERY,
  ScheduleDataSource.ONE_LIVE_QUERY,
];
const providers = [COSCOProvider, OOCLProvider, CMAProvider, MAERSKProvider, HAPAGProvider, MSCProvider, ONEProvider] as const;

function sourceForProvider(code: string) {
  if (code === "OOCL") return ScheduleDataSource.OOCL_LIVE_QUERY;
  if (code === "CMA") return ScheduleDataSource.CMA_LIVE_QUERY;
  if (code === "MAERSK") return ScheduleDataSource.MAERSK_LIVE_QUERY;
  if (code === "HAPAG") return ScheduleDataSource.HAPAG_LIVE_QUERY;
  if (code === "MSC") return ScheduleDataSource.MSC_LIVE_QUERY;
  if (code === "ONE") return ScheduleDataSource.ONE_LIVE_QUERY;
  return ScheduleDataSource.COSCO_LIVE_QUERY;
}

function carrierNameForProvider(code: string) {
  if (code === "OOCL") return "OOCL";
  if (code === "CMA") return "CMA CGM";
  if (code === "MAERSK") return "MAERSK";
  if (code === "HAPAG") return "HAPAG-LLOYD";
  if (code === "MSC") return "MSC";
  if (code === "ONE") return "ONE";
  return "COSCO SHIPPING";
}

function providerStatus(state: LiveFetchState, code: string) {
  return state.providers.find((item) => item.code === code)!;
}

function unavailable(warnings: string[]) {
  return warnings.some((warning) => /AUTH_REQUIRED|NOT_CONFIGURED|ACCESS_BLOCKED|RATE_LIMITED|CAPTCHA_REQUIRED|VERIFICATION_REQUIRED|BROWSER_UNAVAILABLE|PUBLIC_PAGE_FAILED|API responded [45]|QUERY_FAILED|query failed|fetch failed|_TIMEOUT/i.test(warning));
}

function cacheMinutes() {
  const value = Number(process.env.COSCO_SCHEDULE_CACHE_MINUTES ?? "360");
  return Number.isFinite(value) && value > 0 ? value : 360;
}

function liveFetchEnabled() {
  return (process.env.SCHEDULE_LIVE_FETCH_ENABLED ?? process.env.COSCO_SCRAPER_ENABLED) === "true";
}

function cacheCutoff() {
  return new Date(Date.now() - cacheMinutes() * 60000);
}

function providerTimeoutMs() {
  const value = Number(process.env.SCHEDULE_PROVIDER_TIMEOUT_MS ?? "75000");
  return Number.isFinite(value) && value >= 10000 ? value : 75000;
}

type LiveProviderResult = { schedules: CoscoSchedulePreview[]; warnings: string[] };

async function queryDestinations(targets: Port[], query: (port: Port) => Promise<LiveProviderResult>, sequential: boolean): Promise<LiveProviderResult> {
  const run = async (port: Port): Promise<LiveProviderResult> => {
    try { return await query(port); }
    catch (error) { return { schedules: [], warnings: [`${port.locode}: ${error instanceof Error ? error.message : "QUERY_FAILED"}`] }; }
  };
  const results: LiveProviderResult[] = [];
  // Persistent browser profiles cannot be opened by two searches simultaneously.
  if (sequential) { for (const port of targets) results.push(await run(port)); }
  else results.push(...await Promise.all(targets.map(run)));
  return { schedules: results.flatMap((result) => result.schedules), warnings: results.flatMap((result) => result.warnings) };
}

async function withProviderTimeout(code: string, task: Promise<LiveProviderResult>): Promise<LiveProviderResult> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = code === "OOCL" ? Math.max(providerTimeoutMs(), 205000) : providerTimeoutMs();
  try {
    return await Promise.race([
      task,
      new Promise<LiveProviderResult>((_, reject) => {
        timer = setTimeout(() => reject(new Error(`${code}_TIMEOUT: public schedule query exceeded ${timeout}ms.`)), timeout);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

async function resolvePort(value: string | null, carrierCity: string | null) {
  const candidates = [value, ...(carrierCity?.split(",") ?? [])]
    .map((item) => item?.trim() ?? "")
    .filter((item, index, items) => item && !item.startsWith("cosco:") && items.indexOf(item) === index);

  for (const query of candidates) {
    const exact = await prisma.port.findFirst({
      where: { OR: [{ id: query }, { locode: query.toUpperCase() }, { name: query }, { nameZh: query }] },
    });
    if (exact) return exact;
  }

  // 名称 contains 兜底（如 "Yantian" -> "Yantian Pt"）；短词不做模糊，防误匹配。
  for (const query of candidates) {
    if (query.length < 3) continue;
    const contains = await prisma.port.findFirst({
      where: { OR: [{ name: { contains: query } }, { nameZh: { contains: query } }] },
    });
    if (contains) return contains;
  }
  return undefined;
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
    ...((dateFrom || dateTo) ? { etd: { ...(dateFrom ? { gte: new Date(dateFrom) } : {}), ...(dateTo ? { lt: new Date(new Date(dateTo.slice(0, 10)).getTime() + 86400000) } : {}) } } : {}),
  };
}

function frontendScraperMode() {
  const mode = process.env.COSCO_FRONTEND_SCRAPER_MODE;
  const browserFallbackEnabled = process.env.COSCO_FRONTEND_BROWSER_FALLBACK === "true";
  if (!browserFallbackEnabled) return "api";
  // Even legacy browser-only settings should try the working public API first.
  return mode === "browser" || mode === "edge" || mode === "auto" ? "auto" : "api";
}

async function listPayload(where: Prisma.SailingScheduleWhereInput, searchParams: URLSearchParams) {
  const { page, pageSize, skip } = parsePagination(searchParams);
  if (!where.originPortId || !where.destinationPortId) {
    const [rows, total] = await Promise.all([
      prisma.sailingSchedule.findMany({ where, include: scheduleInclude, skip, take: pageSize, orderBy: orderBy(searchParams.get("sort")) }),
      prisma.sailingSchedule.count({ where }),
    ]);
    return { data: rows.map(mapSchedule), providerCounts: {} as Record<string, number>, pagination: { page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) } };
  }
  const rows = await prisma.sailingSchedule.findMany({ where, include: scheduleInclude, orderBy: orderBy(searchParams.get("sort")) });
  const validRows = latestScheduleSnapshots(rows.filter(sourceMatchesPorts));
  const items = validRows.slice(skip, skip + pageSize);
  const total = validRows.length;
  const providerCounts = Object.fromEntries(providers.map((provider) => [provider.code, validRows.filter((row) => row.source === sourceForProvider(provider.code)).length]));
  return { data: items.map(mapSchedule), providerCounts, pagination: { page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) } };
}

type SourcePort = Pick<Port, "name" | "nameZh" | "locode">;
function latestScheduleSnapshots<T extends { id: string; source: ScheduleDataSource; originPortId: string; destinationPortId: string; vesselName: string | null; voyageNumber: string | null; serviceName: string | null; frequency: string | null; updatedAt: Date; rawSourceData: Prisma.JsonValue | null; sourceReference: string | null }>(rows: T[]): T[] {
  const latest = new Map<string, T>();
  const identity = (row: T) => row.vesselName && row.voyageNumber
    ? JSON.stringify([row.source, row.originPortId, row.destinationPortId, row.vesselName, row.voyageNumber, row.serviceName, row.frequency,
      typeof row.rawSourceData === "string" && row.rawSourceData.startsWith('{"officialLegs":') ? row.sourceReference : null]) : row.id;
  for (const row of rows) {
    const key = identity(row);
    const previous = latest.get(key);
    if (!previous || previous.updatedAt < row.updatedAt) latest.set(key, row);
  }
  return rows.filter((row) => latest.get(identity(row))?.id === row.id);
}

function sourceMatchesPorts(row: { source: ScheduleDataSource; rawSourceData: Prisma.JsonValue | null; originPort: SourcePort; destinationPort: SourcePort }) {
  if (row.source === "MANUAL" || row.source === "SEED") return true;
  if (!row.rawSourceData) return false;
  const text = typeof row.rawSourceData === "string" ? row.rawSourceData : JSON.stringify(row.rawSourceData);
  const matches = matchesSourcePort;
  if (row.source === "COSCO_LIVE_QUERY") {
    try {
      type Leg = { pol?: string; pod?: string; polPortCode?: string; podPortCode?: string };
      const source = JSON.parse(text) as Leg & { officialLegs?: Leg[] };
      const first = source.officialLegs?.[0] || source;
      const last = source.officialLegs?.at(-1) || source;
      const origin = first.polPortCode && /^[A-Z]{5}$/.test(first.polPortCode) ? first.polPortCode : first.pol;
      const destination = last.podPortCode && /^[A-Z]{5}$/.test(last.podPortCode) ? last.podPortCode : last.pod;
      return matches(origin, row.originPort) && matches(destination, row.destinationPort);
    } catch { return false; }
  }
  if (row.source === "OOCL_LIVE_QUERY") {
    const origin = text.match(/(?:^|\n)POL:[ \t]*([^\n]+)/)?.[1];
    const destination = text.match(/(?:^|\n)Final Destination Hub:[ \t]*([^\n]+)/)?.[1] || text.match(/(?:^|\n)POD:[ \t]*([^\n]+)/)?.[1];
    return matches(origin, row.originPort) && matches(destination, row.destinationPort);
  }
  return true;
}

async function acquireLockWithRetry(timeoutMs = 180000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (acquireCoscoScraperLock()) return true;
    await new Promise((resolve) => setTimeout(resolve, 5000));
  }
  return false;
}

// 后台按船司独立补抓：不阻塞本次响应，逐船司抓取并入库。
// 已有新鲜数据的船司跳过；全部结束后把 state.done 置 true，供前端停止轮询。
async function runBackgroundFetch(key: string, originPort: Port, destinationPort: Port, searchParams: URLSearchParams, state: LiveFetchState, destinationPorts: Port[]) {
  const dateFrom = searchParams.get("dateFrom");
  const dateTo = searchParams.get("dateTo")?.slice(0, 10) || "";
  try {
    if (!liveFetchEnabled()) return;
    const freshRows = await prisma.sailingSchedule.findMany({
      where: {
        originPortId: originPort.id,
        destinationPortId: { in: destinationPorts.map((port) => port.id) },
        ...(dateFrom || dateTo ? { etd: { ...(dateFrom ? { gte: new Date(dateFrom) } : {}), ...(dateTo ? { lt: new Date(new Date(dateTo).getTime() + 86400000) } : {}) } } : {}),
        source: { in: [...liveSources] },
        updatedAt: { gte: cacheCutoff() },
      },
      include: scheduleInclude,
    }).then((rows) => latestScheduleSnapshots(rows.filter(sourceMatchesPorts)));
    const freshSources = new Set(freshRows.filter((row) => destinationPorts.every((port) => freshRows.some((candidate) => candidate.source === row.source && candidate.destinationPortId === port.id))).map((row) => row.source));
    if (searchParams.get("refresh") === "true") freshSources.clear();
    for (const provider of providers) {
      if (freshSources.has(sourceForProvider(provider.code))) {
        const status = providerStatus(state, provider.code);
        status.status = "cached";
        status.resultCount = freshRows.filter((row) => row.source === sourceForProvider(provider.code)).length;
      }
    }
    // 全部船司都已有新鲜数据时，无需抓取，直接收尾
    if (providers.every((provider) => freshSources.has(sourceForProvider(provider.code)))) return;
    if (!(await acquireLockWithRetry())) {
      for (const status of state.providers) {
        if (status.status === "pending") {
          status.status = "error";
          status.warnings = ["LIVE_FETCH_LOCK_TIMEOUT"];
        }
      }
      return;
    }
    try {
      // 并行抓取：快的接口（MAERSK/COSCO）先入库展示，慢的浏览器（OOCL/CMA）后台继续补
      await Promise.all(providers.map(async (provider) => {
        if (freshSources.has(sourceForProvider(provider.code))) return;
        const status = providerStatus(state, provider.code);
        status.status = "fetching";
        try {
          const targets = provider.code === "COSCO" || provider.code === "ONE" ? [destinationPort] : destinationPorts;
          const result = await withProviderTimeout(provider.code, queryDestinations(targets, (target) => provider.searchSchedule({
            originPort,
            destinationPort: target,
            departureDate: (dateFrom ?? "").slice(0, 10),
            dateTo: dateTo || undefined,
            mode: provider.code === "COSCO" ? frontendScraperMode() : undefined,
            originOverride: provider.code === "COSCO" ? searchParams.get("originCity") || undefined : undefined,
            destinationOverride: provider.code === "COSCO" ? searchParams.get("destinationCity") || undefined : undefined,
            originCityUuid: provider.code === "COSCO" ? searchParams.get("originCityUuid") || undefined : undefined,
            destinationCityUuid: provider.code === "COSCO" ? searchParams.get("destinationCityUuid") || undefined : undefined,
            forceRefresh: provider.code === "COSCO" || searchParams.get("refresh") === "true" ? true : undefined,
          }), provider.code === "CMA" || provider.code === "HAPAG"));
          status.resultCount = result.schedules.length;
          status.warnings = result.warnings.map((warning) => warning.split("\n")[0].slice(0, 300));
          if (!result.schedules.length) {
            status.status = unavailable(result.warnings) ? "unavailable"
              : result.warnings.some((warning) => /^(?:NO_SCHEDULE_FOUND|COSCO_NO_RESULTS)$|returned no routings/i.test(warning)) ? "no_results" : "error";
            return;
          }
          const savedResults = [];
          // A new carrier may not exist yet. Serialize destination writes so LA and
          // Long Beach cannot race to create the same unique carrier code.
          for (const actualDestination of destinationPorts) savedResults.push(await saveCoscoSchedules(result.schedules.filter((item) => {
            if (item.destinationLocode) return samePortCode(item.destinationLocode, actualDestination.locode);
            const name = item.destinationText.split(/[,;(]/)[0].trim().toLowerCase();
            return [actualDestination.name, actualDestination.nameZh, actualDestination.locode].some((value) => value?.toLowerCase() === name);
          }), {
            mode: "updateDuplicates",
            originPort,
            destinationPort: actualDestination,
            source: sourceForProvider(provider.code),
            carrierCode: provider.code,
            carrierName: carrierNameForProvider(provider.code),
          }));
          const saved = savedResults.reduce((total, item) => ({ created: total.created + item.created, updated: total.updated + item.updated, skippedItems: [...total.skippedItems, ...item.skippedItems] }), { created: 0, updated: 0, skippedItems: [] as Array<{ id: string; reason: string }> });
          status.resultCount = saved.created + saved.updated;
          status.status = status.resultCount ? "success" : "error";
          if (!status.resultCount && !saved.skippedItems.length) status.warnings.push("RESULT_PORT_MISMATCH: returned locations do not match the requested destination");
          if (!status.resultCount && saved.skippedItems.length) {
            status.warnings = [...status.warnings, ...saved.skippedItems.slice(0, 3).map((item) => item.reason)];
          }
        } catch (error) {
          status.status = "error";
          status.warnings = [(error instanceof Error ? error.message : "unknown error").split("\n")[0].slice(0, 300)];
          if (process.env.NODE_ENV !== "production") console.error(error);
        }
      }));
    } finally {
      releaseCoscoScraperLock();
    }
  } finally {
    state.done = true;
  }
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const [originPort, destinationPort] = await Promise.all([
      resolvePort(searchParams.get("origin"), searchParams.get("originCity")),
      resolvePort(searchParams.get("destination"), searchParams.get("destinationCity")),
    ]);
    const where = baseWhere(searchParams, originPort?.id, destinationPort?.id);
    // Los Angeles searches include neighbouring Long Beach, retaining its own port identity.
    const destinationPorts = destinationPort ? [destinationPort] : [];
    if (destinationPort?.locode === "USLAX") {
      const longBeach = await prisma.port.findFirst({ where: { locode: "USLGB" } });
      if (longBeach) destinationPorts.push(longBeach);
      where.destinationPortId = { in: destinationPorts.map((port) => port.id) };
    }

    if (originPort && destinationPort && searchParams.get("dateFrom")) {
      const staleWhere: Prisma.SailingScheduleWhereInput = { ...where, source: { in: [...liveSources] }, updatedAt: { gte: cacheCutoff() } };
      const key = [originPort.id, destinationPort.id, searchParams.get("dateFrom")?.slice(0, 10), searchParams.get("dateTo")?.slice(0, 10) || ""].join("|");
      const now = Date.now();
      let state = liveFetchStates.get(key);
      const hasFailed = state?.providers.some((provider) => provider.status === "unavailable" || provider.status === "error");
      if (!state || (state.done && (searchParams.get("refresh") === "true" || (hasFailed && searchParams.get("retry") === "true") || now - state.startedAt >= cacheMinutes() * 60000))) {
        state = {
          done: !liveFetchEnabled(),
          startedAt: now,
          forceRefresh: searchParams.get("refresh") === "true",
          providers: providers.map((provider) => ({
            code: provider.code,
            status: liveFetchEnabled() ? "pending" : "unavailable",
            resultCount: 0,
            warnings: liveFetchEnabled() ? [] : ["LIVE_FETCH_DISABLED"],
          })),
        };
        liveFetchStates.set(key, state);
        if (liveFetchEnabled()) {
          void runBackgroundFetch(key, originPort, destinationPort, searchParams, state, destinationPorts);
        }
      }
      // A forced live run must not pass old cached rows off as fresh results.
      if (state.forceRefresh) {
        staleWhere.updatedAt = { gte: new Date(state.startedAt) };
        staleWhere.source = { in: state.providers.filter((provider) => provider.status === "success").map((provider) => sourceForProvider(provider.code)) };
      }
      const payload = await listPayload(staleWhere, searchParams);
      return NextResponse.json({ ...payload, done: state.done, providers: state.providers.map((provider) => ({ ...provider,
        resultCount: provider.status === "success" || provider.status === "cached" ? payload.providerCounts[provider.code] ?? 0 : provider.resultCount,
      })) });
    }

    return NextResponse.json(await listPayload(where, searchParams));
  } catch (error) {
    if (process.env.NODE_ENV !== "production") console.error(error);
    return jsonError("DATABASE_ERROR", "船期查询暂时不可用，请稍后重试", 500);
  }
}

