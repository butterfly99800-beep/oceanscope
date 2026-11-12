import { queryServiceLoops } from "./loop-schedules";
import type { Port } from "@prisma/client";
import { getCarrierPortMapping } from "@/features/ports/server/port-normalizer";
import type { CoscoSchedulePreview } from "@/features/cosco-scraper/types";
import { launchPublicBrowser } from "@/features/shipping/providers/public-browser";
import type { ShippingProvider } from "@/features/shipping/providers/types";
import { canonicalPortCode, matchesSourcePort, officialPortName } from "@/features/ports/server/source-port-match";
import { queryOoclHttp, MOBILE_UA, OOCL_MOBILE_URL, ooclCitySelector } from "./http";

type OoclProviderPort = Pick<Port, "name" | "locode"> & { id?: string };

export type OoclProviderSearchInput = {
  originPort: OoclProviderPort;
  destinationPort: OoclProviderPort;
  departureDate: string;
  dateTo?: string;
  timeBudgetMs?: number;
};

export type OoclProviderResult = {
  source: "OOCL_LIVE";
  schedules: CoscoSchedulePreview[];
  warnings: string[];
  durationMs: number;
  fromCache: boolean;
};

const months: Record<string, number> = { Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5, Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11 };


async function toOoclPortValue(port: OoclProviderPort) {
  const search = port.id ? await getCarrierPortMapping("OOCL", port.id, "SEARCH_NAME") : null;
  const keyword = search?.mappingValue || officialPortName(port) || port.locode;
  return keyword.split(",")[0].trim();
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
  const match = text.match(new RegExp(`${escaped}:[ \\t]*([^\\n]*)`, "i"));
  return match?.[1]?.trim() || null;
}

function parseService(value: string | null) {
  if (!value) return { serviceName: null, routeName: null };
  const [serviceName, ...rest] = value.split("-");
  return { serviceName: serviceName.trim() || null, routeName: rest.join("-").trim() || value };
}

function parseTransitPorts(text: string) {
  const match = text.match(/Transit via\s+([^\n]+)/i);
  if(match?.[1])return [match[1].trim()];
  const blocks=text.split(/(?=Service:)/).filter(block=>/POL:/.test(block)&&/POD:/.test(block));
  return blocks.slice(0,-1).flatMap((block,i)=>{const pod=detailValue(block,"POD");const next=detailValue(blocks[i+1],"POL");return pod&&next&&pod.toLowerCase()===next.toLowerCase()?[pod]:[];});
}

function parseDetailText(text: string, index: number, baseDate: string, input: OoclProviderSearchInput): CoscoSchedulePreview | null {
  const service = parseService(detailValue(text, "Service"));
  const vessel = splitVesselVoyage(detailValue(text, "Vessel Voyage") || undefined);
  const originText = detailValue(text, "POL") || "";
  const destinationText = detailValue(text, "Final Destination Hub") || detailValue(text, "POD") || "";
  const etd = toIsoDate(detailValue(text, "Estimated Departure") || undefined, baseDate);
  const finalHubSection = text.includes("Final Destination Hub:") ? text.slice(text.indexOf("Final Destination Hub:")) : text;
  const eta = toIsoDate(detailValue(finalHubSection, "Estimated Arrival") || undefined, baseDate);
  const transitDaysText = (detailValue(text, "Total Transit Time") || "").match(/\d+/)?.[0];
  const transitDays = transitDaysText ? Number(transitDaysText) : null;
  if (!originText || !destinationText || !etd || !eta) return null;
  if(etd.slice(0,10)<input.departureDate.slice(0,10) || (input.dateTo && etd.slice(0,10)>input.dateTo.slice(0,10)))return null;
  const requested = detailValue(text, "Origin");
  const port = { ...input.originPort, nameZh: null };
  const alternateLoading = requested && !matchesSourcePort(originText, port) && matchesSourcePort(requested, port)
    && matchesSourcePort(destinationText, { ...input.destinationPort, nameZh: null }) && vessel.vesselName && vessel.voyageNumber
    && etd.slice(0, 10) >= input.departureDate.slice(0, 10) && (!input.dateTo || etd.slice(0, 10) <= input.dateTo.slice(0, 10))
    ? { id: `oocl-alt-${index}-${etd}`, origin: requested, loadingPort: originText, departure: etd, vessel: vessel.vesselName,
        voyage: vessel.voyageNumber, destination: destinationText, arrival: eta } : undefined;
  const transitPorts = parseTransitPorts(text);
  return {
    id: `oocl-${index}-${originText}-${destinationText}-${etd}`,
    alternateLoading,
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
    etdTimeKnown: false,
    etaTimeKnown: false,
    transitDays: transitDays !== null && Number.isFinite(transitDays) ? transitDays : null,
    direct: transitPorts.length ? false : null,
    stopCount: null,
    transitPorts,
    cargoNature: detailValue(text, "Cargo Nature"),
    // The mobile page supplies only a day, not a reliable cutoff time.
    cutOffTime: null,
    availableTime: null,
    originFacilityName: null,
    destinationFacilityName: null,
    outboundHaulage: detailValue(text, "Haulage"),
    inboundHaulage: null,
    rawText: text,
  };
}

