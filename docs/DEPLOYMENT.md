# OceanScope Ubuntu 新空库部署

本发布使用 Prisma 6.19.0 的 `20261029000000_fresh_database_baseline`。仅适用于新建空数据库，以及已经采用此基线的 OceanScope 数据库。旧 OceanScope 数据库需要单独的结构、历史与数据迁移方案，禁止直接标记基线已执行或运行旧 seed。

## 与已有服务隔离

使用独立系统用户 `oceanscope`、目录 `/srv/oceanscope`、数据库及数据库用户、环境文件 `/etc/oceanscope/oceanscope.env`、服务名 `oceanscope.service` 和独立子域名。先确认端口 3040 未被占用。不要改动 AI Marketing Agent 的目录、环境、数据库、服务、端口或代理配置，不执行全局 PM2 restart 或覆盖现有 Nginx 配置。

使用独立安装在 `/opt/oceanscope/node` 的 Node.js 24 LTS；不要为本项目替换已有项目的全局 Node。MySQL 使用 InnoDB、utf8mb4。物理表名统一小写，模型通过 `@@map` 映射；不依赖更改服务器的 `lower_case_table_names`。在 Ubuntu/MySQL 的实际目标版本上先演练，不能把 Windows 测试等同于 Linux 验收。

## 私有环境配置

生产环境文件归部署账户所有，限制权限为 600，不放入 Git。

| 变量 | 配置 |
| --- | --- |
| `DATABASE_URL` | 专用 MySQL 数据库连接；数据库名不能复用其他应用。密码中的特殊字符须 URL 编码 |
| `NEXTAUTH_SECRET` | 用密码管理器或 `openssl rand -base64 48` 生成；不是示例值 |
| `AUTH_SECRET` | 如配置，必须与 NEXTAUTH_SECRET 一致 |
| `NEXTAUTH_URL`、`AUTH_URL` | 独立子域名的 HTTPS 根地址，两者保持一致 |
| `NODE_ENV` | `production` |
| `PORT` | 已确认空闲的内部端口，默认 3040，Node 仅监听 127.0.0.1 |
| `SCHEDULE_LIVE_FETCH_ENABLED` | `true` 开启实时查询；验收前可暂设 false |
| `COSCO_SCRAPER_ENABLED` | `true` 启用 COSCO 抓取 |
| `COSCO_FRONTEND_SCRAPER_MODE` | `auto`，API 优先，按失败原因兜底 |
| `COSCO_FRONTEND_BROWSER_FALLBACK` | 需要浏览器兜底时设 `true` |
| `SCHEDULE_BROWSER_HEADLESS` | `true`；自动兜底代码始终无头运行 |
| `MAERSK_CONSUMER_KEY` | 私下配置有权使用的官网客户端标识；缺失时返回明确配置提示，不伪造船期 |
| `SHOW_SEED_SCHEDULES` | `false` |
| `OCEANSCOPE_DATABASE_MODE` | 执行受保护部署命令时设为 `fresh-baseline` |

普通运行账户仅授予本应用需要的数据读写权限。建库及迁移使用专用部署权限；不要把有其他项目权限的 root 连接配置给应用。认证密钥保持稳定，轮换会使会话失效。

## 安装及空库迁移

由运维创建专用空数据库和账户，确认它没有任何业务表。`oceanscope.sql` 仅是可选建库示例，不是备份或完整初始化脚本。

在本项目目录、以专用用户执行，且环境变量已安全加载：

```bash
npm ci
npm run db:generate
npx --no-install prisma validate
npm test
OCEANSCOPE_DATABASE_MODE=fresh-baseline npm run db:deploy
npm run build
```

`db:deploy` 在非空数据库上只接受本发布基线及当前文件校验值一致的成功迁移历史；旧库、失败记录、未知历史会被拒绝。不要绕过保护直接运行 Prisma deploy 来适配旧库。已有新基线库后续升级仍须备份、审核 SQL，并在副本演练；部署保护不是完整漂移检测工具。

安装 Playwright Chromium 及系统依赖使用该项目锁定版本：`npx --no-install playwright install --with-deps chromium`。系统依赖安装涉及宿主机包管理，应在维护流程中评估对其他服务的影响；浏览器文件应由 OceanScope 用户安装并可读。不要把开发机的 Windows 浏览器路径复制到 Ubuntu。

## 主数据与管理员

迁移只建结构，不写入演示船期、报价或订单。港口 CSV 必须从可信来源独立交付到服务器，例如 `/srv/oceanscope/data/ports.csv`，先审查来源及内容，再显式执行：

```bash
PORTS_DATA_FILE=/srv/oceanscope/data/ports.csv OCEANSCOPE_IMPORT_PORTS=true npm run db:import:ports
```

格式参见 `docs/ports-template.csv`。该模板只有表头，不是生产数据。导入前校验全部非空行的列数、LOCODE 和英文名称；重复执行只补充缺失港口、船司、映射，不覆盖已有字段，不删除旧映射。COSCO、OOCL 长数字 ID 只从原验证记录的 `id=完整数字` 提取，缺失时跳过，不从科学计数法猜测还原。导入中断可重跑；数据更正需要单独审查，不能靠重复导入覆盖。

管理员首次创建需显式设置 `OCEANSCOPE_INIT_ADMIN=true`、`INIT_ADMIN_EMAIL`、`INIT_ADMIN_PASSWORD` 后运行 `npm run db:init:admin`。密码至少 16 个字符且不超过 72 个 UTF-8 字节。不要把密码写入命令行历史。已存在邮箱会拒绝操作，不更新密码、角色或状态。完成后移除一次性初始化变量。

`npm run db:seed` 与 `prisma db seed` 均被禁用；`db:seed:demo` 仅在非生产环境且明确设置 `OCEANSCOPE_ALLOW_DEMO_SEED=true` 时允许。它会写演示数据，不能连接生产或其他现有库。

## 独立服务与域名

`deploy/oceanscope.service.example` 使用独立 Node 路径和用户。安装前核对路径、端口和权限，只操作 OceanScope 的服务。`npm start` 使用相同生产启动器，会校验连接配置、认证密钥和 HTTPS URL。

`deploy/nginx-oceanscope.conf.example` 是单独虚拟主机的 HTTP 模板，不能直接当作完成的 HTTPS 配置。为独立子域名配置 DNS 和证书，使用现有服务器的 TLS 运维流程。不得替换已有站点或默认配置；发布代理变更前运行配置检查并确认 AI Marketing Agent 的原域名、路由及证书保持不变。

单进程启动 OceanScope。船期查询任务状态目前保存在进程内，未经专门验证不要开启多进程负载均衡。保留受限的 `tmp/` 浏览器数据目录，日志、Cookie、环境文件和备份不可公开。

## 验收与回退

验收空库结构、权限、管理员登录、普通账号不能访问管理接口、港口搜索、船期查询及地图。实时船期依赖船司公共服务；必须区分官网无结果、验证、限流和系统错误，不能以缓存或演示数据冒充实时成功。

升级前备份数据库和迁移历史并验证恢复；DDL 失败可能部分生效，不能用 reset 或重复运行 seed 修复。应用回退到上个发布目录前先确认数据库兼容性。任何旧数据库迁移与生产数据修复必须单独制定方案。
