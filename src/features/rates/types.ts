export type LocationType = "港口" | "城市" | "地址" | "邮编";
export type TransportMode = "整箱海运" | "海铁联运" | "卡车转运";
export type ContainerType = "20GP" | "40GP" | "40HC" | "45HC";
export type RateTag = "推荐" | "最快" | "最低价" | "直达";
export type SortOption = "recommended" | "price" | "fastest" | "earliestDeparture" | "earliestArrival";
export type InsuranceOption = "none" | "basic" | "premium";
export type FreeDaysOption = "standard" | "plus5" | "plus10" | "plus15";

export type LocationOption = {
  id: string;
  name: string;
  country: string;
  region: string;
  type: LocationType;
  locode: string;
  aliases: string[];
};

export type ContainerSelection = Record<ContainerType, number>;

export type RateSearchCriteria = {
  originId: string;
  destinationId: string;
  cargoReadyDate: string;
  transportMode: TransportMode;
  containers: ContainerSelection;
  cargoType: "general" | "dangerous";
};

export type RateOption = {
  id: string;
  carrier: string;
  serviceName: string;
  transportMode: TransportMode;
  origin: string;
  destination: string;
  originPortCode: string;
  destinationPortCode: string;
  transitPorts: string[];
  etd: string;
  eta: string;
  transitDays: number;
  direct: boolean;
  stops: number;
  vesselName: string;
  voyageNumber: string;
  cutOffDate: string;
  validUntil: string;
  reliability: number;
  baseFreight: number;
  surcharges: number;
  totalPrice: number;
  currency: "USD";
  freeDays: number;
  tags: RateTag[];
};

export type RateFiltersState = {
  stops: "all" | "direct" | "one" | "two";
  carriers: string[];
  maxPrice: number;
  maxTransitDays: number;
  minFreeDays: number;
  minReliability: number;
  departureFrom: string;
};

export type AdditionalServicesState = {
  exportCustoms: boolean;
  importCustoms: boolean;
  pickup: boolean;
  delivery: boolean;
  insurance: InsuranceOption;
  freeDays: FreeDaysOption;
};

export type CostLineItem = {
  category: "基础费用" | "起运地费用" | "目的地费用" | "其他费用";
  name: string;
  unitPrice: number;
  quantity: number;
  subtotal: number;
};

export type QuoteCalculation = {
  baseFreight: number;
  lineItems: CostLineItem[];
  subtotal: number;
  tax: number;
  total: number;
  currency: "USD";
};

export type RecentSearch = {
  id: string;
  originId: string;
  destinationId: string;
  containerSummary: string;
  date: string;
  dangerous: boolean;
};

export type BookingConfirmation = {
  id: string;
  bookingNumber: string;
  createdAt: string;
};

export type ValidationErrors = Partial<Record<"originId" | "destinationId" | "cargoReadyDate" | "containers", string>>;
