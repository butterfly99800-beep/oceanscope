export type ScheduleStatus = "正常" | "预计延误" | "已延误" | "即将截关" | "已取消";
export type ScheduleTag = "推荐" | "直达" | "中转" | "准班率高" | "即将截关";
export type ScheduleSortOption = "recommended" | "earliestDeparture" | "earliestArrival" | "shortestTransit" | "highestReliability" | "fewestStops";
export type ScheduleViewMode = "cards" | "table" | "calendar";
export type DateRangeOption = "3" | "7" | "14" | "custom";

export interface PortOption {
  id: string;
  name: string;
  localName: string;
  country: string;
  city: string;
  code: string;
  aliases: string[];
}

export interface ScheduleSearchCriteria {
  originPortId: string;
  destinationPortId: string;
  departureDate: string;
  dateRange: DateRangeOption;
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
  reliability: "all" | "90+" | "80-90" | "70-80" | "under70";
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
