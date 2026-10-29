import type { CoscoScheduleCriteria, CoscoScrapeResult } from "@/features/cosco-scraper/types";
import { scrapeCoscoSchedules } from "@/features/cosco-scraper/server/cosco-schedule-scraper";
import { scrapeCoscoSchedulesApi } from "@/features/cosco-scraper/server/cosco-schedule-scraper-api";
import { scrapeCoscoEdge } from "./cosco-edge-schedule";
import { getCoscoScraperCache, setCoscoScraperCache, coscoCacheKey } from "@/features/cosco-scraper/server/cosco-scraper-cache";

export type ScraperMode = "auto" | "api" | "browser" | "edge";

/**
 * 统一抓取入口：双模式调度
 * - api 模式：直接调 COSCO 后端接口（快，优先）
 * - browser 模式：Playwright 浏览器模拟（稳定，兜底）
 * - auto 模式：优先 API，失败自动降级到浏览器
 */
export async function fetchCoscoSchedules(
  criteria: CoscoScheduleCriteria,
  mode: ScraperMode = "auto"
): Promise<CoscoScrapeResult> {
  const key = coscoCacheKey(criteria);

  // 读缓存
  if (!criteria.forceRefresh) {
    const cached = getCoscoScraperCache(key);
    if (cached) return { ...cached, fromCache: true };
  }

  let result: CoscoScrapeResult | null = null;
  let lastError: Error | null = null;

  // Explicit mode permits end-to-end validation of the fallback even while API is healthy.
  if (mode === "edge") {
    result = await scrapeCoscoEdge(criteria);
    if (result.schedules.length) setCoscoScraperCache(key, result);
    return result;
  }

  // 模式 1：纯 API 模式
  if (mode === "api" || mode === "auto") {
    try {
      result = await scrapeCoscoSchedulesApi(criteria);
      if (result.schedules.length > 0) {
        setCoscoScraperCache(key, result);
        return result;
      }
      if (mode === "api" || result.warnings.includes("COSCO_NO_RESULTS")) return result;
      console.warn("[COSCO] API mode returned 0 rows, falling back to browser.");
    } catch (error) {
      lastError = error as Error;
      if (/COSCO_RATE_LIMITED/.test(lastError.message)) throw error;
      if (/COSCO_ACCESS_BLOCKED/.test(lastError.message) && mode === "auto") {
        // The independent API can reject a request while the normal official page remains public.
        // Use the page's own form once; never solve challenges or retry a rejected page request.
        result = await scrapeCoscoEdge(criteria);
        if (result.schedules.length) setCoscoScraperCache(key, result);
        return result;
      }
      if (mode === "api") throw error;
      // auto 模式下继续 fallback
      console.warn(`[COSCO] API mode failed, falling back to browser: ${(error as Error).message}`);
    }
  }

  // 模式 2：Playwright 浏览器模式（兜底）
  if (mode === "browser" || mode === "auto") {
    result = await scrapeCoscoSchedules(criteria);
    setCoscoScraperCache(key, result);
    return result;
  }

  if (lastError) throw lastError;
  throw new Error("No scraper mode available");
}
