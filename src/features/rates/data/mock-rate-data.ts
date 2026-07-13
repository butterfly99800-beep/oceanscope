import type { ContainerType, LocationOption, RateOption, RecentSearch } from "@/features/rates/types";

export const containerDescriptions: Record<ContainerType, string> = {
  "20GP": "20 英尺标准干货箱",
  "40GP": "40 英尺标准干货箱",
  "40HC": "40 英尺高柜",
  "45HC": "45 英尺高柜",
};

export const rateLocations: LocationOption[] = [
  { id: "shanghai", name: "Shanghai, China", country: "China", region: "East Asia", type: "港口", locode: "CNSHA", aliases: ["上海", "上海港", "Shanghai"] },
  { id: "ningbo", name: "Ningbo, China", country: "China", region: "East Asia", type: "港口", locode: "CNNGB", aliases: ["宁波", "宁波港", "Ningbo"] },
  { id: "yantian", name: "Yantian, China", country: "China", region: "East Asia", type: "港口", locode: "CNYTN", aliases: ["盐田", "盐田港", "深圳盐田", "Yantian"] },
  { id: "shenzhen", name: "Shenzhen, China", country: "China", region: "East Asia", type: "城市", locode: "CNSZX", aliases: ["深圳", "Shenzhen"] },
  { id: "singapore", name: "Singapore", country: "Singapore", region: "Southeast Asia", type: "港口", locode: "SGSIN", aliases: ["新加坡", "新加坡港", "Singapore"] },
  { id: "los-angeles", name: "Los Angeles, CA", country: "United States", region: "North America West Coast", type: "城市", locode: "USLAX", aliases: ["洛杉矶", "洛杉矶港", "Los Angeles"] },
  { id: "long-beach", name: "Long Beach, CA", country: "United States", region: "North America West Coast", type: "港口", locode: "USLGB", aliases: ["长滩", "长滩港", "Long Beach"] },
  { id: "rotterdam", name: "Rotterdam, Netherlands", country: "Netherlands", region: "Europe", type: "港口", locode: "NLRTM", aliases: ["鹿特丹", "鹿特丹港", "Rotterdam"] },
  { id: "hamburg", name: "Hamburg, Germany", country: "Germany", region: "Europe", type: "港口", locode: "DEHAM", aliases: ["汉堡", "汉堡港", "Hamburg"] },
];

export const initialRecentSearches: RecentSearch[] = [
  { id: "r1", originId: "shanghai", destinationId: "los-angeles", containerSummary: "1 x 40HC", date: "2026-07-18", dangerous: false },
  { id: "r2", originId: "yantian", destinationId: "long-beach", containerSummary: "2 x 40GP", date: "2026-07-20", dangerous: false },
  { id: "r3", originId: "ningbo", destinationId: "rotterdam", containerSummary: "1 x 20GP", date: "2026-07-22", dangerous: true },
  { id: "r4", originId: "singapore", destinationId: "hamburg", containerSummary: "3 x 40HC", date: "2026-07-24", dangerous: false },
];

