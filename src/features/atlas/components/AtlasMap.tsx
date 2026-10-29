"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { GeoJSONSource, Map as MapLibreMap, MapLayerMouseEvent, Marker, Popup } from "maplibre-gl";
import { Ship } from "lucide-react";
import { MapErrorState } from "@/features/atlas/components/MapErrorState";
import { MapLegend } from "@/features/atlas/components/MapLegend";
import { MapLoadingState } from "@/features/atlas/components/MapLoadingState";
import { createPortsGeoJson, createRoutesGeoJson, getRouteBounds } from "@/features/atlas/lib/geojson";
import type { LayerVisibility, Port, Route, RouteOption, SelectedMapEntity, Vessel } from "@/features/atlas/types";

type AtlasMapProps = {
  vessels: Vessel[];
  ports: Port[];
  routes: Route[];
  routeOptions: RouteOption[];
  selectedEntity: SelectedMapEntity;
  selectedVesselId: string | null;
  selectedPortId: string | null;
  selectedRouteId: string | null;
  layers: LayerVisibility;
  zoom: number;
  dataTimestamp: string;
  onSelectVessel: (vessel: Vessel) => void;
  onSelectPort: (port: Port) => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
};

type MapLibreModule = typeof import("maplibre-gl");
type MarkerRecord = { marker: Marker; element: HTMLButtonElement };

const MAP_STYLE_URL = "https://tiles.openfreemap.org/styles/liberty";
const ROUTE_SOURCE_ID = "atlas-routes";
const PORT_SOURCE_ID = "atlas-ports";
const ROUTE_LAYER_ID = "atlas-routes-line";
const PORT_LAYER_ID = "atlas-ports-circle";
const PORT_LABEL_LAYER_ID = "atlas-ports-label";

function getSource<TSource extends GeoJSONSource>(map: MapLibreMap, id: string) {
  return map.getSource(id) as TSource | undefined;
}

function setLayerVisibility(map: MapLibreMap, layerId: string, visible: boolean) {
  if (map.getLayer(layerId)) {
    map.setLayoutProperty(layerId, "visibility", visible ? "visible" : "none");
  }
}

function createVesselElement(vessel: Vessel, isSelected: boolean) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "atlas-vessel-marker";
  button.setAttribute("aria-label", `选择船舶 ${vessel.name}`);

  const ring = document.createElement("span");
  ring.className = "atlas-vessel-ring";
  const icon = document.createElement("span");
  icon.className = "atlas-vessel-icon";
  icon.style.transform = `rotate(${vessel.headingDegrees}deg)`;
  icon.innerHTML = "▲";
  const tooltip = document.createElement("span");
  tooltip.className = "atlas-vessel-tooltip";
  tooltip.textContent = `${vessel.name} · ${vessel.status}`;
  button.append(ring, icon, tooltip);
  button.classList.toggle("is-selected", isSelected);
  return button;
}

function popupContent(port: Port) {
  const root = document.createElement("div"); root.className = "atlas-map-popup";
  const title = document.createElement("div"); title.className = "atlas-map-popup-title"; title.textContent = port.name;
  const subtitle = document.createElement("div"); subtitle.textContent = port.country + " · " + port.locode;
  const list = document.createElement("dl");
  for (const [label, value] of [["当前船舶数量", port.vesselCount], ["等待船舶数量", port.waitingVesselCount], ["平均等待时间", port.averageWaitingHours + " 小时"]]) {
    const term = document.createElement("dt"); term.textContent = String(label);
    const detail = document.createElement("dd"); detail.textContent = String(value); list.append(term, detail);
  }
  root.append(title, subtitle, list); return root;
}

function updateMarkerSelection(markers: globalThis.Map<string, MarkerRecord>, selectedVesselId: string | null) {
  markers.forEach((record, vesselId) => record.element.classList.toggle("is-selected", vesselId === selectedVesselId));
}

