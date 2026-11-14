import { isCmaMaintenance } from "./maintenance";
import { queryCmaSession } from "./session-client";
import { parseCmaGlobalHtml } from "./global-parser";
import { canonicalPortCode, officialPortName } from "@/features/ports/server/source-port-match";
import type { Port } from "@prisma/client";
import type { CoscoSchedulePreview } from "@/features/cosco-scraper/types";
import { getCarrierPortMapping } from "@/features/ports/server/port-normalizer";
import { openPublicSession } from "@/features/shipping/providers/public-browser";
import type { ShippingProvider } from "@/features/shipping/providers/types";

type CmaProviderPort = Pick<Port, "name" | "locode"> & { id?: string };
export type CmaProviderSearchInput = { originPort: CmaProviderPort; destinationPort: CmaProviderPort; departureDate: string; dateTo?: string; forceRefresh?: boolean };
export type CmaProviderResult = { source: "CMA_LIVE"; schedules: CoscoSchedulePreview[]; warnings: string[]; durationMs: number; fromCache: boolean };

const CMA_PUBLIC_URL = process.env.CMA_PUBLIC_SCHEDULE_URL || "https://www.cma-cgm.com/ebusiness/schedules";
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function pageDate(value: string) {
  const date = new Date(`${value.slice(0, 10)}T12:00:00Z`);
  return Number.isNaN(date.getTime()) ? "" : `${String(date.getUTCDate()).padStart(2, "0")}-${MONTHS[date.getUTCMonth()]}-${date.getUTCFullYear()}`;
}

async function portDescription(port: CmaProviderPort) {
  const mapped = (port.id ? await getCarrierPortMapping("CMA", port.id) : null)?.mappingValue?.trim();
  if (mapped?.includes(" ; ")) return mapped;
  return `${officialPortName(port).toUpperCase()} ; ${port.locode.slice(0, 2).toUpperCase()} ; ${canonicalPortCode(port.locode).toUpperCase()}`;
}

async function waitForQueryForm(page: import("playwright").Page, interactive: boolean) {
  const form = page.locator('form[action="/ebusiness/schedules/routing-finder"]').first();
  const deadline = Date.now() + (interactive ? 180000 : 25000);
  while (Date.now() < deadline) {
    if (await form.isVisible()) return form;
    if (isCmaMaintenance(await page.locator("body").innerText().catch(()=>""))) throw new Error("CMA_MAINTENANCE");
    const challenge = page.locator('iframe[src*="captcha-delivery.com/captcha"]').first();
    if (await challenge.isVisible()) {
      const frame = await (await challenge.elementHandle())?.contentFrame();
      const text = await frame?.locator("body").innerText({ timeout: 1000 }).catch(() => "");
      // DataDome can return an access restriction without an interactive CAPTCHA.
      if (text && /访问暂时受限|access.*(?:restricted|blocked)|temporarily blocked/i.test(text)) {
        throw new Error("CMA_ACCESS_BLOCKED: official verification frame restricts this connection; no interactive verification is available");
      }
      if (text && !interactive) throw new Error("CMA_CAPTCHA_REQUIRED: official page requires human verification");
    }
    await page.waitForTimeout(500);
  }
  throw new Error("CMA_PAGE_LOAD_TIMEOUT: official query form did not load");
}

