# OceanScope

OceanScope 是一个基于 Next.js 15、App Router、TypeScript 和 Tailwind CSS 构建的国际物流前端演示平台。当前版本用于前端测试环境和产品演示，不连接数据库、真实船期 API、真实运价 API、AIS 数据或用户登录系统。

## 安装

```bash
npm install
```

## 开发启动

```bash
npm run dev
```

默认访问地址：

```text
http://localhost:3000
```

## 生产构建

```bash
npm run build
```

## 生产启动

```bash
npm run start
```

Next.js 默认生产端口为 `3000`，可通过部署平台或运行环境覆盖端口配置。

## 当前页面

- `/`：首页
- `/atlas`：Atlas 航运地图，使用 MapLibre GL JS 公开 HTTPS 地图样式和本地模拟船舶、港口、航线数据
- `/schedules`：船期查询，使用本地模拟船期数据
- `/rates`：运费探索器，使用本地模拟报价数据
- `/orders`：模拟订单列表，订单保存在浏览器 localStorage
- `/orders/[id]`：模拟订单详情

## 模拟数据说明

当前仍使用模拟数据的功能包括：

- 船舶位置、航行状态、港口和航线
- 船期查询、船名航次、ETD / ETA、关键节点
- 运费查询、承运商报价、费用明细和附加服务
- 模拟预订和订单保存

这些数据仅用于前端演示，不构成真实船期、真实报价或订舱承诺。

## 环境变量

当前前端演示版不需要必填环境变量。请参考 `.env.example`。不要提交 `.env.local` 或任何包含敏感信息的环境变量文件。

## 部署建议

推荐部署到支持 Next.js 的前端平台，例如 Vercel、Netlify 或自托管 Node.js 环境。

通用流程：

```bash
npm install
npm run build
npm run start
```

## 注意事项

- 不要提交 `node_modules`、`.next`、`.env.local`、日志和临时缓存文件。
- MapLibre 只在客户端动态加载，避免 SSR 阶段访问浏览器 API。
- localStorage 相关逻辑仅在客户端访问，并带有安全回退。

## MySQL 与 Prisma

后台管理中的港口管理、船公司管理、航线管理已预留 MySQL + Prisma ORM 接入。本阶段不把数据库账号或密码写入源码。

### 环境变量

复制 `.env.example` 为 `.env`，并填写真实 MySQL 连接地址：

```env
DATABASE_URL="mysql://USER:PASSWORD@127.0.0.1:3306/oceanscope"
```

可以连接本地 MySQL，也可以连接云 MySQL。请不要提交 `.env`、`.env.local` 或任何包含真实密码的文件。

### Prisma 命令

```bash
npm run db:generate
npm run db:migrate -- --name init_core_data
npm run db:seed
npm run db:studio
```

也可以直接使用：

```bash
npx prisma validate
npx prisma generate
npx prisma migrate dev --name init_core_data
npx prisma db seed
```

### 当前数据库化模块

- `/admin/ports`：港口管理，读取 `/api/admin/ports`
- `/admin/carriers`：船公司管理，读取 `/api/admin/carriers`
- `/admin/routes`：航线管理，读取 `/api/admin/routes`

其他模块仍保留本地模拟数据，后续再逐步接入数据库。



## ???????

OceanScope ???? NextAuth Credentials ??? MySQL ????????? bcrypt ???????????

### ??????

?? `.env.example` ? `.env`??????

```env
DATABASE_URL="mysql://USER:PASSWORD@127.0.0.1:3306/oceanscope"
NEXTAUTH_SECRET="replace-with-a-long-random-secret"
NEXTAUTH_URL="http://localhost:3000"
SEED_ADMIN_PASSWORD="change-me-before-production"
SEED_CUSTOMER_PASSWORD="change-me-before-production"
```

?????????????

```bash
openssl rand -base64 32
```

### ????

Seed ????

- ????`admin@oceanscope.local`
- ?????`customer@oceanscope.local`

???? `SEED_ADMIN_PASSWORD` ? `SEED_CUSTOMER_PASSWORD`????????seed ??????????????????????????????????????

```bash
npx prisma db seed
```

### ????

- ?????????????????
- ????????????????
- ????????? `/admin` ? `/api/admin/**`?
- ?????????????????????
- ??????????????????????

## COSCO Schedule Scraper Test

The admin schedule page includes a disabled-by-default COSCO sailing schedule scraper test. It is for manual admin testing only and does not run scheduled jobs.

Required local setup:

```bash
npm install
npx playwright install chromium
```

Environment variables:

```env
COSCO_SCRAPER_ENABLED="false"
COSCO_SCRAPER_HEADLESS="true"
COSCO_SCRAPER_TIMEOUT_MS="60000"
```

Set `COSCO_SCRAPER_ENABLED=true` only when an administrator intentionally runs the test from `/admin/schedules`. The preview API does not write to MySQL. The commit API writes only after admin confirmation and skips records that cannot be matched to existing MySQL ports/carriers or are duplicates.

If COSCO shows captcha, login, 403, or 429 controls, the scraper returns a specific error and stops. It does not bypass access controls.
