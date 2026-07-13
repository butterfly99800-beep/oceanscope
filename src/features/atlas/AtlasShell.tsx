"use client";

import { useEffect, useMemo, useState } from "react";
import { AtlasDetailsPanel } from "@/features/atlas/components/AtlasDetailsPanel";
import { AtlasMap } from "@/features/atlas/components/AtlasMap";
import { AtlasSidebar } from "@/features/atlas/components/AtlasSidebar";
import { AtlasToolbar } from "@/features/atlas/components/AtlasToolbar";
import { useAtlasSearch } from "@/features/atlas/hooks/useAtlasSearch";
import { atlasLastUpdated, atlasPorts, atlasRegions, atlasRoutes, atlasVessels, routeOptions } from "@/features/atlas/data/mock-atlas-data";
import type { AtlasFilters, LayerVisibility, RouteOption, RouteSearchState, SearchSuggestion, SelectedMapEntity, Vessel } from "@/features/atlas/types";

const initialFilters: AtlasFilters = { vesselType: "全部", status: "全部", region: "全球", updatedWithin: "全部" };
const initialLayers: LayerVisibility = { vessels: true, ports: true, routes: true };
const initialRouteSearch: RouteSearchState = { originPortId: "yantian", destinationPortId: "los-angeles", directOnly: false, maxTransfers: 2, departureDate: "" };

function getUpdatedMinutes(value: string) {
  if (value.includes("分钟")) return Number.parseInt(value, 10);
  if (value.includes("小时")) return Number.parseInt(value, 10) * 60;
  return 0;
}

function matchesUpdatedFilter(lastUpdated: string, filter: AtlasFilters["updatedWithin"]) {
  if (filter === "全部") return true;
  const minutes = getUpdatedMinutes(lastUpdated);
  if (filter === "15 分钟内") return minutes <= 15;
  if (filter === "1 小时内") return minutes <= 60;
  return minutes <= 24 * 60;
}

function formatRefreshTime() {
  return new Intl.DateTimeFormat("zh-CN", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date());
}

function routeSearchMatches(option: RouteOption, state: RouteSearchState) {
  const originMatch = state.originPortId.length === 0 || option.originPortId === state.originPortId;
  const destinationMatch = state.destinationPortId.length === 0 || option.destinationPortId === state.destinationPortId;
  const directMatch = !state.directOnly || option.direct;
  const transferMatch = option.transferCount <= state.maxTransfers;
  return originMatch && destinationMatch && directMatch && transferMatch;
}

function normalizeParam(value: string | null) {
  return value?.trim().toLowerCase() ?? "";
}

function findPortByParam(value: string | null) {
  const normalized = normalizeParam(value);
  if (!normalized) return null;
  return atlasPorts.find((port) => [port.id, port.name, port.nameZh ?? "", port.locode, ...port.aliases].some((item) => item.toLowerCase() === normalized)) ?? null;
}

function findRouteByPorts(originId: string | null, destinationId: string | null) {
  if (!originId || !destinationId) return null;
  return atlasRoutes.find((route) => route.originPortId === originId && route.destinationPortId === destinationId) ?? null;
}

