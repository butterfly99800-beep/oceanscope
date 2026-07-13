export type VesselStatus = "航行中" | "锚泊中" | "靠港中";
export type VesselType = "集装箱船" | "散货船" | "油轮";
export type PortRegion = "东亚" | "东南亚" | "北美西岸" | "欧洲";
export type SearchSuggestionType = "vessel" | "port" | "route" | "region";

export type PortCall = {
  port: string;
  arrivalTime: string;
  departureTime: string;
  duration: string;
};

export type Vessel = {
  id: string;
  name: string;
  type: VesselType;
  status: VesselStatus;
  flag: string;
  imo: string;
  mmsi: string;
  coordinates: string;
  speed: string;
  speedKnots: number;
  heading: string;
  headingDegrees: number;
  latitude: number;
  longitude: number;
  routeId: string;
  area: string;
  region: PortRegion;
  previousPort: string;
  nextPort: string;
  eta: string;
  lastUpdated: string;
  position: { x: number; y: number; rotation: number };
  voyage: {
    origin: string;
    transit: string;
    destination: string;
    etd: string;
    eta: string;
    days: number;
    progress: number;
  };
  portCalls: PortCall[];
};

export type Port = {
  id: string;
  name: string;
  nameZh?: string;
  aliases: string[];
  country: string;
  region: PortRegion;
  latitude: number;
  longitude: number;
  locode: string;
  vesselCount: number;
  waitingVesselCount: number;
  averageWaitingHours: number;
  x: number;
  y: number;
};

export type Route = {
  id: string;
  name: string;
  originPortId: string;
  destinationPortId: string;
  transitPortIds: string[];
  portIds: string[];
  direct: boolean;
  transitDays: number;
  lineStrings: Array<Array<[number, number]>>;
};

export type RouteOption = {
  id: string;
  routeId: string;
  originPortId: string;
  destinationPortId: string;
  transitPortIds: string[];
  carrier: string;
  service: string;
  transitDays: number;
  direct: boolean;
  transferCount: number;
  etd: string;
  eta: string;
  vesselName: string;
  voyageNumber: string;
};

export type RegionOption = {
  id: string;
  label: string;
  labelZh: string;
  region?: PortRegion;
  center: [number, number];
  zoom: number;
  keywords: string[];
};

export type SelectedMapEntity =
  | { type: "vessel"; id: string }
  | { type: "port"; id: string }
  | { type: "route"; id: string }
  | null;

export type SearchSuggestion = {
  id: string;
  type: SearchSuggestionType;
  title: string;
  subtitle: string;
  meta: string;
  keywords: string[];
  latitude?: number;
  longitude?: number;
  vesselId?: string;
  portId?: string;
  routeId?: string;
  regionId?: string;
  originPortId?: string;
  destinationPortId?: string;
};

export type RouteSearchState = {
  originPortId: string;
  destinationPortId: string;
  directOnly: boolean;
  maxTransfers: number;
  departureDate: string;
};

export type LayerVisibility = {
  vessels: boolean;
  ports: boolean;
  routes: boolean;
};

export type AtlasFilters = {
  vesselType: "全部" | VesselType;
  status: "全部" | VesselStatus;
  region: "全球" | PortRegion;
  updatedWithin: "全部" | "15 分钟内" | "1 小时内" | "24 小时内";
};
