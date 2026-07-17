import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { chromium, type BrowserContext, type Page, type Response } from "playwright";
import { mapDomRowsToCoscoSchedules, mapJsonPayloadsToCoscoSchedules } from "@/features/cosco-scraper/server/cosco-schedule-mapper";
import type { CoscoDetectedControl, CoscoNetworkProbe, CoscoScheduleCriteria, CoscoScrapeResult, CoscoScraperErrorCode } from "@/features/cosco-scraper/types";

const homeUrl = "https://elines.coscoshipping.com/ebusiness/";

type Step = "open homepage" | "locate schedule entry" | "open schedule page" | "select origin" | "select destination" | "set date" | "submit search" | "wait for results" | "parse results";

export class CoscoScraperError extends Error {
  constructor(public readonly code: CoscoScraperErrorCode, message: string, public readonly status = 400, public readonly step?: string) {
    super(message);
  }
}

function timeoutMs() {
  const value = Number(process.env.COSCO_SCRAPER_TIMEOUT_MS ?? "60000");
  return Number.isFinite(value) && value > 0 ? value : 60000;
}

function isHeadless() {
  return process.env.COSCO_SCRAPER_HEADLESS !== "false";
}

function log(step: string) {
  console.info(`[COSCO] ${step}`);
}

function fail(step: Step, code: CoscoScraperErrorCode, message: string, status = 400): never {
  console.warn(`[COSCO] failed at: ${step}`);
  throw new CoscoScraperError(code, message, status, step);
}

function networkProbe(response: Response): CoscoNetworkProbe {
  return { url: response.url(), method: response.request().method(), status: response.status(), resourceType: response.request().resourceType(), contentType: response.headers()["content-type"] ?? null };
}

async function detectBlocked(page: Page, network: CoscoNetworkProbe[], step: Step) {
  if (network.some((item) => item.status === 429)) fail(step, "COSCO_RATE_LIMITED", "COSCO returned 429 rate limit.", 429);
  if (network.some((item) => item.status === 403)) fail(step, "COSCO_AUTOMATION_BLOCKED", "COSCO returned 403 access restriction.", 403);
  const bodyText = (await page.locator("body").innerText({ timeout: 3000 }).catch(() => "")).toLowerCase();
  if (/captcha|verification code|verify you are human|人机|验证码|滑块/.test(bodyText)) fail(step, "COSCO_CAPTCHA_REQUIRED", "COSCO requires captcha or human verification.", 409);
  if (/please login|sign in required|登录后/.test(bodyText)) fail(step, "COSCO_LOGIN_REQUIRED", "COSCO requires login before schedule search.", 401);
  if (/access denied|forbidden|blocked/.test(bodyText)) fail(step, "COSCO_AUTOMATION_BLOCKED", "COSCO access was blocked.", 403);
}

async function detectControls(page: Page): Promise<CoscoDetectedControl[]> {
  return page.locator("input,button,select,[role=combobox],iframe").evaluateAll((nodes) => nodes.slice(0, 100).map((node, index) => {
    const element = node as HTMLInputElement | HTMLButtonElement | HTMLSelectElement;
    const rect = element.getBoundingClientRect();
    const visible = Boolean(rect.width && rect.height);
    const text = element.textContent?.replace(/\s+/g, " ").trim() || "";
    const placeholder = "placeholder" in element ? element.placeholder || undefined : undefined;
    const selector = placeholder ? `${element.tagName.toLowerCase()}[placeholder="${placeholder.replace(/"/g, "\\\"")}"]` : `${element.tagName.toLowerCase()}:nth-of-type(${index + 1})`;
    return { name: text || placeholder || `${element.tagName.toLowerCase()}-${index}`, selector, placeholder, visible };
  }));
}

async function dismissPublicModals(page: Page) {
  const names = [/^OK$/i, /Allow All/i, /Reject All/i, /^Confirm$/i, /^Accept$/i];
  for (let round = 0; round < 4; round += 1) {
    let clicked = false;
    for (const name of names) {
      const roleButton = page.getByRole("button", { name }).first();
      if (await roleButton.isVisible({ timeout: 1000 }).catch(() => false)) {
        await roleButton.click({ timeout: 3000 }).catch(() => undefined);
        clicked = true;
        await page.waitForTimeout(600).catch(() => undefined);
        continue;
      }
      const textButton = page.locator("button, .ivu-btn, [role=button]").filter({ hasText: name }).first();
      if (await textButton.isVisible({ timeout: 1000 }).catch(() => false)) {
        await textButton.click({ timeout: 3000 }).catch(() => undefined);
        clicked = true;
        await page.waitForTimeout(600).catch(() => undefined);
      }
    }
    if (!clicked) break;
  }
}

