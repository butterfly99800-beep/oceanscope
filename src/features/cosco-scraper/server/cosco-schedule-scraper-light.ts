import type { CoscoScheduleCriteria, CoscoScrapeResult } from "@/features/cosco-scraper/types";
import { mapDomRowsToCoscoSchedules } from "@/features/cosco-scraper/server/cosco-schedule-mapper";

const BASE_URL = "https://elines.coscoshipping.com/ebusiness";
const SCHEDULE_URL = `${BASE_URL}/sailingSchedule`;

const DEFAULT_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
  "Accept":
    "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.9",
  "Referer": BASE_URL + "/",
};

/**
 * 轻量版 COSCO 船期抓取器：纯 HTTP + HTML 解析，不启动浏览器
 * 注意：COSCO 船期数据为 JS 动态渲染，纯静态 HTML 可能拿不到搜索结果
 */
export async function scrapeCoscoSchedulesLight(
  criteria: CoscoScheduleCriteria
): Promise<CoscoScrapeResult> {
  const started = Date.now();
  const warnings: string[] = [];

  // 第一步：获取船期查询页（拿 cookie + 页面结构）
  const homeResp = await fetch(SCHEDULE_URL, {
    headers: DEFAULT_HEADERS,
    redirect: "follow",
  });

  const html = await homeResp.text();
  const pageTitle = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.replace(/\s+/g, " ").trim() ?? "";

  // 提取页面中的表格行。这里只作为轻量兜底，不引入额外 HTML 解析依赖。
  const rows = Array.from(html.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi))
    .map((match) => match[1].replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim())
    .filter((text) => text.length > 20);

  // 检查页面是否有船期数据特征（日期格式）
  const hasScheduleData = rows.some((r) => /20\d{2}[-/.]\d{1,2}[-/.]\d{1,2}/.test(r));

  if (!hasScheduleData) {
    warnings.push(
      "静态 HTML 中未检测到船期数据。COSCO 船期列表为 JS 动态渲染，纯 HTTP 抓取无法获取，需改用浏览器渲染或直接调用 API。"
    );
  }

  const schedules = mapDomRowsToCoscoSchedules(rows, criteria.origin, criteria.destination);

  return {
    source: "COSCO_LIVE",
    targetUrl: SCHEDULE_URL,
    finalUrl: homeResp.url,
    pageTitle,
    entryText: "Sailing Schedule",
    openedNewPage: false,
    iframeUrls: [],
    queriedAt: new Date().toISOString(),
    criteria,
    schedules,
    warnings,
    debug: {
      controls: [],
      network: [],
      jsonEndpoints: [],
      jsonPayloadCount: 0,
    },
    durationMs: Date.now() - started,
    fromCache: false,
  };
}
