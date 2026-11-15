import type { Port } from "@prisma/client";
import type { CoscoSchedulePreview } from "@/features/cosco-scraper/types";
import { getCarrierPortMapping } from "@/features/ports/server/port-normalizer";
import { openPublicSession } from "@/features/shipping/providers/public-browser";
import type { ShippingProvider } from "@/features/shipping/providers/types";
import { searchChinaPublic, chinaTrade } from "./china-public";

type CmaProviderPort = Pick<Port, "id" | "name" | "locode">;
export type CmaProviderSearchInput = { originPort: CmaProviderPort; destinationPort: CmaProviderPort; departureDate: string; dateTo?: string; forceRefresh?: boolean };
export type CmaProviderResult = { source: "CMA_LIVE"; schedules: CoscoSchedulePreview[]; warnings: string[]; durationMs: number; fromCache: boolean };

const CMA_PUBLIC_URL = process.env.CMA_PUBLIC_SCHEDULE_URL || "https://www.cma-cgm.com/ebusiness/schedules";
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function pageDate(value: string) {
  const date = new Date(`${value.slice(0, 10)}T12:00:00Z`);
  return Number.isNaN(date.getTime()) ? "" : `${String(date.getUTCDate()).padStart(2, "0")}-${MONTHS[date.getUTCMonth()]}-${date.getUTCFullYear()}`;
}

function dateOnlyIso(value: string | null) {
  if (!value) return null;
  const match = value.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!match) return null;
  return new Date(Date.UTC(Number(match[3]), Number(match[1]) - 1, Number(match[2]), 12)).toISOString();
}

async function portDescription(port: CmaProviderPort) {
  const mapped = (await getCarrierPortMapping("CMA", port.id))?.mappingValue?.trim();
  if (mapped?.includes(" ; ")) return mapped;
  return `${port.name.toUpperCase()} ; ${port.locode.slice(0, 2).toUpperCase()} ; ${port.locode.toUpperCase()}`;
}

type PageRow = {
  departure: string | null; arrival: string | null; origin: string | null; destination: string | null;
  originLocode: string | null; destinationLocode: string | null; originTerminal: string | null; destinationTerminal: string | null;
  vessel: string | null; voyage: string | null; service: string | null; transitDays: number | null; routing: string | null; rawText: string;
};

async function waitForQueryForm(page: import("playwright").Page, interactive: boolean) {
  const form = page.locator('form[action="/ebusiness/schedules/routing-finder"]').first();
  const deadline = Date.now() + (interactive ? 180000 : 25000);
  while (Date.now() < deadline) {
    if (await form.isVisible()) return form;
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
    // The China public schedule tool publishes North America trade and per-voyage POD/ETA details.
    if (input.originPort.locode.startsWith("CN") && chinaTrade(input.destinationPort.locode)) {
      return searchChinaPublic(input);
    }
    const started = Date.now();
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
      await page.locator("#field").fill("4");
      await page.locator("#IsDeparture").selectOption("True");
      await Promise.all([
        page.waitForNavigation({ waitUntil: "domcontentloaded", timeout: 60000 }),
        form.evaluate((element) => (element as HTMLFormElement).submit()),
      ]);
      await page.locator(".cardelem").first().waitFor({ state: "attached", timeout: 45000 }).catch(() => undefined);
      const rows = await page.locator(".cardelem").evaluateAll((cards): PageRow[] => cards.map((card) => {
        const departure = card.querySelector<HTMLElement>(".DepartureDatesCls")?.dataset.eventDate || null;
        const arrival = card.querySelector<HTMLElement>(".ArrivalDatesCls")?.dataset.eventDate || null;
        const portLink = (selector: string) => card.querySelector<HTMLAnchorElement>(selector);
        const originLink = portLink(".DepartureDatesCls a.capsule-container");
        const destinationLink = portLink(".ArrivalDatesCls a.capsule-container");
        const terminal = (selector: string) => portLink(`${selector} a[href*='/terminal/detail/']`)?.textContent?.trim() || null;
        const labelled = new Map(Array.from(card.querySelectorAll("dt")).map((dt) => [dt.textContent?.trim().toLowerCase(), dt.nextElementSibling?.textContent?.trim() || null]));
        const hrefCode = (link: HTMLAnchorElement | null) => {
          const decoded = decodeURIComponent(link?.getAttribute("href") || "");
          return decoded.match(/;\s*([A-Z]{5})(?:&|$)/)?.[1] || null;
        };
        const transit = card.querySelector<HTMLElement>("[id^='Transit_']")?.dataset.value;
        return {
          departure, arrival,
          origin: originLink?.textContent?.replace(/^\s*POL\s*/i, "").trim() || null,
          destination: destinationLink?.textContent?.replace(/^\s*POD\s*/i, "").trim() || null,
          originLocode: hrefCode(originLink), destinationLocode: hrefCode(destinationLink),
          originTerminal: terminal(".DepartureDatesCls"), destinationTerminal: terminal(".ArrivalDatesCls"),
          vessel: labelled.get("main vessel") || null, voyage: labelled.get("voyage ref.") || null,
          service: labelled.get("service") || null,
          transitDays: transit && Number.isFinite(Number(transit)) ? Number(transit) : null,
          routing: card.querySelector("#Direct")?.textContent?.trim() || null,
          rawText: card.textContent?.replace(/\s+/g, " ").trim() || "",
        };
      }));
      const schedules = rows.map((row, index): CoscoSchedulePreview | null => {
        const etd = dateOnlyIso(row.departure); const eta = dateOnlyIso(row.arrival);
        if (!etd || !eta || !row.origin || !row.destination) return null;
        const direct = row.routing ? /^direct$/i.test(row.routing) : null;
        return {
          id: `cma-${row.voyage || index}-${etd}`, carrierName: "CMA CGM", serviceName: row.service, routeName: null,
          vesselName: row.vessel, voyageNumber: row.voyage, originText: row.origin, destinationText: row.destination,
          originLocode: row.originLocode, destinationLocode: row.destinationLocode, etd, eta, etdTimeKnown: false, etaTimeKnown: false,
          transitDays: row.transitDays, direct, stopCount: null, transitPorts: [], cargoNature: null,
          cutOffTime: null, availableTime: null, originFacilityName: row.originTerminal, destinationFacilityName: row.destinationTerminal,
          outboundHaulage: null, inboundHaulage: null, rawText: row.rawText,
        };
      }).filter((row): row is CoscoSchedulePreview => Boolean(row));
      const bodyText = await page.locator("body").innerText().catch(() => "");
      const warnings = schedules.length ? [] : [/captcha|verify you are human|access denied|datadome/i.test(bodyText)
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