async function detectHumanVerification(page: import("playwright").Page) {
  const candidates = page.locator("text=/captcha|verification|slide|puzzle|验证|滑块/i");
  let visible = false;
  for (const candidate of await candidates.all()) {
    if (await candidate.isVisible()) { visible = true; break; }
  }
  const token = await page.locator("#form\\:csCaptchaToken").evaluateAll((inputs) => (inputs[0] as HTMLInputElement | undefined)?.value || "");
  return visible && !token;
}

const OOCLSingleAttempt: ShippingProvider<OoclProviderSearchInput, OoclProviderResult> = {
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

    const browser = await launchPublicBrowser({ channel: "msedge", lifetimeMs: 175000 });
    const schedules: CoscoSchedulePreview[] = [];
    let timedOut = false;
    const budget = Math.min(170000, input.timeBudgetMs ?? 170000);
    const deadline = setTimeout(() => { timedOut = true; void browser.close().catch(() => undefined); }, Math.max(1000, budget - (Date.now() - started)));
    try {
      const page = await browser.newPage({ viewport: { width: 430, height: 900 }, userAgent: MOBILE_UA });
      page.setDefaultTimeout(12000);
      const entryResponse = await page.goto(OOCL_MOBILE_URL, { waitUntil: "commit", timeout: 30000 }).catch(async (error: unknown) => {
        if (!(error instanceof Error) || !/Timeout|ERR_CONNECTION|ERR_NETWORK/i.test(error.message)) throw error;
        return page.goto(OOCL_MOBILE_URL, { waitUntil: "commit", timeout: 30000 });
      });
      if (entryResponse && !entryResponse.ok()) {
        return { source: "OOCL_LIVE", schedules: [], warnings: [`OOCL_PUBLIC_PAGE_FAILED: official mobile entry HTTP ${entryResponse.status()}`], durationMs: Date.now() - started, fromCache: false };
      }
      await page.locator("body").waitFor({state:"attached",timeout:20000});
      if (/\[QF17\]/i.test(await page.locator("body").innerText())) throw new Error("OOCL_AUTH_REQUIRED: QF17");
      if (await detectHumanVerification(page)) {
        return { source: "OOCL_LIVE", schedules: [], warnings: ["OOCL_CAPTCHA_REQUIRED"], durationMs: Date.now() - started, fromCache: false };
      }
      await page.locator("#form\\:origin_city").fill(origin);
      await page.locator("#form\\:dest_city").fill(destination);
      await page.locator("#form\\:sailingWeek").selectOption({ label: "4 Weeks" });
      await page.locator("#form\\:sailinglDate").fill(mobileDate);
      // Let the mobile JSF handlers finish initialization before submitting.
      await page.waitForLoadState("networkidle", { timeout: 5000 }).catch(() => undefined);
      const originOption = page.locator(ooclCitySelector("Origin", canonicalPortCode(input.originPort.locode))).first();
      const destinationOption = page.locator(ooclCitySelector("Destination", canonicalPortCode(input.destinationPort.locode))).first();
      const details = page.locator("a:visible").filter({ hasText: /^\s*Details\s*$/i }).first();
      const empty = page.getByText(/no\s+results?\s+(?:(?:were|was|are)\s+)?found/i).first();
      const navigate = async (control: import("playwright").Locator) => {
        await Promise.all([page.waitForNavigation({ waitUntil: "commit", timeout: 30000 }), control.click()]);
      };
      await navigate(page.locator("#form\\:goToOriginList"));
      for (let transition = 0; transition < 3; transition++) {
        if (await detectHumanVerification(page)) throw new Error("OOCL_CAPTCHA_REQUIRED");
        await Promise.any([originOption, destinationOption, details, empty].map(option => option.waitFor({ state: "visible", timeout: 12000 })));
        if (await empty.isVisible()) throw new Error("NO_SCHEDULE_FOUND");
        if (await details.isVisible()) break;
        if (await originOption.isVisible()) await navigate(originOption);
        else if (await destinationOption.isVisible()) await navigate(destinationOption);
      }
      await details.waitFor({ state: "visible", timeout: 10000 });
      await page.waitForLoadState("networkidle", { timeout: 5000 }).catch(() => undefined);
      // The result view publishes its hidden JSF state after the visible links.
      await page.waitForTimeout(1500);
      const fields = await page.locator("form#form").evaluate(form => Object.fromEntries(
        Array.from(new FormData(form as HTMLFormElement).entries()).filter((entry): entry is [string, string] => typeof entry[1] === "string")));
      const result = await queryOoclHttp({
        origin, destination, originCode: canonicalPortCode(input.originPort.locode),
        destinationCode: canonicalPortCode(input.destinationPort.locode), date: mobileDate,
      }, { http: page.request, html: await page.content(), url: page.url(), fields });
      warnings.push(...result.warnings);
      if(result.warnings.some(w=>/DETAIL_FAILED/.test(w)))warnings.push("COUNT_RECONCILIATION_INCOMPLETE: official detail requests did not all finish");
      for (const text of result.texts) {
        const item = parseDetailText(text, schedules.length + 1, input.departureDate, input);
        if (item && (item.alternateLoading || matchesSourcePort(item.originText, { ...input.originPort, nameZh: null }))
          && matchesSourcePort(item.destinationText, { ...input.destinationPort, nameZh: null })) schedules.push(item);
      }
      if (process.env.SCHEDULE_DEBUG === "true") console.info("OOCL transport", "headless-form-http-details");
      if (!schedules.length && !warnings.includes("NO_SCHEDULE_FOUND")) warnings.push("OOCL_PARSE_INCOMPLETE: official mobile page returned no matching parsed schedules.");
      return { source: "OOCL_LIVE", schedules, warnings, durationMs: Date.now() - started, fromCache: false };
    } catch (error) {
      const message = error instanceof Error ? error.message.split("\n")[0] : "unknown error";
      if (message === "NO_SCHEDULE_FOUND") return { source: "OOCL_LIVE", schedules: [], warnings: [message], durationMs: Date.now() - started, fromCache: false };
      return { source: "OOCL_LIVE", schedules, warnings: [...warnings, timedOut ? "OOCL_TIMEOUT: official query exceeded its time budget; completed records were retained" : `OOCL mobile schedule query failed: ${message}`], durationMs: Date.now() - started, fromCache: false };
    } finally {
      clearTimeout(deadline);
      await browser.close();
    }
  },
};

