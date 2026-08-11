import type { Port } from "@prisma/client";
import { getCarrierPortMapping } from "@/features/ports/server/port-normalizer";
import type { CoscoSchedulePreview } from "@/features/cosco-scraper/types";
import type { ShippingProvider } from "@/features/shipping/providers/types";

type OoclProviderPort = Pick<Port, "id" | "name" | "locode">;

export type OoclProviderSearchInput = {
  originPort: OoclProviderPort;
  destinationPort: OoclProviderPort;
  departureDate: string;
  dateTo?: string;
};

export type OoclProviderResult = {
  source: "OOCL_LIVE";
  schedules: CoscoSchedulePreview[];
  warnings: string[];
  durationMs: number;
  fromCache: boolean;
};

const OOCL_MOBILE_URL = "https://pbservice.moc.oocl.com/party/sailingschedule/MOBILE/mobile_ss_search.jsf?ANONYMOUS_BEHAVIOR=BUILD_UP&ENTRY=MCC&ENTRY_TYPE=OOCL";
const MOBILE_UA = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1";
const months: Record<string, number> = { Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5, Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11 };

async function toOoclPortValue(port: OoclProviderPort) {
  const mapping = await getCarrierPortMapping("OOCL", port.id);
  return (mapping?.mappingValue || port.name || port.locode).split(",")[0].trim();
}

function formatMobileDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return `${String(date.getDate()).padStart(2, "0")} ${String(date.getMonth() + 1).padStart(2, "0")} ${date.getFullYear()}`;
}

function toIsoDate(value: string | undefined, baseDate: string) {
  if (!value) return null;
  const match = value.match(/(\d{1,2})\s+([A-Za-z]{3})/);
  if (!match) return null;
  const base = new Date(baseDate);
  const year = base.getFullYear();
  const month = months[match[2]];
  if (month === undefined) return null;
  let date = new Date(Date.UTC(year, month, Number(match[1]), 12));
  if (date.getTime() + 14 * 86400000 < base.getTime()) {
    date = new Date(Date.UTC(year + 1, month, Number(match[1]), 12));
  }
  return date.toISOString();
}

function splitVesselVoyage(value: string | undefined) {
  const text = value?.trim();
  if (!text) return { vesselName: null, voyageNumber: null };
  const parts = text.split(/\s+/);
  const voyageNumber = parts.pop() || null;
  return { vesselName: parts.join(" ") || null, voyageNumber };
}

function detailValue(text: string, label: string) {
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = text.match(new RegExp(`${escaped}:\\s*([^\\n]+)`, "i"));
  return match?.[1]?.trim() || null;
}

function parseService(value: string | null) {
  if (!value) return { serviceName: null, routeName: null };
  const [serviceName, ...rest] = value.split("-");
  return { serviceName: serviceName.trim() || null, routeName: rest.join("-").trim() || value };
}

function parseTransitPorts(text: string) {
  const match = text.match(/Transit via\s+([^\n]+)/i);
  return match?.[1] ? [match[1].trim()] : [];
}

async function parseCurrentDetail(page: import("playwright").Page, index: number, baseDate: string): Promise<CoscoSchedulePreview | null> {
  const text = await page.locator("body").innerText();
  const service = parseService(detailValue(text, "Service"));
  const vessel = splitVesselVoyage(detailValue(text, "Vessel Voyage") || undefined);
  const originText = detailValue(text, "POL") || "";
  const destinationText = detailValue(text, "Final Destination Hub") || detailValue(text, "POD") || "";
  const etd = toIsoDate(detailValue(text, "Estimated Departure") || undefined, baseDate);
  const eta = toIsoDate(detailValue(text, "Estimated Arrival") || undefined, baseDate);
  const transitDays = Number((detailValue(text, "Total Transit Time") || "").match(/\d+/)?.[0] || "");
  if (!originText || !destinationText || !etd || !eta) return null;
  const transitPorts = parseTransitPorts(text);
  return {
    id: `oocl-${index}-${originText}-${destinationText}-${etd}`,
    carrierName: "OOCL",
    serviceName: service.serviceName,
    routeName: service.routeName,
    vesselName: vessel.vesselName,
    voyageNumber: vessel.voyageNumber,
    originText,
    destinationText,
    originLocode: null,
    destinationLocode: null,
    etd,
    eta,
    transitDays: Number.isFinite(transitDays) ? transitDays : null,
    direct: transitPorts.length === 0,
    stopCount: transitPorts.length,
    transitPorts,
    cargoNature: detailValue(text, "Cargo Nature"),
    cutOffTime: toIsoDate(detailValue(text, "CY Cutoff") || undefined, baseDate),
    availableTime: null,
    originFacilityName: null,
    destinationFacilityName: null,
    outboundHaulage: detailValue(text, "Haulage"),
    inboundHaulage: null,
    rawText: text,
  };
}

