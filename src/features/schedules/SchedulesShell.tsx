"use client";

import { ArrowLeft, RefreshCw, SlidersHorizontal, X } from "lucide-react";
import dynamic from "next/dynamic";
import { Suspense, useEffect, useMemo, useState } from "react";
import { PageContainer } from "@/components/layout/PageContainer";
import { PageHeader } from "@/components/layout/PageHeader";
import { PopularRoutes } from "@/features/schedules/components/PopularRoutes";
import { RecentScheduleSearches } from "@/features/schedules/components/RecentScheduleSearches";
import { ScheduleSearchForm } from "@/features/schedules/components/ScheduleSearchForm";
import { initialScheduleSearches, mockSchedules, popularScheduleRoutes, schedulePorts as fallbackPorts } from "@/features/schedules/data/mock-schedule-data";
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
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function createInitialCriteria(): ScheduleSearchCriteria {
  return { originPortId: "", destinationPortId: "", departureDate: todayInputValue(), dateRange: "7", beforeDays: "0", afterDays: "28", directOnly: false };
}

const initialFilters: ScheduleFilterState = { carriers: [], direct: "all", stopCount: "all", statuses: [], departureFrom: "", transitDays: "all", serviceName: "", vesselName: "", terminal: "" };

type PortListResponse = { data: PortOption[] };
type ScheduleListResponse = { data: SailingSchedule[]; pagination: { total: number } };

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
  return port?.id ?? port?.code ?? id;
}

function dbPortValueForCosco(ports: PortOption[], coscoCity: NonNullable<ScheduleSearchCriteria["originCoscoCity"]>, fallbackId: string) {
  const fullName = coscoCity.fullName.toLowerCase();
  const matched = ports.find((port) =>
    (coscoCity.locode && port.code.toLowerCase() === coscoCity.locode.toLowerCase()) ||
    fullName.includes(port.name.toLowerCase()) ||
    (port.localName && fullName.includes(port.localName.toLowerCase()))
  );
  return matched?.id ?? apiPortValue(ports, fallbackId);
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
  const base = new Date(`${criteria.departureDate}T00:00:00`);
  const beforeDays = Number(criteria.beforeDays || 0);
  const afterDays = Number(criteria.afterDays || criteria.dateRange || 0);
  const from = new Date(base);
  const to = new Date(base);
  from.setDate(base.getDate() - beforeDays);
  to.setDate(base.getDate() + afterDays);
  return { dateFrom: from.toISOString(), dateTo: to.toISOString() };
}

function SkeletonCard() {
  return <div className="animate-pulse rounded-lg border border-slate-200 bg-white p-5 shadow-card"><div className="h-5 w-32 rounded bg-slate-200" /><div className="mt-4 grid grid-cols-3 gap-2"><div className="h-10 rounded bg-slate-100" /><div className="h-10 rounded bg-slate-100" /><div className="h-10 rounded bg-slate-100" /></div><div className="mt-4 h-10 rounded bg-slate-100" /></div>;
}

