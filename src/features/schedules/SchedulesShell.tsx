"use client";

import { completeSchedulePages } from "@/features/schedules/lib/completeSchedulePages";
import { ArrowLeft, RefreshCw, SlidersHorizontal, X } from "lucide-react";
import dynamic from "next/dynamic";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { PageContainer } from "@/components/layout/PageContainer";
import { PageHeader } from "@/components/layout/PageHeader";
import { RecentScheduleSearches } from "@/features/schedules/components/RecentScheduleSearches";
import { ScheduleSearchForm } from "@/features/schedules/components/ScheduleSearchForm";
import { schedulePorts as fallbackPorts } from "@/features/schedules/data/mock-schedule-data";
import { countActiveFilters, filterSchedules } from "@/features/schedules/lib/filterSchedules";
import { getFavoriteScheduleIds, getRecentScheduleSearches, saveRecentScheduleSearch, toggleFavoriteSchedule } from "@/features/schedules/lib/scheduleStorage";
import { sortSchedules } from "@/features/schedules/lib/sortSchedules";
import type { PortOption, RecentScheduleSearch, SailingSchedule, ScheduleFilterState, ScheduleSearchCriteria, ScheduleSortOption, ScheduleViewMode } from "@/features/schedules/types";

const ScheduleCompareBar = dynamic(() => import("@/features/schedules/components/ScheduleCompare").then((m) => m.ScheduleCompareBar), { ssr: false });
const ScheduleCompareDrawer = dynamic(() => import("@/features/schedules/components/ScheduleCompare").then((m) => m.ScheduleCompareDrawer), { ssr: false });
const ScheduleControls = dynamic(() => import("@/features/schedules/components/ScheduleControls").then((m) => m.ScheduleControls), { ssr: false });
const ScheduleDetailsPanel = dynamic(() => import("@/features/schedules/components/ScheduleDetailsPanel").then((m) => m.ScheduleDetailsPanel), { ssr: false });
const ScheduleFilters = dynamic(() => import("@/features/schedules/components/ScheduleFilters").then((m) => m.ScheduleFilters), { ssr: false });
const ScheduleResultList = dynamic(() => import("@/features/schedules/components/ScheduleResultList").then((m) => m.ScheduleResultList), { ssr: false });

function todayInputValue() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Shanghai", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}

function createInitialCriteria(): ScheduleSearchCriteria {
  return { originPortId: "", destinationPortId: "", departureDate: todayInputValue(), dateRange: "7", beforeDays: "0", afterDays: "28", directOnly: false };
}

const initialFilters: ScheduleFilterState = { carriers: [], direct: "all", stopCount: "all", departureFrom: "", transitDays: "all", serviceName: "", vesselName: "", terminal: "" };

type PortListResponse = { data: PortOption[] };
import type { InlandRailOption, AlternateLoadingOption } from "@/features/cosco-scraper/types";

type ProviderFetchStatus = { alternateLoading?: AlternateLoadingOption[]; inlandRail?: InlandRailOption[]; code: string; status: "pending" | "fetching" | "cached" | "success" | "no_results" | "unavailable" | "error"; resultCount: number; warnings: string[] };
type ScheduleListResponse = { data: SailingSchedule[]; pagination: { total: number }; done: boolean; providers?: ProviderFetchStatus[] };

const carrierLabels: Record<string, string> = { COSCO: "COSCO", OOCL: "OOCL", CMA: "CMA CGM", MAERSK: "MAERSK", HAPAG: "Hapag-Lloyd", MSC: "MSC", ONE: "ONE" };

