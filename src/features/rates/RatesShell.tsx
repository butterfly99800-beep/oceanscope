"use client";

import { useMemo, useState } from "react";
import { PageContainer } from "@/components/layout/PageContainer";
import { PageHeader } from "@/components/layout/PageHeader";
import { RateFilters } from "@/features/rates/components/RateFilters";
import { RateResultList } from "@/features/rates/components/RateResultList";
import { RateSearchForm } from "@/features/rates/components/RateSearchForm";
import { RateSummaryPanel } from "@/features/rates/components/RateSummaryPanel";
import { RecentSearches } from "@/features/rates/components/RecentSearches";
import { QuoteDrawer } from "@/features/rates/components/QuoteDrawer";
import { initialRecentSearches, mockRateOptions, rateLocations } from "@/features/rates/data/mock-rate-data";
import type { BookingOrder } from "@/features/orders/types";
import { calculateQuote } from "@/features/rates/lib/calculateQuote";
import type { AdditionalServicesState, ContainerSelection, RateFiltersState, RateOption, RateSearchCriteria, RecentSearch, SortOption, ValidationErrors } from "@/features/rates/types";

const emptyContainers: ContainerSelection = { "20GP": 0, "40GP": 0, "40HC": 1, "45HC": 0 };
const initialCriteria: RateSearchCriteria = { originId: "", destinationId: "", cargoReadyDate: "", transportMode: "整箱海运", containers: emptyContainers, cargoType: "general" };
const initialFilters: RateFiltersState = { stops: "all", carriers: [], maxPrice: 9000, maxTransitDays: 35, minFreeDays: 0, minReliability: 70, departureFrom: "" };
const initialServices: AdditionalServicesState = { exportCustoms: false, importCustoms: false, pickup: false, delivery: false, insurance: "none", freeDays: "standard" };

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function selectedContainerCount(containers: ContainerSelection) {
  return Object.values(containers).reduce((sum, count) => sum + count, 0);
}

function validate(criteria: RateSearchCriteria): ValidationErrors {
  const errors: ValidationErrors = {};
  if (!rateLocations.some((location) => location.id === criteria.originId)) errors.originId = "请选择有效起运地";
  if (!rateLocations.some((location) => location.id === criteria.destinationId)) errors.destinationId = "请选择有效目的地";
  if (criteria.originId && criteria.destinationId && criteria.originId === criteria.destinationId) errors.destinationId = "起运地和目的地不能相同";
  if (!criteria.cargoReadyDate) errors.cargoReadyDate = "请选择货好日期";
  if (criteria.cargoReadyDate && criteria.cargoReadyDate < todayIso()) errors.cargoReadyDate = "货好日期不能早于今天";
  if (selectedContainerCount(criteria.containers) <= 0) errors.containers = "至少选择一个箱型";
  return errors;
}

function optionMatchesFilters(option: RateOption, filters: RateFiltersState) {
  const stopMatch = filters.stops === "all" || (filters.stops === "direct" && option.stops === 0) || (filters.stops === "one" && option.stops === 1) || (filters.stops === "two" && option.stops === 2);
  const carrierMatch = filters.carriers.length === 0 || filters.carriers.includes(option.carrier);
  const priceMatch = option.totalPrice / 100 <= filters.maxPrice;
  const timeMatch = option.transitDays <= filters.maxTransitDays;
  const freeMatch = option.freeDays >= filters.minFreeDays;
  const reliabilityMatch = option.reliability >= filters.minReliability;
  const departureMatch = !filters.departureFrom || option.etd >= filters.departureFrom;
  return stopMatch && carrierMatch && priceMatch && timeMatch && freeMatch && reliabilityMatch && departureMatch;
}

function sortOptions(options: RateOption[], sort: SortOption) {
  return [...options].sort((a, b) => {
    if (sort === "price") return a.totalPrice - b.totalPrice;
    if (sort === "fastest") return a.transitDays - b.transitDays;
    if (sort === "earliestDeparture") return a.etd.localeCompare(b.etd);
    if (sort === "earliestArrival") return a.eta.localeCompare(b.eta);
    return Number(b.tags.includes("推荐")) - Number(a.tags.includes("推荐")) || a.totalPrice - b.totalPrice;
  });
}

