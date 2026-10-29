# OceanScope

> 生产部署请先阅读 [Ubuntu 新空库部署说明](docs/DEPLOYMENT.md)。当前迁移基线只适用于新建空库，不可用于旧 OceanScope 数据库。默认 seed 已禁用。

OceanScope 是一个基于 Next.js 15 构建的国际物流 SaaS 平台，提供船期查询、运费对比、订单管理和航运地图可视化等功能。采用 Prisma + MySQL 作为数据层，集成 COSCO 中远海运实时船期数据抓取。

## 技术栈

| 类别 | 技术 |
|------|------|
| 框架 | Next.js 15 (App Router) + React 19 |
| 语言 | TypeScript |
| 样式 | Tailwind CSS |
| 数据库 | MySQL 8.x + Prisma ORM 6.x |
| 认证 | NextAuth v4 (Credentials + bcryptjs) |
| 爬虫 | Playwright (COSCO 船期抓取) |
| 地图 | MapLibre GL JS |
| 校验 | Zod |
| 图标 | Lucide React |

## 核心功能

### 前台功能

- **`/` 首页**：平台入口，功能导航
- **`/atlas` 航运地图**：基于 MapLibre 的全球港口、航线可视化
- **`/schedules` 船期查询**：按起运港/目的港/日期查询船期，支持筛选、排序、对比
- **`/rates` 运费查询**：多承运商运价对比，费用明细拆解，附加服务选择
- **`/orders` 订单管理**：订舱订单列表与详情查看
- **`/account` 个人中心**：账户信息与密码管理

### 后台管理 (`/admin`)

- **港口管理** `/admin/ports`：港口基础数据维护
- **船公司管理** `/admin/carriers`：承运商信息管理
- **航线管理** `/admin/routes`：航线与中转港配置
- **船期管理** `/admin/schedules`：船期数据管理 + COSCO 抓取测试
- **运价管理** `/admin/rates`：运费报价与费用项管理
- **订单管理** `/admin/orders`：订舱订单全量管理
- **用户管理** `/admin/users`：用户角色、状态、权限管理

## 项目结构

```
oceanscope/
├── src/
│   ├── app/                    # Next.js App Router 页面与 API
│   │   ├── api/                # 所有 API 路由
│   │   │   ├── admin/          # 管理员 API（需鉴权）
│   │   │   ├── auth/           # NextAuth 认证接口
│   │   │   ├── schedules/      # 船期查询接口
│   │   │   ├── rates/          # 运价查询接口
│   │   │   ├── orders/         # 订单接口
│   │   │   ├── ports/          # 港口搜索接口
│   │   │   └── cosco/          # COSCO 城市搜索接口
│   │   └── [page]/             # 前端页面
│   ├── features/               # 业务功能模块
│   │   ├── admin/              # 后台管理组件与工具
│   │   ├── atlas/              # 航运地图模块
│   │   ├── auth/               # 认证表单
│   │   ├── cosco-scraper/      # COSCO 船期爬虫
│   │   ├── orders/             # 订单模块
│   │   ├── rates/              # 运价模块
│   │   └── schedules/          # 船期模块
│   ├── components/             # 通用 UI 组件
│   ├── lib/                    # 公共库（prisma、auth、授权等）
│   └── types/                  # 全局类型定义
├── prisma/
│   ├── schema.prisma           # 数据模型定义
│   ├── seed.mjs                # 种子数据脚本
│   └── migrations/             # 数据库迁移文件
├── scripts/                    # 调试脚本
├── .env.example                # 环境变量模板
└── package.json
```

## 快速开始

### 1. 安装依赖

```bash
npm ci
```

### 2. 配置环境变量

复制 `.env.example` 为 `.env` 并填写配置：

```bash
cp .env.example .env
```

### 3. 初始化数据库

```bash
# 生成 Prisma Client
npm run db:generate

# 仅对新建空库应用基线，已有库禁止执行
OCEANSCOPE_DATABASE_MODE=fresh-baseline npm run db:deploy

# 生产主数据和管理员分别初始化，见 docs/DEPLOYMENT.md
```

### 4. 安装 Playwright 浏览器（可选，COSCO 浏览器模式需要）

```bash
npx playwright install chromium
```

### 5. 启动开发服务

```bash
npm run dev
```

访问：http://localhost:3000

## 环境变量说明

### 数据库

| 变量 | 说明 | 示例 |
|------|------|------|
| `DATABASE_URL` | MySQL 连接串 | `mysql://root:password@127.0.0.1:3306/oceanscope` |

### 认证

| 变量 | 说明 |
|------|------|
| `NEXTAUTH_SECRET` | JWT 加密密钥（`openssl rand -base64 32` 生成） |
| `NEXTAUTH_URL` | 应用根 URL，开发环境为 `http://localhost:3000` |
| `SEED_ADMIN_PASSWORD` | 种子管理员账号密码 |
| `SEED_CUSTOMER_PASSWORD` | 种子客户账号密码 |