function providerStatusText(provider: ProviderFetchStatus) {
  if (provider.alternateLoading?.length) return [provider.resultCount ? provider.resultCount + " 条" : "", provider.alternateLoading.length + " 条异港装船"].filter(Boolean).join("，");
  if (provider.inlandRail?.length) return [provider.resultCount ? provider.resultCount + " 条完整船期" : "", provider.inlandRail.length + " 条含铁路段"].filter(Boolean).join("，");
  if (provider.status === "success" || provider.status === "cached") return `${provider.resultCount} 条`;
  if (provider.warnings.some(w => /MAERSK_CONFIG_REQUIRED/.test(w))) return "缺少查询配置";
  if (provider.warnings.some(w => /INLAND_UNSUPPORTED/.test(w))) return "内陆段暂未支持";
  if (provider.warnings.some(w => /PORT_NOT_FOUND|Geo ID could not be resolved/.test(w))) return "公开入口未匹配到地点";
  if (provider.warnings.some(w => /RESULT_PORT_MISMATCH|Official result port does not match/.test(w))) return "官网返回其他港口";
  if (provider.warnings.some(w => /OOCL_AUTH_REQUIRED/.test(w))) return "官网要求登录后重试";
  if (provider.warnings.some(w => /PARSE_INCOMPLETE|RESPONSE_INVALID/.test(w))) return "官网数据未能完整解析";
  if (provider.warnings.some((warning) => /ACCESS_BLOCKED/.test(warning))) return "官网限制访问";
  if (provider.warnings.some((warning) => /RATE_LIMITED/.test(warning))) return "官网请求限流";
  if (provider.status === "fetching" || provider.status === "pending") return "查询中";
  if (provider.status === "no_results") return "未查到船期";
  if (provider.warnings.some((warning) => /CAPTCHA_REQUIRED|VERIFICATION_REQUIRED/i.test(warning))) return "需要官网验证";
  if (provider.warnings.some((warning) => /TIMEOUT|Timeout/i.test(warning))) return "官网响应超时";
  if (provider.status === "unavailable") return "官网暂不可用";
  return "查询失败";
}

function slug(value: string) {
  return value.toLowerCase().replace(/\s+/g, "-");
}

function findPort(ports: PortOption[], id: string) {
  return ports.find((item) => item.id === id || item.code.toLowerCase() === id.toLowerCase() || slug(item.name) === id || item.aliases.some((alias) => alias.toLowerCase() === id.toLowerCase()));
}

function portLabel(ports: PortOption[], id: string) {
  const port = findPort(ports, id);
  return port ? `${port.localName} ${port.code}` : id;
}

function apiPortValue(ports: PortOption[], id: string) {
  const port = findPort(ports, id);
  return port?.code ?? port?.id ?? id;
}

function dbPortValueForCosco(ports: PortOption[], coscoCity: NonNullable<ScheduleSearchCriteria["originCoscoCity"]>) {
  const matched = ports.find((port) => coscoCity.locode && port.code.toLowerCase() === coscoCity.locode.toLowerCase())
    || ports.find((port) => port.name.toLowerCase() === coscoCity.name.toLowerCase());
  // COSCO suggestions use synthetic `cosco:<uuid>` ids. When the matching DB
  // port is not in the first page of loaded ports, send the city name instead
  // of that synthetic id so the API can still resolve the real port.
  return matched?.code ?? coscoCity.locode ?? coscoCity.name;
}

function validate(criteria: ScheduleSearchCriteria, ports: PortOption[]) {
  const errors: Partial<Record<keyof ScheduleSearchCriteria, string>> = {};
  if (!criteria.originCoscoCity && !findPort(ports, criteria.originPortId)) errors.originPortId = "请选择有效起运港";
  if (!criteria.destinationCoscoCity && !findPort(ports, criteria.destinationPortId)) errors.destinationPortId = "请选择有效目的港";
  const originValue = criteria.originCoscoCity?.uuid || apiPortValue(ports, criteria.originPortId);
  const destinationValue = criteria.destinationCoscoCity?.uuid || apiPortValue(ports, criteria.destinationPortId);
  if (originValue && originValue === destinationValue) errors.destinationPortId = "起运港和目的港不能相同";
  if (!criteria.departureDate) errors.departureDate = "请选择最早出发日期";
  return errors;
}

function dateWindow(criteria: ScheduleSearchCriteria) {
  const base = new Date(`${criteria.departureDate}T00:00:00Z`);
  const beforeDays = Number(criteria.beforeDays || 0);
  const afterDays = Number(criteria.afterDays || criteria.dateRange || 0);
  const from = new Date(base);
  const to = new Date(base);
  from.setUTCDate(base.getUTCDate() - beforeDays);
  to.setUTCDate(base.getUTCDate() + afterDays);
  return { dateFrom: from.toISOString().slice(0, 10), dateTo: to.toISOString().slice(0, 10) };
}

