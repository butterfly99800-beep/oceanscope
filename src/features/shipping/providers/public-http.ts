import type { AuditedSchedules } from "./query-audit";
import { retryPublicRequest } from "./retry-public-request";
import { createHash } from "node:crypto";
import { request, type APIRequestContext, type Page } from "playwright";
import type { Port } from "@prisma/client";
import type { CoscoSchedulePreview } from "@/features/cosco-scraper/types";
import { launchPublicBrowser } from "./public-browser";
import { liveDateWindow } from "./live-date-window";

export type PublicScheduleInput = { originPort: Pick<Port, "id" | "name" | "locode">; destinationPort: Pick<Port, "id" | "name" | "locode">; departureDate: string; dateTo?: string; mode?: string };
export function publishedDate(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim().replace(/\//g, "-").replace(" ", "T");
  if (!/^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}(?::\d{2})?)?$/.test(normalized)) return null;
  const iso = normalized.length === 10 ? normalized + "T00:00:00.000Z" : normalized.length === 16 ? normalized + ":00.000Z" : normalized + ".000Z";
  const parsed = new Date(iso);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString() === iso ? iso : null;
}
export function scheduleId(code: string, values: unknown): string {
  return `${code.toLowerCase()}-${createHash("sha256").update(JSON.stringify(values)).digest("hex").slice(0, 40)}`;
}
export async function responseText(context: APIRequestContext, url: string, form?: Record<string, string>): Promise<string> {
  const response = await retryPublicRequest(() => form ? context.post(url, { form, timeout: 25000 }) : context.get(url, { timeout: 25000 }));
  if (response.status() === 429) throw new Error("RATE_LIMITED: official HTTP 429");
  if (!response.ok()) throw new Error(`ACCESS_BLOCKED: official HTTP ${response.status()}`);
  const text = await response.text();
  if (/Just a moment\.\.\.|<title>Access Denied|Incapsula incident ID|Request Rejected/i.test(text)) throw new Error("VERIFICATION_REQUIRED: official access verification");
  return text;
}
export function publicProvider(code: string, pageUrl: string, query: (context: APIRequestContext, input: PublicScheduleInput, from: string, to: string) => Promise<CoscoSchedulePreview[]>, browserQuery?: (page:Page,input:PublicScheduleInput,from:string,to:string)=>Promise<CoscoSchedulePreview[]>) {
  return { code, async searchSchedule(input: PublicScheduleInput) {
    const started = Date.now();
    const { from, expired } = liveDateWindow(input.departureDate, input.dateTo);
    const to = input.dateTo?.slice(0, 10) ?? new Date(Date.parse(from) + 28 * 86400000).toISOString().slice(0, 10);
    if (expired) return { source: `${code}_LIVE`, schedules: [], warnings: [], fromCache: false, durationMs: 0 };
    const run = (context: APIRequestContext) => query(context, input, from, to);
    const context = await request.newContext({ extraHTTPHeaders: { Referer: pageUrl, "Cache-Control": "no-cache" } });
    let schedules: CoscoSchedulePreview[] = [];
    const warnings: string[] = [];
    let transport = "http";
    try { if(input.mode === "browser" && browserQuery)throw new Error("BROWSER_TEST_REQUESTED"); schedules = await run(context); }
    catch (error) {
      const reason = error instanceof Error ? error.message.split("\n")[0] : "QUERY_FAILED";
      // A real form may resolve a location differently; session-only HTTP cannot repair parser/location failures.
      if (/RATE_LIMITED/.test(reason) || (!browserQuery && /PUBLICATION_UNSUPPORTED|PORT_NOT_FOUND|RESULT_PORT_MISMATCH|RESPONSE_INVALID/.test(reason))) warnings.push(`${code}_${reason}`);
      else {
        const browser = await launchPublicBrowser({ channel: "msedge" }).catch(() => null);
        if (!browser) warnings.push(`${code}_${reason}`);
        else try {
          const session = await browser.newContext({serviceWorkers:"block"});
          const page = await session.newPage();
          page.setDefaultTimeout(12000);
          if(browserQuery){transport="browser-form";schedules=await browserQuery(page,input,from,to);}
          else {transport="browser-session-http";await page.goto(pageUrl, { waitUntil: "domcontentloaded", timeout: 25000 });schedules = await run(session.request);}
        } catch (fallbackError) { warnings.push(`${code}_${fallbackError instanceof Error ? fallbackError.message.split("\n")[0] : reason}`); }
        finally { await browser.close(); }
      }
    } finally { await context.dispose(); }
    const audit=(schedules as AuditedSchedules).audit;
    if(audit?.complete===false)warnings.push("COUNT_RECONCILIATION_INCOMPLETE: some official rows could not be validated");
    if (!schedules.length && !warnings.length) warnings.push("NO_SCHEDULE_FOUND");
    return { source: `${code}_LIVE`, schedules, warnings, audit, transport, fromCache: false, durationMs: Date.now() - started };
  } };
}

// Try the stored name first, then remove a descriptive port suffix. Callers must
// still validate the official location code; this does not alias nearby ports.
export function publicLocationSearchTerms(name: string): string[] {
  const original = name.split(",")[0].trim();
  const simplified = original.replace(/\s+(?:pt\.?|port|city)\s*$/i, "").trim();
  return [...new Set([original, simplified].filter(Boolean))];
}
