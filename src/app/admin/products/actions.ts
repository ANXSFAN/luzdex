"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getActiveFactory } from "@/lib/active-factory";
import { isCategory } from "@/lib/matching";
import {
  parseHighlights,
  parseDetailBlocks,
  parseApplications,
  parseFaq,
  parseBoxContents,
  parseInstall,
  parseDimensionsJson,
  parseDimensions,
  parseLocalizedContent,
  parseContentI18n,
  parseSpecs,
  contentSourceHash,
  type ProductAttributes,
  type LocalizedContent,
} from "@/lib/products";
import { openRouterJSON, type ChatMessage } from "@/lib/ai";
import { routing, normalizeLocale, type AppLocale } from "@/i18n/routing";
import { luminaireLabel } from "@/lib/luminaire";

type Relation = "accessory" | "alternative";

/** 登录 + 选中工厂校验。 */
async function authedFactory() {
  const session = await auth();
  if (!session) throw new Error("未授权");
  const factory = await getActiveFactory();
  if (!factory) throw new Error("未选择工厂");
  return factory;
}

/** 校验产品属于当前工厂，防止跨租户越权操作。 */
async function assertOwned(productId: string, factoryId: string) {
  const p = await prisma.product.findUnique({
    where: { id: productId },
    select: { factoryId: true },
  });
  if (!p || p.factoryId !== factoryId) {
    throw new Error("产品不存在或不属于当前工厂");
  }
}

function asRelation(v: string): Relation {
  if (v !== "accessory" && v !== "alternative") throw new Error("未知关系类型");
  return v;
}

/** 保存产品的类目 / 系列 / 自动匹配属性。 */
export async function saveProductMeta(input: {
  productId: string;
  category: string;
  series: string;
  pcbWidth: string;
  voltage: string;
  watt: string;
}) {
  const factory = await authedFactory();
  await assertOwned(input.productId, factory.id);

  let category: string | null = null;
  if (input.category) {
    if (!isCategory(input.category)) throw new Error("未知类目");
    category = input.category;
  }

  const attrs: ProductAttributes = {};
  if (input.pcbWidth.trim()) attrs.pcbWidth = input.pcbWidth.trim();
  if (input.voltage.trim()) attrs.voltage = input.voltage.trim();
  if (input.watt.trim() && Number.isFinite(Number(input.watt))) {
    attrs.watt = Number(input.watt);
  }

  await prisma.product.update({
    where: { id: input.productId },
    data: {
      category,
      series: input.series.trim() || null,
      // 空对象代表"无属性"，parseAttributes 一致回退到 {}
      attributes: attrs,
    },
  });

  revalidatePath(`/admin/products/${input.productId}`);
}

/**
 * 保存产品展示内容：卖点短语带 / 亮点图标排 / 京东式图文长详情。
 * 这些是资料站独有字段，不来自主站同步，不会被 sync 覆盖。
 * highlights / detailBlocks 经 parse 清洗，非法项静默丢弃；空集合存 [] 表示"无"。
 */
export async function saveProductShowcase(input: {
  productId: string;
  tagline: string;
  variantLabel: string;
  description: string;
  luminaireType: string;
  highlights: unknown;
  detailBlocks: unknown;
  applications: unknown;
  faq: unknown;
  boxContents: unknown;
  install: unknown;
  dimensions: unknown;
  sourceLocale: string;
}) {
  const factory = await authedFactory();
  await assertOwned(input.productId, factory.id);

  const highlights = parseHighlights(input.highlights);
  const detailBlocks = parseDetailBlocks(input.detailBlocks);
  const applications = parseApplications(input.applications);
  const faq = parseFaq(input.faq);
  const boxContents = parseBoxContents(input.boxContents);
  const install = parseInstall(input.install);
  const dimensions = parseDimensionsJson(input.dimensions);

  await prisma.product.update({
    where: { id: input.productId },
    data: {
      tagline: input.tagline.trim() || null,
      variantLabel: input.variantLabel.trim() || null,
      description: input.description.trim() || null,
      luminaireType: input.luminaireType.trim() || null,
      highlights,
      detailBlocks,
      applications,
      faq,
      boxContents,
      // 空安装/尺寸存 {}（parser 读回为 null），保证"清空"能落库
      install: install ?? {},
      dimensions: dimensions ?? {},
      sourceLocale: normalizeLocale(input.sourceLocale) ?? "zh",
    },
  });

  revalidatePath(`/admin/products/${input.productId}`);
}

