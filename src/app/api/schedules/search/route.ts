import { scheduleDateWindows } from "@/features/shipping/providers/query-windows";
import type { QueryAudit } from "@/features/shipping/providers/query-audit";
import { pruneQueryStates } from "@/features/schedules/lib/pruneQueryStates";
import { Prisma, ScheduleDataSource, ScheduleStatus, type Port } from "@prisma/client";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { matchesSourcePort, samePortCode } from "@/features/ports/server/source-port-match";
import { jsonError, parsePagination } from "@/features/admin/server/api-utils";
import { acquireCoscoScraperLock, releaseCoscoScraperLock } from "@/features/cosco-scraper/server/cosco-scraper-lock";
import { currentScheduleFormat, saveCoscoSchedules } from "@/features/cosco-scraper/server/save-cosco-schedules";
import type { CoscoSchedulePreview, InlandRailOption, AlternateLoadingOption } from "@/features/cosco-scraper/types";
import { mapSchedule, scheduleInclude } from "@/features/schedules/server/schedule-mapper";
import { COSCOProvider } from "@/features/shipping/providers/cosco/provider";
import { OOCLProvider } from "@/features/shipping/providers/oocl/provider";
import { CMAProvider } from "@/features/shipping/providers/cma/provider";
import { MAERSKProvider } from "@/features/shipping/providers/maersk/provider";
import { HAPAGProvider } from "@/features/shipping/providers/hapag/provider";
import { MSCProvider } from "@/features/shipping/providers/msc/provider";

import { ONEProvider } from "@/features/shipping/providers/one/provider";

import { EMCProvider } from "@/features/shipping/providers/emc/provider";
import { YMLProvider } from "@/features/shipping/providers/yml/provider";
import { HMMProvider } from "@/features/shipping/providers/hmm/provider";
import { KMTCProvider } from "@/features/shipping/providers/kmtc/provider";
import { ZIMProvider } from "@/features/shipping/providers/zim/provider";

const statusMap: Record<string, ScheduleStatus> = { "正常": "NORMAL", NORMAL: "NORMAL", "预计延误": "EXPECTED_DELAY", EXPECTED_DELAY: "EXPECTED_DELAY", "已延误": "DELAYED", DELAYED: "DELAYED", "即将截关": "CUTOFF_SOON", CUTOFF_SOON: "CUTOFF_SOON", "已取消": "CANCELLED", CANCELLED: "CANCELLED" };
// 记录每个(起运|目的|日期)键的实时抓取状态，用于前端轮询补全。
// done=false 表示仍有船司在后台抓取，前端应继续轮询；done=true 表示本轮抓取已结束。
type ProviderFetchStatus = {
  code: string;
  status: "pending" | "fetching" | "cached" | "success" | "no_results" | "unavailable" | "error";
  resultCount: number;
  warnings: string[];
  audits?: Array<QueryAudit | undefined>;
  inlandRail?: InlandRailOption[];
  alternateLoading?: AlternateLoadingOption[];
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
  ScheduleDataSource.EMC_LIVE_QUERY,
  ScheduleDataSource.YML_LIVE_QUERY,
  ScheduleDataSource.HMM_LIVE_QUERY,
  ScheduleDataSource.KMTC_LIVE_QUERY,
  ScheduleDataSource.ZIM_LIVE_QUERY,
];
const providers = [COSCOProvider, OOCLProvider, CMAProvider, MAERSKProvider, HAPAGProvider, MSCProvider, ONEProvider, EMCProvider, YMLProvider, HMMProvider, KMTCProvider, ZIMProvider] as const;

function sourceForProvider(code: string) {
  if (code === "ZIM") return ScheduleDataSource.ZIM_LIVE_QUERY;
  if (code === "EMC") return ScheduleDataSource.EMC_LIVE_QUERY;
  if (code === "YML") return ScheduleDataSource.YML_LIVE_QUERY;
  if (code === "HMM") return ScheduleDataSource.HMM_LIVE_QUERY;
  if (code === "KMTC") return ScheduleDataSource.KMTC_LIVE_QUERY;
  if (code === "PIL") return ScheduleDataSource.PIL_LIVE_QUERY;
  if (code === "SITC") return ScheduleDataSource.SITC_LIVE_QUERY;
  if (code === "OOCL") return ScheduleDataSource.OOCL_LIVE_QUERY;
  if (code === "CMA") return ScheduleDataSource.CMA_LIVE_QUERY;
  if (code === "MAERSK") return ScheduleDataSource.MAERSK_LIVE_QUERY;
  if (code === "HAPAG") return ScheduleDataSource.HAPAG_LIVE_QUERY;
  if (code === "MSC") return ScheduleDataSource.MSC_LIVE_QUERY;
  if (code === "ONE") return ScheduleDataSource.ONE_LIVE_QUERY;
  return ScheduleDataSource.COSCO_LIVE_QUERY;
}

