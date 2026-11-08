# 直达 / 中转原始证据核查（2026-11-08）

查询窗口：2026-11-08 至 2026-12-06。使用应用 Provider，forceRefresh=true；均报告 fromCache=false。只读取业务库港口映射；写入与页面验证使用独立本地 MySQL 33379 测试库。原始响应保存在开发工作区，不提交真实响应、联系人或环境文件。

## 逐家结论

| 船司 | 原始证据 / 结论 | 本次结果 |
|---|---|---|
| COSCO | legSequence=1 的完整单段、船名航次与两端港口，deList1/deList2 明确为空；旧解析未识别单段直达，已修复 | 上海→洛杉矶（保留长滩）14 条直达 |
| OOCL | 官方 PDF 同船同航次列内的两次挂港，无缺行或新一轮航次分隔；旧解析固定 null，已修复 | 上海→洛杉矶 3 条直达；仅发布表范围 |
| MAERSK | routingLegs/carriageType=OCEAN、船舶与设施代码；旧解析只找可选布尔字段，已修复 | 上海→洛杉矶 5 条独立有效船期，均直达；上海→新加坡 5 条中转 |
| Hapag | legs/modeOfTransport=VESSEL、两端 unLocationCode 与 vesselDetails；已修复 | 上海→洛杉矶 8 条：5 直达、3 中转 |
| HMM | fstTrshpPortCd 明确 KRPUS；海运中间夹 TT 港内转运导致旧代码无法分类，已修复 | 上海→洛杉矶/长滩 27 条：7 直达、20 中转 |
| CMA | 本次中国站响应 TransitType=null、VIA 为空，没有完整分段；不能推断为空即直达 | 上海→洛杉矶 9 条仍待确认 |
| ZIM | 当前简版发布表保留主船、航次和日期，未核验完整分段或明确直达标志 | 上海→洛杉矶 3 条仍待确认；不是断言官网所有入口都没标 |
| MSC | IsDirectRoute 已被解析；上海→洛杉矶本轮入口空，改查有结果的航线验证 | 青岛→新加坡 21 条直达 |
| ONE | transshipmentType / totalTransshipment 已解析 | 上海→洛杉矶 4 条直达 |
| EVERGREEN | 上轮已修复同船海运分段，复测保持正确 | 上海→洛杉矶/长滩 15 条直达 |
| YANG MING | routeDetails/transitMode=VESSEL 已解析 | 上海→洛杉矶 4 条直达 |
| KMTC | ts=Y/N 明确中转标志，已解析 | 上海→东京 44 条：5 直达、39 中转 |
| PIL | 官方路线详情海运分段已解析 | 青岛→新加坡 20 条直达 |
| SITC | 调用官网直航查询，已明确限定覆盖范围 | 上海→东京 28 条直达；非完整中转覆盖 |
| WHL | 尚未接通，未取得此次可核验的原始船期 | 无法判断，不标为“船司未提供” |

MAERSK 官网响应 7 行中有 1 行超出窗口、1 行重复，窗口内 6 行去重后前端 5 条。Hapag 响应 11 行中 3 行超出窗口，实际前端 8 条。上述条数不是承诺所有航线或所有日期均完整。

## 分类边界

新海运分段分类必须有明确海运模式、起讫代码、船名和连续完整链。中间挂港仍在同一艘船不算换船中转；船名改变才统计换船。铁路、未知模式、缺字段或不连续链不猜测为直达。明确的官方直达/中转标志优先。

COSCO 的分类范围是实际海运卸港；不能把到温哥华/长滩的海运直达解释成到内陆城市直达。OOCL 发布表不代表官网所有点到点路径都已覆盖。CMA 与 ZIM 的空字段保留待确认。

## 验证

- npm test 全部通过：新增分段分类、内部港口代码、换船、同船挂港、铁路、断链、COSCO 单段与 OOCL 同列断行回归。
- TypeScript 与 Next.js 生产构建通过。
- 无缓存获取的五家结果保存到隔离 MySQL，读取并映射后分类保持一致。
- 生产构建 + 隔离库 + 实际查询 API + 浏览器页面（没有替换 API）：MAERSK 5、Hapag 8、HMM 27、COSCO 14、OOCL 3 条均具有明确分类，直航与中转周表可见。
- 另做真实响应到页面与 Excel 的替身 API 测试，验证 Excel 分类与输入一致；不将其冒充生产验证。
- 未部署云端。没有迁移改动，没有业务库写入。服务器仍需更新；OOCL 本地 worker 需加载新代码（更新后重启 worker，SSH 隧道不用改）。

## 复测工具

scripts/check-routing-evidence-live.cjs CARRIER_CODES ORIGIN DESTINATION YYYY-MM-DD：读取港口映射，实时调用 Provider，不保存船期到业务库。OCEANSCOPE_AUDIT_FILE 可指定私有原始证据输出路径；OCEANSCOPE_AUDIT_UI_DIR 可指定私有测试输出目录。不要提交输出文件。

scripts/check-routing-db.cjs 只允许写固定隔离测试数据库；scripts/check-routing-ui.cjs 使用上述新鲜响应做页面与 Excel 检查。