export const CMAProvider: ShippingProvider<CmaProviderSearchInput, CmaProviderResult> = {
  code: "CMA",
  async searchSchedule(input) {
    const started = Date.now();
    if(process.env.CMA_USE_LOCAL_WORKER === "true") {
      try {
        const token=process.env.CMA_WORKER_TOKEN || process.env.OOCL_WORKER_TOKEN;
        if(!token||token.length<32)throw new Error("missing token");
        const response=await fetch(process.env.CMA_WORKER_URL || "http://127.0.0.1:18341/cma/query",{method:"POST",cache:"no-store",redirect:"error",
          headers:{Authorization:"Bearer "+token,"Content-Type":"application/json"},
          body:JSON.stringify({originPort:input.originPort,destinationPort:input.destinationPort,departureDate:input.departureDate,dateTo:input.dateTo}),
          signal:AbortSignal.timeout(180000)});
        if(!response.ok)throw new Error("worker HTTP "+response.status);
        const result=await response.json();
        if(result.source!=="CMA_LIVE"||result.fromCache!==false||!Array.isArray(result.schedules)||!Array.isArray(result.warnings))throw new Error("invalid worker response");
        return result;
      }catch{return {source:"CMA_LIVE",schedules:[],warnings:["CMA_LOCAL_WORKER_UNAVAILABLE"],durationMs:Date.now()-started,fromCache:false};}
    }
    if (process.env.CMA_USE_BROWSER_SESSION === "true") {
      try { return await queryCmaSession(input); }
      catch (error) { return {source:"CMA_LIVE",schedules:[],warnings:[error instanceof Error && error.message === "CMA_MAINTENANCE" ? "CMA_MAINTENANCE" : "CMA_BROWSER_SESSION_UNAVAILABLE"],durationMs:Date.now()-started,fromCache:false}; }
    }
    const [origin, destination] = await Promise.all([portDescription(input.originPort), portDescription(input.destinationPort)]);
    // A normal schedule search must never open a verification window.
    const interactive = false;
    const browser = await openPublicSession("CMA", interactive);
    try {
      const page = await browser.newPage();
      page.setDefaultTimeout(30000);
      await page.goto(CMA_PUBLIC_URL, { waitUntil: "domcontentloaded", timeout: 60000 });
      if (interactive) {
        console.info("CMA: complete official verification in the project window; keep it open. The query will continue automatically.");
      }
      const form = await waitForQueryForm(page, interactive);
      await page.locator("#AutoCompletePOL").fill(origin);
      await page.locator("#AutoCompletePOD").fill(destination);
      await form.evaluate((element, values) => {
        for (const [name, value] of Object.entries(values)) {
          const input = (element as HTMLFormElement).elements.namedItem(name) as HTMLInputElement | null;
          if (input) input.value = value;
        }
      }, { ActualPOLDescription: origin, ActualPODDescription: destination, ActualPOLType: "Port", ActualPODType: "Port" });
      await page.locator("#datepicker").fill(pageDate(input.departureDate));
      await page.locator("#field").fill(String(Math.max(1, Math.min(10, Math.ceil(((Date.parse(input.dateTo || input.departureDate) - Date.parse(input.departureDate)) / 86400000 + 1) / 7)))));
      await page.locator("#IsDeparture").selectOption("True");
      await Promise.all([
        page.waitForNavigation({ waitUntil: "domcontentloaded", timeout: 60000 }),
        form.evaluate((element) => (element as HTMLFormElement).submit()),
      ]);
      await page.locator(".cardelem").first().waitFor({ state: "attached", timeout: 45000 }).catch(() => undefined);
      const schedules = parseCmaGlobalHtml(await page.content(), input.departureDate.slice(0,10), (input.dateTo || input.departureDate).slice(0,10));
      const bodyText = await page.locator("body").innerText().catch(() => "");
      const warnings = schedules.length ? [] : [isCmaMaintenance(bodyText) ? "CMA_MAINTENANCE" : /captcha|verify you are human|access denied|datadome/i.test(bodyText)
        ? "CMA_CAPTCHA_REQUIRED: public page requested human verification."
        : /no (?:schedules|results|routes|routing)|no result found/i.test(bodyText) ? "NO_SCHEDULE_FOUND"
          : "CMA_RESPONSE_INVALID: official result cards were not present"];
      return { source: "CMA_LIVE", schedules, warnings, durationMs: Date.now() - started, fromCache: false };
    } catch (error) {
      const message = error instanceof Error ? error.message : "unknown error";
      return { source: "CMA_LIVE", schedules: [], warnings: [`CMA_PUBLIC_PAGE_FAILED: ${message}`], durationMs: Date.now() - started, fromCache: false };
    } finally { await browser.close(); }
  },
};
