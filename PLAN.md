# 资料站 (Datasheet Portal) 演进计划书

## 0. 背景与边界

- 项目：`F:/traeProjects/datasheet`（**与 sysled 解耦，不参考 sysled 主项目代码**）
- 形态：白标多租户 SaaS — 每个 `Factory` 是一个独立租户公司
- 主流量：B2B 客户扫产品二维码进入 `/p/{slug}`
- 平台占位品牌：**CLOUD**；产品页一律走该 Factory 的品牌
- 已完成：设计系统、§01–§04（标识 / 封面 / 文档 / 媒体 / 询盘）、产品页白标渲染、Factory 询盘字段（email + whatsapp + note）

## 1. 已识别问题（按真实业务影响降序）

| #  | 问题                                              | 影响                                       |
| -- | ------------------------------------------------- | ------------------------------------------ |
| 1  | 产品页**无规格 / 无描述 / 无认证徽章**            | 信息空洞，工程师必须开 PDF 才能看参数      |
| 2  | 后台**没有 Factory 编辑器**                       | 多租户跑不通；新工厂无法自助配置           |
| 3  | 没有 **相关产品 / 多张图**                        | 单产品页是死胡同，没有浏览动线             |
| 4  | 没有 **扫码统计**                                 | 厂家最关心的运营指标缺失                   |
| 5  | 没有 **多语言** 框架                              | 出口客户体验差，但工程量大                 |
| 6  | 没有 **询盘点击统计**                             | 看不到询盘转化漏斗                         |
| 7  | 没有 **按型号搜索**                               | QR 损坏 / 模糊时没有退路                   |
| 8  | 没有 **白标主题**                                 | 多家工厂视觉上区分度不足                   |
| 9  | 没有 **PDF 自动合成**                             | 客户拿不到一份统一的可分发文档             |

---

## 2. 里程碑

### M1 · 产品页内容补全（最高优先级）

让扫码进来的工程师 **不开 PDF 就能看到关键参数**。

**Schema 改动**

```prisma
model Product {
  // ...existing
  description    String?  @db.Text                  // 1–2 段介绍文案
  specs          Json?                              // [{ group?, label, value, unit? }]
  certifications String[] @default([])              // ["CE","RoHS","IP65","IK10","LM-80"]
  images         ProductImage[]
}

model ProductImage {
  id        String   @id @default(cuid())
  productId String   @map("product_id")
  url       String
  alt       String?
  sortOrder Int      @default(0) @map("sort_order")
  product   Product  @relation(fields: [productId], references: [id], onDelete: Cascade)

  @@index([productId])
  @@map("product_images")
}
```

**UI 改动（产品页）**

- §01 H1 下方加 **description 段落**（~40em 宽，body sans）
- §01 规格条下方加一行 **认证徽章 chip 排**（4–6 枚，hairline 边框 + mono 文字）
- 新增 **§02 Specifications**：左栏节号，右栏 2-column dl 表格（功率/光通量/CCT/CRI/光束角/IP/电压/寿命 等）
- 封面图升级为 **多图 figure**：主图 16:10 + 下方缩略图横条
- 原有 §02/§03/§04 顺延为 §03/§04/§05

**Seed**：6 个 LED 产品都补真实合理的规格 / 描述 / 认证 / 额外图片（Unsplash）

**验收**：技术买家**不开 PDF 也能起草 RFQ**

---

### M2 · 多租户运营基建

让"很多家公司一起用"真的能发生。

**Schema 改动**

```prisma
model Factory {
  // ...existing
  accentColor String? @map("accent_color")          // oklch 串或 hex
}
```

**功能**

- Admin 新增 `/admin/factory` 编辑页：name / brandShort / logoUrl / contact* / inquiryNote / accentColor
- Logo 上传走现有 R2 通道
- 产品页 SSR 时根据 `factory.accentColor` 在 `<html style>` 注入 `--color-accent` 覆盖
- 颜色选择器限制在暖色域（避免荧光配色破坏整体克制感）