async function findScheduleEntry(page: Page) {
  const candidates = [
    page.getByRole("link", { name: /Sailing Schedules?/i }).first(),
    page.getByText(/Sailing Schedules?/i).first(),
    page.getByRole("link", { name: /^Schedule$/i }).first(),
    page.getByText(/^Schedule$/i).first(),
    page.getByText(/Find Schedule by City Pairs/i).first(),
    page.getByText(/Search by City/i).first(),
    page.getByText(/船期|船期查询/).first(),
  ];
  for (const locator of candidates) {
    if (await locator.isVisible({ timeout: 1500 }).catch(() => false)) return locator;
  }
  return null;
}

async function openScheduleFromHome(context: BrowserContext, page: Page, network: CoscoNetworkProbe[]) {
  log("open homepage");
  await page.goto(homeUrl, { waitUntil: "domcontentloaded", timeout: timeoutMs() });
  await page.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => undefined);
  await dismissPublicModals(page);
  await detectBlocked(page, network, "open homepage");

  log("locate schedule entry");
  const entry = await findScheduleEntry(page);
  if (!entry) fail("locate schedule entry", "COSCO_SELECTOR_NOT_FOUND", "Sailing Schedule entry was not found on COSCO homepage.", 502);
  const entryText = (await entry.innerText().catch(() => "Sailing Schedule")).replace(/\s+/g, " ").trim();
  const popupPromise = page.waitForEvent("popup", { timeout: 5000 }).catch(() => null);
  await entry.click({ timeout: 10000 });
  const popup = await popupPromise;
  const schedulePage = popup ?? page;
  if (popup) await popup.waitForLoadState("domcontentloaded", { timeout: timeoutMs() }).catch(() => undefined);
  await schedulePage.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => undefined);
  await dismissPublicModals(schedulePage);

  log("open schedule page");
  const originInput = schedulePage.getByPlaceholder(/^Origin City/i).first();
  if (!(await originInput.isVisible({ timeout: 12000 }).catch(() => false))) fail("open schedule page", "COSCO_SELECTOR_NOT_FOUND", "Origin City input was not found after opening COSCO schedule entry.", 502);
  return { page: schedulePage, entryText, openedNewPage: Boolean(popup), frames: context.pages().flatMap((item) => item.frames().map((frame) => frame.url()).filter(Boolean)) };
}

