export type ScheduleStatus = "正常" | "预计延误" | "已延误" | "即将截关" | "已取消";
export type ScheduleTag = "直达" | "中转" | "即将截关";
export type ScheduleSortOption = "recommended" | "earliestDeparture" | "earliestArrival" | "shortestTransit" | "fewestStops";
export type ScheduleViewMode = "cards" | "table" | "calendar";
export type DateRangeOption = "3" | "7" | "14" | "custom";

export interface CoscoCitySelection {
  uuid: string;
  name: string;
  fullName: string;
  locode: string;
  cityCode: string;
  country: string;
}

export interface PortOption {
  id: string;
  source?: "SEED" | "MANUAL" | "COSCO_LIVE_QUERY" | "OOCL_LIVE_QUERY";
  name: string;
  localName: string;
  country: string;
  city: string;
  code: string;
  aliases: string[];
  coscoCity?: CoscoCitySelection;
}

export interface ScheduleSearchCriteria {
  originPortId: string;
  destinationPortId: string;
  originCoscoCity?: CoscoCitySelection;
  destinationCoscoCity?: CoscoCitySelection;
  departureDate: string;
  dateRange: DateRangeOption;
  beforeDays: string;
  afterDays: string;
  directOnly: boolean;
}

export interface ScheduleRouteNode {
  portName: string;
  portCode: string;
  terminal?: string;
  date: string;
  time: string;
  type: "origin" | "transit" | "destination";
}

export interface ScheduleTransitPort {
  portName: string;
  portCode: string;
  arrivalTime: string;
  departureTime: string;
  waitingHours: number;
  nextVesselName?: string;
  nextVoyageNumber?: string;
  terminal?: string;
}

export interface SailingSchedule {
  id: string;
  source?: "SEED" | "MANUAL" | "COSCO_LIVE_QUERY" | "OOCL_LIVE_QUERY";
  carrier: string;
  carrierCode: string;
  serviceName: string;
  routeName: string;
  vesselName: string;
  voyageNumber: string;
  originPort: string;
  originPortCode: string;
  destinationPort: string;
  destinationPortCode: string;
  transitPorts: ScheduleTransitPort[];
  etd: string;
  eta: string;
  originalEtd?: string;
  originalEta?: string;
  transitDays: number;
  direct: boolean;
  stopCount: number;
  frequency: string;
  terminal: string;
  destinationTerminal: string;
  cutOffTime: string;
  availableTime?: string;
  siCutOffTime: string;
  vgmCutOffTime: string;
  cyOpenTime: string;
  estimatedBerthingTime: string;
  departureReliability: number;
  scheduleStatus: ScheduleStatus;
  delayHours: number;
  lastUpdated: string;
  routeNodes: ScheduleRouteNode[];
  tags: ScheduleTag[];
  terminalRemark: string;
}

export interface ScheduleFilterState {
  carriers: string[];
  direct: "all" | "direct" | "transit";
  stopCount: "all" | "direct" | "one" | "twoPlus";
  statuses: ScheduleStatus[];
  departureFrom: string;
  transitDays: "all" | "0-15" | "16-25" | "26-35" | "35+";
  serviceName: string;
  vesselName: string;
  terminal: string;
}

export interface RecentScheduleSearch {
  id: string;
  originPortId: string;
  destinationPortId: string;
  departureDate: string;
  directOnly: boolean;
  searchedAt: string;
}

export interface FavoriteSchedule {
  scheduleId: string;
  createdAt: string;
}




