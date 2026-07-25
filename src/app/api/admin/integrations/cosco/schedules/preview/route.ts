import { NextResponse } from "next/server";
import { z } from "zod";
import { getCoscoScraperCache, setCoscoScraperCache, coscoCacheKey } from "@/features/cosco-scraper/server/cosco-scraper-cache";
import { acquireCoscoScraperLock, releaseCoscoScraperLock } from "@/features/cosco-scraper/server/cosco-scraper-lock";
import { CoscoScraperError } from "@/features/cosco-scraper/server/cosco-schedule-scraper";
import { fetchCoscoSchedules } from "@/features/cosco-scraper/server/cosco-scraper-fetcher";
import type { ScraperMode } from "@/features/cosco-scraper/server/cosco-scraper-fetcher";
import { jsonData, jsonError, validationError } from "@/features/admin/server/api-utils";
import { requireAdminForApi } from "@/lib/authorization";

export const runtime = "nodejs";

const previewSchema = z.object({
  origin: z.string().trim().min(1),
  destination: z.string().trim().min(1),
  dateFrom: z.string().regex(/^20\d{2}-\d{2}-\d{2}$/),
  dateTo: z.string().regex(/^20\d{2}-\d{2}-\d{2}$/).optional().or(z.literal("")),
  debug: z.boolean().optional(),
  forceRefresh: z.boolean().optional(),
  mode: z.enum(["auto", "api", "browser"]).optional(),
}).superRefine((value, context) => {
  if (value.dateTo) {
    const from = new Date(`${value.dateFrom}T00:00:00Z`).getTime();
    const to = new Date(`${value.dateTo}T00:00:00Z`).getTime();
    const days = (to - from) / 86400000;
    if (days < 0 || days > 31) context.addIssue({ code: "custom", message: "Date range must be 0 to 31 days.", path: ["dateTo"] });
  }
});

export async function POST(request: Request) {
  const adminAuth = await requireAdminForApi();
  if (adminAuth.response) return adminAuth.response;
  if (process.env.COSCO_SCRAPER_ENABLED !== "true") return jsonError("COSCO_SCRAPER_DISABLED", "COSCO scraper is disabled. Set COSCO_SCRAPER_ENABLED=true to run tests.", 503);

  const parsed = previewSchema.safeParse(await request.json());
  if (!parsed.success) return validationError(parsed.error);
  const criteria = { ...parsed.data, dateTo: parsed.data.dateTo || undefined };
  const mode: ScraperMode = parsed.data.mode ?? "auto";
  const key = coscoCacheKey(criteria);
  if (!criteria.forceRefresh) {
    const cached = getCoscoScraperCache(key);
    if (cached) return jsonData(cached);
  }
  if (!acquireCoscoScraperLock()) return jsonError("COSCO_AUTOMATION_BLOCKED", "Another COSCO scraper task is running. Please retry later.", 429);
  try {
    const result = await fetchCoscoSchedules(criteria, mode);
    setCoscoScraperCache(key, result);
    return jsonData(result);
  } catch (error) {
    if (error instanceof CoscoScraperError) return NextResponse.json({ error: { code: error.code, message: error.message, step: error.step ?? "unknown" } }, { status: error.status });
    return jsonError("COSCO_UNKNOWN_ERROR", "COSCO scraper failed.", 500);
  } finally {
    releaseCoscoScraperLock();
  }
}