async function detectHumanVerification(page: import("playwright").Page) {
  const visible = await page.locator("text=/captcha|verification|slide|puzzle|验证|滑块/i").count().catch(() => 0);
  const token = await page.locator("#form\\:csCaptchaToken").inputValue().catch(() => "");
  return visible > 0 && !token;
}

export const OOCLProvider: ShippingProvider<OoclProviderSearchInput, OoclProviderResult> = {
  code: "OOCL",
  async searchSchedule(input) {
    const started = Date.now();
    const warnings: string[] = [];
    const [origin, destination] = await Promise.all([
      toOoclPortValue(input.originPort),
      toOoclPortValue(input.destinationPort),
    ]);
    const mobileDate = formatMobileDate(input.departureDate);
    if (!origin || !destination || !mobileDate) {
      return { source: "OOCL_LIVE", schedules: [], warnings: ["OOCL query criteria is incomplete."], durationMs: Date.now() - started, fromCache: false };
    }

    const { chromium } = await import("playwright");
    const browser = await chromium.launch({ headless: process.env.COSCO_SCRAPER_HEADLESS !== "false" });
    try {
      const page = await browser.newPage({ viewport: { width: 430, height: 900 }, userAgent: MOBILE_UA });
      await page.goto(OOCL_MOBILE_URL, { waitUntil: "domcontentloaded", timeout: 60000 });
      await page.waitForTimeout(1500);
      if (await detectHumanVerification(page)) {
        return { source: "OOCL_LIVE", schedules: [], warnings: ["OOCL_CAPTCHA_REQUIRED"], durationMs: Date.now() - started, fromCache: false };
      }
      await page.locator("#form\\:origin_city").fill(origin);
      await page.locator("#form\\:dest_city").fill(destination);
      await page.locator("#form\\:sailingWeek").selectOption({ label: "4 Weeks" });
      await page.locator("#form\\:sailinglDate").fill(mobileDate);
      await page.locator("#form\\:goToOriginList").click();
      await page.waitForTimeout(2000);
      const originOption = page.getByText(new RegExp(`^${origin.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`, "i")).first();
      if (!(await originOption.count())) {
        return { source: "OOCL_LIVE", schedules: [], warnings: ["OOCL origin city option was not found."], durationMs: Date.now() - started, fromCache: false };
      }
      await originOption.click();
      await page.waitForTimeout(2000);
      const destinationOption = page.getByText(new RegExp(`^${destination.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`, "i")).first();
      if (!(await destinationOption.count())) {
        return { source: "OOCL_LIVE", schedules: [], warnings: ["OOCL destination city option was not found."], durationMs: Date.now() - started, fromCache: false };
      }
      await destinationOption.click();
      await page.waitForTimeout(3000);

      const detailIds = await page.locator("a").evaluateAll((links) => links
        .filter((link) => /Details/i.test(link.textContent || "") && link.id)
        .slice(0, 12)
        .map((link) => link.id));
      const schedules: CoscoSchedulePreview[] = [];
      for (const id of detailIds) {
        await page.locator(`#${id.replace(/:/g, "\\:")}`).click();
        await page.waitForTimeout(1500);
        const item = await parseCurrentDetail(page, schedules.length + 1, input.departureDate);
        if (item) schedules.push(item);
        const back = page.getByText("« Back").first();
        if (await back.count()) {
          await back.click();
          await page.waitForTimeout(1200);
        }
      }
      if (!schedules.length) warnings.push("OOCL official mobile page returned no parsed schedules.");
      return { source: "OOCL_LIVE", schedules, warnings, durationMs: Date.now() - started, fromCache: false };
    } catch (error) {
      const message = error instanceof Error ? error.message : "unknown error";
      return { source: "OOCL_LIVE", schedules: [], warnings: [`OOCL mobile schedule query failed: ${message}`], durationMs: Date.now() - started, fromCache: false };
    } finally {
      await browser.close();
    }
  },
};