const LANG_NAMES: Record<AppLocale, string> = {
  es: "Spanish",
  en: "English",
  fr: "French",
  de: "German",
  it: "Italian",
  pt: "Portuguese",
  nl: "Dutch",
  pl: "Polish",
  zh: "Chinese",
};

/**
 * AI 把源语言展示内容翻译成其余 8 种语言，写入 `contentI18n`（直接入库、可重跑）。
 * 「填一种语言 → 其余 AI 补全」：读已保存的源字段，逐语言并行翻译。
 * 红线写进 prompt：只译文字、保结构/数字/图标/URL，禁联系/价格/厂家/采购词。
 * specs 不翻译（保持源语言，避免语言相关启发式失效）。
 */
export async function translateShowcase(productId: string) {
  const factory = await authedFactory();
  await assertOwned(productId, factory.id);

  const product = await prisma.product.findUnique({
    where: { id: productId },
    select: {
      name: true,
      description: true,
      tagline: true,
      highlights: true,
      applications: true,
      faq: true,
      boxContents: true,
      install: true,
      dimensions: true,
      detailBlocks: true,
      specs: true,
      sourceLocale: true,
      documents: { select: { title: true }, orderBy: { sortOrder: "asc" } },
    },
  });
  if (!product) throw new Error("产品不存在");

  // 组装源语言内容包（含结构，AI 只改文字）
  const source = {
    name: product.name,
    description: product.description ?? "",
    tagline: product.tagline ?? "",
    highlights: parseHighlights(product.highlights),
    applications: parseApplications(product.applications),
    faq: parseFaq(product.faq),
    boxContents: parseBoxContents(product.boxContents),
    install: parseInstall(product.install),
    dimensions: parseDimensionsJson(product.dimensions),
    detailBlocks: parseDetailBlocks(product.detailBlocks),
    specs: parseSpecs(product.specs),
    docTitles: product.documents.map((d) => d.title),
  };

  const sourceLocale = normalizeLocale(product.sourceLocale) ?? "zh";
  const targets = routing.locales.filter((l) => l !== sourceLocale);
  const srcJson = JSON.stringify(source);

  const system: ChatMessage = {
    role: "system",
    content:
      "You are a professional translator for a consumer product showcase site. " +
      "Translate ONLY the human-readable text values in the given JSON. " +
      "Keep the JSON structure and keys, icon keys, image URLs, the 'kind' field, " +
      "all numbers, units and quantity symbols (e.g. ×1) EXACTLY unchanged. " +
      "For dimensions translate only the 'cutout' text; keep w/h/d/unit unchanged. " +
      "For specs translate 'group', 'label', and any descriptive words in 'value' " +
      "(e.g. material names, '已通过' → 'passed'); but keep numbers, measurements, " +
      "units and codes unchanged (e.g. 50000, IP66, AC 100-277V, lm/W, K, Ra, °, Ø75). " +
      "Translate each string in 'docTitles' (document titles). " +
      "Natural, consumer-facing tone. Never add contact info, prices, or any " +
      "seller/manufacturer/procurement wording. Output ONLY the JSON object.",
  };

  const results = await Promise.all(
    targets.map(async (loc) => {
      try {
        const raw = await openRouterJSON([
          system,
          {
            role: "user",
            content:
              `Translate from ${LANG_NAMES[sourceLocale]} to ${LANG_NAMES[loc]}. ` +
              `Return the same JSON shape with text translated:\n${srcJson}`,
          },
        ]);
        return [loc, parseLocalizedContent(raw)] as const;
      } catch {
        return [loc, null] as const;
      }
    })
  );

  const contentI18n: Record<string, LocalizedContent> = {};
  let ok = 0;
  for (const [loc, lc] of results) {
    if (lc) {
      contentI18n[loc] = lc;
      ok++;
    }
  }

  await prisma.product.update({
    where: { id: productId },
    data: {
      contentI18n,
      // 记录本次翻译所基于的源内容指纹，供"过期"检测
      translationStamp: contentSourceHash({
        name: product.name,
        description: product.description,
        tagline: product.tagline,
        highlights: product.highlights,
        applications: product.applications,
        faq: product.faq,
        boxContents: product.boxContents,
        install: product.install,
        dimensions: product.dimensions,
        detailBlocks: product.detailBlocks,
        sourceLocale: product.sourceLocale,
      }),
    },
  });

  revalidatePath(`/admin/products/${productId}`);
  return { ok, total: targets.length };
}

