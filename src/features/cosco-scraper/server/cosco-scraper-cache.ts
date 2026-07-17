import type { CoscoScheduleCriteria, CoscoScrapeResult } from "@/features/cosco-scraper/types";

const ttlMs = 10 * 60 * 1000;
const cache = new Map<string, { expiresAt: number; value: CoscoScrapeResult }>();

export function coscoCacheKey(criteria: CoscoScheduleCriteria) {
  return [criteria.origin.trim().toUpperCase(), criteria.destination.trim().toUpperCase(), criteria.dateFrom, criteria.dateTo ?? ""].join("|");
}

export function getCoscoScraperCache(key: string) {
  const entry = cache.get(key);
  if (!entry) return null;
  if (entry.expiresAt < Date.now()) {
    cache.delete(key);
    return null;
  }
  return { ...entry.value, fromCache: true, durationMs: 0 } satisfies CoscoScrapeResult;
}

export function setCoscoScraperCache(key: string, value: CoscoScrapeResult) {
  cache.set(key, { expiresAt: Date.now() + ttlMs, value: { ...value, fromCache: false } });
}
