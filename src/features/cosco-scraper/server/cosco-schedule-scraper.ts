import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { chromium, type Browser, type BrowserContext, type Page, type Response } from "playwright";
import { mapDomRowsToCoscoSchedules, mapJsonPayloadsToCoscoSchedules } from "@/features/cosco-scraper/server/cosco-schedule-mapper";
import type { CoscoDetectedControl, CoscoNetworkProbe, CoscoScheduleCriteria, CoscoScrapeResult, CoscoScraperErrorCode } from "@/features/cosco-scraper/types";

const homeUrl = "https://elines.coscoshipping.com/ebusiness/";
const scheduleUrl = "https://elines.coscoshipping.com/ebusiness/sailingSchedule";

type Step = "open schedule page" | "select origin" | "select destination" | "set date" | "submit search" | "wait for results" | "parse results";

export class CoscoScraperError extends Error {
  constructor(public readonly code: CoscoScraperErrorCode, message: string, public readonly status = 400, public readonly step?: string) {
    super(message);
  }
}

// ========== 优化1：浏览器全局复用，不每次启动 ==========
let sharedBrowser: Browser | null = null;
let sharedBrowserPromise: Promise<Browser> | null = null;

async function getBrowser(): Promise<Browser> {
  if (sharedBrowser) return sharedBrowser;
  if (sharedBrowserPromise) return sharedBrowserPromise;

  sharedBrowserPromise = (async () => {
    const headless = isHeadless();
    const browser = await chromium.launch({
      headless,
      slowMo: headless ? 0 : 200,
      timeout: timeoutMs(),
    });
    sharedBrowser = browser;
    sharedBrowserPromise = null;

    // 浏览器崩溃时自动清理
    browser.on("disconnected", () => {
      sharedBrowser = null;
    });

    return browser;
  })();

  return sharedBrowserPromise;
}

function timeoutMs() {
  const value = Number(process.env.COSCO_SCRAPER_TIMEOUT_MS ?? "60000");
  return Number.isFinite(value) && value > 0 ? value : 60000;
}

function isHeadless() {
  return true;
}

function log(step: string) {
  console.info(`[COSCO] ${step}`);
}

function fail(step: Step, code: CoscoScraperErrorCode, message: string, status = 400): never {
  console.warn(`[COSCO] failed at: ${step}`);
  throw new CoscoScraperError(code, message, status, step);
}

function networkProbe(response: Response): CoscoNetworkProbe {
  return { url: response.url(), method: response.request().method(), status: response.status(), resourceType: response.request().resourceType(), contentType: response.headers()["content-type"] ?? null, postData: response.request().postData() };
}

// ========== 反爬检测：完全保留，遇到封禁直接停，不硬刚 ==========
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
  for (let round = 0; round < 3; round += 1) {
    let clicked = false;
    for (const name of names) {
      const roleButton = page.getByRole("button", { name }).first();
      if (await roleButton.isVisible({ timeout: 800 }).catch(() => false)) {
        await roleButton.click({ timeout: 2000 }).catch(() => undefined);
        clicked = true;
        continue;
      }
      const textButton = page.locator("button, .ivu-btn, [role=button]").filter({ hasText: name }).first();
      if (await textButton.isVisible({ timeout: 800 }).catch(() => false)) {
        await textButton.click({ timeout: 2000 }).catch(() => undefined);
        clicked = true;
      }
    }
    if (!clicked) break;
  }
}

// ========== 优化2：从首页导航到船期页（更稳定，避免直接跳转缺 session） ==========
async function openSchedulePage(page: Page, network: CoscoNetworkProbe[]) {
  log("open home page");
  await page.goto(homeUrl, { waitUntil: "domcontentloaded", timeout: timeoutMs() });
  await page.waitForLoadState("networkidle", { timeout: 5000 }).catch(() => undefined);
  await dismissPublicModals(page);
  await detectBlocked(page, network, "open schedule page");

  log("navigate to sailing schedule");
  // 点击导航进入船期页，建立完整 session
  const scheduleLink = page.getByRole("link", { name: /sailing schedule/i }).first();
  if (await scheduleLink.isVisible({ timeout: 5000 }).catch(() => false)) {
    await Promise.all([
      page.waitForNavigation({ waitUntil: "domcontentloaded", timeout: 15000 }).catch(() => undefined),
      scheduleLink.click(),
    ]);
  } else {
    // fallback：直接跳转
    await page.goto(scheduleUrl, { waitUntil: "domcontentloaded", timeout: timeoutMs() });
  }
  await page.waitForLoadState("networkidle", { timeout: 5000 }).catch(() => undefined);
  await dismissPublicModals(page);
  await detectBlocked(page, network, "open schedule page");

  const originInput = page.getByPlaceholder(/^Origin City/i).first();
  if (!(await originInput.isVisible({ timeout: 10000 }).catch(() => false))) {
    fail("open schedule page", "COSCO_SELECTOR_NOT_FOUND", "Origin City input was not found on COSCO schedule page.", 502);
  }
}

