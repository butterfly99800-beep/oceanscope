# 公开船期扩展验收（2026-11-07）

本次已启用 EMC、YML、HMM、KMTC、PIL、SITC 六家，原七家保留。**不是八家全部完成**：ZIM 与 WHL 未取得可解析的真实船期，不伪造空结果、不启用占位 Provider。

API/HTTP 优先；网络失败可使用无头浏览器会话。地点不存在与解析失败不反复打开浏览器。无登录、无申请授权。SITC 目前仅验证直航查询，界面会注明范围。内陆段、未知到达时间和未公布字段不会推算补齐。

## 无缓存实测

日期 2026-11-07 至 2026-12-05。下列是 Provider 原始可解析条数，可能包含不同中转方案。未匹配地点与官方空返回分开记录，零条不等于该船司没有该航线。

|船司|起运|目的|条数|状态|
|---|---|---|---:|---|
|EMC|CNSHA|USLAX|15|返回真实船期|
|EMC|CNNGB|DEHAM|16|返回真实船期|
|EMC|CNTAO|SGSIN|38|返回真实船期|
|EMC|CNSHA|JPTYO|8|返回真实船期|
|YML|CNSHA|USLAX|6|返回真实船期|
|YML|CNNGB|DEHAM|18|返回真实船期|
|YML|CNTAO|SGSIN|9|返回真实船期|
|YML|CNSHA|JPTYO|0|官方地点未匹配|
|HMM|CNSHA|USLAX|26|返回真实船期|
|HMM|CNNGB|DEHAM|18|返回真实船期|
|HMM|CNTAO|SGSIN|8|返回真实船期|
|HMM|CNSHA|JPTYO|0|当前公开查询未返回船期|
|KMTC|CNSHA|USLAX|0|官方地点未匹配|
|KMTC|CNNGB|DEHAM|0|官方地点未匹配|
|KMTC|CNTAO|SGSIN|4|返回真实船期|
|KMTC|CNSHA|JPTYO|41|返回真实船期|
|PIL|CNSHA|USLAX|0|当前公开查询未返回船期|
|PIL|CNNGB|DEHAM|0|当前公开查询未返回船期|
|PIL|CNTAO|SGSIN|19|返回真实船期|
|PIL|CNSHA|JPTYO|0|当前公开查询未返回船期|
|SITC|CNSHA|USLAX|0|官方地点未匹配|
|SITC|CNNGB|DEHAM|0|当前公开查询未返回船期|
|SITC|CNTAO|SGSIN|0|当前公开查询未返回船期|
|SITC|CNSHA|JPTYO|27|返回真实船期|

上海查询保留 USLGB，并按实际目的港保存。不同中转路径分别保存；修复了数据库及 API 二次去重覆盖不同方案的问题。

## 完整联调

- 隔离 MySQL 9.6 空库完整执行四个迁移成功，未连接原有或生产数据库。Ubuntu MySQL 8.4 尚未执行本次迁移演练。
- 六个 Provider 实时获取后入库：EMC 15、YML 6、HMM 26、KMTC 4、PIL 19、SITC 27，均无跳过。
- 实际 API 和生产构建前端（无接口替身）：上海→洛杉矶/长滩 47、青岛→新加坡 23、上海→东京 27；Excel 明细行数与前端一致。
- Excel 包含船期明细、航线汇总两个工作表；空字段保留空白，来源及获取时间保留，公式样式文本不会执行。
- 汇总按直航、中转、未公布方式分组，展示船司、服务、实际开航日期、已公布航程范围。没有根据同船推测共舱关系，也不把某一次开航日当固定周班。
- Prisma validate、TypeScript、现有回归及新增回归、生产构建、页面/认证/权限冒烟测试通过。
- 本机 Prisma generate 遇到正在运行进程占用 query_engine DLL 的 EPERM；未终止用户 worker。现有同版本引擎可运行上述隔离数据库测试；生产使用新 release 目录生成。

## 仍然受阻的官方入口

- ZIM https://www.zim.com/schedules/point-to-point 及 /api/v2/scheduleByRoute/getResult：HTTP 403 Access Denied。官方 api.zim.com 另需申请账号，未使用。
- WHL https://www.wanhai.com/views/skd/SkdByPort.xhtml 、tw.wanhai.com 同路径以及官网服务 PDF：返回 Incapsula 验证 HTML；HTTP 200 不代表已获取船期。未将历史 PDF 或第三方结果冒充实时官方数据。
- 这两家尚未上线，不能将本次发布说成十五家都可用。

## 依赖与安全

保留 Next 15.5.28、React 19.0.9、Prisma 6.19.0。新增 ExcelJS 4.4.0；brace-expansion 更新至兼容补丁 1.1.21。
生产 npm audit：4 high（Prisma 配置工具依赖链）、2 moderate（ExcelJS/uuid 依赖链），0 critical。ExcelJS 源码仅调用 uuid.v4，告警针对 v3/v5/v6 buffer；本功能不导入用户 Excel，不使用这些调用。未强制降级 ExcelJS 或升级 Prisma 主版本。

## 发布

新增迁移仅向 sailingschedule.source 枚举追加六个来源，旧迁移字节保留。
使用 deploy/update-expanded-carriers.sh，要求 sudo、mysqldump、python3、现有 /srv/oceanscope/current 发布软链接。脚本只操作 OceanScope：构建成功、专用数据库备份成功、迁移历史校验成功后才切换和重启。保留原环境文件和旧发布版本；失败恢复旧代码，追加枚举不回滚、不恢复覆盖数据库。
该脚本只做过 Bash 静态检查，尚未在 Ubuntu 执行。缺 mysqldump、远程 main 不等于指定 SHA、迁移历史不匹配时停止，不会重启服务。不要用 git pull + 原地构建替代此发布过程。

复测脚本：
- node scripts/check-expanded-carriers-live.cjs（无缓存，不连接数据库）
- npm test
- scripts/check-expanded-db-live.cjs 仅允许固定隔离测试库，不能用于生产
- scripts/check-expanded-ui-db.cjs 仅连接本机 3059 隔离验收服务
