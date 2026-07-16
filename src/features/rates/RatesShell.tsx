"use client";

import { useEffect, useMemo, useState } from "react";
import { PageContainer } from "@/components/layout/PageContainer";
import { PageHeader } from "@/components/layout/PageHeader";
import { RateFilters } from "@/features/rates/components/RateFilters";
import { RateResultList } from "@/features/rates/components/RateResultList";
import { RateSearchForm } from "@/features/rates/components/RateSearchForm";
import { RateSummaryPanel } from "@/features/rates/components/RateSummaryPanel";
import { RecentSearches } from "@/features/rates/components/RecentSearches";
import { QuoteDrawer } from "@/features/rates/components/QuoteDrawer";
import { initialRecentSearches, rateLocations as fallbackRateLocations } from "@/features/rates/data/mock-rate-data";
import type { BookingOrder } from "@/features/orders/types";
import { calculateQuote } from "@/features/rates/lib/calculateQuote";
import type { AdditionalServicesState, ContainerSelection, ContainerType, LocationOption, RateFiltersState, RateOption, RateSearchCriteria, RecentSearch, SortOption, ValidationErrors } from "@/features/rates/types";

const emptyContainers: ContainerSelection = { "20GP": 0, "40GP": 0, "40HC": 1, "45HC": 0 };
const initialCriteria: RateSearchCriteria = { originId: "", destinationId: "", cargoReadyDate: "", transportMode: "整箱海运", containers: emptyContainers, cargoType: "general" };
const initialFilters: RateFiltersState = { stops: "all", carriers: [], maxPrice: 9000, maxTransitDays: 35, minFreeDays: 0, minReliability: 70, departureFrom: "" };
const initialServices: AdditionalServicesState = { exportCustoms: false, importCustoms: false, pickup: false, delivery: false, insurance: "none", freeDays: "standard" };

type PortsSearchResponse = { data: Array<{ id: string; name?: string | null; nameZh?: string | null; locode?: string | null; code?: string | null; country?: string | null; countryCode?: string | null; region?: string | null; aliases?: string[] }> };
type RateSearchResponse = { data: RateOption[] } | { error: { message: string } };

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function selectedContainerCount(containers: ContainerSelection) {
  return Object.values(containers).reduce((sum, count) => sum + count, 0);
}

const validationText = {
  origin: "\u8bf7\u9009\u62e9\u6709\u6548\u8d77\u8fd0\u5730",
  destination: "\u8bf7\u9009\u62e9\u6709\u6548\u76ee\u7684\u5730",
  sameLocation: "\u8d77\u8fd0\u5730\u548c\u76ee\u7684\u5730\u4e0d\u80fd\u76f8\u540c",
  readyDate: "\u8bf7\u9009\u62e9\u8d27\u597d\u65e5\u671f",
  pastDate: "\u8d27\u597d\u65e5\u671f\u4e0d\u80fd\u65e9\u4e8e\u4eca\u5929",
  containers: "\u81f3\u5c11\u9009\u62e9\u4e00\u4e2a\u7bb1\u578b",
  portType: "\u6e2f\u53e3",
};

function normalizeSearchValue(value: unknown) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function isKnownLocation(locations: LocationOption[], value: string) {
  const query = normalizeSearchValue(value);
  return locations.some((location) => location.id === value || normalizeSearchValue(location.name) === query || normalizeSearchValue(location.locode) === query);
}

function validate(criteria: RateSearchCriteria, locations: LocationOption[]): ValidationErrors {
  const errors: ValidationErrors = {};
  if (!isKnownLocation(locations, criteria.originId)) errors.originId = validationText.origin;
  if (!isKnownLocation(locations, criteria.destinationId)) errors.destinationId = validationText.destination;
  if (criteria.originId && criteria.destinationId && criteria.originId === criteria.destinationId) errors.destinationId = validationText.sameLocation;
  if (!criteria.cargoReadyDate) errors.cargoReadyDate = validationText.readyDate;
  if (criteria.cargoReadyDate && criteria.cargoReadyDate < todayIso()) errors.cargoReadyDate = validationText.pastDate;
  if (selectedContainerCount(criteria.containers) <= 0) errors.containers = validationText.containers;
  return errors;
}