/**
 * 保存某一种语言的人工审校译文（语言模式编辑器）。只覆盖编辑器管理的字段，
 * 保留该语言已有的 name / specs 译文；尺寸沿用源 w/h/d/unit + 译文 cutout。
 * 不动 translationStamp（手改译文不影响"源是否变更"的判断）。
 */
export async function saveTranslation(input: {
  productId: string;
  locale: string;
  tagline: string;
  description: string;
  highlights: unknown;
  detailBlocks: unknown;
  applications: unknown;
  faq: unknown;
  boxContents: unknown;
  install: unknown;
  dimCutout: string;
}) {
  const factory = await authedFactory();
  await assertOwned(input.productId, factory.id);
  const loc = normalizeLocale(input.locale);
  if (!loc) throw new Error("未知语言");

  const product = await prisma.product.findUnique({
    where: { id: input.productId },
    select: { contentI18n: true, dimensions: true, specs: true, sourceLocale: true },
  });
  if (!product) throw new Error("产品不存在");
  if (loc === (normalizeLocale(product.sourceLocale) ?? "zh")) {
    throw new Error("源语言请用「保存展示内容」");
  }

  const all = parseContentI18n(product.contentI18n);
  const prev = all[loc] ?? {};
  const built: LocalizedContent = {};
  if (prev.name) built.name = prev.name; // 保留 AI 译名（编辑器不改名）
  if (prev.specs?.length) built.specs = prev.specs; // 保留规格译文
  if (input.description.trim()) built.description = input.description.trim();
  if (input.tagline.trim()) built.tagline = input.tagline.trim();
  const hl = parseHighlights(input.highlights);
  if (hl.length) built.highlights = hl;
  const ap = parseApplications(input.applications);
  if (ap.length) built.applications = ap;
  const fq = parseFaq(input.faq);
  if (fq.length) built.faq = fq;
  const bx = parseBoxContents(input.boxContents);
  if (bx.length) built.boxContents = bx;
  const ins = parseInstall(input.install);
  if (ins) built.install = ins;
  const db = parseDetailBlocks(input.detailBlocks);
  if (db.length) built.detailBlocks = db;
  // 尺寸：源 w/h/d/unit + 译文 cutout
  const srcDim =
    parseDimensionsJson(product.dimensions) ??
    parseDimensions(parseSpecs(product.specs));
  const cut = input.dimCutout.trim();
  if (srcDim) built.dimensions = { ...srcDim, cutout: cut || srcDim.cutout };

  all[loc] = built;
  await prisma.product.update({
    where: { id: input.productId },
    data: { contentI18n: all },
  });
  revalidatePath(`/admin/products/${input.productId}`);
}

/** 判断一个产品是否"缺展示内容"（卖点/场景/图文都空）。 */
function lacksShowcase(p: {
  highlights: unknown;
  applications: unknown;
  detailBlocks: unknown;
}): boolean {
  return (
    parseHighlights(p.highlights).length === 0 &&
    parseApplications(p.applications).length === 0 &&
    parseDetailBlocks(p.detailBlocks).length === 0
  );
}

/** 当前工厂内"缺展示内容"的产品数（供导入页面板显示）。 */
export async function countMissingShowcase(): Promise<number> {
  const factory = await authedFactory();
  const all = await prisma.product.findMany({
    where: { factoryId: factory.id },
    select: { highlights: true, applications: true, detailBlocks: true },
  });
  return all.filter(lacksShowcase).length;
}

/**
 * 批量给"缺展示内容"的产品 AI 生成展示文案并翻译（导入后流水线）。
 * 每次最多处理 CAP 个，避免单次请求过长；返回剩余数，可重复点。
 * 生成走 generateShowcaseDraft（红线一致），存为源语言，再 translateShowcase 补全多语言。
 */