async function chooseCity(page: Page, placeholder: RegExp, value: string, step: Step) {
  const input = page.getByPlaceholder(placeholder).first();
  if (!(await input.isVisible({ timeout: 10000 }).catch(() => false))) fail(step, "COSCO_SELECTOR_NOT_FOUND", `${placeholder} input was not found.`, 502);
  await input.click();
  await input.fill("");
  const waitCity = page.waitForResponse((response) => /findCityDistrictByPrefix/i.test(response.url()), { timeout: 10000 }).catch(() => null);
  await input.type(value, { delay: isHeadless() ? 20 : 120 });
  await waitCity;
  await page.waitForTimeout(900);
  const firstWord = value.split(/[,(\s]/)[0] || value;
  const options = page.locator(".ivu-select-dropdown:not([style*='display: none']) .ivu-select-item, .ivu-select-item").filter({ hasText: new RegExp(firstWord, "i") });
  const preferred = options.filter({ hasText: /China|United States|Shanghai|Los Angeles|CNSHA|USLAX/i }).first();
  const option = await preferred.isVisible({ timeout: 3500 }).catch(() => false) ? preferred : options.first();
  if (await option.isVisible({ timeout: 3500 }).catch(() => false)) {
    await option.click();
    await page.waitForTimeout(600);
    return;
  }
  await input.press("Enter").catch(() => undefined);
  await page.waitForTimeout(600);
  const selectedValue = await input.inputValue().catch(() => "");
  if (!selectedValue) fail(step, "COSCO_SELECTOR_NOT_FOUND", `COSCO city autocomplete did not confirm ${value}.`, 502);
}

async function setDepartureDate(page: Page, dateFrom: string) {
  const dateInput = page.getByPlaceholder(/Earliest Departure Date/i).first();
  if (!(await dateInput.isVisible({ timeout: 5000 }).catch(() => false))) return;
  await dateInput.click();
  const plainInput = await dateInput.evaluate((node) => node instanceof HTMLInputElement && !node.readOnly).catch(() => false);
  if (plainInput) {
    await dateInput.fill(dateFrom);
    await dateInput.press("Enter").catch(() => undefined);
    return;
  }
  await dateInput.fill(dateFrom).catch(async () => {
    await page.keyboard.type(dateFrom);
    await page.keyboard.press("Enter").catch(() => undefined);
  });
}

async function extractRows(page: Page) {
  return page.locator("table tbody tr, .ivu-table-row, .schedule-list *, .result-list *, .ivu-card, .sailingSchedule *").evaluateAll((nodes) => {
    const values = nodes.map((node) => node.textContent?.replace(/\s+/g, " ").trim() ?? "");
    return Array.from(new Set(values)).filter((item) => item.length > 20);
  }).catch(() => [] as string[]);
}

export async function scrapeCoscoSchedules(criteria: CoscoScheduleCriteria): Promise<CoscoScrapeResult> {
  const started = Date.now();
  const network: CoscoNetworkProbe[] = [];
  const jsonEndpoints = new Set<string>();
  const jsonPayloads: unknown[] = [];
  const headless = isHeadless();
  const browser = await chromium.launch({ headless, slowMo: headless ? 0 : 300, timeout: timeoutMs() });
  const context = await browser.newContext({ locale: "en-US", userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36 OceanScopeCoscoLive/1.0" });
  const page = await context.newPage();
  page.setDefaultTimeout(timeoutMs());
  page.on("response", async (response) => {
    const probe = networkProbe(response);
    if (probe.resourceType === "xhr" || probe.resourceType === "fetch") network.push(probe);
    if (probe.contentType?.includes("json")) {
      jsonEndpoints.add(probe.url);
      if (/schedule|sailing|city/i.test(probe.url)) {
        const payload = await response.json().catch(() => null);
        if (payload) jsonPayloads.push(payload);
      }
    }
  });

  try {
    const opened = await openScheduleFromHome(context, page, network);
    const schedulePage = opened.page;
    const controlsBefore = await detectControls(schedulePage);
    await detectBlocked(schedulePage, network, "open schedule page");

    log("select origin");
    await chooseCity(schedulePage, /^Origin City/i, criteria.origin, "select origin");
    log("select destination");
    await chooseCity(schedulePage, /^Destination City/i, criteria.destination, "select destination");
    log("set date");
    await setDepartureDate(schedulePage, criteria.dateFrom);

    log("submit search");
    const beforeNetworkLength = network.length;
    const searchButton = schedulePage.locator(".sailing-search-by-city-form button.search-btn, button.search-btn").first();
    if (!(await searchButton.isVisible({ timeout: 5000 }).catch(() => false))) fail("submit search", "COSCO_SELECTOR_NOT_FOUND", "Search button was not found.", 502);
    await searchButton.click({ force: true });

    log("wait for results");
    await schedulePage.waitForLoadState("networkidle", { timeout: timeoutMs() }).catch(() => undefined);
    await schedulePage.waitForTimeout(3500);
    await detectBlocked(schedulePage, network, "wait for results");

    log("parse results");
    const rows = await extractRows(schedulePage);
    const jsonSchedules = mapJsonPayloadsToCoscoSchedules(jsonPayloads, criteria.origin, criteria.destination);
    const schedules = jsonSchedules.length ? jsonSchedules : mapDomRowsToCoscoSchedules(rows, criteria.origin, criteria.destination);
    const warnings: string[] = [];
    if (network.length === beforeNetworkLength) warnings.push("No new XHR/fetch request was observed after COSCO Search click.");
    if (schedules.length === 0) warnings.push("COSCO live query completed, but no stable schedule rows were parsed. No seed or mock data was returned.");

    let screenshotPath: string | undefined;
    if (criteria.debug) {
      const debugDir = path.join(process.cwd(), "tmp", "cosco-debug");
      await mkdir(debugDir, { recursive: true });
      const stamp = Date.now();
      screenshotPath = path.join(debugDir, `live-preview-${stamp}.png`);
      await schedulePage.screenshot({ path: screenshotPath, fullPage: true }).catch(() => undefined);
      await writeFile(path.join(debugDir, `live-preview-${stamp}.html`), await schedulePage.content(), "utf8").catch(() => undefined);
      await writeFile(path.join(debugDir, `live-preview-${stamp}.txt`), rows.join("\n---\n"), "utf8").catch(() => undefined);
      await writeFile(path.join(debugDir, `live-preview-${stamp}.json`), JSON.stringify(jsonPayloads, null, 2), "utf8").catch(() => undefined);
    }

    return {
      source: "COSCO_LIVE",
      targetUrl: homeUrl,
      finalUrl: schedulePage.url(),
      pageTitle: await schedulePage.title().catch(() => ""),
      entryText: opened.entryText,
      openedNewPage: opened.openedNewPage,
      iframeUrls: opened.frames.filter((url) => url !== homeUrl),
      queriedAt: new Date().toISOString(),
      criteria,
      schedules,
      warnings,
      debug: { controls: controlsBefore, network: network.slice(-60), jsonEndpoints: Array.from(jsonEndpoints), screenshotPath, jsonPayloadCount: jsonPayloads.length },
      durationMs: Date.now() - started,
      fromCache: false,
    };
  } catch (error) {
    if (!headless) await page.waitForTimeout(7000).catch(() => undefined);
    if (error instanceof CoscoScraperError) throw error;
    const message = error instanceof Error ? error.message : "Unknown COSCO scraper error";
    if (/timeout/i.test(message)) throw new CoscoScraperError("COSCO_TIMEOUT", message, 504);
    throw new CoscoScraperError("COSCO_UNKNOWN_ERROR", message, 500);
  } finally {
    await context.close().catch(() => undefined);
    await browser.close().catch(() => undefined);
  }
}




