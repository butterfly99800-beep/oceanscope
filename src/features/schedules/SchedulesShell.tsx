"use client";

import { RefreshCw } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { PageContainer } from "@/components/layout/PageContainer";
import { PageHeader } from "@/components/layout/PageHeader";
import { PopularRoutes } from "@/features/schedules/components/PopularRoutes";
import { RecentScheduleSearches } from "@/features/schedules/components/RecentScheduleSearches";
import { ScheduleCompareBar, ScheduleCompareDrawer } from "@/features/schedules/components/ScheduleCompare";
import { ScheduleControls } from "@/features/schedules/components/ScheduleControls";
import { ScheduleDetailsPanel } from "@/features/schedules/components/ScheduleDetailsPanel";
import { ScheduleFilters } from "@/features/schedules/components/ScheduleFilters";
import { ScheduleResultList } from "@/features/schedules/components/ScheduleResultList";
import { ScheduleSearchForm } from "@/features/schedules/components/ScheduleSearchForm";
import { initialScheduleSearches, mockSchedules, popularScheduleRoutes, schedulePorts as fallbackPorts } from "@/features/schedules/data/mock-schedule-data";
import { countActiveFilters, filterSchedules } from "@/features/schedules/lib/filterSchedules";
import { getFavoriteScheduleIds, getRecentScheduleSearches, saveRecentScheduleSearch, toggleFavoriteSchedule } from "@/features/schedules/lib/scheduleStorage";
import { sortSchedules } from "@/features/schedules/lib/sortSchedules";
import type { PortOption, RecentScheduleSearch, SailingSchedule, ScheduleFilterState, ScheduleSearchCriteria, ScheduleSortOption, ScheduleViewMode } from "@/features/schedules/types";

const initialCriteria: ScheduleSearchCriteria = { originPortId: "", destinationPortId: "", departureDate: "2026-07-17", dateRange: "7", directOnly: false };
const initialFilters: ScheduleFilterState = { carriers: [], direct: "all", stopCount: "all", statuses: [], departureFrom: "", transitDays: "all", reliability: "all", serviceName: "", vesselName: "", terminal: "" };

type PortListResponse = { data: PortOption[] };
type ScheduleListResponse = { data: SailingSchedule[]; pagination: { total: number } };

function slug(value: string) { return value.toLowerCase().replace(/\s+/g, "-"); }
function findPort(ports: PortOption[], id: string) { return ports.find((item) => item.id === id || item.code.toLowerCase() === id.toLowerCase() || slug(item.name) === id || item.aliases.some((alias) => alias.toLowerCase() === id.toLowerCase())); }
function portLabel(ports: PortOption[], id: string) { const port = findPort(ports, id); return port ? `${port.localName} ${port.code}` : id; }
function apiPortValue(ports: PortOption[], id: string) { const port = findPort(ports, id); return port?.id ?? port?.code ?? id; }

function validate(criteria: ScheduleSearchCriteria, ports: PortOption[]) {
  const errors: Partial<Record<keyof ScheduleSearchCriteria, string>> = {};
  if (!findPort(ports, criteria.originPortId)) errors.originPortId = "请选择有效起运港";
  if (!findPort(ports, criteria.destinationPortId)) errors.destinationPortId = "请选择有效目的港";
  if (criteria.originPortId && apiPortValue(ports, criteria.originPortId) === apiPortValue(ports, criteria.destinationPortId)) errors.destinationPortId = "起运港和目的港不能相同";
  if (!criteria.departureDate) errors.departureDate = "请选择预计出发日期";
  return errors;
}

function dateWindow(criteria: ScheduleSearchCriteria) {
  const base = new Date(`${criteria.departureDate}T00:00:00`);
  const range = criteria.dateRange === "custom" ? 7 : Number(criteria.dateRange);
  const from = new Date(base);
  const to = new Date(base);
  from.setDate(base.getDate() - range);
  to.setDate(base.getDate() + range);
  return { dateFrom: from.toISOString(), dateTo: to.toISOString() };
}