async function chooseCity(page: Page, placeholder: RegExp, value: string, step: Step) {
  await page.keyboard.press("Escape").catch(() => undefined);
  await page.mouse.click(20, 20).catch(() => undefined);
  const input = page.getByPlaceholder(placeholder).first();
  if (!(await input.isVisible({ timeout: 8000 }).catch(() => false))) fail(step, "COSCO_SELECTOR_NOT_FOUND", `${placeholder} input was not found.`, 502);
  await input.click({ force: true, timeout: 5000 });
  await input.fill("", { timeout: 5000 });
  // 等待城市搜索接口返回，事件驱动而非硬等待
  const waitCity = page.waitForResponse((response) => /findCityDistrictByPrefix/i.test(response.url()), { timeout: 10000 }).catch(() => null);
  await input.type(value, { delay: isHeadless() ? 15 : 100 });
  await waitCity;

  const firstWord = value.split(/[,(\s]/)[0] || value;
  const options = page.locator(".ivu-select-dropdown:not([style*='display: none']) .ivu-select-item, .ivu-select-item").filter({ hasText: new RegExp(firstWord, "i") });
  const preferred = options.filter({ hasText: /China|United States|Shanghai|Los Angeles|CNSHA|USLAX/i }).first();
  const option = await preferred.isVisible({ timeout: 3000 }).catch(() => false) ? preferred : options.first();
  if (await option.isVisible({ timeout: 3000 }).catch(() => false)) {
    await option.click({ force: true, timeout: 5000 });
    await page.keyboard.press("Escape").catch(() => undefined);
    await page.waitForTimeout(150).catch(() => undefined);
    return;
  }
  await input.press("Enter").catch(() => undefined);
  const selectedValue = await input.inputValue().catch(() => "");
  if (!selectedValue) fail(step, "COSCO_SELECTOR_NOT_FOUND", `COSCO city autocomplete did not confirm ${value}.`, 502);
}

async function setDepartureDate(page: Page, dateFrom: string) {
  const dateInput = page.getByPlaceholder(/Earliest Departure Date/i).first();
  if (!(await dateInput.isVisible({ timeout: 4000 }).catch(() => false))) return;
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

async function clickScheduleSearchButton(page: Page) {
  const selectors = [
    ".sailing-search-by-city-form button.search-btn",
    ".sailing-search-by-city-form button",
    "button.search-btn",
  ];
  for (const selector of selectors) {
    const button = page.locator(selector).filter({ hasText: /^Search$/i }).first();
    if (await button.isVisible({ timeout: 1200 }).catch(() => false)) {
      await button.click({ force: true });
      return true;
    }
  }

  const clicked = await page.evaluate(() => {
    const isVisible = (element: Element) => {
      const rect = element.getBoundingClientRect();
      const style = window.getComputedStyle(element);
      return rect.width > 0 && rect.height > 0 && style.display !== "none" && style.visibility !== "hidden";
    };
    const candidates = Array.from(document.querySelectorAll("button, [role='button'], .ivu-btn"))
      .filter((element) => /^Search$/i.test((element.textContent ?? "").replace(/\s+/g, " ").trim()))
      .filter(isVisible)
      .map((element) => ({ element, rect: element.getBoundingClientRect() }))
      .filter((item) => item.rect.top > 120)
      .sort((a, b) => a.rect.top - b.rect.top);
    const target = candidates[0]?.element as HTMLElement | undefined;
    target?.click();
    return Boolean(target);
  }).catch(() => false);

  return clicked;
}

// ========== 优化3：更激进的资源拦截 ==========
function setupRouteBlocking(context: BrowserContext) {
  // 只拦图片、字体、媒体和第三方统计脚本，不拦 CSS（避免影响页面渲染）
  const blockedTypes = new Set(["image", "font", "media"]);
  const blockedPatterns = [
    /googleanalytics/i,
    /googletagmanager/i,
    /hotjar/i,
    /baidu.*tongji/i,
    /umami/i,
    /clarity/i,
    /gtag/i,
  ];

  context.route("**/*", async (route) => {
    const type = route.request().resourceType();
    if (blockedTypes.has(type)) {
      await route.abort().catch(() => undefined);
      return;
    }
    const url = route.request().url();
    if (blockedPatterns.some((p) => p.test(url))) {
      await route.abort().catch(() => undefined);
      return;
    }
    await route.continue().catch(() => undefined);
  });
}

export async function scrapeCoscoSchedules(criteria: CoscoScheduleCriteria): Promise<CoscoScrapeResult> {
  const started = Date.now();
  const network: CoscoNetworkProbe[] = [];
  const jsonEndpoints = new Set<string>();
  const jsonPayloads: unknown[] = [];
  const headless = isHeadless();

  // 复用全局浏览器，只新建 context + page
  const browser = await getBrowser();
  const context = await browser.newContext({
    locale: "en-US",
    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36 OceanScopeCoscoLive/1.0",
  });
  setupRouteBlocking(context);

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
    await openSchedulePage(page, network);
    const controlsBefore = await detectControls(page);

    log("select origin");
    await chooseCity(page, /^Origin City/i, criteria.origin, "select origin");
    log("select destination");
    await chooseCity(page, /^Destination City/i, criteria.destination, "select destination");
    log("set date");
    await setDepartureDate(page, criteria.dateFrom);

    log("submit search");
    const beforeNetworkLength = network.length;
    const scheduleResponsePromise = page.waitForResponse(
      (response) => /purpoShipmentWs/i.test(response.url()),
      { timeout: Math.min(timeoutMs(), 30000) }
    ).catch(() => null);
    if (!(await clickScheduleSearchButton(page))) fail("submit search", "COSCO_SELECTOR_NOT_FOUND", "Search button was not found.", 502);

    log("wait for results");
    const scheduleResponse = await scheduleResponsePromise;
    if (scheduleResponse) {
      const payload = await scheduleResponse.json().catch(() => null);
      if (payload) jsonPayloads.push(payload);
    } else {
      // 没有直接抓到船期接口的话，等网络空闲，去掉1200ms硬等待
      await page.waitForLoadState("networkidle", { timeout: Math.min(timeoutMs(), 10000) }).catch(() => undefined);
    }
    await detectBlocked(page, network, "wait for results");

    log("parse results");
    const rows = await extractRows(page);
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
      await page.screenshot({ path: screenshotPath, fullPage: true }).catch(() => undefined);
      await writeFile(path.join(debugDir, `live-preview-${stamp}.html`), await page.content(), "utf8").catch(() => undefined);
      await writeFile(path.join(debugDir, `live-preview-${stamp}.txt`), rows.join("\n---\n"), "utf8").catch(() => undefined);
      await writeFile(path.join(debugDir, `live-preview-${stamp}.json`), JSON.stringify(jsonPayloads, null, 2), "utf8").catch(() => undefined);
    }

    return {
      source: "COSCO_LIVE",
      targetUrl: scheduleUrl,
      finalUrl: page.url(),
      pageTitle: await page.title().catch(() => ""),
      entryText: "Sailing Schedule",
      openedNewPage: false,
      iframeUrls: page.frames().map((f) => f.url()).filter((u) => u && u !== scheduleUrl),
      queriedAt: new Date().toISOString(),
      criteria,
      schedules,
      warnings,
      debug: { controls: controlsBefore, network: network.slice(-60), jsonEndpoints: Array.from(jsonEndpoints), screenshotPath, jsonPayloadCount: jsonPayloads.length },
      durationMs: Date.now() - started,
      fromCache: false,
    };
  } catch (error) {
    if (!headless) await page.waitForTimeout(5000).catch(() => undefined);
    if (error instanceof CoscoScraperError) throw error;
    const message = error instanceof Error ? error.message : "Unknown COSCO scraper error";
    if (/timeout/i.test(message)) throw new CoscoScraperError("COSCO_TIMEOUT", message, 504);
    throw new CoscoScraperError("COSCO_UNKNOWN_ERROR", message, 500);
  } finally {
    // 只关闭 context，不关闭 browser（browser 全局复用）
    await context.close().catch(() => undefined);
  }
}