**验收**：在 Prisma Studio 之外能完整配一家新工厂；两家工厂的产品页视觉可感知区分

---

### M3 · 数据观察

让厂家知道 "我的 QR 真的有人扫吗 / 询盘点了多少次"。

**Schema 改动**

```prisma
model ScanLog {
  id         String   @id @default(cuid())
  productId  String   @map("product_id")
  scannedAt  DateTime @default(now()) @map("scanned_at")
  userAgent  String?  @map("user_agent")
  country    String?
  locale     String?
  product    Product  @relation(fields: [productId], references: [id], onDelete: Cascade)

  @@index([productId, scannedAt])
  @@map("scan_logs")
}

model InquiryClick {
  id        String   @id @default(cuid())
  productId String   @map("product_id")
  channel   String                                  // "email" | "whatsapp"
  clickedAt DateTime @default(now()) @map("clicked_at")
  product   Product  @relation(fields: [productId], references: [id], onDelete: Cascade)

  @@index([productId, clickedAt])
  @@map("inquiry_clicks")
}
```

**实现要点**

- ScanLog：产品页 server component 顶部 `prisma.scanLog.create({...})`（**fire-and-forget**，不 await，不阻塞 SSR）
- InquiryClick：客户端按钮 `onclick` 用 `navigator.sendBeacon('/api/inquiry-click', body)`，deep link 同时正常打开
- Admin 产品详情页底部：30 天扫码 / 询盘趋势（CSS sparkline，不引图表库）

**验收**：admin 进任一产品能看到 "近 30 天 X 次扫码 / Y 次询盘点击"

---

### M4 · 退路 + 增值

#### M4-A 型号搜索

- 首页加搜索（默认隐藏，触发后展开）
- 后端按 `modelNumber ILIKE '%q%'`，附带 `factory.isActive = true`
- 结果卡片展示 brandShort + 产品名 + 跳 `/p/{slug}`

#### M4-B PDF 自动合成

- `GET /p/{slug}/pdf` 路由
- 用 **@react-pdf/renderer**（React 化 PDF，与现有组件心智一致；纯 JS ≈ 600KB）
- **完全独立实现**，不参考 sysled
- 内容：封面图 / 型号 / 名称 / 描述 / 规格表 / 认证 / 文档清单（含 URL 与 QR）
- Server 缓存 60s（同产品高频请求降本）

**验收**：搜索可用；PDF 能正常下载、打印、邮件附件

---

### M5 · i18n（独立大件，放最后）

**第一阶段：仅 UI 壳 i18n（推荐先做这层）**

- 装 `next-intl`
- 路由 `/[locale]/p/{slug}`，locale 解析顺序：URL → cookie → `factory.defaultLocale` → "zh-CN"
- 所有 UI 字符串（Identification / Documents / Inquiry 等）抽到 `messages/{locale}.json`
- Factory 加 `defaultLocale` 与 `supportedLocales[]`
- 顶栏切换器（仅展示该 Factory 支持的 locale）

**第二阶段：内容层 i18n（更大手术，单独立项）**

- 将 `Product.name` / `description` / `Document.title` / `Factory.inquiryNote` 从 `String` 升级为 `Json`（`{ "zh-CN": "...", "en": "..." }`）
- 读取侧加 fallback：缺失 locale 回落到 defaultLocale
- Admin 多语言编辑器

---

## 3. 不在本计划范围

- 自定义域名 / 子域名（等真有第二家签约再做）
- 经销商分级 / 价格可见性（这是 ERP，不是 datasheet portal）
- Sentry / 错误监控 / 速率限制（基础设施，等流量起来再补）
- 通用 SEO / sitemap（产品全 noindex，无意义）
- 多产品询盘购物车 / 文档内嵌预览 / 视频自动抽帧（nice-to-have，最后考虑）

---

## 4. 执行顺序