export function SchedulesShell() {
  const [ports, setPorts] = useState<PortOption[]>(fallbackPorts);
  const [criteria, setCriteria] = useState<ScheduleSearchCriteria>(() => createInitialCriteria());
  const [errors, setErrors] = useState<Partial<Record<keyof ScheduleSearchCriteria, string>>>({});
  const [hasSearched, setHasSearched] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [queryError, setQueryError] = useState("");
  const [lastUpdated, setLastUpdated] = useState("");
  const [baseResults, setBaseResults] = useState<SailingSchedule[]>(mockSchedules);
  const [filters, setFilters] = useState<ScheduleFilterState>(initialFilters);
  const [sort, setSort] = useState<ScheduleSortOption>("recommended");
  const [view, setView] = useState<ScheduleViewMode>("table");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [visibleCount, setVisibleCount] = useState(6);
  const [recentSearches, setRecentSearches] = useState<RecentScheduleSearch[]>(initialScheduleSearches);
  const [favoriteIds, setFavoriteIds] = useState<string[]>([]);
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [compareIds, setCompareIds] = useState<string[]>([]);
  const [compareOpen, setCompareOpen] = useState(false);
  const [compareMessage, setCompareMessage] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);

  useEffect(() => {
    setRecentSearches(getRecentScheduleSearches(initialScheduleSearches));
    setFavoriteIds(getFavoriteScheduleIds());
    fetch("/api/ports/search?pageSize=100")
      .then((response) => response.ok ? response.json() as Promise<PortListResponse> : Promise.reject())
      .then((payload) => { if (payload.data.length) setPorts(payload.data); })
      .catch(() => undefined);
  }, []);

  const carriers = useMemo(() => Array.from(new Set(baseResults.map((schedule) => schedule.carrier))), [baseResults]);
  const filtered = useMemo(() => sortSchedules(filterSchedules(baseResults, filters, favoriteIds, favoritesOnly), sort), [baseResults, favoriteIds, favoritesOnly, filters, sort]);
  const selected = selectedId ? baseResults.find((schedule) => schedule.id === selectedId) ?? null : null;
  const compareSchedules = compareIds.map((id) => baseResults.find((schedule) => schedule.id === id)).filter((schedule): schedule is SailingSchedule => Boolean(schedule));
  const activeFilters = countActiveFilters(filters, favoritesOnly);
  const directCount = filtered.filter((schedule) => schedule.direct).length;
  const shortest = filtered.length ? Math.min(...filtered.map((schedule) => schedule.transitDays)) : 0;

  const runSearch = async (nextCriteria = criteria) => {
    const nextErrors = validate(nextCriteria, ports);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;
    setIsLoading(true);
    setQueryError("");
    try {
      const { dateFrom, dateTo } = dateWindow(nextCriteria);
      const params = new URLSearchParams({
        origin: nextCriteria.originCoscoCity ? dbPortValueForCosco(ports, nextCriteria.originCoscoCity, nextCriteria.originPortId) : apiPortValue(ports, nextCriteria.originPortId),
        destination: nextCriteria.destinationCoscoCity ? dbPortValueForCosco(ports, nextCriteria.destinationCoscoCity, nextCriteria.destinationPortId) : apiPortValue(ports, nextCriteria.destinationPortId),
        dateFrom,
        dateTo,
        pageSize: "100",
        sort,
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
      const response = await fetch(`/api/schedules/search?${params.toString()}`);
      if (!response.ok) throw new Error("船期接口请求失败");
      const payload = await response.json() as ScheduleListResponse;
      setBaseResults(payload.data);
      setHasSearched(true);
      setVisibleCount(6);
      setSelectedId(null);
      setFiltersOpen(false);
      setLastUpdated(new Date().toLocaleString("zh-CN", { hour12: false }));
      const nextRecent = saveRecentScheduleSearch({ id: `rs-${Date.now()}`, originPortId: nextCriteria.originPortId, destinationPortId: nextCriteria.destinationPortId, departureDate: nextCriteria.departureDate, directOnly: nextCriteria.directOnly, searchedAt: new Date().toISOString() }, initialScheduleSearches);
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
        actions={<div className="flex items-center gap-3 text-sm text-slate-500">{lastUpdated ? <span>最后更新 {lastUpdated}</span> : null}<button type="button" onClick={() => setLastUpdated(new Date().toLocaleString("zh-CN", { hour12: false }))} className="flex h-9 w-9 items-center justify-center rounded-md border border-slate-300 text-slate-600 hover:border-ocean-500 hover:text-ocean-700"><RefreshCw className="h-4 w-4" /></button></div>}
      />

      {!hasSearched ? (
        <>
          <ScheduleSearchForm criteria={criteria} ports={ports} errors={errors} isLoading={isLoading} onChange={setCriteria} onSubmit={() => void runSearch()} />
          <RecentScheduleSearches searches={recentSearches} ports={ports} onSelect={(search) => { const next = { ...criteria, originPortId: search.originPortId, destinationPortId: search.destinationPortId, departureDate: search.departureDate, directOnly: search.directOnly }; setCriteria(next); void runSearch(next); }} />
          <Suspense fallback={<div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3"><SkeletonCard /><SkeletonCard /><SkeletonCard /></div>}>
            <PopularRoutes routes={popularScheduleRoutes} ports={ports} onSelect={(originPortId, destinationPortId) => { const next = { ...criteria, originPortId, destinationPortId }; setCriteria(next); void runSearch(next); }} />
          </Suspense>
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
                <p className="mt-1 text-sm text-slate-500">日期范围：前 {criteria.beforeDays || 0} 天 / 后 {criteria.afterDays || criteria.dateRange} 天 · 共 {filtered.length} 条船期 · {directCount} 条直达 · 最短 {shortest} 天</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={backToQuery} className="inline-flex h-10 items-center gap-2 rounded-md border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-700 hover:border-ocean-500 hover:text-ocean-700"><ArrowLeft className="h-4 w-4" />返回查询</button>
                <button type="button" onClick={() => setFiltersOpen(true)} className="inline-flex h-10 items-center gap-2 rounded-md bg-[#2f68a8] px-3 text-sm font-semibold text-white hover:bg-[#285b92]"><SlidersHorizontal className="h-4 w-4" />筛选{activeFilters ? ` · ${activeFilters}` : ""}</button>
                <span className="inline-flex h-10 items-center rounded-full bg-slate-100 px-3 text-xs font-semibold text-slate-600">最后更新 {lastUpdated}</span>
              </div>
            </div>
          </div>

          <main className="min-w-0 space-y-4">
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
