# ONE 公开船期接入

## 查询流程

官方入口：https://www.one-line.com/one-ecom/schedule/point-to-point-schedule

优先调用该公开页面使用的 HTTP 接口，不使用登录、开发者 API 密钥或网页中的签名私钥：

- 地点：`https://ecomm.one-line.com/api/v1/schedule/point-to-point/search`
- 船期：`https://ecomm.one-line.com/api/v1/schedule/point-to-point`

查询时用项目港口 LOCODE 向官方地点接口校验，并选择官网返回的 CY (`Y`) 选项。不需要提前全量跑 ONE 地点代码；现有港口资料必须正确，无法精确匹配时显示地点未匹配，不猜测替代港口。现有项目宁波 CNNBO/青岛 CNQIN 别名沿用已确认的 CNNGB/CNTAO 规范化规则。

HTTP 请求对网络错误、5xx 最多两次；必要时才使用无头浏览器匿名会话兜底，不弹窗，不解验证码。429 不重试；正常空结果不触发浏览器。业务船期缓存沿用统一查询层，`refresh=true` 可做实时验收。

洛杉矶官方返回的长滩结果保留 USLGB 身份；其他邻近港口不自动替代。缺失的船名、航次、航程、直达标志等为 null。时间使用官网当地时间值；官网未提供时区偏移，不推算真实 UTC 时刻。原始返回保存在 rawSourceData。

## 数据库部署

追加 `20261030000000_add_one_schedule_source`，只在 sailingschedule.source 枚举末尾增加 ONE_LIVE_QUERY，不改动已发布基线或旧迁移，不删除业务数据。新空库依序执行基线及本迁移。已采用 20261029000000 基线的库可按既定备份/部署流程应用增量；更旧的数据库仍需单独审查。

```bash
npm run db:generate
# 确认目标为专用新空库或已采用发布基线的数据库之后执行：
OCEANSCOPE_DATABASE_MODE=fresh-baseline npm run db:deploy
npm run build
```

2026-10-29 经用户授权，本机现有 oceanscope 库已完成备份、隔离恢复验证和 ONE 增量。旧 11 条迁移记录保持原样，仅登记两个实际执行的增量；未将新空库基线标记为已执行。当前旧库仍不能直接运行 fresh-baseline 部署命令。不要运行 seed 或 db push。

## 验证

2026-10-29，直接运行适配器，不使用船期缓存，日期范围 2026-10-29 至 2026-11-26：盐田→洛杉矶 17 条（长滩 6 条）、上海→鹿特丹 3 条、宁波→汉堡 4 条、青岛→新加坡 54 条。实际数量随官网更新变化。

离线回归覆盖：API 优先、官方地点精确匹配、长滩保留、重复记录、错误日期、其他港口过滤及缺失字段不补造。浏览器兜底路径未以官网故障强制实测，不能据此承诺绕过官网限制或长期稳定。

最终联调：隔离 MySQL 9.6 新库完整执行两项迁移，结构 diff 为零。最终 Next.js 生产构建、TypeScript 和九项回归通过。无头 Edge 从项目页面强制实时查询盐田→洛杉矶，ONE 状态 success、17 条入库结果、6 条长滩，真实船名可见；截图和测试日志保存在项目外的 one-integration-20261029 目录。其他三条航线完成两轮实时适配器验证，未逐条做页面验收。

联调同时修复了新空库首次查询洛杉矶/长滩并行保存时争抢创建同一船司的竞态：同一船司的两个目的港按顺序保存，各船司抓取仍保持并行。当时仅完成隔离测试；此后已正式启用本机旧库，见下方启用记录，仍未部署到 Ubuntu。下述正式启用记录更新了此前隔离验证阶段的状态。

只读实时复测命令：`node scripts/check-one-live.cjs`（可追加 YYYY-MM-DD）；不加载私有 .env、不连接数据库、不使用船期缓存。

## 当前项目正式启用（2026-10-29）

- 新增 `20261030010000_preserve_routing_variants`：routingKey 默认为空，保留原有人工船期重复约束；官方多航段方案采用独立指纹，避免同首程的不同中转方案被唯一键丢弃。原有字段及行数据迁移前后完全一致。新空库三项迁移重放成功，结构 diff 为零。
- 船司按 code 精确匹配，ONE 不再误关联到演示船司 HarborOne；只纠正本轮新抓取的 ONE 记录。
- OOCL 无头浏览器按官方 onclick 中的 LOCODE 选择城市，等待完整导航，不依赖同名城市文本或隐藏页面。HTTP 查询仍优先，验证页不绕过。
- 当前本机生产入口为 http://localhost:3000/schedules，私有环境指定 OCEANSCOPE_DIST_DIR=.next-seven-final、PORT=3000 和实时查询开关。密钥、数据库密码未更改。
- 两次完整 SQL 备份和 .env 备份在项目外的受限 one-enable-20261029 目录；首次 SQL 备份已实际恢复验证。未操作 Ubuntu 或其他项目。

完整的当前七船司真实前端结果、备份与数据核对见 [SEVEN-CARRIER-VERIFICATION.md](SEVEN-CARRIER-VERIFICATION.md)。