```
M1 (内容补全)
  └─ Product schema 三件套 + ProductImage + UI §Specifications + Seed 真实数据
       ↓
M2 (Factory admin + 主题)
  └─ /admin/factory 表单 + accentColor + logo 上传 + 运行时主题注入
       ↓
M3 (数据观察)
  └─ ScanLog + InquiryClick + admin 趋势 sparkline
       ↓
M4 (搜索 + PDF)
  └─ 首页搜索 + GET /p/{slug}/pdf
       ↓
M5 (i18n 壳)
  └─ next-intl + Factory.defaultLocale + 顶栏切换器
```

每个 M 完成后**停一下**收真实使用反馈，再决定是否直接进下一个 M。

---

## 5. 立即执行：M1

Schema 一次到位（Product +3 字段、新建 ProductImage 表），Seed 全部补真实数据，产品页加 §Specifications 块、description 段落、认证徽章排、多图 figure。

完成 M1 后停一下，看页面是否还需要再补内容，再决定进 M2 还是先调整。

---

## 6. 客户新增需求（2026-06 客户沟通后追加）

### 6.0 背景与现状澄清

客户提了两点：(1) 产品页不能是单产品死胡同，扫一条灯带要能看到**同系列其他灯带**和**适配的铝槽 / 变压器**；(2) 上线后很多工厂会自带货导入，后台要一个**批量导入**功能。

**先澄清"数据从哪来"**：后台**不是直接读 sysled 数据库**。现链路是 `src/lib/main-site.ts` + `src/app/api/sync/route.ts`：后台点同步 → HTTP `GET {MAIN_SITE_URL}/api/products`（只读、分页）→ upsert 进本地镜像表 `Product`。且现在写死 `factory.findFirst()`，**只往第一家工厂灌数据**。别的工厂没有 sysled 那个主站，所以批量导入不是可选项，是多租户能跑起来的前提。

需求1与需求2**共用同一套数据模型**——相关产品 / 配件关系，恰好在导入时一并填入，因此合并设计。

### 6.1 已拍板的三个决策

| 决策 | 选择 | 含义 |
| -- | -- | -- |
| 后台运营模式 | **先平台代运营，预留自助** | v1 由平台超管登录 + 后台「当前工厂」选择器代各厂操作；`AdminUser` 预留 `factoryId` 字段，工厂多了再开自助登录 |
| 配件适配关系 | **手动关联 + 属性自动匹配 两者都要** | `ProductLink`（手动 / 导入填"适配型号"）为权威优先；`attributes`（PCB 宽度 / 电压）做自动匹配，但**只产出建议**，由后台确认，不静默写库 |
| 批量导入格式 | **多 Sheet 工作簿** | 一个 `.xlsx` 四张表（产品 / 规格 / 图片 / 配件），靠"型号"关联，完整支持规格 / 图片 / 配件等 1:N 数据 |

### 6.2 Schema 增量（一次 migration 落齐，避免反复改库）

```prisma
model AdminUser {
  // ...existing
  factoryId String? @map("factory_id")    // v1 留空 = 平台超管；预留自助登录
}

model Product {
  // ...existing
  category   String?  @map("category")     // strip|channel|power|connector|accessory
  series     String?  @map("series")       // 同系列自动聚合键
  attributes Json?                          // { pcbWidth:"10mm", voltage:"24V", watt:14.4 } 自动匹配用
  linksOut   ProductLink[] @relation("from")
  linksIn    ProductLink[] @relation("to")

  @@index([factoryId, series])
  @@index([factoryId, category])
}

model ProductLink {                         // 手动 / 导入关系，权威，优先展示
  id        String  @id @default(cuid())
  factoryId String  @map("factory_id")      // 冗余存一份，约束关系不跨租户
  fromId    String  @map("from_id")
  toId      String  @map("to_id")
  relation  String  @default("accessory")   // accessory|alternative
  sortOrder Int     @default(0) @map("sort_order")
  from      Product @relation("from", fields: [fromId], references: [id], onDelete: Cascade)
  to        Product @relation("to",   fields: [toId],   references: [id], onDelete: Cascade)

  @@unique([fromId, toId, relation])
  @@index([toId])
  @@map("product_links")
}

model ImportJob {                           // 导入任务，驱动"先预览后写库"与异步化
  id          String   @id @default(cuid())
  factoryId   String   @map("factory_id")
  fileName    String   @map("file_name")
  status      String   // uploaded|validating|preview_ready|importing|done|failed
  totalRows   Int      @default(0) @map("total_rows")
  createdRows Int      @default(0) @map("created_rows")
  updatedRows Int      @default(0) @map("updated_rows")
  errorRows   Int      @default(0) @map("error_rows")
  report      Json?    // 逐行结果 / 错误明细，供预览与下载
  createdAt   DateTime @default(now()) @map("created_at")

  @@map("import_jobs")
}
```