export async function autofillMissingShowcase() {
  const factory = await authedFactory();
  const all = await prisma.product.findMany({
    where: { factoryId: factory.id },
    select: {
      id: true,
      highlights: true,
      applications: true,
      detailBlocks: true,
    },
    orderBy: { createdAt: "asc" },
  });
  const missing = all.filter(lacksShowcase);

  const CAP = 5;
  const batch = missing.slice(0, CAP);
  let done = 0;
  let translated = 0;
  for (const p of batch) {
    try {
      const draft = await generateShowcaseDraft(p.id);
      await prisma.product.update({
        where: { id: p.id },
        data: {
          tagline: draft.tagline.trim() || null,
          description: draft.description.trim() || null,
          highlights: draft.highlights,
          applications: draft.applications,
          faq: draft.faq,
          boxContents: draft.boxContents,
          install: draft.install ?? {},
          dimensions: draft.dimensions ?? {},
          detailBlocks: draft.detailBlocks,
        },
      });
      const r = await translateShowcase(p.id);
      translated += r.ok;
      done++;
    } catch {
      // 单个失败跳过，不阻断整批
    }
  }

  revalidatePath("/admin/import");
  return { done, translated, remaining: missing.length - done };
}

/** AI 可选图标白名单（与前台 HL_ICONS / 后台 ICONS 对齐）。 */
const AI_ICON_KEYS = [
  "shield", "droplet", "zap", "clock", "award", "sun",
  "temp", "ruler", "gauge", "bulb", "battery", "dot",
];

/**
 * 用 LLM（OpenRouter）生成「展示文案草稿」。**只生成、不入库**——返回给前端填进
 * 编辑器，由人工过目 / 修改后再保存（草稿待确认流程）。
 *
 * 红线（PLAN.md §7）写进 system prompt：纯展示种草站、终端顾客向、禁联系/价格/厂家/
 * 采购词；只基于真实事实组织语言，禁编造数字/认证/尺寸，禁输出图片 URL。
 * 数字参数与认证不交给 AI（参数可视化 / 认证详解走确定性映射）。
 */