export function AtlasMap({ vessels, ports, routes, routeOptions, selectedEntity, selectedVesselId, selectedPortId, selectedRouteId, layers, zoom, dataTimestamp, onSelectVessel, onSelectPort, onZoomIn, onZoomOut }: AtlasMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const maplibreRef = useRef<MapLibreModule | null>(null);
  const markersRef = useRef<globalThis.Map<string, MarkerRecord>>(new globalThis.Map());
  const popupRef = useRef<Popup | null>(null);
  const onSelectVesselRef = useRef(onSelectVessel);
  const onSelectPortRef = useRef(onSelectPort);
  const refs = useRef({ ports, routes, vessels, routeOptions, layers, selectedEntity, selectedPortId, selectedVesselId, selectedRouteId });
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [mapZoom, setMapZoom] = useState(2.5);

  const selectedVessel = useMemo(() => vessels.find((vessel) => vessel.id === selectedVesselId), [selectedVesselId, vessels]);

  useEffect(() => { onSelectVesselRef.current = onSelectVessel; }, [onSelectVessel]);
  useEffect(() => { onSelectPortRef.current = onSelectPort; }, [onSelectPort]);
  useEffect(() => { refs.current = { ports, routes, vessels, routeOptions, layers, selectedEntity, selectedPortId, selectedVesselId, selectedRouteId }; }, [ports, routeOptions, routes, vessels, layers, selectedEntity, selectedPortId, selectedVesselId, selectedRouteId]);

  const clearMarkers = useCallback(() => {
    markersRef.current.forEach((record) => record.marker.remove());
    markersRef.current.clear();
  }, []);

  const openPortPopup = useCallback((port: Port) => {
    const map = mapRef.current;
    const maplibregl = maplibreRef.current;
    if (!map || !maplibregl) return;
    popupRef.current?.remove();
    popupRef.current = new maplibregl.Popup({ closeButton: true, closeOnClick: true })
      .setLngLat([port.longitude, port.latitude])
      .setDOMContent(popupContent(port))
      .addTo(map);
  }, []);

  useEffect(() => {
    let isCancelled = false;
    let resizeObserver: ResizeObserver | null = null;

    async function initializeMap() {
      if (!containerRef.current || mapRef.current) return;
      setIsLoading(true);
      setHasError(false);
      try {
        const maplibregl = await import("maplibre-gl");
        if (isCancelled || !containerRef.current || mapRef.current) return;
        maplibreRef.current = maplibregl;
        const map = new maplibregl.Map({ container: containerRef.current, style: MAP_STYLE_URL, center: [105, 22], zoom: 2.5, minZoom: 1.2, attributionControl: { compact: true } });
        mapRef.current = map;
        map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), "top-right");
        map.addControl(new maplibregl.FullscreenControl(), "top-right");
        map.addControl(new maplibregl.GeolocateControl({ positionOptions: { enableHighAccuracy: true }, trackUserLocation: false, showUserLocation: true }), "top-right");

        map.on("load", () => {
          const current = refs.current;
          map.addSource(PORT_SOURCE_ID, { type: "geojson", data: createPortsGeoJson(current.ports, current.selectedPortId ?? "") });
          map.addLayer({ id: PORT_LAYER_ID, type: "circle", source: PORT_SOURCE_ID, paint: { "circle-color": ["case", ["boolean", ["get", "selected"], false], "#3568ff", "#6d5dfc"], "circle-radius": ["interpolate", ["linear"], ["zoom"], 2, ["case", ["boolean", ["get", "selected"], false], 7, 4], 8, ["case", ["boolean", ["get", "selected"], false], 14, 11]], "circle-stroke-color": "#ffffff", "circle-stroke-width": ["case", ["boolean", ["get", "selected"], false], 3, 2], "circle-opacity": 0.95 } });
          map.addLayer({ id: PORT_LABEL_LAYER_ID, type: "symbol", source: PORT_SOURCE_ID, minzoom: 4, layout: { "text-field": ["get", "name"], "text-size": 12, "text-offset": [0, 1.3], "text-anchor": "top" }, paint: { "text-color": "#08111f", "text-halo-color": "#ffffff", "text-halo-width": 1.5 } });
          map.addSource(ROUTE_SOURCE_ID, { type: "geojson", data: createRoutesGeoJson(current.routes, current.selectedRouteId ?? "") });
          map.addLayer({ id: ROUTE_LAYER_ID, type: "line", source: ROUTE_SOURCE_ID, layout: { "line-cap": "round", "line-join": "round" }, paint: { "line-color": ["case", ["boolean", ["get", "selected"], false], "#6d5dfc", "#3568ff"], "line-opacity": ["case", ["boolean", ["get", "selected"], false], 0.9, 0.28], "line-width": ["interpolate", ["linear"], ["zoom"], 2, ["case", ["boolean", ["get", "selected"], false], 3, 1.5], 6, ["case", ["boolean", ["get", "selected"], false], 6, 3]], "line-dasharray": [2, 1.2] } });
          setLayerVisibility(map, PORT_LAYER_ID, current.layers.ports);
          setLayerVisibility(map, PORT_LABEL_LAYER_ID, current.layers.ports);
          setLayerVisibility(map, ROUTE_LAYER_ID, current.layers.routes);
          setIsLoading(false);
          map.resize();
          const selectedVesselOnLoad = current.selectedVesselId ? current.vessels.find((vessel) => vessel.id === current.selectedVesselId) : null;
          if (selectedVesselOnLoad) {
            map.flyTo({ center: [selectedVesselOnLoad.longitude, selectedVesselOnLoad.latitude], zoom: 5.8, speed: 0.9, curve: 1.2, essential: true });
            return;
          }
          if (current.selectedEntity?.type === "port") {
            const port = current.ports.find((item) => item.id === current.selectedEntity?.id);
            if (port) openPortPopup(port);
            if (port) map.flyTo({ center: [port.longitude, port.latitude], zoom: 7.6, speed: 0.9, essential: true });
            return;
          }
          if (current.selectedEntity?.type === "route") {
            const option = current.routeOptions.find((item) => item.id === current.selectedEntity?.id);
            const route = current.routes.find((item) => item.id === option?.routeId || item.id === current.selectedEntity?.id);
            if (route) map.fitBounds(getRouteBounds(route), { padding: 80, duration: 900 });
          }
        });

        map.on("zoom", () => setMapZoom(Number(map.getZoom().toFixed(1))));
        map.on("error", () => { setHasError(true); setIsLoading(false); });
        map.on("click", PORT_LAYER_ID, (event: MapLayerMouseEvent) => {
          const id = event.features?.[0]?.properties?.id as string | undefined;
          const port = refs.current.ports.find((item) => item.id === id);
          if (port) onSelectPortRef.current(port);
        });
        map.on("mouseenter", PORT_LAYER_ID, () => { map.getCanvas().style.cursor = "pointer"; });
        map.on("mouseleave", PORT_LAYER_ID, () => { map.getCanvas().style.cursor = ""; });
        resizeObserver = new ResizeObserver(() => map.resize());
        resizeObserver.observe(containerRef.current);
      } catch {
        if (!isCancelled) { setHasError(true); setIsLoading(false); }
      }
    }

    void initializeMap();
    return () => { isCancelled = true; resizeObserver?.disconnect(); popupRef.current?.remove(); clearMarkers(); mapRef.current?.remove(); mapRef.current = null; maplibreRef.current = null; };
  }, [clearMarkers, openPortPopup, reloadKey]);

  useEffect(() => {
    const map = mapRef.current;
    const maplibregl = maplibreRef.current;
    if (!map || !maplibregl || hasError) return;
    clearMarkers();
    vessels.forEach((vessel) => {
      const element = createVesselElement(vessel, vessel.id === selectedVesselId);
      element.addEventListener("click", () => onSelectVesselRef.current(vessel));
      const marker = new maplibregl.Marker({ element, anchor: "center" }).setLngLat([vessel.longitude, vessel.latitude]).addTo(map);
      markersRef.current.set(vessel.id, { marker, element });
      element.style.display = layers.vessels ? "" : "none";
    });
  }, [clearMarkers, hasError, layers.vessels, selectedVesselId, vessels]);

  useEffect(() => { markersRef.current.forEach((record) => { record.element.style.display = layers.vessels ? "" : "none"; }); }, [layers.vessels]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;
    setLayerVisibility(map, PORT_LAYER_ID, layers.ports);
    setLayerVisibility(map, PORT_LABEL_LAYER_ID, layers.ports);
    setLayerVisibility(map, ROUTE_LAYER_ID, layers.routes);
  }, [layers.ports, layers.routes]);

  useEffect(() => {
    const map = mapRef.current;
    updateMarkerSelection(markersRef.current, selectedVesselId);
    if (!map || !map.isStyleLoaded()) return;
    getSource<GeoJSONSource>(map, PORT_SOURCE_ID)?.setData(createPortsGeoJson(ports, selectedPortId ?? ""));
    getSource<GeoJSONSource>(map, ROUTE_SOURCE_ID)?.setData(createRoutesGeoJson(routes, selectedRouteId ?? ""));

    if (selectedEntity?.type === "vessel" && selectedVessel) {
      popupRef.current?.remove();
      map.flyTo({ center: [selectedVessel.longitude, selectedVessel.latitude], zoom: 5.8, speed: 0.9, curve: 1.2, essential: true });
    }

    if (selectedEntity?.type === "port") {
      const port = ports.find((item) => item.id === selectedEntity.id);
      if (port) { map.flyTo({ center: [port.longitude, port.latitude], zoom: 7.6, speed: 0.9, essential: true }); openPortPopup(port); }
    }

    if (selectedEntity?.type === "route") {
      const option = routeOptions.find((item) => item.id === selectedEntity.id);
      const route = routes.find((item) => item.id === option?.routeId || item.id === selectedEntity.id);
      if (route) map.fitBounds(getRouteBounds(route), { padding: 80, duration: 900 });
    }
    map.resize();
  }, [openPortPopup, ports, routeOptions, routes, selectedEntity, selectedPortId, selectedRouteId, selectedVessel, selectedVesselId]);

  const handleZoomIn = () => { onZoomIn(); mapRef.current?.zoomTo(Math.min(12, mapRef.current.getZoom() + 0.7)); };
  const handleZoomOut = () => { onZoomOut(); mapRef.current?.zoomTo(Math.max(1.2, mapRef.current.getZoom() - 0.7)); };

  return (
    <section className="relative min-h-[560px] min-w-0 flex-1 overflow-hidden rounded-lg border border-slate-200 bg-[#dfefff] shadow-card lg:min-h-0">
      <div ref={containerRef} className="absolute inset-0 h-full w-full" />
      {isLoading ? <MapLoadingState /> : null}
      {hasError ? <MapErrorState onReload={() => setReloadKey((value) => value + 1)} /> : null}
      <div className="absolute left-4 top-4 z-20 rounded-lg border border-white/70 bg-white/90 px-3 py-2 text-sm shadow-card backdrop-blur"><div className="flex items-center gap-2 font-semibold text-ink"><Ship className="h-4 w-4 text-ocean-700" aria-hidden="true" />{selectedVessel ? selectedVessel.area : "全球视图"}</div><p className="mt-1 text-xs text-slate-500">当前缩放级别 {mapZoom.toFixed(1)}x</p></div>
      <div className="absolute right-4 top-[148px] z-20 flex overflow-hidden rounded-lg border border-slate-200 bg-white shadow-card"><button type="button" onClick={handleZoomOut} className="h-9 px-3 text-sm font-semibold text-slate-700 transition hover:bg-ocean-50 hover:text-ocean-700 focus:outline-none focus-visible:ring-4 focus-visible:ring-ocean-100">-</button><div className="border-x border-slate-200 px-3 py-2 text-xs font-semibold text-slate-500">{zoom.toFixed(1)}x</div><button type="button" onClick={handleZoomIn} className="h-9 px-3 text-sm font-semibold text-slate-700 transition hover:bg-ocean-50 hover:text-ocean-700 focus:outline-none focus-visible:ring-4 focus-visible:ring-ocean-100">+</button></div>
      <MapLegend />
      <div className="absolute inset-x-4 bottom-4 z-20 grid gap-2 rounded-lg border border-white/70 bg-white/85 p-3 text-xs text-slate-600 shadow-card backdrop-blur sm:grid-cols-5"><div><span className="block font-semibold text-ink">{layers.vessels ? vessels.length : 0}</span>可见船舶</div><div><span className="block font-semibold text-ink">{layers.ports ? ports.length : 0}</span>可见港口</div><div><span className="block font-semibold text-ink">{layers.routes ? routes.length : 0}</span>航线数量</div><div><span className="block font-semibold text-ink">{dataTimestamp}</span>数据更新时间</div><div><span className="block font-semibold text-violet-700">模拟数据</span>数据状态</div></div>
    </section>
  );
}