### 6.3 需求1 · 相关产品（同系列 + 适配配件）

两种关系分开建，因为成本与性质不同：

| 关系 | 例子 | 机制 |
| -- | -- | -- |
| **同系列**（兄弟） | 星光系列 COB 暖色灯带 → 同系列其他灯带 | 查 `series` 相同、`id` 不同、同 `factoryId`，零授权成本 |
| **适配配件**（跨类目） | 灯带 → 铝槽 / 变压器 | `ProductLink relation=accessory` 手动权威；无手动时按 `attributes` 自动兜底 |

**配件逻辑（两者都要）**：`ProductLink` 永远优先展示；某产品没有手动配件时，用 `attributes`（PCB 宽度决定铝槽、电压+功率决定电源）在同工厂内自动推荐兜底。导入时跑一遍自动匹配，把高置信结果作为"建议关系"在后台一键确认——自动只做建议，不静默写库。

**产品页 UI**：在 §05 询盘前插新区块 **§ 相关产品**，两组横向卡片：
- **同系列**（同 `series`，排除自己）
- **推荐配件 / 适配**（手动 link 优先，属性兜底；卡片标类目角标）

**验收**：扫一条灯带，页面能跳到同系列其他灯带与适配铝槽 / 电源，浏览动线打通。

### 6.4 需求2 · 批量导入（多 Sheet 工作簿）

**模板（一个 `.xlsx`，靠"型号"做主键关联）**：

| Sheet | 字段 |
| -- | -- |
| **产品** | 型号\*、名称\*、描述、系列、类目(灯带/铝槽/电源/配件)、认证(CE,RoHS)、封面图URL |
| **规格** | 型号\*、分组、参数名、参数值、单位（一个产品多行）|
| **图片** | 型号\*、图片URL、说明、排序 |
| **配件** | 型号\*、适配型号\*、关系(accessory/alternative) |

后台提供「下载模板」按钮；一张模板同时喂饱需求1与需求2。

**流程（核心原则：永远先预览再写库）**：

```
上传 .xlsx/.csv
  → 后端解析(SheetJS) + 逐行校验(Zod)         ← 不写库
  → 生成预览 diff：✅120 新增 / 🔁30 更新 / ⛔5 错误(第7行缺型号…)
  → 可下载「错误报告 CSV」
  → 用户确认
  → 分批事务写入，按 (factoryId, 型号) upsert
       Pass 1：产品 + 规格 + 图片 + 认证
       Pass 2：按型号解析 系列 & 配件关系（须等产品全建完）
  → 完成，给汇总（写入 ImportJob）
```

绝不盲写、绝不一把梭；重复导入幂等（同型号更新而非新增）。

**技术要点**：
- 解析用 `xlsx`(SheetJS)，同吃 `.xlsx`/`.csv`，服务端跑。
- upsert key：现有 `@@unique([factoryId, sourceId])` 且 `sourceId` 必填 → 导入产品令 **`sourceId = 型号`**，复用唯一约束，与 sysled 同步产品天然隔离。
- 图片：v1 收**图片 URL**；phase 2 再做「ZIP 批量上传按文件名匹配型号」走现有 R2 通道(`src/lib/r2.ts`)。
- 大批量：几百行同步带进度条；ImportJob 已设计成可改 `after()` 异步，不动接口。
- 错误处理：行级隔离，错误行不阻断好行（或提供"全有或全无"开关），错误报告带行号与原因可下载。

