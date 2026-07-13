"use client";

import { X } from "lucide-react";
import { CompactFilters } from "@/features/atlas/components/CompactFilters";
import { RouteResultList } from "@/features/atlas/components/RouteResultList";
import { RouteSearchForm } from "@/features/atlas/components/RouteSearchForm";
import { VesselListItem } from "@/features/atlas/components/VesselListItem";
import type { AtlasFilters, Port, RouteOption, RouteSearchState, Vessel } from "@/features/atlas/types";

type AtlasSidebarProps = {
  vessels: Vessel[];
  ports: Port[];
  routeOptions: RouteOption[];
  selectedVesselId: string | null;
  selectedRouteOptionId: string | null;
  routeSearch: RouteSearchState;
  filters: AtlasFilters;
  isFiltersOpen: boolean;
  isOpenOnMobile: boolean;
  onFiltersToggle: () => void;
  onFiltersChange: (filters: AtlasFilters) => void;
  onFiltersClear: () => void;
  onRouteSearchChange: (state: RouteSearchState) => void;
  onRouteSearchSubmit: () => void;
  onSelectVessel: (vessel: Vessel) => void;
  onSelectRouteOption: (option: RouteOption) => void;
  onCloseMobile: () => void;
};

function resolvePortInputLabel(ports: Port[], value: string) {
  const port = ports.find((item) => item.id === value);
  if (!port) {
    return value;
  }
  return `${port.name}, ${port.country === "United States" ? "CA" : port.country}`;
}

export function AtlasSidebar({
  vessels,
  ports,
  routeOptions,
  selectedVesselId,
  selectedRouteOptionId,
  routeSearch,
  filters,
  isFiltersOpen,
  isOpenOnMobile,
  onFiltersToggle,
  onFiltersChange,
  onFiltersClear,
  onRouteSearchChange,
  onRouteSearchSubmit,
  onSelectVessel,
  onSelectRouteOption,
  onCloseMobile,
}: AtlasSidebarProps) {
  const hasRouteSearch = Boolean(routeSearch.originPortId && routeSearch.destinationPortId);

  return (
    <aside className={`z-30 flex min-h-0 w-[min(360px,calc(100vw-32px))] shrink-0 flex-col rounded-lg border border-slate-200 bg-white shadow-card lg:relative lg:flex lg:translate-x-0 ${isOpenOnMobile ? "fixed inset-y-20 left-4 translate-x-0" : "hidden"}`}>
      <div className="flex items-center justify-between border-b border-slate-200 px-3 py-2 lg:hidden">
        <span className="text-sm font-semibold text-ink">Atlas 查询</span>
        <button type="button" onClick={onCloseMobile} className="inline-flex h-8 w-8 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100 hover:text-ink" aria-label="关闭左侧面板">
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>

      <RouteSearchForm
        ports={ports}
        routeSearch={routeSearch}
        originLabel={resolvePortInputLabel(ports, routeSearch.originPortId)}
        destinationLabel={resolvePortInputLabel(ports, routeSearch.destinationPortId)}
        onRouteSearchChange={onRouteSearchChange}
        onSubmit={onRouteSearchSubmit}
      />

      <CompactFilters filters={filters} isOpen={isFiltersOpen} onToggle={onFiltersToggle} onChange={onFiltersChange} onClear={onFiltersClear} />

      {hasRouteSearch ? (
        <RouteResultList options={routeOptions} ports={ports} selectedRouteOptionId={selectedRouteOptionId} onSelect={onSelectRouteOption} />
      ) : (
        <div className="flex min-h-0 flex-1 flex-col">
          <div className="border-b border-slate-200 px-3 py-3">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">搜索结果</p>
            <h2 className="mt-1 text-sm font-semibold text-ink">{vessels.length} 艘模拟船舶</h2>
          </div>
          <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-3">
            {vessels.length > 0 ? (
              vessels.map((vessel) => <VesselListItem key={vessel.id} vessel={vessel} isSelected={selectedVesselId === vessel.id} onSelect={onSelectVessel} />)
            ) : (
              <div className="rounded-lg border border-dashed border-slate-300 p-5 text-center text-sm text-slate-500">没有匹配的模拟船舶</div>
            )}
          </div>
        </div>
      )}
    </aside>
  );
}
