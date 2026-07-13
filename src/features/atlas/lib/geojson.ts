import type { Port, Route } from "@/features/atlas/types";

type PortProperties = {
  id: string;
  name: string;
  country: string;
  region: string;
  locode: string;
  vesselCount: number;
  waitingVesselCount: number;
  averageWaitingHours: number;
  selected: boolean;
};

type RouteProperties = {
  id: string;
  name: string;
  selected: boolean;
};

export type PortFeatureCollection = GeoJSON.FeatureCollection<GeoJSON.Point, PortProperties>;
export type RouteFeatureCollection = GeoJSON.FeatureCollection<GeoJSON.LineString, RouteProperties>;

export function createPortsGeoJson(ports: Port[], selectedPortId: string): PortFeatureCollection {
  return {
    type: "FeatureCollection",
    features: ports.map((port) => ({
      type: "Feature",
      properties: {
        id: port.id,
        name: port.name,
        country: port.country,
        region: port.region,
        locode: port.locode,
        vesselCount: port.vesselCount,
        waitingVesselCount: port.waitingVesselCount,
        averageWaitingHours: port.averageWaitingHours,
        selected: port.id === selectedPortId,
      },
      geometry: { type: "Point", coordinates: [port.longitude, port.latitude] },
    })),
  };
}

export function createRoutesGeoJson(routes: Route[], selectedRouteId: string): RouteFeatureCollection {
  return {
    type: "FeatureCollection",
    features: routes.flatMap((route) =>
      route.lineStrings.map((coordinates, index) => ({
        type: "Feature" as const,
        properties: {
          id: route.id,
          name: index === 0 ? route.name : `${route.name} segment ${index + 1}`,
          selected: route.id === selectedRouteId,
        },
        geometry: { type: "LineString" as const, coordinates },
      })),
    ),
  };
}

export function getRouteBounds(route: Route): [[number, number], [number, number]] {
  const coordinates = route.lineStrings.flat();
  const normalized = coordinates.map(([longitude, latitude]) => [longitude < 0 ? longitude + 360 : longitude, latitude] as [number, number]);
  const longitudes = normalized.map(([longitude]) => longitude);
  const latitudes = normalized.map(([, latitude]) => latitude);
  const west = Math.min(...longitudes);
  const east = Math.max(...longitudes);
  const south = Math.min(...latitudes);
  const north = Math.max(...latitudes);
  return [[west > 180 ? west - 360 : west, south], [east > 180 ? east - 360 : east, north]];
}
