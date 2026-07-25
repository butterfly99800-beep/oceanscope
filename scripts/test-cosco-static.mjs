// 测试：纯 HTTP 抓取 COSCO 船期页，看静态 HTML 里有没有船期数据
// 直接用 Node.js 原生能力，不需要额外依赖

const SCHEDULE_URL = "https://elines.coscoshipping.com/ebusiness/sailingSchedule";

async function test() {
  console.log("正在请求 COSCO 船期查询页...");
  const start = Date.now();

  const resp = await fetch(SCHEDULE_URL, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
      "Accept-Language": "en-US,en;q=0.9",
    },
    redirect: "follow",
  });

  const html = await resp.text();
  const elapsed = Date.now() - start;

  console.log(`\n请求完成，耗时 ${elapsed}ms`);
  console.log(`状态码: ${resp.status}`);
  console.log(`HTML 大小: ${(html.length / 1024).toFixed(1)} KB`);

  // 检查有没有船期数据特征：日期格式
  const dateMatch = html.match(/20\d{2}[-/.]\d{1,2}[-/.]\d{1,2}/g);
  console.log(`\n页面中日期字符串数量: ${dateMatch ? dateMatch.length : 0}`);

  // 检查有没有表格行数据
  const hasTable = /<table[^>]*>/.test(html);
  const hasIvuTable = /ivu-table-row/.test(html);
  const hasScheduleList = /schedule-list|result-list/.test(html);
  console.log(`包含 table 标签: ${hasTable}`);
  console.log(`包含 ivu-table 样式类: ${hasIvuTable}`);
  console.log(`包含 schedule/result 列表容器: ${hasScheduleList}`);

  // 检查是否是 SPA 空壳
  const hasRootDiv = /<div[^>]*id="app"|<div[^>]*id="__next/.test(html);
  const scriptCount = (html.match(/<script/g) || []).length;
  console.log(`\nSPA 根容器: ${hasRootDiv}`);
  console.log(`script 标签数量: ${scriptCount}`);

  // 提取 title
  const titleMatch = html.match(/<title>([^<]*)<\/title>/);
  console.log(`页面标题: ${titleMatch ? titleMatch[1].trim() : "无"}`);

  console.log("\n===== 结论 =====");
  if (dateMatch && dateMatch.length > 3) {
    console.log("静态 HTML 中检测到多条日期数据，可能可以直接解析");
  } else {
    console.log("静态 HTML 中几乎没有船期数据 → 数据由 JS 动态加载，纯 HTTP 抓不到");
    console.log("这种页面必须用 Playwright 等浏览器渲染，或者直接调后端 API");
  }
}

test().catch(console.error);