export function SchedulesShell() {
  const [ports, setPorts] = useState<PortOption[]>(fallbackPorts);
  const [criteria, setCriteria] = useState<ScheduleSearchCriteria>(initialCriteria);
  const [errors, setErrors] = useState<Partial<Record<keyof ScheduleSearchCriteria, string>>>({});
  const [hasSearched, setHasSearched] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [queryError, setQueryError] = useState("");
  const [lastUpdated, setLastUpdated] = useState("2026-07-13 10:30");
  const [baseResults, setBaseResults] = useState<SailingSchedule[]>(mockSchedules);
  const [filters, setFilters] = useState<ScheduleFilterState>(initialFilters);
  const [sort, setSort] = useState<ScheduleSortOption>("recommended");
  const [view, setView] = useState<ScheduleViewMode>("cards");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [visibleCount, setVisibleCount] = useState(6);
  const [recentSearches, setRecentSearches] = useState<RecentScheduleSearch[]>(initialScheduleSearches);
  const [favoriteIds, setFavoriteIds] = useState<string[]>([]);
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [compareIds, setCompareIds] = useState<string[]>([]);
  const [compareOpen, setCompareOpen] = useState(false);
  const [compareMessage, setCompareMessage] = useState("");

  useEffect(() => {
    setRecentSearches(getRecentScheduleSearches(initialScheduleSearches));
    setFavoriteIds(getFavoriteScheduleIds());
    fetch("/api/ports/search?pageSize=100")
      .then((response) => response.ok ? response.json() as Promise<PortListResponse> : Promise.reject())
      .then((payload) => { if (payload.data.length) setPorts(payload.data); })
      .catch(() => setPorts(fallbackPorts));
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
      const params = new URLSearchParams({ origin: apiPortValue(ports, nextCriteria.originPortId), destination: apiPortValue(ports, nextCriteria.destinationPortId), dateFrom, dateTo, pageSize: "100", sort });
      if (nextCriteria.directOnly) params.set("direct", "true");
      const response = await fetch(`/api/schedules/search?${params.toString()}`);
      if (!response.ok) throw new Error("船期接口请求失败");
      const payload = await response.json() as ScheduleListResponse;
      setBaseResults(payload.data);
      setHasSearched(true);
      setVisibleCount(6);
      setSelectedId(null);
      setLastUpdated(new Date().toLocaleString("zh-CN", { hour12: false }));
      const nextRecent = saveRecentScheduleSearch({ id: `rs-${Date.now()}`, originPortId: nextCriteria.originPortId, destinationPortId: nextCriteria.destinationPortId, departureDate: nextCriteria.departureDate, directOnly: nextCriteria.directOnly, searchedAt: new Date().toISOString() }, initialScheduleSearches);
      setRecentSearches(nextRecent);
    } catch {
      setQueryError("船期数据库接口暂不可用，请检查 MySQL 连接或稍后重试。旧模拟数据已保留为开发回退。");
      setBaseResults([]);
      setHasSearched(true);
    } finally {
      setIsLoading(false);
    }
  };

  const toggleFavorite = (id: string) => setFavoriteIds(toggleFavoriteSchedule(id));
  const toggleCompare = (schedule: SailingSchedule) => { setCompareMessage(""); if (compareIds.includes(schedule.id)) { setCompareIds((ids) => ids.filter((id) => id !== schedule.id)); return; } if (compareIds.length >= 3) { setCompareMessage("最多只能对比 3 条船期"); return; } setCompareIds((ids) => [...ids, schedule.id]); };
  const clearFilters = () => { setFilters(initialFilters); setFavoritesOnly(false); setVisibleCount(6); };

  return <PageContainer className="py-6 pb-24"><PageHeader eyebrow="Schedules" title="船期查询" description="查询全球港口之间的船期、航程、船名航次与关键操作节点" actions={<div className="flex items-center gap-3 text-sm text-slate-500"><span className="rounded-full bg-ocean-50 px-3 py-1 font-semibold text-ocean-700 ring-1 ring-ocean-200">数据库船期 · 模拟数据</span><span>最后更新 {lastUpdated}</span><button type="button" onClick={() => setLastUpdated(new Date().toLocaleString("zh-CN", { hour12: false }))} className="flex h-9 w-9 items-center justify-center rounded-md border border-slate-300 text-slate-600 hover:border-ocean-500 hover:text-ocean-700"><RefreshCw className="h-4 w-4" /></button></div>} />{!hasSearched ? <><ScheduleSearchForm criteria={criteria} ports={ports} errors={errors} isLoading={isLoading} onChange={setCriteria} onSubmit={() => void runSearch()} /><RecentScheduleSearches searches={recentSearches} ports={ports} onSelect={(search) => { const next = { ...criteria, originPortId: search.originPortId, destinationPortId: search.destinationPortId, departureDate: search.departureDate, directOnly: search.directOnly }; setCriteria(next); void runSearch(next); }} /><PopularRoutes routes={popularScheduleRoutes} ports={ports} onSelect={(originPortId, destinationPortId) => { const next = { ...criteria, originPortId, destinationPortId }; setCriteria(next); void runSearch(next); }} /><section className="mt-6 grid gap-4 md:grid-cols-3"><Info title="模块式船期表" text="卡片集中展示船名航次、ETD/ETA、截关与开港节点。" /><Info title="多视图切换" text="支持模块、表格和两周日历视图，适合不同查询习惯。" /><Info title="收藏与对比" text="收藏船期并最多对比 3 条模拟服务，不包含任何价格信息。" /></section></> : <div className="space-y-5"><ScheduleSearchForm compact criteria={criteria} ports={ports} errors={errors} isLoading={isLoading} onChange={setCriteria} onSubmit={() => void runSearch()} />{queryError ? <div className="rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{queryError}</div> : null}<div className="rounded-lg border border-slate-200 bg-white p-4 shadow-card"><div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between"><div><h2 className="text-lg font-semibold text-ink">{portLabel(ports, criteria.originPortId)} → {portLabel(ports, criteria.destinationPortId)}</h2><p className="mt-1 text-sm text-slate-500">日期范围：前后 {criteria.dateRange === "custom" ? "自定义" : `${criteria.dateRange} 天`} · 共 {filtered.length} 条船期 · {directCount} 条直达 · 最短 {shortest} 天</p></div><span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">船期数据 · 数据库模拟数据</span></div></div><div className="grid gap-5 xl:grid-cols-[300px_minmax(0,1fr)_360px]"><ScheduleFilters carriers={carriers} filters={filters} activeCount={activeFilters} resultCount={filtered.length} favoritesOnly={favoritesOnly} onFavoritesOnlyChange={setFavoritesOnly} onChange={(next) => { setFilters(next); setVisibleCount(6); }} onClear={clearFilters} /><main className="min-w-0 space-y-4"><ScheduleControls view={view} sort={sort} onViewChange={setView} onSortChange={setSort} /><ScheduleResultList schedules={filtered} visibleCount={visibleCount} view={view} selectedId={selectedId} favoriteIds={favoriteIds} comparingIds={compareIds} isLoading={isLoading} departureDate={criteria.departureDate} onLoadMore={() => setVisibleCount((count) => count + 6)} onSelect={(schedule) => setSelectedId(schedule.id)} onToggleFavorite={toggleFavorite} onToggleCompare={toggleCompare} onClearFilters={clearFilters} /></main><ScheduleDetailsPanel schedule={selected} favorite={selected ? favoriteIds.includes(selected.id) : false} comparing={selected ? compareIds.includes(selected.id) : false} onClose={() => setSelectedId(null)} onToggleFavorite={toggleFavorite} onToggleCompare={toggleCompare} /></div></div>}<ScheduleCompareBar schedules={compareSchedules} message={compareMessage} onClear={() => { setCompareIds([]); setCompareMessage(""); }} onOpen={() => setCompareOpen(true)} onRemove={(id) => setCompareIds((ids) => ids.filter((item) => item !== id))} /><ScheduleCompareDrawer open={compareOpen} schedules={compareSchedules} onClose={() => setCompareOpen(false)} /></PageContainer>;
}

function Info({ title, text }: { title: string; text: string }) { return <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-card"><h3 className="font-semibold text-ink">{title}</h3><p className="mt-2 text-sm text-slate-600">{text}</p></div>; }
