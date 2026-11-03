import type { Page } from "playwright";
import { launchPublicBrowser } from "@/features/shipping/providers/public-browser";
import { mapJsonPayloadsToCoscoSchedules } from "./cosco-schedule-mapper";
import type { CoscoScheduleCriteria, CoscoScrapeResult } from "../types";

const ENTRY = "https://elines.coscoshipping.com/ebusiness/sailingSchedule/searchByCity";

async function selectCity(page: Page, placeholder: RegExp, value: string, uuid?: string) {
  const keyword = value.split(",")[0].replace(/\s+Pt$/i, "");
  const input = page.getByPlaceholder(placeholder);
  const pending = page.waitForResponse(response => response.url().includes("/findCityDistrictByPrefix")
    && new URL(response.url()).searchParams.get("prefix")?.toLowerCase() === keyword.toLowerCase(), { timeout: 12000 });
  void pending.catch(() => undefined);
  await input.click();
  await input.fill("");
  await input.pressSequentially(keyword, { delay: 40 });
  const response = await pending;
  if (!response.ok()) throw new Error(`COSCO_ACCESS_BLOCKED: Edge city query HTTP ${response.status()}`);
  const json = await response.json();
  const options = json?.data?.content as Array<{ cityUuid?: string; districtUuid?: string | null; fullFormate?: string; unloCode?: string }> | undefined;
  // The same city UUID can also identify an industrial district. Select the city,
  // not every district sharing its UUID (e.g. Ningbo's Yangming facility).
  const matches = (options || []).filter(option => !option.districtUuid && (uuid ? option.cityUuid === uuid : option.unloCode === keyword || option.fullFormate?.split(",")[0].toLowerCase() === keyword.toLowerCase()));
  if (matches.length !== 1 || !matches[0].fullFormate) throw new Error(`COSCO_CITY_AMBIGUOUS: ${keyword}; official city selection was not unique`);
  await page.locator(".ivu-select-item").filter({ hasText: matches[0].fullFormate }).first().click();
}

export async function scrapeCoscoEdge(criteria: CoscoScheduleCriteria): Promise<CoscoScrapeResult> {
  const started = Date.now();
  const browser = await launchPublicBrowser({ channel: "msedge", lifetimeMs: 60000 });
  const deadline = setTimeout(() => { void browser.close().catch(() => undefined); }, 60000);
  try {
    const page = await browser.newPage();
    page.setDefaultTimeout(12000);
    const entryResponse = await page.goto(ENTRY, { waitUntil: "networkidle", timeout: 20000 }).catch(async (error: unknown) => {
      // One bounded retry for connection failures, never for HTTP rejection/challenges.
      if (!(error instanceof Error) || !/Timeout|ERR_CONNECTION|ERR_NETWORK/i.test(error.message)) throw error;
      return page.goto(ENTRY, { waitUntil: "networkidle", timeout: 15000 });
    });
    if (entryResponse && !entryResponse.ok()) throw new Error(`${entryResponse.status() === 429 ? "COSCO_RATE_LIMITED" : "COSCO_ACCESS_BLOCKED"}: Edge entry HTTP ${entryResponse.status()}`);
    // Cookie choices are mounted after the SPA's initial network-idle event.
    await page.getByText(/^(拒绝全部|Reject All)$/).first().waitFor({ state: "visible", timeout: 5000 }).catch(() => undefined);
    for (const name of ["拒绝全部", "Reject All"]) {
      for (const button of await page.getByText(name, { exact: true }).all()) if (await button.isVisible()) await button.click();
    }
    const language = page.getByText("English", { exact: true }).first();
    if (await language.isVisible()) await language.click();
    await selectCity(page, /^Origin City/i, criteria.origin, criteria.originCityUuid);
    await selectCity(page, /^Destination City/i, criteria.destination, criteria.destinationCityUuid);
    const date = page.getByPlaceholder("Earliest Departure Date", { exact: true });
    await date.fill(criteria.dateFrom.slice(0, 10));
    await date.press("Tab");
    // This official form defaults to four weeks. Never silently claim a larger window.
    if (criteria.dateTo && new Date(criteria.dateTo).getTime() - new Date(criteria.dateFrom).getTime() > 28 * 86400000) throw new Error("COSCO_EDGE_DATE_RANGE: public Edge fallback supports up to four weeks");
    const pending = page.waitForResponse(response => response.url().includes("/ebschedule/public/purpoShipmentWs"), { timeout: 20000 });
    void pending.catch(() => undefined);
    await page.getByRole("button", { name: "Search", exact: true }).last().click();
    const response = await pending;
    if (!response.ok()) throw new Error(`${response.status() === 429 ? "COSCO_RATE_LIMITED" : "COSCO_ACCESS_BLOCKED"}: Edge official schedule HTTP ${response.status()}`);
    const payload = await response.json();
    const schedules = mapJsonPayloadsToCoscoSchedules([payload], criteria.origin, criteria.destination);
    return {
      source: "COSCO_LIVE", targetUrl: ENTRY, finalUrl: page.url(), pageTitle: await page.title(), entryText: "Official Edge schedule form",
      openedNewPage: false, iframeUrls: [], queriedAt: new Date().toISOString(), criteria, schedules,
      warnings: schedules.length ? [] : ["COSCO_EDGE_RESPONSE_EMPTY: official response contained no parsed schedules"],
      debug: { controls: [], network: [{ url: response.url(), method: "POST", status: response.status(), resourceType: "xhr", contentType: response.headers()["content-type"] || null, postData: response.request().postData() }], jsonEndpoints: [response.url()], jsonPayloadCount: 1 },
      durationMs: Date.now() - started, fromCache: false,
    };
  } finally { clearTimeout(deadline); await browser.close(); }
}
