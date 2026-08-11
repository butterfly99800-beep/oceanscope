import { request, type APIRequestContext, type APIResponse } from "playwright";
import type { CoscoCityOption, CoscoNetworkProbe, CoscoScheduleCriteria, CoscoScrapeResult } from "@/features/cosco-scraper/types";
import { mapJsonPayloadsToCoscoSchedules } from "@/features/cosco-scraper/server/cosco-schedule-mapper";

const HOME_URL = "https://elines.coscoshipping.com/ebusiness/";
const SCHEDULE_PAGE_URL = "https://elines.coscoshipping.com/ebusiness/sailingSchedule/searchByCity";
const CITY_SEARCH_API = "https://elines.coscoshipping.com/ebbase/public/general/findCityDistrictByPrefix";
const SCHEDULE_API = "https://elines.coscoshipping.com/ebschedule/public/purpoShipmentWs";
const REFERER = "https://elines.coscoshipping.com/ebusiness/sailingSchedule/searchByCity/resultByCity";

const DEFAULT_HEADERS = {
  Accept: "application/json, text/plain, */*",
  "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
  "Accept-Encoding": "gzip, deflate, br",
  Origin: "https://elines.coscoshipping.com",
  Referer: REFERER,
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
  "sec-ch-ua": '"Not/A)Brand";v="8", "Chromium";v="126", "Google Chrome";v="126"',
  "sec-ch-ua-mobile": "?0",
  "sec-ch-ua-platform": '"Windows"',
  "sec-fetch-dest": "empty",
  "sec-fetch-mode": "cors",
  "sec-fetch-site": "same-site",
  language: "en_US",
  sys: "eb",
};

type CitySearchResult = {
  uuid?: string;
  cityUuid?: string;
  id?: string;
  name?: string;
  cityName?: string;
  cityLocName?: string;
  fullName?: string;
  fullFormate?: string;
  code?: string;
  cityCode?: string;
  unloCode?: string;
  country?: string;
  [key: string]: unknown;
};

function recordNetwork(network: CoscoNetworkProbe[], response: APIResponse, method: "GET" | "POST", postData?: string | null) {
  network.push({
    url: response.url(),
    method,
    status: response.status(),
    resourceType: "api",
    contentType: response.headers()["content-type"] ?? null,
    postData,
  });
}

async function newCoscoApiContext() {
  return request.newContext({
    ignoreHTTPSErrors: true,
    extraHTTPHeaders: DEFAULT_HEADERS,
  });
}

async function initSession(context: APIRequestContext, network: CoscoNetworkProbe[]) {
  try {
    // 第一步：访问主页，获取基础 Cookie
    const homeResponse = await context.get(HOME_URL, {
      headers: {
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
        "sec-fetch-dest": "document",
        "sec-fetch-mode": "navigate",
        "sec-fetch-site": "none",
        "sec-fetch-user": "?1",
        "upgrade-insecure-requests": "1",
      },
      timeout: 15000,
    });
    recordNetwork(network, homeResponse, "GET");

    // 第二步：访问船期查询页，建立完整会话 Cookie
    const pageResponse = await context.get(SCHEDULE_PAGE_URL, {
      headers: {
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
        Referer: HOME_URL,
        "sec-fetch-dest": "document",
        "sec-fetch-mode": "navigate",
        "sec-fetch-site": "same-origin",
        "upgrade-insecure-requests": "1",
      },
      timeout: 15000,
    });
    recordNetwork(network, pageResponse, "GET");
  } catch {
    // The JSON endpoints can still work when the homepage probe is blocked.
  }
}

function extractCityResults(data: unknown): CitySearchResult[] {
  if (Array.isArray(data)) return data.flatMap(extractCityResults);
  if (!data || typeof data !== "object") return [];
  const record = data as Record<string, unknown>;
  const looksLikeCity = ["uuid", "cityUuid", "id", "name", "cityName", "cityLocName", "fullName", "fullFormate", "code", "cityCode", "unloCode"].some((key) => key in record);
  const nested = ["data", "result", "list", "rows", "content", "records"].flatMap((key) => extractCityResults(record[key]));
  return looksLikeCity ? [record as CitySearchResult, ...nested] : nested;
}