### COSCO 船期爬虫

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `COSCO_SCRAPER_ENABLED` | `false` | 是否启用 COSCO 抓取功能 |
| `COSCO_SCRAPER_HEADLESS` | `true` | 浏览器模式是否无头 |
| `COSCO_SCHEDULE_CACHE_MINUTES` | `360` | 船期缓存时长（分钟） |
| `COSCO_SCHEDULE_FETCH_COOLDOWN_SECONDS` | `120` | 相同查询抓取冷却时间（秒） |
| `COSCO_FRONTEND_SCRAPER_MODE` | `api` | 前端抓取模式：`api` / `auto` / `browser` |
| `COSCO_FRONTEND_BROWSER_FALLBACK` | `false` | API 模式失败时是否自动降级到浏览器 |
| `SHOW_SEED_SCHEDULES` | `false` | 是否展示种子船期数据 |

## 种子账号

仅在隔离开发数据库明确启用 `OCEANSCOPE_ALLOW_DEMO_SEED=true npm run db:seed:demo` 后创建演示账号；生产禁止使用：

| 角色 | 邮箱 | 密码 |
|------|------|------|
| 管理员 | `admin@oceanscope.local` | `SEED_ADMIN_PASSWORD` 环境变量值 |
| 普通用户 | `customer@oceanscope.local` | `SEED_CUSTOMER_PASSWORD` 环境变量值 |

## COSCO 船期抓取

### 双模式架构

```
请求 → API 模式（直接调 COSCO 接口，~3秒）
         ↓ 失败/无结果
      浏览器模式（Playwright 模拟，~45秒，兜底）
         ↓
      内存缓存（默认6小时）
```

- **API 模式**：直接调用 COSCO 官方 JSON 接口，速度快，优先使用
- **浏览器模式**：Playwright 模拟真实浏览器操作，稳定性高，作为兜底
- **自动降级**：`auto` 模式下 API 失败自动切换浏览器模式

### 管理端测试

管理员可在 `/admin/schedules` 页面使用 COSCO 抓取测试工具，支持 Preview（预览不入库）和 Commit（确认后入库）两种模式。

## 主要 API 接口

### 公开接口

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/ports/search` | 港口搜索 |
| GET | `/api/cosco/cities/search` | COSCO 城市搜索 |
| GET | `/api/schedules/search` | 船期查询 |
| POST | `/api/rates/search` | 运价查询 |
| POST | `/api/auth/register` | 用户注册 |

### 需要登录

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/account` | 账户信息 |
| PUT | `/api/account/profile` | 更新资料 |
| PUT | `/api/account/password` | 修改密码 |
| GET | `/api/orders` | 我的订单列表 |
| GET | `/api/orders/[id]` | 订单详情 |
| POST | `/api/bookings` | 创建订舱 |

### 管理员接口

| 方法 | 路径 | 说明 |
|------|------|------|
| CRUD | `/api/admin/ports` | 港口管理 |
| CRUD | `/api/admin/carriers` | 船公司管理 |
| CRUD | `/api/admin/routes` | 航线管理 |
| CRUD | `/api/admin/schedules` | 船期管理 |
| CRUD | `/api/admin/rates` | 运价管理 |
| CRUD | `/api/admin/orders` | 订单管理 |
| CRUD | `/api/admin/users` | 用户管理 |
| POST | `/api/admin/integrations/cosco/schedules/preview` | COSCO 抓取预览 |
| POST | `/api/admin/integrations/cosco/schedules/commit` | COSCO 抓取入库 |

## 数据库模型

核心数据表：

- **Port** - 港口（LOCODE 唯一标识）
- **Carrier** - 船公司
- **Route** - 航线（含中转港）
- **SailingSchedule** - 船期（ETD/ETA、可靠性、状态等）
- **RateQuote** - 运价报价（含多箱型、费用明细）
- **RateLineItem** - 运价费用项
- **User** - 用户（ADMIN / CUSTOMER 角色）
- **BookingOrder** - 订舱订单
- **BookingContainer** - 订单箱型明细
- **BookingTimeline** - 订单状态时间线

## 生产部署

```bash
npm install
npm run build
npm run start
```

推荐部署环境：
- Vercel（Serverless 模式）
- 自托管 Node.js 服务器
- Docker 容器部署

## 开发命令

| 命令 | 说明 |
|------|------|
| `npm run dev` | 启动开发服务器 |
| `npm run build` | 生产构建 |
| `npm run start` | 启动生产服务 |
| `npm run lint` | ESLint 代码检查 |
| `npm run db:generate` | 生成 Prisma Client |
| `npm run db:migrate` | 仅开发环境的 migrate dev，生产禁止使用 |
| `npm run db:deploy` | 受保护的新空库迁移 |
| `npm run db:seed` | 默认拒绝执行，生产禁用 |
| `npm run db:studio` | 打开 Prisma Studio 数据库可视化 |

## 注意事项

- COSCO 船期抓取仅供测试使用，请遵守目标网站的使用条款和 robots 协议
- 生产不创建演示账号；独立初始化管理员并配置私有 NEXTAUTH_SECRET
- MapLibre 地图仅在客户端加载，避免 SSR 阶段访问浏览器 API
- 不要提交 `.env`、`node_modules`、`.next` 等包含敏感信息或构建产物的文件