**前置卡点**：`AdminUser` 现无 `factoryId`、sync 写死第一家工厂。v1 走平台代运营，需在后台加「当前工厂」选择器，并把 sync 的 `findFirst` 改为跟随选中工厂。

**验收**：平台超管选定一家工厂，上传四表模板，预览无误后导入，产品 / 规格 / 图片 / 系列 / 配件关系全部成型；重复导入不产生重复。

### 6.5 施工顺序

```
M6 · Phase 0 — Schema + 工厂选择器
   └─ 上面整套 migration 一次到位 + 后台「当前工厂」下拉 + sync 跟随选中工厂
        ↓
M7 · Phase 1 — 批量导入（重头）
   └─ 多 Sheet 模板下载 + 上传解析 + Zod 校验 + 预览 diff + 确认 upsert(两 Pass) + ImportJob + 错误报告
        ↓
M8 · Phase 2 — 相关产品展示
   └─ 产品页 §相关产品：同系列卡片 + 适配配件卡片（手动优先，属性兜底）
        ↓
M9 · Phase 3 — 属性自动匹配后台
   └─ 导入/编辑时的配件建议确认 UI
```

Phase 1 是重头，且 Phase 2 靠它喂数据，故先 0→1。每阶段完成后停一下收反馈。

> 注：prisma migration 会动数据库，执行前单独确认一次；`npm run dev` 由本人启动验证。

---

## 7. 定位转向：纯展示种草站（2026-06 老板沟通后定稿）

### 7.0 背景与角色重定

老板对照京东 APP 重新定调，**产品页的角色从"B2B 工程师查规格书 / 向厂家询盘"转为"终端顾客扫码种草、看完回原零售店购买"**。商业链路：

```
平台 CLOUD（白标 SaaS，本公司运营）
  └─ 厂家租户 Factory（本公司 + 几家合作公司，多租户各自白标）  ← 保留，不动
       └─ 零售店 / 代理经销商（各厂家自己的下游，货批发出去）
            └─ 终端顾客（扫码 → 看产品 → 回原店购买）
```

**两条都重要、且不冲突**：

- **多租户**（Factory 层）继续保留 —— 决定"这页归哪个厂家、白标成什么牌子"。
- **不抢终端零售店生意**（终端展示层）—— 决定"这页不给任何指向厂家的购买/询盘出口"，把顾客自然导回他原来的店。

两者各管一层，互不影响。

### 7.1 核心原则：「包装上有的才展示」

页面只呈现实体产品 / 包装上本就印着的信息（品牌、型号、参数、认证、产品图）。**包装上没有的就不放**——尤其不引入厂家客服、在线询盘、价格。这天然实现"纯展示、不抢店"。

### 7.2 已拍板决策

| 决策 | 选择 | 含义 |
| -- | -- | -- |
| 厂家询盘入口 | **彻底去掉** | 删除产品页 §06 询盘整块；页面零联系出口，连"请联系当地授权经销商"话术也**不显示** |
| 品牌展示 | **保留，不刻意隐藏** | 品牌包装上本就有（符合 7.1）；头部 brandShort / logo 维持白标渲染。要隐藏的是"卖家(厂家)联系方式"，不是产品品牌 |
| 经销商专属码 | **仅底层预留，UI 零体现** | `?s=source` 链路透传 + `ScanLog.source` 已在记录；不建表、页面不展示。将来给代理 / 经销商点亮"扫哪家店的码显示哪家店联系方式"（未来 `Store` 模型 `factoryId + storeId`，天然落在多租户下） |
| 展示丰富度 | **对标京东商品详情页** | 四块全做，见 7.3 |