function cityText(city: CitySearchResult) {
  return [city.fullFormate, city.fullName, city.name, city.cityName, city.cityLocName, city.code, city.cityCode, city.unloCode, city.country].filter(Boolean).join(" ");
}

function cityName(city: CitySearchResult) {
  const base = city.fullFormate || city.fullName || city.name || city.cityName || city.cityLocName || "";
  const locode = city.unloCode || city.code;
  if (base && locode && !base.toUpperCase().includes(String(locode).toUpperCase())) return `${base},${locode}`;
  return base || city.cityCode || locode || "";
}

function cityUuid(city: CitySearchResult) {
  return city.cityUuid || city.uuid || city.id || "";
}

function toCoscoCityOption(city: CitySearchResult): CoscoCityOption | null {
  const uuid = cityUuid(city);
  const fullName = cityName(city);
  if (!uuid || !fullName) return null;
  return {
    uuid,
    name: String(city.cityLocName || city.cityName || city.name || fullName),
    fullName,
    locode: String(city.unloCode || city.code || ""),
    cityCode: String(city.cityCode || ""),
    country: String(city.country || ""),
  };
}

function fromCriteriaCity(uuid: string | undefined, fullName: string): CitySearchResult | null {
  if (!uuid || !fullName) return null;
  const parts = fullName.split(",");
  const locode = parts.at(-1) || "";
  return {
    cityUuid: uuid,
    cityLocName: parts[0] || fullName,
    fullFormate: fullName.replace(new RegExp(`,${locode}$`, "i"), ""),
    unloCode: locode,
  };
}

function scoreCity(city: CitySearchResult, query: string) {
  const normalizedQuery = query.toLowerCase();
  const text = cityText(city).toLowerCase();
  let score = text.includes(normalizedQuery) ? 10 : 0;
  if ((city.unloCode || "").toLowerCase() === normalizedQuery) score += 25;
  if ((city.code || city.cityCode || "").toLowerCase() === normalizedQuery) score += 20;
  if ((city.name || city.cityName || city.cityLocName || "").toLowerCase() === normalizedQuery) score += 15;
  if (/china|united states|netherlands|germany|singapore|korea/i.test(text)) score += 2;
  return score;
}

async function searchCity(context: APIRequestContext, query: string, network: CoscoNetworkProbe[]) {
  const prefix = query.split(",")[0]?.trim() || query;
  const response = await context.get(CITY_SEARCH_API, {
    params: { prefix, timestamp: String(Date.now()) },
    timeout: 15000,
  });
  recordNetwork(network, response, "GET");
  if (!response.ok()) throw new Error(`COSCO city search failed: ${response.status()}`);
  const data = await response.json().catch(() => null);
  const results = extractCityResults(data).filter((item) => cityUuid(item) && cityName(item));
  const [best] = results.sort((a, b) => scoreCity(b, query) - scoreCity(a, query));
  if (!best) throw new Error(`COSCO city was not found: ${query}`);
  return best;
}

export async function searchCoscoCityOptions(query: string): Promise<CoscoCityOption[]> {
  const network: CoscoNetworkProbe[] = [];
  const context = await newCoscoApiContext();
  try {
    await initSession(context, network);
    const response = await context.get(CITY_SEARCH_API, {
      params: { prefix: query, timestamp: String(Date.now()) },
      timeout: 15000,
    });
    if (!response.ok()) return [];
    const data = await response.json().catch(() => null);
    const seen = new Set<string>();
    return extractCityResults(data)
      .map(toCoscoCityOption)
      .filter((item): item is CoscoCityOption => Boolean(item))
      .filter((item) => {
        if (seen.has(item.uuid)) return false;
        seen.add(item.uuid);
        return true;
      })
      .slice(0, 12);
  } finally {
    await context.dispose().catch(() => undefined);
  }
}

function dateOnly(value: string | undefined, fallback: string) {
  return (value || fallback).slice(0, 10);
}