function carrierNameForProvider(code: string) {
  if (code === "ZIM") return "ZIM";
  if (code === "EMC") return "EVERGREEN";
  if (code === "YML") return "YANG MING";
  if (code === "HMM") return "HMM";
  if (code === "KMTC") return "KMTC";
  if (code === "PIL") return "PIL";
  if (code === "SITC") return "SITC";
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
  return warnings.some((warning) => /PUBLICATION_UNSUPPORTED|PORT_NOT_FOUND|RESPONSE_INVALID|AUTH_REQUIRED|NOT_CONFIGURED|ACCESS_BLOCKED|RATE_LIMITED|CAPTCHA_REQUIRED|VERIFICATION_REQUIRED|BROWSER_UNAVAILABLE|PUBLIC_PAGE_FAILED|API responded [45]|QUERY_FAILED|query failed|fetch failed|_TIMEOUT/i.test(warning));
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

type LiveProviderResult = { schedules: CoscoSchedulePreview[]; warnings: string[]; audit?: QueryAudit; audits?: Array<QueryAudit | undefined> };

async function queryDestinations(targets: Port[], query: (port: Port) => Promise<LiveProviderResult>, sequential: boolean): Promise<LiveProviderResult> {
  const run = async (port: Port): Promise<LiveProviderResult> => {
    try { return await query(port); }
    catch (error) { return { schedules: [], warnings: [`${port.locode}: ${error instanceof Error ? error.message : "QUERY_FAILED"}`] }; }
  };
  const results: LiveProviderResult[] = [];
  // Persistent browser profiles cannot be opened by two searches simultaneously.
  if (sequential) { for (const port of targets) results.push(await run(port)); }
  else results.push(...await Promise.all(targets.map(run)));
  return { schedules: results.flatMap((result) => result.schedules), warnings: results.flatMap((result) => result.warnings), audits:results.flatMap(result=>result.audits??[result.audit]) };
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
  const cityParts = (carrierCity || "").split(",").map(part => part.trim());
  const cityCode = cityParts.at(-1);
  const code = cityCode && /^[A-Z]{2}[A-Z0-9]{3}$/.test(cityCode) ? cityCode
    : value && /^[A-Z]{2}[A-Z0-9]{3}$/.test(value) ? value : undefined;
  if (code) {
    const aliases = [["CNSHA", "CNSGH"], ["CNNGB", "CNNBO"], ["CNTAO", "CNQIN"]];
    const codes = aliases.find(group => group.includes(code)) || [code];
    // Fail closed when this exact location is absent, rather than using its name.
    return (await prisma.port.findFirst({ where: { locode: { in: codes } } })) ?? undefined;
  }
  if (value && !value.startsWith("cosco:")) {
    const byId = await prisma.port.findUnique({ where: { id: value } });
    if (byId) return byId;
  }
  const name = cityParts[0] || value;
  if (!name || name.startsWith("cosco:")) return undefined;
  const matches = await prisma.port.findMany({
    where: { OR: [{ name }, { nameZh: name }] }, take: 2,
  });
  return matches.length === 1 ? matches[0] : undefined;
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
    source: { notIn: ["SEED", "PIL_LIVE_QUERY", "SITC_LIVE_QUERY"] },
    ...(originPortId ? { originPortId } : searchParams.get("origin") ? { id: "__none__" } : {}),
    ...(destinationPortId ? { destinationPortId } : searchParams.get("destination") ? { id: "__none__" } : {}),
    ...(direct === "true" ? { direct: true } : direct === "false" ? { direct: false } : {}),
    carrier: { code: { notIn: ["PIL", "SITC"] }, ...(carrier ? { name: { contains: carrier } } : {}) },
    ...(status && statusMap[status] ? { status: statusMap[status] } : {}),
    ...(minReliability ? { departureReliability: { gte: Number(minReliability) } } : {}),
    ...(maxTransitDays ? { transitDays: { lte: Number(maxTransitDays) } } : {}),
    ...((dateFrom || dateTo) ? { etd: { ...(dateFrom ? { gte: new Date(dateFrom) } : {}), ...(dateTo ? { lt: new Date(new Date(dateTo.slice(0, 10)).getTime() + 86400000) } : {}) } } : {}),
  };
}

function frontendScraperMode() {
  if (process.env.COSCO_FRONTEND_BROWSER_FALLBACK === "false" || process.env.COSCO_FRONTEND_SCRAPER_MODE === "api") return "api";
  return "auto";
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
      ((typeof row.rawSourceData === "string" && row.rawSourceData.startsWith('{"officialLegs":')) || ["EMC_LIVE_QUERY", "YML_LIVE_QUERY", "HMM_LIVE_QUERY", "KMTC_LIVE_QUERY", "PIL_LIVE_QUERY", "SITC_LIVE_QUERY", "ZIM_LIVE_QUERY"].includes(row.source)) ? row.sourceReference : null]) : row.id;
  for (const row of rows) {
    const key = identity(row);
    const previous = latest.get(key);
    if (!previous || previous.updatedAt < row.updatedAt) latest.set(key, row);
  }
  return rows.filter((row) => latest.get(identity(row))?.id === row.id);
}