export function RatesShell() {
  const [criteria, setCriteria] = useState<RateSearchCriteria>(initialCriteria);
  const [errors, setErrors] = useState<ValidationErrors>({});
  const [hasSearched, setHasSearched] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [sort, setSort] = useState<SortOption>("recommended");
  const [filters, setFilters] = useState<RateFiltersState>(initialFilters);
  const [recentSearches, setRecentSearches] = useState<RecentSearch[]>(initialRecentSearches);
  const [services, setServices] = useState<AdditionalServicesState>(initialServices);
  const [isQuoteOpen, setIsQuoteOpen] = useState(false);
  const [savedNotice, setSavedNotice] = useState("");

  const carriers = useMemo(() => Array.from(new Set(mockRateOptions.map((option) => option.carrier))), []);
  const filteredOptions = useMemo(() => sortOptions(mockRateOptions.filter((option) => optionMatchesFilters(option, filters)), sort), [filters, sort]);
  const selectedOption = filteredOptions.find((option) => option.id === selectedId) ?? mockRateOptions.find((option) => option.id === selectedId) ?? null;
  const calculation = selectedOption ? calculateQuote({ option: selectedOption, containers: criteria.containers, isDangerous: criteria.cargoType === "dangerous", services }) : null;

  const runSearch = () => {
    const nextErrors = validate(criteria);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;
    setIsLoading(true);
    window.setTimeout(() => {
      setIsLoading(false);
      setHasSearched(true);
      setSelectedId(null);
      setRecentSearches((items) => [{ id: `r-${Date.now()}`, originId: criteria.originId, destinationId: criteria.destinationId, containerSummary: Object.entries(criteria.containers).filter(([, count]) => count > 0).map(([type, count]) => `${count} x ${type}`).join(" · "), date: criteria.cargoReadyDate, dangerous: criteria.cargoType === "dangerous" }, ...items].slice(0, 5));
    }, 900);
  };

  const fillRecent = (search: RecentSearch) => {
    setCriteria({ ...criteria, originId: search.originId, destinationId: search.destinationId, cargoReadyDate: search.date, cargoType: search.dangerous ? "dangerous" : "general" });
  };

  return (
    <PageContainer className="py-6">
      <PageHeader eyebrow="Rates" title="运费探索器" description="快速查询海运方案、运输时效与费用明细" />
      {savedNotice ? <div className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">{savedNotice}</div> : null}

      {!hasSearched ? (
        <>
          <RateSearchForm criteria={criteria} locations={rateLocations} errors={errors} isLoading={isLoading} onChange={setCriteria} onSubmit={runSearch} />
          <RecentSearches searches={recentSearches} locations={rateLocations} onSelect={fillRecent} onClear={() => setRecentSearches([])} />
          <section className="mt-6 grid gap-4 md:grid-cols-3"><div className="rounded-lg border border-slate-200 bg-white p-5 shadow-card"><h3 className="font-semibold text-ink">多承运商报价</h3><p className="mt-2 text-sm text-slate-600">比较多个模拟承运商服务、时效和价格。</p></div><div className="rounded-lg border border-slate-200 bg-white p-5 shadow-card"><h3 className="font-semibold text-ink">费用明细透明</h3><p className="mt-2 text-sm text-slate-600">基础运费、起运地、目的地和附加费用分组展示。</p></div><div className="rounded-lg border border-slate-200 bg-white p-5 shadow-card"><h3 className="font-semibold text-ink">模拟预订流程</h3><p className="mt-2 text-sm text-slate-600">选择方案、附加服务、确认费用并提交模拟预订。</p></div></section>
        </>
      ) : (
        <div className="grid min-h-[680px] gap-5 xl:grid-cols-[320px_minmax(0,1fr)_360px]">
          <div className="space-y-4"><RateSearchForm compact criteria={criteria} locations={rateLocations} errors={errors} isLoading={isLoading} onChange={setCriteria} onSubmit={runSearch} /><RateFilters carriers={carriers} filters={filters} resultCount={filteredOptions.length} onChange={setFilters} onClear={() => setFilters(initialFilters)} /></div>
          <RateResultList options={filteredOptions} selectedId={selectedId} criteria={criteria} isLoading={isLoading} sort={sort} onSortChange={setSort} onSelect={(option) => setSelectedId(option.id)} />
          <RateSummaryPanel option={selectedOption} containers={criteria.containers} calculation={calculation} onOpenQuote={() => setIsQuoteOpen(true)} />
        </div>
      )}

      <QuoteDrawer isOpen={isQuoteOpen} option={selectedOption} containers={criteria.containers} isDangerous={criteria.cargoType === "dangerous"} readyDate={criteria.cargoReadyDate} services={services} onServicesChange={setServices} onClose={() => setIsQuoteOpen(false)} onBackToResults={() => setHasSearched(true)} onOrderSaved={(order: BookingOrder) => setSavedNotice(`订单 ${order.bookingNumber} 已保存，可在“我的订单”中查看。`)} />
    </PageContainer>
  );
}