function findRouteOptionForRoute(routeId: string | null, originId: string | null, destinationId: string | null) {
  const normalizedRouteId = normalizeParam(routeId);
  return routeOptions.find((option) => option.id.toLowerCase() === normalizedRouteId || option.routeId.toLowerCase() === normalizedRouteId)
    ?? routeOptions.find((option) => option.originPortId === originId && option.destinationPortId === destinationId)
    ?? null;
}
export function AtlasShell() {
  const [query, setQuery] = useState("");
  const [filters, setFilters] = useState<AtlasFilters>(initialFilters);
  const [layers, setLayers] = useState<LayerVisibility>(initialLayers);
  const [selectedEntity, setSelectedEntity] = useState<SelectedMapEntity>({ type: "route", id: routeOptions[0].id });
  const [selectedRouteOptionId, setSelectedRouteOptionId] = useState<string | null>(routeOptions[0].id);
  const [isDetailsOpen, setIsDetailsOpen] = useState(true);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isLayerMenuOpen, setIsLayerMenuOpen] = useState(false);
  const [isSuggestOpen, setIsSuggestOpen] = useState(false);
  const [activeSuggestionIndex, setActiveSuggestionIndex] = useState(0);
  const [isFiltersOpen, setIsFiltersOpen] = useState(false);
  const [routeSearch, setRouteSearch] = useState<RouteSearchState>(initialRouteSearch);
  const [zoom, setZoom] = useState(1);
  const [dataTimestamp, setDataTimestamp] = useState(atlasLastUpdated);

  const suggestions = useAtlasSearch({ query, vessels: atlasVessels, ports: atlasPorts, routes: atlasRoutes, regions: atlasRegions });

  const filteredVessels = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return atlasVessels.filter((vessel) => {
      const queryMatch = normalizedQuery.length === 0 || [vessel.name, vessel.mmsi, vessel.imo, vessel.nextPort, vessel.previousPort, vessel.area, vessel.voyage.destination].some((value) => value.toLowerCase().includes(normalizedQuery));
      const typeMatch = filters.vesselType === "全部" || vessel.type === filters.vesselType;
      const statusMatch = filters.status === "全部" || vessel.status === filters.status;
      const regionMatch = filters.region === "全球" || vessel.region === filters.region;
      const updatedMatch = matchesUpdatedFilter(vessel.lastUpdated, filters.updatedWithin);
      return queryMatch && typeMatch && statusMatch && regionMatch && updatedMatch;
    });
  }, [filters, query]);

  const visibleRouteOptions = useMemo(() => routeOptions.filter((option) => routeSearchMatches(option, routeSearch)), [routeSearch]);

  const selectedRouteOption = selectedRouteOptionId ? routeOptions.find((option) => option.id === selectedRouteOptionId) ?? null : null;
  const selectedVesselId = selectedEntity?.type === "vessel" ? selectedEntity.id : null;
  const selectedPortId = selectedEntity?.type === "port" ? selectedEntity.id : null;
  const selectedRouteId = selectedRouteOption?.routeId ?? (selectedEntity?.type === "route" ? atlasRoutes.find((route) => route.id === selectedEntity.id)?.id ?? null : selectedEntity?.type === "vessel" ? atlasVessels.find((vessel) => vessel.id === selectedEntity.id)?.routeId ?? null : null);
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const vesselIdParam = params.get("vesselId");
    const vesselNameParam = params.get("vesselName");
    const routeIdParam = params.get("routeId");
    const originParam = params.get("origin");
    const destinationParam = params.get("destination");
    if (!vesselIdParam && !vesselNameParam && !routeIdParam && !originParam && !destinationParam) return;

    const vessel = atlasVessels.find((item) => item.id.toLowerCase() === normalizeParam(vesselIdParam) || item.name.toLowerCase() === normalizeParam(vesselNameParam));
    if (vessel) {
      setSelectedEntity({ type: "vessel", id: vessel.id });
      setSelectedRouteOptionId(null);
      setQuery(vessel.name);
      setIsDetailsOpen(true);
      setLayers((current) => ({ ...current, vessels: true, routes: true }));
      return;
    }

    const originPort = findPortByParam(originParam);
    const destinationPort = findPortByParam(destinationParam);
    const routeOption = findRouteOptionForRoute(routeIdParam, originPort?.id ?? null, destinationPort?.id ?? null);
    const route = routeOption ? atlasRoutes.find((item) => item.id === routeOption.routeId) ?? null : atlasRoutes.find((item) => item.id.toLowerCase() === normalizeParam(routeIdParam)) ?? findRouteByPorts(originPort?.id ?? null, destinationPort?.id ?? null);

    if (routeOption) {
      setSelectedRouteOptionId(routeOption.id);
      setSelectedEntity({ type: "route", id: routeOption.id });
      setRouteSearch((current) => ({ ...current, originPortId: routeOption.originPortId, destinationPortId: routeOption.destinationPortId }));
      setQuery(`${atlasPorts.find((port) => port.id === routeOption.originPortId)?.name ?? "Origin"} → ${atlasPorts.find((port) => port.id === routeOption.destinationPortId)?.name ?? "Destination"}`);
      setIsDetailsOpen(true);
      setLayers((current) => ({ ...current, routes: true, ports: true }));
      return;
    }

    if (route) {
      setSelectedRouteOptionId(null);
      setSelectedEntity({ type: "route", id: route.id });
      setRouteSearch((current) => ({ ...current, originPortId: route.originPortId, destinationPortId: route.destinationPortId }));
      setQuery(route.name);
      setIsDetailsOpen(false);
      setLayers((current) => ({ ...current, routes: true, ports: true }));
      return;
    }

    const targetPort = destinationPort ?? originPort;
    if (targetPort) {
      setSelectedEntity({ type: "port", id: targetPort.id });
      setSelectedRouteOptionId(null);
      setQuery(targetPort.name);
      setIsDetailsOpen(true);
      setLayers((current) => ({ ...current, ports: true }));
    }
  }, []);

  const handleSelectVessel = (vessel: Vessel) => {
    setSelectedEntity({ type: "vessel", id: vessel.id });
    setSelectedRouteOptionId(null);
    setQuery(vessel.name);
    setIsDetailsOpen(true);
    setIsSuggestOpen(false);
    setIsSidebarOpen(false);
  };

  const handleSelectRouteOption = (option: RouteOption) => {
    setSelectedRouteOptionId(option.id);
    setSelectedEntity({ type: "route", id: option.id });
    setQuery(`${atlasPorts.find((port) => port.id === option.originPortId)?.name ?? "Origin"} → ${atlasPorts.find((port) => port.id === option.destinationPortId)?.name ?? "Destination"}`);
    setIsDetailsOpen(true);
  };

  const handleSuggestionSelect = (suggestion: SearchSuggestion) => {
    if (suggestion.type === "vessel" && suggestion.vesselId) {
      const vessel = atlasVessels.find((item) => item.id === suggestion.vesselId);
      if (vessel) handleSelectVessel(vessel);
    }

    if (suggestion.type === "port" && suggestion.portId) {
      setSelectedEntity({ type: "port", id: suggestion.portId });
      setSelectedRouteOptionId(null);
      setQuery(suggestion.title);
      setIsDetailsOpen(true);
      setIsSuggestOpen(false);
    }

    if (suggestion.type === "route" && suggestion.routeId) {
      const option = routeOptions.find((item) => item.routeId === suggestion.routeId) ?? routeOptions[0];
      handleSelectRouteOption(option);
      setIsSuggestOpen(false);
    }

    if (suggestion.type === "region" && suggestion.regionId) {
      const region = atlasRegions.find((item) => item.id === suggestion.regionId);
      const targetRegion = region?.region;
      if (targetRegion) setFilters((current) => ({ ...current, region: targetRegion }));
      setSelectedEntity(null);
      setQuery(suggestion.title);
      setIsDetailsOpen(false);
      setIsSuggestOpen(false);
    }
  };

  const handleSearchSubmit = () => {
    if (suggestions[activeSuggestionIndex]) {
      handleSuggestionSelect(suggestions[activeSuggestionIndex]);
      return;
    }

    const exactPort = atlasPorts.find((port) => [port.name, port.nameZh, port.locode, ...port.aliases].filter(Boolean).some((value) => value?.toLowerCase() === query.toLowerCase()));
    if (exactPort) {
      handleSuggestionSelect({ id: `port-${exactPort.id}`, type: "port", title: exactPort.name, subtitle: exactPort.country, meta: exactPort.locode, keywords: [], portId: exactPort.id });
    }
  };

  return (
    <div className="flex h-[calc(100vh-4rem)] flex-col overflow-hidden bg-ocean-50">
      <AtlasToolbar
        query={query}
        onQueryChange={(value) => { setQuery(value); setIsSuggestOpen(value.trim().length > 0); setActiveSuggestionIndex(0); }}
        suggestions={suggestions}
        isSuggestOpen={isSuggestOpen}
        activeSuggestionIndex={activeSuggestionIndex}
        onActiveSuggestionIndexChange={setActiveSuggestionIndex}
        onSuggestionSelect={handleSuggestionSelect}
        onSuggestionsClose={() => setIsSuggestOpen(false)}
        onSearchSubmit={handleSearchSubmit}
        layers={layers}
        onLayerToggle={(layer) => setLayers((current) => ({ ...current, [layer]: !current[layer] }))}
        isLayerMenuOpen={isLayerMenuOpen}
        onLayerMenuToggle={() => setIsLayerMenuOpen((value) => !value)}
        onLayerMenuClose={() => setIsLayerMenuOpen(false)}
        onRefresh={() => setDataTimestamp(formatRefreshTime())}
        onToggleSidebar={() => setIsSidebarOpen((value) => !value)}
        dataTimestamp={dataTimestamp}
      />

      <div className="mx-auto flex min-h-0 w-full max-w-[1600px] flex-1 gap-4 px-4 py-4 sm:px-6 lg:px-8">
        {isSidebarOpen ? <button type="button" className="fixed inset-0 z-20 bg-ink/20 lg:hidden" aria-label="关闭筛选面板遮罩" onClick={() => setIsSidebarOpen(false)} /> : null}
        <AtlasSidebar
          vessels={filteredVessels}
          ports={atlasPorts}
          routeOptions={visibleRouteOptions.length > 0 ? visibleRouteOptions : routeOptions}
          selectedVesselId={selectedVesselId}
          selectedRouteOptionId={selectedRouteOptionId}
          routeSearch={routeSearch}
          filters={filters}
          isFiltersOpen={isFiltersOpen}
          isOpenOnMobile={isSidebarOpen}
          onFiltersToggle={() => setIsFiltersOpen((value) => !value)}
          onFiltersChange={setFilters}
          onFiltersClear={() => setFilters(initialFilters)}
          onRouteSearchChange={setRouteSearch}
          onRouteSearchSubmit={() => { const first = visibleRouteOptions[0] ?? routeOptions[0]; handleSelectRouteOption(first); }}
          onSelectVessel={handleSelectVessel}
          onSelectRouteOption={handleSelectRouteOption}
          onCloseMobile={() => setIsSidebarOpen(false)}
        />
        <AtlasMap
          vessels={atlasVessels}
          ports={atlasPorts}
          routes={atlasRoutes}
          routeOptions={routeOptions}
          selectedEntity={selectedEntity}
          selectedVesselId={selectedVesselId}
          selectedPortId={selectedPortId}
          selectedRouteId={selectedRouteId}
          layers={layers}
          zoom={zoom}
          dataTimestamp={dataTimestamp}
          onSelectVessel={handleSelectVessel}
          onSelectPort={(port) => { setSelectedEntity({ type: "port", id: port.id }); setSelectedRouteOptionId(null); setQuery(port.name); setIsDetailsOpen(true); }}
          onZoomIn={() => setZoom((value) => Math.min(2.4, Number((value + 0.2).toFixed(1))))}
          onZoomOut={() => setZoom((value) => Math.max(0.8, Number((value - 0.2).toFixed(1))))}
        />
        <AtlasDetailsPanel entity={selectedEntity} vessels={atlasVessels} ports={atlasPorts} routeOptions={routeOptions} isOpen={isDetailsOpen} onClose={() => setIsDetailsOpen(false)} />
      </div>
    </div>
  );
}