function addDays(value: string, days: number) {
  const date = new Date(`${value.slice(0, 10)}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function scheduleBody(origin: CitySearchResult, destination: CitySearchResult, fromDate: string, toDate: string) {
  const originName = cityName(origin);
  const destinationName = cityName(destination);
  const originCityUuid = cityUuid(origin);
  const destinationCityUuid = cityUuid(destination);
  if (!originCityUuid) throw new Error(`COSCO origin city UUID missing: ${originName}`);
  if (!destinationCityUuid) throw new Error(`COSCO destination city UUID missing: ${destinationName}`);
  return {
    fromDate,
    pickup: "B",
    delivery: "B",
    estimateDate: "D",
    toDate,
    originCityUuid,
    destinationCityUuid,
    originCity: originName,
    destinationCity: destinationName,
  };
}

async function querySchedules(context: APIRequestContext, origin: CitySearchResult, destination: CitySearchResult, fromDate: string, toDate: string, network: CoscoNetworkProbe[]) {
  const payloads: unknown[] = [];
  const warnings: string[] = [];
  const body = scheduleBody(origin, destination, fromDate, toDate);
  const postData = JSON.stringify(body);
  const response = await context.post(SCHEDULE_API, {
    data: body,
    timeout: 20000,
  });
  recordNetwork(network, response, "POST", postData);
  if (response.status() === 429) throw new Error("COSCO API rate limited: 429");
  if (response.status() === 403) throw new Error("COSCO API blocked: 403");
  if (!response.ok()) {
    warnings.push(`schedule API returned ${response.status()}`);
    return { schedules: [] as ReturnType<typeof mapJsonPayloadsToCoscoSchedules>, payloads, warnings };
  }
  const payload = await response.json().catch(() => null);
  if (!payload) {
    warnings.push("schedule API returned non JSON payload");
    return { schedules: [] as ReturnType<typeof mapJsonPayloadsToCoscoSchedules>, payloads, warnings };
  }
  payloads.push(payload);
  const mapped = mapJsonPayloadsToCoscoSchedules([payload], cityName(origin), cityName(destination));
  if (!mapped.length) warnings.push("schedule API JSON did not contain recognizable schedule rows");
  return { schedules: mapped, payloads, warnings };
}

export async function scrapeCoscoSchedulesApi(criteria: CoscoScheduleCriteria): Promise<CoscoScrapeResult> {
  const started = Date.now();
  const network: CoscoNetworkProbe[] = [];
  const warnings: string[] = [];
  const fromDate = dateOnly(criteria.dateFrom, new Date().toISOString());
  const toDate = dateOnly(criteria.dateTo, addDays(fromDate, 28));
  const context = await newCoscoApiContext();

  try {
    await initSession(context, network);
    const [origin, destination] = await Promise.all([
      Promise.resolve(fromCriteriaCity(criteria.originCityUuid, criteria.origin)).then((city) => city || searchCity(context, criteria.origin, network)),
      Promise.resolve(fromCriteriaCity(criteria.destinationCityUuid, criteria.destination)).then((city) => city || searchCity(context, criteria.destination, network)),
    ]);
    const result = await querySchedules(context, origin, destination, fromDate, toDate, network);
    warnings.push(...result.warnings);
    if (!result.schedules.length) warnings.push("COSCO API returned no schedule rows. No seed or mock data was returned.");

    return {
      source: "COSCO_LIVE",
      targetUrl: SCHEDULE_API,
      finalUrl: SCHEDULE_API,
      pageTitle: "COSCO API",
      entryText: "API Mode",
      openedNewPage: false,
      iframeUrls: [],
      queriedAt: new Date().toISOString(),
      criteria,
      schedules: result.schedules.slice(0, 80),
      warnings,
      debug: {
        controls: [],
        network,
        jsonEndpoints: [SCHEDULE_API],
        jsonPayloadCount: result.payloads.length,
      },
      durationMs: Date.now() - started,
      fromCache: false,
    };
  } finally {
    await context.dispose().catch(() => undefined);
  }
}

