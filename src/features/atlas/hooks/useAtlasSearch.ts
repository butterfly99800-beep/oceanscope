import { useMemo } from "react";
import type { Port, RegionOption, Route, SearchSuggestion, Vessel } from "@/features/atlas/types";

function normalize(value: string) {
  return value.trim().toLowerCase();
}

function includesQuery(keywords: string[], query: string) {
  const normalizedQuery = normalize(query);
  return normalizedQuery.length > 0 && keywords.some((keyword) => normalize(keyword).includes(normalizedQuery));
}

export function useAtlasSearch({
  query,
  vessels,
  ports,
  routes,
  regions,
}: {
  query: string;
  vessels: Vessel[];
  ports: Port[];
  routes: Route[];
  regions: RegionOption[];
}) {
  return useMemo(() => {
    if (query.trim().length === 0) {
      return [];
    }

    const vesselSuggestions: SearchSuggestion[] = vessels
      .filter((vessel) =>
        includesQuery(
          [vessel.name, vessel.mmsi, vessel.imo, vessel.nextPort, vessel.previousPort, vessel.area, vessel.type, vessel.status],
          query,
        ),
      )
      .map((vessel) => ({
        id: `vessel-${vessel.id}`,
        type: "vessel",
        title: vessel.name,
        subtitle: `${vessel.type} · MMSI ${vessel.mmsi}`,
        meta: `${vessel.status} · ${vessel.area} · ${vessel.nextPort}`,
        keywords: [vessel.name, vessel.mmsi, vessel.imo, vessel.nextPort, vessel.area],
        latitude: vessel.latitude,
        longitude: vessel.longitude,
        vesselId: vessel.id,
        routeId: vessel.routeId,
      }));

    const portSuggestions: SearchSuggestion[] = ports
      .filter((port) => includesQuery([port.name, port.nameZh ?? "", port.country, port.locode, port.region, ...port.aliases], query))
      .map((port) => ({
        id: `port-${port.id}`,
        type: "port",
        title: port.name,
        subtitle: `${port.nameZh ?? port.region} · ${port.country}`,
        meta: `${port.locode} · ${port.vesselCount} vessels`,
        keywords: [port.name, port.nameZh ?? "", port.country, port.locode, ...port.aliases],
        latitude: port.latitude,
        longitude: port.longitude,
        portId: port.id,
      }));

    const routeSuggestions: SearchSuggestion[] = routes
      .filter((route) => {
        const origin = ports.find((port) => port.id === route.originPortId);
        const destination = ports.find((port) => port.id === route.destinationPortId);
        const transit = route.transitPortIds.map((id) => ports.find((port) => port.id === id)?.name ?? "");
        return includesQuery([route.name, origin?.name ?? "", destination?.name ?? "", origin?.locode ?? "", destination?.locode ?? "", ...transit], query);
      })
      .map((route) => {
        const origin = ports.find((port) => port.id === route.originPortId);
        const destination = ports.find((port) => port.id === route.destinationPortId);
        return {
          id: `route-${route.id}`,
          type: "route" as const,
          title: route.name,
          subtitle: route.direct ? "直达航线" : `${route.transitPortIds.length} 次中转`,
          meta: `模拟运输 ${route.transitDays} 天`,
          keywords: [route.name, origin?.name ?? "", destination?.name ?? ""],
          routeId: route.id,
          originPortId: route.originPortId,
          destinationPortId: route.destinationPortId,
        };
      });

    const regionSuggestions: SearchSuggestion[] = regions
      .filter((region) => includesQuery([region.label, region.labelZh, ...region.keywords], query))
      .map((region) => ({
        id: `region-${region.id}`,
        type: "region",
        title: region.label,
        subtitle: region.labelZh,
        meta: "区域视图",
        keywords: [region.label, region.labelZh, ...region.keywords],
        latitude: region.center[1],
        longitude: region.center[0],
        regionId: region.id,
      }));

    return [...vesselSuggestions, ...portSuggestions, ...routeSuggestions, ...regionSuggestions].slice(0, 8);
  }, [ports, query, regions, routes, vessels]);
}