### 7.3 京东式丰富度（四块）

1. **沉浸大图轮播 + 点击全屏缩放** — 升级 `ProductGallery`，纯前端，不动库。
2. **卖点短语带 + 亮点图标排** — 标题下 tagline 卖点带；certifications 升级为图标 + 短词亮点排。
3. **图文长详情（重头）** — 京东详情页往下滑那段：场景图 / 安装效果 / 细节特写 / 卖点逐条配图。差距最大的一块。
4. **同系列 / 搭配推荐横滑卡** — 把现有 §05 相关产品视觉强化成京东式横滑推荐卡（缩略图 + 类目角标）。

### 7.4 Schema 增量（一次 migration，动库前单独确认）

```prisma
model Product {
  // ...existing
  tagline      String?  @map("tagline")        // 标题下卖点短语带
  highlights   Json?                            // [{ icon, label }] 亮点图标排
  detailBlocks Json?    @map("detail_blocks")   // [{ kind:"text"|"image", ... }] 图文长详情
}
```

经销商 / Store v1 **不建表**，靠现有 `source` 字段预留链路。

### 7.5 施工顺序

```
M10 · Phase A — 不动库的前端块（先做，零风险）
   └─ 砍 §06 询盘（页面零联系出口） + ProductGallery 轮播放大 + RelatedProducts 横滑卡
        ↓
M10 · Phase B — schema + 内容块（动库前单独确认）
   └─ Product +tagline/+highlights/+detailBlocks migration + generate
      + 标题区卖点带 + 亮点图标排 + 图文长详情渲染 + 后台编辑 + seed 真实内容
```

Phase A 全是增量 / 删除，不碰数据库，先落地见效；Phase B 动库，按规矩动前确认。

---

## 8. 前台系列页（2026-06 追加，后台增强完成后再做）

### 8.0 需求

终端顾客扫一条「星光系列」灯带，产品页上要有一个 **「了解更多 · 星光系列」** 入口；点进去是一个**系列页**：顶部该系列的介绍（名称 / 一段文案 / 主视觉），下面是该系列全部产品的展示卡片。要求**美观、丰富**，与产品页同一套克制设计语言。

### 8.1 链路

```
产品页（§相关产品 区或标题区）
  └─ 「了解更多 · {series} 系列」入口（仅当 product.series 非空时出现）
       └─ /[locale]/series/{seriesSlug}  系列页
            ├─ 系列介绍：名称 + 文案 + 主视觉图
            └─ 该系列产品卡片栅格（同 factory、同 series，跳各自 /p/{slug}）
```

### 8.2 待定的数据来源（动库前单独确认）

当前 `series` 只是 Product 上的一个字符串 key，**没有系列级的介绍文案 / 主视觉**。两种方案：

| 方案 | 做法 | 取舍 |
| -- | -- | -- |
| A · 轻量（推荐起步） | 不建表，系列名直接用 `series` 字符串，产品卡片取该系列产品；介绍文案/主视觉暂缺或取系列内某代表产品 | 零迁移、马上能上；但系列没有专属介绍 |
| B · Series 模型 | 新建 `Series`（factoryId + slug + name + intro + heroImage + sortOrder），产品 `seriesId` 外键 | 能配专属介绍/主视觉、后台可编辑；一次迁移 + 后台系列编辑器 + 产品改挂 seriesId |

> 红线照旧（§7.1）：系列页同样零联系 / 价格 / 厂家出口，只做"种草式"系列呈现。

### 8.3 施工顺序

```
M11 · 系列页
   └─ Phase A：路由 /[locale]/series/{slug} + 产品页入口 + 系列产品卡片（走方案 A，不动库）
        ↓
   └─ Phase B（可选）：Series 模型 + 后台系列编辑器（介绍/主视觉）+ 产品改挂 seriesId（方案 B，动库前确认）
```

排在后台增强（Dashboard / 富化列表 / 批量操作 / 导入历史）之后做。