function optionMatchesFilters(option: RateOption, filters: RateFiltersState) {
  const stopMatch = filters.stops === "all" || (filters.stops === "direct" && option.stops === 0) || (filters.stops === "one" && option.stops === 1) || (filters.stops === "two" && option.stops >= 2);
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

function containersForApi(containers: ContainerSelection) {
  return (Object.entries(containers) as Array<[ContainerType, number]>).filter(([, quantity]) => quantity > 0).map(([type, quantity]) => ({ type, quantity }));
}

function mapPortLocation(port: PortsSearchResponse["data"][number]): LocationOption {
  const locode = port.locode ?? port.code ?? "";
  const name = port.name ?? port.nameZh ?? locode;
  return {
    id: port.id,
    name,
    nameZh: port.nameZh ?? null,
    country: port.country ?? null,
    countryCode: port.countryCode ?? null,
    region: port.region ?? null,
    type: validationText.portType,
    locode,
    aliases: [name, port.nameZh ?? "", locode, port.country ?? "", port.region ?? "", ...(Array.isArray(port.aliases) ? port.aliases : [])].filter((item): item is string => typeof item === "string" && item.length > 0),
  };
}

export function RatesShell() {
  const [criteria, setCriteria] = useState<RateSearchCriteria>(initialCriteria);
  const [locations, setLocations] = useState<LocationOption[]>(fallbackRateLocations);
  const [errors, setErrors] = useState<ValidationErrors>({});
  const [hasSearched, setHasSearched] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [sort, setSort] = useState<SortOption>("recommended");
  const [filters, setFilters] = useState<RateFiltersState>(initialFilters);
  const [rateOptions, setRateOptions] = useState<RateOption[]>([]);
  const [rateError, setRateError] = useState("");
  const [recentSearches, setRecentSearches] = useState<RecentSearch[]>(initialRecentSearches);
  const [services, setServices] = useState<AdditionalServicesState>(initialServices);
  const [isQuoteOpen, setIsQuoteOpen] = useState(false);
  const [savedNotice, setSavedNotice] = useState("");

  useEffect(() => {
    let active = true;
    fetch("/api/ports/search?q=&pageSize=100")
      .then((response) => response.json() as Promise<PortsSearchResponse>)
      .then((payload) => {
        if (!active || !Array.isArray(payload.data)) return;
        const mapped = payload.data.map(mapPortLocation);
        setLocations([...mapped, ...fallbackRateLocations.filter((fallback) => !mapped.some((item) => item.locode === fallback.locode))]);
      })
      .catch(() => undefined);
    return () => { active = false; };
  }, []);

  const carriers = useMemo(() => Array.from(new Set(rateOptions.map((option) => option.carrier))), [rateOptions]);
  const filteredOptions = useMemo(() => sortOptions(rateOptions.filter((option) => optionMatchesFilters(option, filters)), sort), [filters, rateOptions, sort]);
  const selectedOption = filteredOptions.find((option) => option.id === selectedId) ?? rateOptions.find((option) => option.id === selectedId) ?? null;
  const calculation = selectedOption ? calculateQuote({ option: selectedOption, containers: criteria.containers, isDangerous: criteria.cargoType === "dangerous", services }) : null;

  const runSearch = async () => {
    const nextErrors = validate(criteria, locations);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;
    setIsLoading(true);
    setRateError("");
    setSelectedId(null);
    try {
      const response = await fetch("/api/rates/search", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ origin: criteria.originId, destination: criteria.destinationId, readyDate: criteria.cargoReadyDate, transportMode: criteria.transportMode, cargoType: criteria.cargoType, containers: containersForApi(criteria.containers), filters, sort }) });
      const payload = await response.json() as RateSearchResponse;
      if (!response.ok || "error" in payload) {
        setRateError("error" in payload ? payload.error.message : "运价查询失败，请稍后重试");
        setRateOptions([]);
      } else {
        setRateOptions(payload.data);
        setHasSearched(true);
        setRecentSearches((items) => [{ id: `r-${Date.now()}`, originId: criteria.originId, destinationId: criteria.destinationId, containerSummary: Object.entries(criteria.containers).filter(([, count]) => count > 0).map(([type, count]) => `${count} x ${type}`).join(" · "), date: criteria.cargoReadyDate, dangerous: criteria.cargoType === "dangerous" }, ...items].slice(0, 5));
      }
    } catch {
      setRateError("数据库运价接口暂不可用，请稍后重试");
      setRateOptions([]);
    } finally {
      setIsLoading(false);
    }
  };

  const fillRecent = (search: RecentSearch) => {
    setCriteria({ ...criteria, originId: search.originId, destinationId: search.destinationId, cargoReadyDate: search.date, cargoType: search.dangerous ? "dangerous" : "general" });
  };

  return (
    <PageContainer className="py-6">
      <PageHeader eyebrow="Rates" title="运费探索器" description="快速查询海运方案、运输时效与费用明细" />
      {savedNotice ? <div className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">{savedNotice}</div> : null}
      {rateError ? <div className="mb-4 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">{rateError}</div> : null}

      {!hasSearched ? (
        <>
          <RateSearchForm criteria={criteria} locations={locations} errors={errors} isLoading={isLoading} onChange={setCriteria} onSubmit={runSearch} />
          <RecentSearches searches={recentSearches} locations={locations} onSelect={fillRecent} onClear={() => setRecentSearches([])} />
          <section className="mt-6 grid gap-4 md:grid-cols-3"><div className="rounded-lg border border-slate-200 bg-white p-5 shadow-card"><h3 className="font-semibold text-ink">多承运商报价</h3><p className="mt-2 text-sm text-slate-600">比较多个模拟承运商服务、时效和价格。</p></div><div className="rounded-lg border border-slate-200 bg-white p-5 shadow-card"><h3 className="font-semibold text-ink">费用明细透明</h3><p className="mt-2 text-sm text-slate-600">基础运费、起运地、目的地和附加费用分组展示。</p></div><div className="rounded-lg border border-slate-200 bg-white p-5 shadow-card"><h3 className="font-semibold text-ink">模拟预订流程</h3><p className="mt-2 text-sm text-slate-600">选择方案、附加服务、确认费用并提交模拟预订。</p></div></section>
        </>
      ) : (
        <div className="grid min-h-[680px] gap-5 xl:grid-cols-[320px_minmax(0,1fr)_360px]">
          <div className="space-y-4"><RateSearchForm compact criteria={criteria} locations={locations} errors={errors} isLoading={isLoading} onChange={setCriteria} onSubmit={runSearch} /><RateFilters carriers={carriers} filters={filters} resultCount={filteredOptions.length} onChange={setFilters} onClear={() => setFilters(initialFilters)} /></div>
          <RateResultList options={filteredOptions} selectedId={selectedId} criteria={criteria} isLoading={isLoading} sort={sort} onSortChange={setSort} onSelect={(option) => { if (!option.expired) setSelectedId(option.id); }} />
          <RateSummaryPanel option={selectedOption} containers={criteria.containers} calculation={calculation} onOpenQuote={() => setIsQuoteOpen(true)} />
        </div>
      )}

      <QuoteDrawer isOpen={isQuoteOpen} option={selectedOption} containers={criteria.containers} isDangerous={criteria.cargoType === "dangerous"} readyDate={criteria.cargoReadyDate} services={services} onServicesChange={setServices} onClose={() => setIsQuoteOpen(false)} onBackToResults={() => setHasSearched(true)} onOrderSaved={(order: BookingOrder) => setSavedNotice(`订单 ${order.bookingNumber} 已保存，可在“我的订单”中查看。`)} />
    </PageContainer>
  );
}