export function SchedulesShell() {
  const [ports, setPorts] = useState<PortOption[]>(fallbackPorts);
  const [criteria, setCriteria] = useState<ScheduleSearchCriteria>(() => createInitialCriteria());
  const [errors, setErrors] = useState<Partial<Record<keyof ScheduleSearchCriteria, string>>>({});
  const [hasSearched, setHasSearched] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [queryError, setQueryError] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [providerStatuses, setProviderStatuses] = useState<ProviderFetchStatus[]>([]);
  const pollTokenRef = useRef(0);
  const [lastUpdated, setLastUpdated] = useState("");
  const [baseResults, setBaseResults] = useState<SailingSchedule[]>([]);
  const [filters, setFilters] = useState<ScheduleFilterState>(initialFilters);
  const [sort, setSort] = useState<ScheduleSortOption>("recommended");
  const [view, setView] = useState<ScheduleViewMode>("table");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [visibleCount, setVisibleCount] = useState(6);
  const [recentSearches, setRecentSearches] = useState<RecentScheduleSearch[]>([]);
  const [favoriteIds, setFavoriteIds] = useState<string[]>([]);
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [compareIds, setCompareIds] = useState<string[]>([]);
  const [compareOpen, setCompareOpen] = useState(false);
  const [compareMessage, setCompareMessage] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);

  useEffect(() => {
    const savedSearches = getRecentScheduleSearches([]);
    setRecentSearches(savedSearches);
    setFavoriteIds(getFavoriteScheduleIds());
    fetch("/api/ports/search?pageSize=100")
      .then((response) => response.ok ? response.json() as Promise<PortListResponse> : Promise.reject())
      .then(async (payload) => {
        if (payload.data.length) setPorts(payload.data);
        const missing = [...new Set(savedSearches.flatMap((search) => [search.originPortId, search.destinationPortId]))]
          .filter((key) => !findPort(payload.data, key));
        const resolved = await Promise.all(missing.map(async (key) => {
          try {
            const response = await fetch(`/api/ports/search?q=${encodeURIComponent(key)}&pageSize=10`);
            if (!response.ok) return [];
            const result = await response.json() as PortListResponse;
            return result.data;
          } catch { return []; }
        }));
        setPorts((current) => [...new Map([...current, ...resolved.flat()].map((port) => [port.id, port])).values()]);
      })
      .catch(() => undefined);
  }, []);

  const carriers = useMemo(() => Array.from(new Set(baseResults.map((schedule) => schedule.carrier))), [baseResults]);
  const filtered = useMemo(() => sortSchedules(filterSchedules(baseResults, filters, favoriteIds, favoritesOnly), sort), [baseResults, favoriteIds, favoritesOnly, filters, sort]);
  const selected = selectedId ? baseResults.find((schedule) => schedule.id === selectedId) ?? null : null;
  const compareSchedules = compareIds.map((id) => baseResults.find((schedule) => schedule.id === id)).filter((schedule): schedule is SailingSchedule => Boolean(schedule));
  const activeFilters = countActiveFilters(filters, favoritesOnly);
  const directCount = filtered.filter((schedule) => schedule.direct === true).length;
  const knownTransitDays = filtered.map((schedule) => schedule.transitDays).filter((days): days is number => days !== null);
  const shortest = knownTransitDays.length ? Math.min(...knownTransitDays) : null;

  // 后台仍在逐船司抓取时，轮询同一接口把新入库的结果合并进来，
  // 直到后端返回 done=true 或超时（最多 3 分钟），实现“先展示已搜到的、再慢慢补全”。
  const pollUntilDone = async (url: string) => {
    const token = ++pollTokenRef.current;
    const deadline = Date.now() + 240000;
    setIsStreaming(true);
    let completed = false;
    let failures = 0;
    try {
      while (pollTokenRef.current === token && Date.now() < deadline) {
        await new Promise((resolve) => setTimeout(resolve, 4000));
        try {
          const response = await fetch(url);
          if (!response.ok) {
            if (++failures >= 3) break;
            continue;
          }
          const payload = await completeSchedulePages(await response.json() as ScheduleListResponse, url);
          failures = 0;
          if (pollTokenRef.current !== token) return;
          setBaseResults(payload.data);
          setProviderStatuses(payload.providers ?? []);
          if (payload.done) { completed = true; break; }
        } catch {
          if (++failures >= 3) break;
        }
      }
    } finally {
      if (pollTokenRef.current === token) {
        setIsStreaming(false);
        if (!completed) {
          setQueryError("部分船司的查询未能完成，请点击重新查询；已返回的结果仍可查看。");
          setProviderStatuses(current => current.map(provider => provider.status === "pending" || provider.status === "fetching"
            ? { ...provider, status: "error", warnings: [...provider.warnings, "POLL_TIMEOUT"] } : provider));
        }
      }
    }
  };

  const runSearch = async (nextCriteria = criteria, refresh = false) => {
    ++pollTokenRef.current;
    const nextErrors = validate(nextCriteria, ports);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;
    setIsLoading(true);
    setIsStreaming(false);
    setQueryError("");
    setProviderStatuses([]);
    try {
      const { dateFrom, dateTo } = dateWindow(nextCriteria);
      const params = new URLSearchParams({
        origin: nextCriteria.originCoscoCity ? dbPortValueForCosco(ports, nextCriteria.originCoscoCity) : apiPortValue(ports, nextCriteria.originPortId),
        destination: nextCriteria.destinationCoscoCity ? dbPortValueForCosco(ports, nextCriteria.destinationCoscoCity) : apiPortValue(ports, nextCriteria.destinationPortId),
        dateFrom,
        dateTo,
        pageSize: "100",
        sort,
        retry: "true",
      });
      if (nextCriteria.originCoscoCity) {
        params.set("originCityUuid", nextCriteria.originCoscoCity.uuid);
        params.set("originCity", nextCriteria.originCoscoCity.fullName);
      }
      if (nextCriteria.destinationCoscoCity) {
        params.set("destinationCityUuid", nextCriteria.destinationCoscoCity.uuid);
        params.set("destinationCity", nextCriteria.destinationCoscoCity.fullName);
      }
      if (nextCriteria.directOnly) params.set("direct", "true");
      if (refresh) params.set("refresh", "true");
      const response = await fetch(`/api/schedules/search?${params.toString()}`);
      if (!response.ok) throw new Error("船期接口请求失败");
      const payload = await completeSchedulePages(await response.json() as ScheduleListResponse, `/api/schedules/search?${params.toString()}`);
      setBaseResults(payload.data);
      setProviderStatuses(payload.providers ?? []);
      setHasSearched(true);
      setVisibleCount(6);
      setSelectedId(null);
      setFiltersOpen(false);
      setLastUpdated(new Date().toLocaleString("zh-CN", { hour12: false }));
      if (payload.done === false) {
        params.delete("retry");
        params.delete("refresh");
        void pollUntilDone(`/api/schedules/search?${params.toString()}`);
      } else {
        setIsStreaming(false);
      }
      const originStored = nextCriteria.originCoscoCity ? dbPortValueForCosco(ports, nextCriteria.originCoscoCity) : apiPortValue(ports, nextCriteria.originPortId);
      const destinationStored = nextCriteria.destinationCoscoCity ? dbPortValueForCosco(ports, nextCriteria.destinationCoscoCity) : apiPortValue(ports, nextCriteria.destinationPortId);
      const originName = nextCriteria.originCoscoCity?.name || findPort(ports, nextCriteria.originPortId)?.name;
      const destinationName = nextCriteria.destinationCoscoCity?.name || findPort(ports, nextCriteria.destinationPortId)?.name;
      const nextRecent = saveRecentScheduleSearch({ id: `rs-${Date.now()}`, originPortId: originStored, destinationPortId: destinationStored, originName, destinationName, departureDate: nextCriteria.departureDate, directOnly: nextCriteria.directOnly, searchedAt: new Date().toISOString() }, []);
      setRecentSearches(nextRecent);
    } catch {
      setQueryError("船期查询暂时不可用，请稍后重试");
      setBaseResults([]);
      setHasSearched(true);
    } finally {
      setIsLoading(false);
    }
  };

  const toggleFavorite = (id: string) => setFavoriteIds(toggleFavoriteSchedule(id));
  const toggleCompare = (schedule: SailingSchedule) => {
    setCompareMessage("");
    if (compareIds.includes(schedule.id)) {
      setCompareIds((ids) => ids.filter((id) => id !== schedule.id));
      return;
    }
    if (compareIds.length >= 3) {
      setCompareMessage("最多只能对比 3 条船期");
      return;
    }
    setCompareIds((ids) => [...ids, schedule.id]);
  };
  const clearFilters = () => {
    setFilters(initialFilters);
    setFavoritesOnly(false);
    setVisibleCount(6);
  };
  const backToQuery = () => {
    setHasSearched(false);
    setQueryError("");
    setSelectedId(null);
    setFiltersOpen(false);
  };

  return (
    <PageContainer className="max-w-[1800px] py-6 pb-24">
      <PageHeader
        eyebrow="Schedules"
        title="船期查询"
        description="按承运人返回的船期字段展示截载、船名航次、航线信息、可提货时间与两端服务"
        actions={<div className="flex items-center gap-3 text-sm text-slate-500">{lastUpdated ? <span>最后更新 {lastUpdated}</span> : null}<button type="button" aria-label="重新查询船期" disabled={!hasSearched || isLoading || isStreaming} onClick={() => void runSearch(criteria, true)} className="flex h-9 w-9 items-center justify-center rounded-md border border-slate-300 text-slate-600 hover:border-ocean-500 hover:text-ocean-700 disabled:opacity-40"><RefreshCw className="h-4 w-4" /></button></div>}
      />

      {!hasSearched ? (
        <>
          <ScheduleSearchForm criteria={criteria} ports={ports} errors={errors} isLoading={isLoading} onChange={setCriteria} onSubmit={() => void runSearch()} />
          <RecentScheduleSearches searches={recentSearches} ports={ports} onSelect={(search) => { const next = { ...createInitialCriteria(), originPortId: search.originPortId, destinationPortId: search.destinationPortId }; setCriteria(next); setFilters(initialFilters); void runSearch(next); }} />
          <section className="mt-6 grid gap-4 md:grid-cols-3">
            <Info title="表格式船期结果" text="默认以承运人官网类似表格展示，便于放下更多字段。" />
            <Info title="真实字段优先" text="仅展示接口返回或数据库保存的字段，不补造准班率等推断信息。" />
            <Info title="收藏与对比" text="收藏船期并最多对比 3 条服务，不包含任何价格信息。" />
          </section>
        </>
      ) : (
        <div className="space-y-5">
          <ScheduleSearchForm compact criteria={criteria} ports={ports} errors={errors} isLoading={isLoading} onChange={setCriteria} onSubmit={() => void runSearch()} />
          {queryError ? <div className="rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{queryError}</div> : null}

          <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-card">
            <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
              <div>
                <h2 className="text-lg font-semibold text-ink">{criteria.originCoscoCity?.fullName || portLabel(ports, criteria.originPortId)} → {criteria.destinationCoscoCity?.fullName || portLabel(ports, criteria.destinationPortId)}</h2>
                <p className="mt-1 text-sm text-slate-500">日期范围：前 {criteria.beforeDays || 0} 天 / 后 {criteria.afterDays || criteria.dateRange} 天 · 共 {filtered.length} 条船期{directCount ? ` · ${directCount} 条已确认直达` : ""}{shortest !== null ? ` · 已公布最短航程 ${shortest} 天` : ""}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={backToQuery} className="inline-flex h-10 items-center gap-2 rounded-md border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-700 hover:border-ocean-500 hover:text-ocean-700"><ArrowLeft className="h-4 w-4" />返回查询</button>
                <button type="button" onClick={() => setFiltersOpen(true)} className="inline-flex h-10 items-center gap-2 rounded-md bg-[#2f68a8] px-3 text-sm font-semibold text-white hover:bg-[#285b92]"><SlidersHorizontal className="h-4 w-4" />筛选{activeFilters ? ` · ${activeFilters}` : ""}</button>
                <span className="inline-flex h-10 items-center rounded-full bg-slate-100 px-3 text-xs font-semibold text-slate-600">最后更新 {lastUpdated}</span>
              </div>
            </div>
          </div>

          <main className="min-w-0 space-y-4">
            {providerStatuses.length ? (
              <div className="rounded-lg border border-slate-200 bg-white px-4 py-3 shadow-card">
                <div className="flex flex-wrap gap-2 text-xs">
                  {providerStatuses.map((provider) => (
                    <span key={provider.code} className={`rounded-full px-3 py-1.5 font-semibold ${provider.status === "success" || provider.status === "cached" ? "bg-emerald-50 text-emerald-700" : provider.status === "fetching" || provider.status === "pending" ? "bg-ocean-50 text-ocean-700" : "bg-amber-50 text-amber-800"}`} title={provider.warnings.join("\n")}>
                      {carrierLabels[provider.code] || provider.code}：{providerStatusText(provider)}
                    </span>
                  ))}
                </div>
                {providerStatuses.flatMap(provider => provider.alternateLoading?.length ? <details key={provider.code} className="mt-3">
                  <summary>OOCL 异港装船方案（离港日期为实际装船港时间）</summary>
                  <div className="overflow-x-auto"><table className="mt-2 w-full text-left text-sm">
                    <thead><tr>{["查询起运地","实际装船港","离港日期","首程船名 / 航次","最终目的地","预计到达"].map(label => <th key={label}>{label}</th>)}</tr></thead>
                    <tbody>{provider.alternateLoading.map(row => <tr key={row.id}><td>{row.origin}</td><td>{row.loadingPort}</td>
                      <td>{row.departure.slice(0,10)}</td><td>{row.vessel} {row.voyage}</td><td>{row.destination}</td><td>{row.arrival.slice(0,10)}</td></tr>)}</tbody>
                  </table></div></details> : [])}
                {providerStatuses.flatMap(provider => provider.inlandRail?.length ? <details key={provider.code} className="mt-3">
                  <summary>COSCO 含铁路段方案（目的地到达时间未公布）</summary>
                  <div className="overflow-x-auto"><table className="mt-2 w-full text-left text-sm">
                    <thead><tr>{["船名 / 航次","起运地 / 离港","卸船港 / 到港","内陆场站","运输方式","查询目的地","目的地 ETA"].map(h => <th key={h}>{h}</th>)}</tr></thead>
                    <tbody>{provider.inlandRail.map(row => <tr key={row.id}>
                      <td>{row.vessel} {row.voyage}</td><td>{row.origin} {row.departure.slice(0,10)}</td>
                      <td>{row.dischargePort} {row.dischargeEta?.slice(0,10)}</td><td>{row.facility}</td>
                      <td>{row.modes}</td><td>{row.requestedDestination}</td><td>{row.destinationEta}</td>
                    </tr>)}</tbody>
                  </table></div></details> : [])}
                {providerStatuses.some(provider => provider.code === "OOCL" && provider.warnings.some(w => w.startsWith("OOCL_PDF_SOURCE"))) && <p className="mt-2 text-xs text-slate-500">OOCL 来源为官网分航线船期表，仅展示可核对的同船挂靠方案。</p>}
                {providerStatuses.flatMap(provider => provider.warnings.filter(warning => warning.startsWith("MSC_DATE_ADJUSTED:")).map(warning => <p key={`${provider.code}-${warning}`} className="mt-2 text-xs text-amber-800">{warning.replace("MSC_DATE_ADJUSTED: ", "MSC：")}</p>))}
                {providerStatuses.filter(provider => provider.status === "success" && provider.warnings.some(warning => /TIMEOUT|DETAIL_FAILED|PARSE_INCOMPLETE|OOCL_PDF_HTTP_|OOCL_PDF_READER_FAILED|OOCL_PDF_RESPONSE_INVALID/.test(warning))).map(provider => <p key={`partial-${provider.code}`} className="mt-2 text-xs text-amber-800">{carrierLabels[provider.code] || provider.code}：已显示获取到的结果，部分方案未能完成获取，可稍后重新查询。</p>)}
                {providerStatuses.some((provider) => provider.warnings.some((warning) => /CMA_ACCESS_BLOCKED/.test(warning))) ? <p className="mt-2 text-xs text-amber-800">CMA 官网限制当前连接访问，暂未返回船期；该限制页面没有可操作的验证码。</p> : null}
                {providerStatuses.some((provider) => provider.warnings.some((warning) => /CAPTCHA_REQUIRED|VERIFICATION_REQUIRED/.test(warning))) ? <p className="mt-2 text-xs text-slate-500">部分船司需要官网验证，请在项目专用浏览器中完成验证。</p> : null}
              </div>
            ) : null}
            {isStreaming ? (
              <div className="rounded-lg border border-ocean-200 bg-ocean-50 px-4 py-2 text-sm text-ocean-700">正在逐船司抓取并补全结果，已加载 {filtered.length} 条，继续加载中…</div>
            ) : null}
            <Suspense fallback={<div className="h-10 rounded bg-slate-100" />}>
              <ScheduleControls view={view} sort={sort} onViewChange={setView} onSortChange={setSort} />
            </Suspense>
            <Suspense fallback={<div className="space-y-4"><div className="h-32 animate-pulse rounded-lg border border-slate-200 bg-white" /><div className="h-32 animate-pulse rounded-lg border border-slate-200 bg-white" /></div>}>
              <ScheduleResultList schedules={filtered} visibleCount={visibleCount} view={view} selectedId={selectedId} favoriteIds={favoriteIds} comparingIds={compareIds} isLoading={isLoading} departureDate={criteria.departureDate} onLoadMore={() => setVisibleCount((count) => count + 6)} onSelect={(schedule) => setSelectedId(schedule.id)} onToggleFavorite={toggleFavorite} onToggleCompare={toggleCompare} onClearFilters={clearFilters} />
            </Suspense>
          </main>
        </div>
      )}

      {filtersOpen ? (
        <div className="fixed inset-0 z-[2300] bg-ink/40" onClick={() => setFiltersOpen(false)}>
          <aside className="h-full w-full max-w-sm overflow-y-auto bg-slate-50 p-4 shadow-2xl" onClick={(event) => event.stopPropagation()}>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-ink">筛选船期</h2>
              <button type="button" onClick={() => setFiltersOpen(false)} className="flex h-9 w-9 items-center justify-center rounded-md text-slate-500 hover:bg-slate-200"><X className="h-4 w-4" /></button>
            </div>
            <Suspense fallback={<div className="h-96 animate-pulse rounded-lg bg-white" />}>
              <ScheduleFilters carriers={carriers} filters={filters} activeCount={activeFilters} resultCount={filtered.length} favoritesOnly={favoritesOnly} onFavoritesOnlyChange={setFavoritesOnly} onChange={(next) => { setFilters(next); setVisibleCount(6); }} onClear={clearFilters} />
            </Suspense>
          </aside>
        </div>
      ) : null}

      {selected ? (
        <div className="fixed inset-0 z-[2350] bg-ink/40" onClick={() => setSelectedId(null)}>
          <aside className="ml-auto h-full w-full max-w-md overflow-y-auto bg-slate-50 p-4 shadow-2xl" onClick={(event) => event.stopPropagation()}>
            <Suspense fallback={<div className="h-96 animate-pulse rounded-lg bg-white" />}>
              <ScheduleDetailsPanel schedule={selected} favorite={favoriteIds.includes(selected.id)} comparing={compareIds.includes(selected.id)} onClose={() => setSelectedId(null)} onToggleFavorite={toggleFavorite} onToggleCompare={toggleCompare} />
            </Suspense>
          </aside>
        </div>
      ) : null}

      <ScheduleCompareBar schedules={compareSchedules} message={compareMessage} onClear={() => { setCompareIds([]); setCompareMessage(""); }} onOpen={() => setCompareOpen(true)} onRemove={(id) => setCompareIds((ids) => ids.filter((item) => item !== id))} />
      <ScheduleCompareDrawer open={compareOpen} schedules={compareSchedules} onClose={() => setCompareOpen(false)} />
    </PageContainer>
  );
}

function Info({ title, text }: { title: string; text: string }) {
  return <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-card"><h3 className="font-semibold text-ink">{title}</h3><p className="mt-2 text-sm text-slate-600">{text}</p></div>;
}