export async function generateShowcaseDraft(productId: string) {
  const factory = await authedFactory();
  await assertOwned(productId, factory.id);

  const product = await prisma.product.findUnique({
    where: { id: productId },
    select: {
      name: true,
      modelNumber: true,
      luminaireType: true,
      category: true,
      description: true,
      specs: true,
      certifications: true,
    },
  });
  if (!product) throw new Error("产品不存在");

  const specs = parseSpecs(product.specs);
  const specLines = specs
    .map((s) => `- ${s.label}: ${s.value}${s.unit ? " " + s.unit : ""}`)
    .join("\n");

  const facts = [
    `产品名称：${product.name}`,
    `型号：${product.modelNumber}`,
    product.luminaireType
      ? `灯具类型：${luminaireLabel(product.luminaireType, "zh")}`
      : null,
    product.category ? `类目：${product.category}` : null,
    product.description ? `现有描述：${product.description}` : null,
    product.certifications.length
      ? `认证：${product.certifications.join(", ")}`
      : null,
    specs.length ? `规格参数：\n${specLines}` : null,
  ]
    .filter(Boolean)
    .join("\n");

  const system: ChatMessage = {
    role: "system",
    content:
      "你是照明产品展示页的中文文案助手。本站是【纯展示种草站】：面向终端顾客，顾客看完回原零售店购买。" +
      "必须严格遵守：" +
      "1) 只基于用户给出的产品事实组织语言，禁止编造任何数字参数、认证、尺寸、价格；缺信息就省略对应内容。" +
      "2) 禁止出现任何联系方式、价格、厂家/制造商导向，以及采购术语（OEM、ODM、起订量、MOQ、交期、样品、批发、报价）。" +
      "3) 内容面向终端顾客、产品使用向，语气自然种草。" +
      "4) 不要输出任何图片 URL（图片由人工补）。" +
      "5) 只输出一个 JSON 对象，不要额外解释文字。",
  };

  const user: ChatMessage = {
    role: "user",
    content:
      `产品事实如下：\n${facts}\n\n` +
      `请生成展示文案，输出 JSON，结构与约束：\n` +
      `{\n` +
      `  "tagline": "标题下卖点短语带，用 · 分隔 3-4 个短语",\n` +
      `  "description": "1-2 段产品介绍，面向顾客",\n` +
      `  "highlights": [{"icon":"白名单key","label":"说明","value":"短数值(可选,只用上方真实参数)"}],\n` +
      `  "applications": [{"icon":"白名单key","title":"场景名","desc":"一句话"}],\n` +
      `  "faq": [{"q":"顾客向问题(安装/色温/防护/质保/配件)","a":"答案"}],\n` +
      `  "boxContents": [{"item":"盒内物品","qty":"数量(可选)"}],\n` +
      `  "install": {"method":"安装方式一句话","steps":["步骤1","步骤2"]},\n` +
      `  "dimensions": {"w":数字,"h":数字,"d":数字或null,"unit":"mm","cutout":"开孔说明如 Ø75 或 null"},\n` +
      `  "detailBlocks": [{"kind":"heading","text":"小标题"},{"kind":"text","text":"段落"}]\n` +
      `}\n` +
      `icon 只能从这些 key 选：${AI_ICON_KEYS.join(", ")}。\n` +
      `dimensions 只能从上方"产品事实"里抽取（规格/描述/名称/卖点都可找），抽不到的项给 null；` +
      `严禁估算或编造任何尺寸数字。若完全无尺寸信息，dimensions 整个给 null。\n` +
      `highlights/applications 各 3-4 项；faq 4-5 条；boxContents 按该灯具类型常见配置（并在心里默认"以实际包装为准"，但不要把这句写进物品名）；detailBlocks 交替 heading/text 共 4-6 块，不要 image 块。`,
  };

  const raw = (await openRouterJSON([system, user])) as Record<string, unknown>;

  // 用既有 parser 清洗，非法项静默丢弃；icon 不在白名单的回退到 dot
  const fixIcon = <T extends { icon: string }>(x: T): T =>
    AI_ICON_KEYS.includes(x.icon) ? x : { ...x, icon: "dot" };

  return {
    tagline: typeof raw.tagline === "string" ? raw.tagline : "",
    description: typeof raw.description === "string" ? raw.description : "",
    highlights: parseHighlights(raw.highlights).map(fixIcon),
    applications: parseApplications(raw.applications).map(fixIcon),
    faq: parseFaq(raw.faq),
    boxContents: parseBoxContents(raw.boxContents),
    install: parseInstall(raw.install),
    dimensions: parseDimensionsJson(raw.dimensions),
    detailBlocks: parseDetailBlocks(raw.detailBlocks),
  };
}

/** 采纳一条自动匹配建议 → 写入权威 ProductLink。 */
export async function adoptSuggestion(
  fromId: string,
  toId: string,
  relation: string,
) {
  const factory = await authedFactory();
  const rel = asRelation(relation);
  await assertOwned(fromId, factory.id);
  await assertOwned(toId, factory.id);
  if (fromId === toId) throw new Error("不能关联自身");

  await prisma.productLink.upsert({
    where: { fromId_toId_relation: { fromId, toId, relation: rel } },
    create: { factoryId: factory.id, fromId, toId, relation: rel },
    update: {},
  });

  revalidatePath(`/admin/products/${fromId}`);
}

/** 按型号手动关联配件。 */
export async function addAccessoryByModel(
  fromId: string,
  toModel: string,
  relation: string,
) {
  const factory = await authedFactory();
  const rel = asRelation(relation);
  await assertOwned(fromId, factory.id);

  const target = await prisma.product.findFirst({
    where: { factoryId: factory.id, modelNumber: toModel.trim() },
    select: { id: true },
  });
  if (!target) throw new Error(`当前工厂未找到型号「${toModel}」`);
  if (target.id === fromId) throw new Error("不能关联自身");

  await prisma.productLink.upsert({
    where: { fromId_toId_relation: { fromId, toId: target.id, relation: rel } },
    create: { factoryId: factory.id, fromId, toId: target.id, relation: rel },
    update: {},
  });

  revalidatePath(`/admin/products/${fromId}`);
}

/** 删除一条配件关系。 */
export async function removeLink(linkId: string, fromId: string) {
  const factory = await authedFactory();
  await prisma.productLink.deleteMany({
    where: { id: linkId, factoryId: factory.id },
  });
  revalidatePath(`/admin/products/${fromId}`);
}