export const OOCLProvider: ShippingProvider<OoclProviderSearchInput, OoclProviderResult> = {
  code: "OOCL",
  async searchSchedule(input) {
    const started = Date.now();
    if (process.env.OOCL_USE_LOCAL_WORKER === "true") {
      try {
        const token = process.env.OOCL_WORKER_TOKEN;
        if (!token || token.length < 32) throw new Error("missing worker token");
        const response = await fetch("http://127.0.0.1:18341/query", {
          method: "POST", cache: "no-store", redirect: "error",
          headers: { Authorization: "Bearer " + token, "Content-Type": "application/json" },
          body: JSON.stringify({
            originPort: { name: input.originPort.name, locode: input.originPort.locode },
            destinationPort: { name: input.destinationPort.name, locode: input.destinationPort.locode },
            departureDate: input.departureDate, dateTo: input.dateTo,
          }), signal: AbortSignal.timeout(input.timeBudgetMs || 180000),
        });
        if (!response.ok) throw new Error("worker HTTP " + response.status);
        const result = await response.json();
        if (result.source !== "OOCL_LIVE" || result.fromCache !== false ||
            !Array.isArray(result.schedules) || !Array.isArray(result.warnings)) throw new Error("invalid worker response");
        return result;
      } catch {
        return { source: "OOCL_LIVE", schedules: [], warnings: ["OOCL_LOCAL_WORKER_UNAVAILABLE: check local worker and SSH tunnel"], fromCache: false, durationMs: Date.now() - started };
      }
    }
    // Browser form first: retain its session when reading official detail responses.
    const browserResult = await OOCLSingleAttempt.searchSchedule(input).catch((error):OoclProviderResult=>({source:"OOCL_LIVE",schedules:[],warnings:["OOCL_BROWSER_FAILED: "+(error instanceof Error?error.message.split("\n")[0]:"launch failed")],durationMs:Date.now()-started,fromCache:false}));
    if(browserResult.schedules.length || browserResult.warnings.includes("NO_SCHEDULE_FOUND"))return browserResult;
    let httpFailure = "";
    try {
      const [origin, destination] = await Promise.all([toOoclPortValue(input.originPort), toOoclPortValue(input.destinationPort)]);
      const result = await queryOoclHttp({ origin, destination, originCode: canonicalPortCode(input.originPort.locode),
        destinationCode: canonicalPortCode(input.destinationPort.locode), date: formatMobileDate(input.departureDate) });
      const schedules = result.texts.map((text, i) => parseDetailText(text, i + 1, input.departureDate, input))
        .filter((item): item is CoscoSchedulePreview => Boolean(item
          && (item.alternateLoading || matchesSourcePort(item.originText, { ...input.originPort, nameZh: null }))
          && matchesSourcePort(item.destinationText, { ...input.destinationPort, nameZh: null })));
      if (schedules.length) {
        if (process.env.SCHEDULE_DEBUG === "true") console.info("OOCL transport", "http-only");
        return { source: "OOCL_LIVE", schedules, warnings: result.warnings, durationMs: Date.now() - started, fromCache: false };
      }
      if (result.warnings.includes("NO_SCHEDULE_FOUND")) httpFailure = "NO_SCHEDULE_FOUND";
      else throw new Error("OOCL_HTTP_PARSE_INCOMPLETE");
    } catch (error) {
      httpFailure = error instanceof Error ? error.message.split("\n")[0] : "OOCL_HTTP_FAILED";
      if (/RATE_LIMITED|HTTP 429/.test(httpFailure)) return { source: "OOCL_LIVE", schedules: [], warnings: [httpFailure], durationMs: Date.now() - started, fromCache: false };
      if (process.env.SCHEDULE_DEBUG === "true") console.info("OOCL HTTP fallback reason", httpFailure);
    }
    {
      const to = input.dateTo?.slice(0,10) || new Date(new Date(input.departureDate).getTime()+28*86400000).toISOString().slice(0,10);
      const published = await queryServiceLoops(
        { ...input.originPort, name: officialPortName(input.originPort), locode: canonicalPortCode(input.originPort.locode) },
        { ...input.destinationPort, name: officialPortName(input.destinationPort), locode: canonicalPortCode(input.destinationPort.locode) },
        input.departureDate.slice(0,10), to);
      if (published.schedules.length) return { source:"OOCL_LIVE", ...published,
        warnings: ["OOCL_PDF_SOURCE: published service loops", ...browserResult.warnings, ...published.warnings], durationMs:Date.now()-started, fromCache:false };
      if (httpFailure === "NO_SCHEDULE_FOUND") return { source: "OOCL_LIVE", schedules: [],
        warnings: [httpFailure, ...published.warnings], durationMs: Date.now() - started, fromCache: false };
      if (published.warnings.length) httpFailure += "; " + published.warnings.join(", ");
    }
    const first = browserResult;
    first.durationMs = Date.now() - started;
    // Only transient navigation/transition failures get one clean-session retry.
    // Never retry an access rejection, CAPTCHA or already returned partial data.
    if (first.schedules.length || Date.now() - started >= 45000
      || !first.warnings.some(w => /All promises were rejected|page.goto: Timeout|ERR_CONNECTION_RESET|ERR_NETWORK_CHANGED|OOCL_HTTP_RESPONSE_INVALID:.*offered=none/.test(w))
      || first.warnings.some(w => /CAPTCHA|VERIFICATION|ACCESS_BLOCKED|HTTP (?:403|429)/.test(w))) {
      if (!first.schedules.length && !first.warnings.includes("NO_SCHEDULE_FOUND")) first.warnings.push(httpFailure);
      return first;
    }
    const second = await OOCLSingleAttempt.searchSchedule({ ...input, timeBudgetMs: Math.min(60000, 100000 - (Date.now() - started)) });
    return { ...second, durationMs: Date.now() - started, warnings: [...second.warnings,
      ...(!second.schedules.length && !second.warnings.includes("NO_SCHEDULE_FOUND") ? [httpFailure, ...first.warnings] : []),
      "OOCL_RETRIED_ONCE: transient public form transition was retried once"] };
  },
};