export const mockRateOptions: RateOption[] = [
  { id: "rate-1", carrier: "OceanLink", serviceName: "ZEX Express", transportMode: "整箱海运", origin: "Yantian, China", destination: "Los Angeles, CA", originPortCode: "CNYTN", destinationPortCode: "USLAX", transitPorts: [], etd: "2026-07-18", eta: "2026-07-31", transitDays: 13, direct: true, stops: 0, vesselName: "EVER GLORY", voyageNumber: "EG512E", cutOffDate: "2026-07-16", validUntil: "2026-07-15", reliability: 94, baseFreight: 248000, surcharges: 42000, totalPrice: 290000, currency: "USD", freeDays: 7, tags: ["推荐", "直达"] },
  { id: "rate-2", carrier: "Pacific Star", serviceName: "PSW Loop", transportMode: "整箱海运", origin: "Yantian, China", destination: "Long Beach, CA", originPortCode: "CNYTN", destinationPortCode: "USLGB", transitPorts: [], etd: "2026-07-19", eta: "2026-08-02", transitDays: 14, direct: true, stops: 0, vesselName: "ASIA EXPRESS", voyageNumber: "AX208E", cutOffDate: "2026-07-17", validUntil: "2026-07-16", reliability: 91, baseFreight: 232000, surcharges: 39000, totalPrice: 271000, currency: "USD", freeDays: 6, tags: ["最快", "直达"] },
  { id: "rate-3", carrier: "BlueWave Shipping", serviceName: "TPX Relay", transportMode: "整箱海运", origin: "Shanghai, China", destination: "Los Angeles, CA", originPortCode: "CNSHA", destinationPortCode: "USLAX", transitPorts: ["Busan"], etd: "2026-07-20", eta: "2026-08-04", transitDays: 15, direct: false, stops: 1, vesselName: "PACIFIC BRIDGE", voyageNumber: "PB73E", cutOffDate: "2026-07-18", validUntil: "2026-07-17", reliability: 88, baseFreight: 218000, surcharges: 43000, totalPrice: 261000, currency: "USD", freeDays: 8, tags: ["最低价"] },
  { id: "rate-4", carrier: "Global Horizon", serviceName: "Asia Europe 1", transportMode: "整箱海运", origin: "Ningbo, China", destination: "Rotterdam, Netherlands", originPortCode: "CNNGB", destinationPortCode: "NLRTM", transitPorts: ["Singapore"], etd: "2026-07-21", eta: "2026-08-16", transitDays: 26, direct: false, stops: 1, vesselName: "SILK ROUTE", voyageNumber: "SR330W", cutOffDate: "2026-07-19", validUntil: "2026-07-18", reliability: 86, baseFreight: 286000, surcharges: 51000, totalPrice: 337000, currency: "USD", freeDays: 10, tags: [] },
  { id: "rate-5", carrier: "SeaBridge", serviceName: "WCA Shuttle", transportMode: "海铁联运", origin: "Shenzhen, China", destination: "Long Beach, CA", originPortCode: "CNSZX", destinationPortCode: "USLGB", transitPorts: ["Ningbo"], etd: "2026-07-22", eta: "2026-08-07", transitDays: 16, direct: false, stops: 1, vesselName: "HARBOR LINK", voyageNumber: "HL188E", cutOffDate: "2026-07-20", validUntil: "2026-07-19", reliability: 83, baseFreight: 242000, surcharges: 47000, totalPrice: 289000, currency: "USD", freeDays: 9, tags: [] },
  { id: "rate-6", carrier: "NorthStar Logistics", serviceName: "AEX Europe", transportMode: "整箱海运", origin: "Singapore", destination: "Hamburg, Germany", originPortCode: "SGSIN", destinationPortCode: "DEHAM", transitPorts: ["Rotterdam"], etd: "2026-07-23", eta: "2026-08-12", transitDays: 20, direct: false, stops: 1, vesselName: "BLUE HORIZON", voyageNumber: "BH44W", cutOffDate: "2026-07-21", validUntil: "2026-07-20", reliability: 89, baseFreight: 254000, surcharges: 49000, totalPrice: 303000, currency: "USD", freeDays: 12, tags: [] },
  { id: "rate-7", carrier: "Meridian Freight", serviceName: "Pacific Budget", transportMode: "整箱海运", origin: "Shanghai, China", destination: "Long Beach, CA", originPortCode: "CNSHA", destinationPortCode: "USLGB", transitPorts: ["Kaohsiung", "Busan"], etd: "2026-07-25", eta: "2026-08-14", transitDays: 20, direct: false, stops: 2, vesselName: "OCEAN STAR", voyageNumber: "OS718E", cutOffDate: "2026-07-23", validUntil: "2026-07-22", reliability: 79, baseFreight: 205000, surcharges: 52000, totalPrice: 257000, currency: "USD", freeDays: 5, tags: ["最低价"] },
  { id: "rate-8", carrier: "Atlas Blue", serviceName: "Prime Westbound", transportMode: "整箱海运", origin: "Yantian, China", destination: "Los Angeles, CA", originPortCode: "CNYTN", destinationPortCode: "USLAX", transitPorts: [], etd: "2026-07-17", eta: "2026-07-30", transitDays: 13, direct: true, stops: 0, vesselName: "NORTHERN VENTURE", voyageNumber: "NV91E", cutOffDate: "2026-07-15", validUntil: "2026-07-14", reliability: 96, baseFreight: 268000, surcharges: 44000, totalPrice: 312000, currency: "USD", freeDays: 10, tags: ["推荐", "最快", "直达"] },
];