function sourceMatchesPorts(row: { source: ScheduleDataSource; sourceReference: string | null; rawSourceData: Prisma.JsonValue | null; originPort: SourcePort; destinationPort: SourcePort }) {
  if (row.source === "MANUAL" || row.source === "SEED") return true;
  if (!currentScheduleFormat(row.source, row.sourceReference)) return false;
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
          const windowResults: LiveProviderResult[] = [];
          const windows = dateFrom && dateTo && Date.parse(dateTo)-Date.parse(dateFrom)>=28*86400000
            ? scheduleDateWindows(dateFrom,dateTo) : [{from:dateFrom || "",to:dateTo || ""}];
          for (const window of windows) {
            try {
              windowResults.push(await withProviderTimeout(provider.code, queryDestinations(targets, (target) => provider.searchSchedule({
            originPort,
            destinationPort: target,
            departureDate: window.from.slice(0, 10),
            dateTo: window.to || undefined,
            mode: provider.code === "COSCO" ? frontendScraperMode() : undefined,
            originOverride: provider.code === "COSCO" ? searchParams.get("originCity") || undefined : undefined,
            destinationOverride: provider.code === "COSCO" ? searchParams.get("destinationCity") || undefined : undefined,
            originCityUuid: provider.code === "COSCO" ? searchParams.get("originCityUuid") || undefined : undefined,
            destinationCityUuid: provider.code === "COSCO" ? searchParams.get("destinationCityUuid") || undefined : undefined,
            forceRefresh: provider.code === "COSCO" || searchParams.get("refresh") === "true" ? true : undefined,
          }), provider.code === "HAPAG")));
            } catch (error) {
              windowResults.push({schedules:[],warnings:[`${provider.code}_WINDOW_FAILED: ${window.from}..${window.to}: ${error instanceof Error ? error.message : "query failed"}`]});
            }
          }
          const result: LiveProviderResult = {
            schedules: [...new Map(windowResults.flatMap(r=>r.schedules).map(s=>[`${s.id}:${s.destinationLocode || s.destinationText}`,s])).values()],
            warnings: [...new Set(windowResults.flatMap(r=>r.warnings))],
            audits: windowResults.flatMap(r=>r.audits || [r.audit]),
          };
          if(result.schedules.length && result.warnings.some(w=>/_WINDOW_FAILED/.test(w)))result.warnings.push("COUNT_RECONCILIATION_INCOMPLETE: a date window did not finish");
          status.audits = result.audits;
          status.resultCount = result.schedules.length;
          status.warnings = result.warnings.map((warning) => warning.split("\n")[0].slice(0, 300));
          if (!result.schedules.length) {
            status.status = unavailable(result.warnings) ? "unavailable"
              : result.warnings.some((warning) => /^(?:NO_SCHEDULE_FOUND|COSCO_NO_RESULTS)$|returned no routings/i.test(warning)) ? "no_results" : "error";
            return;
          }
          if (provider.code === "COSCO") status.inlandRail = result.schedules.flatMap(item => item.inlandRail ? [item.inlandRail] : []);
          if (provider.code === "OOCL") status.alternateLoading = result.schedules.flatMap(item => item.alternateLoading ? [item.alternateLoading] : []);
          const savedResults = [];
          // A new carrier may not exist yet. Serialize destination writes so LA and
          // Long Beach cannot race to create the same unique carrier code.
          for (const actualDestination of destinationPorts) savedResults.push(await saveCoscoSchedules(result.schedules.filter((item) => {
            if (item.alternateLoading) return false;
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
          status.status = status.resultCount || status.inlandRail?.length || status.alternateLoading?.length ? "success" : "error";
          if (!status.resultCount && !status.inlandRail?.length && !status.alternateLoading?.length && !saved.skippedItems.length) status.warnings.push("RESULT_PORT_MISMATCH: returned locations do not match the requested destination");
          if (saved.skippedItems.length) {
            status.warnings = [...status.warnings, "COUNT_RECONCILIATION_INCOMPLETE: some returned rows were not saved", ...saved.skippedItems.slice(0, 3).map((item) => item.reason)];
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
    const requestedFrom=searchParams.get("dateFrom")?.slice(0,10), requestedTo=searchParams.get("dateTo")?.slice(0,10);
    if(requestedFrom && requestedTo) {
      try { scheduleDateWindows(requestedFrom,requestedTo); }
      catch { return jsonError("BAD_REQUEST", "查询范围必须为有效日期，且不超过 70 天",400); }
    }
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
      pruneQueryStates(liveFetchStates, now, cacheMinutes() * 60000, key);
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

