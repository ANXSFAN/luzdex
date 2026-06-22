"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { adminErr } from "@/lib/admin-err";
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
  parseAttributes,
  contentSourceHash,
  recomputeReadiness,
  type ProductAttributes,
  type LocalizedContent,
} from "@/lib/products";
import { listAttributes } from "@/lib/attributes";
import { ATTR_KEY_RE } from "@/lib/attribute-defaults";
import { openRouterJSON, type ChatMessage } from "@/lib/ai";
import { routing, normalizeLocale, type AppLocale } from "@/i18n/routing";
import { luminaireLabel } from "@/lib/luminaire";
import { deleteFromR2, copyInR2 } from "@/lib/r2";
import { categoryIdByKind, seriesIdByName, catalogSlug } from "@/lib/catalog";

type Relation = "accessory" | "alternative";

/** 登录 + 选中工厂校验。 */
async function authedFactory() {
  const session = await auth();
  if (!session) throw await adminErr("unauthorized");
  const factory = await getActiveFactory();
  if (!factory) throw await adminErr("noFactory");
  return factory;
}

/** 校验产品属于当前工厂，防止跨租户越权操作。 */
async function assertOwned(productId: string, factoryId: string) {
  const p = await prisma.product.findUnique({
    where: { id: productId },
    select: { factoryId: true },
  });
  if (!p || p.factoryId !== factoryId) {
    throw await adminErr("notOwned");
  }
}

async function asRelation(v: string): Promise<Relation> {
  if (v !== "accessory" && v !== "alternative") throw await adminErr("unknownRelation");
  return v;
}

/**
 * 保存产品的类目 / 系列 / 自动匹配属性。
 * attributes 按字典过滤：key 须在当前工厂字典内，或产品原本已存（防字典删项后静默丢数据）；
 * number 型字典项的值收敛为数字（非数字按原文存字符串）；空值 = 删除该属性。
 */
export async function saveProductMeta(input: {
  productId: string;
  category: string;
  series: string;
  attributes: Record<string, string>;
}) {
  const factory = await authedFactory();
  await assertOwned(input.productId, factory.id);

  let category: string | null = null;
  if (input.category) {
    if (!isCategory(input.category)) throw await adminErr("unknownCategory");
    category = input.category;
  }

  const [defs, current] = await Promise.all([
    listAttributes(factory.id),
    prisma.product.findUnique({
      where: { id: input.productId },
      select: { attributes: true },
    }),
  ]);
  const defByKey = new Map(defs.map((d) => [d.key, d]));
  const existing = parseAttributes(current?.attributes);

  const attrs: ProductAttributes = {};
  for (const [k, raw] of Object.entries(input.attributes ?? {})) {
    if (!ATTR_KEY_RE.test(k)) continue;
    const def = defByKey.get(k);
    if (!def && !(k in existing)) continue;
    const v = String(raw).trim();
    if (!v) continue;
    if (def?.type === "number" && Number.isFinite(Number(v))) {
      attrs[k] = Number(v);
    } else {
      attrs[k] = v.slice(0, 120);
    }
  }

  // 字符串与实体外键同步：category→categoryId(按 kind)、series→seriesId(按名,缺则建)
  const seriesName = input.series.trim() || null;
  const [categoryId, seriesId] = await Promise.all([
    categoryIdByKind(factory.id, category),
    seriesIdByName(factory.id, seriesName),
  ]);

  await prisma.product.update({
    where: { id: input.productId },
    data: {
      category,
      categoryId,
      series: seriesName,
      seriesId,
      // 空对象代表"无属性"，parseAttributes 一致回退到 {}
      attributes: attrs,
    },
  });

  revalidatePath(`/admin/products/${input.productId}`);
  revalidatePath("/admin/products");
}

/**
 * 保存产品展示内容：卖点短语带 / 亮点图标排 / 京东式图文长详情。
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
      sourceLocale: normalizeLocale(input.sourceLocale) ?? "es",
    },
  });

  await recomputeReadiness(input.productId);
  revalidatePath(`/admin/products/${input.productId}`);
}

/**
 * 保存产品基本信息：名称 / 型号。支持后台直接改。
 * 改名会触发译文过期（name 在 contentSourceHash 内）。
 */
export async function saveProductBasics(input: {
  productId: string;
  name: string;
  modelNumber: string;
}) {
  const factory = await authedFactory();
  await assertOwned(input.productId, factory.id);
  const name = input.name.trim();
  const modelNumber = input.modelNumber.trim();
  if (!name) throw await adminErr("nameRequired");
  if (!modelNumber) throw await adminErr("modelRequired");
  await prisma.product.update({
    where: { id: input.productId },
    data: { name, modelNumber },
  });
  // name 在 contentSourceHash 内：改名 → 译文过期，stale 需重算
  await recomputeReadiness(input.productId);
  revalidatePath(`/admin/products/${input.productId}`);
}

/**
 * 画廊图（ProductImage）与封面图的管理。图片文件先经 /api/upload 落 R2 拿到 URL，
 * 这里只持久化引用关系。封面图与画廊图相互独立：公开页把封面排在画廊最前。
 */

/** 画廊图：新增一张（排到末尾）。 */
export async function addProductImage(input: {
  productId: string;
  url: string;
  alt?: string;
}) {
  const factory = await authedFactory();
  await assertOwned(input.productId, factory.id);
  const url = input.url.trim();
  if (!url) throw await adminErr("imageUrlMissing");
  const count = await prisma.productImage.count({
    where: { productId: input.productId },
  });
  await prisma.productImage.create({
    data: {
      productId: input.productId,
      url,
      alt: input.alt?.trim() || null,
      sortOrder: count,
    },
  });
  revalidatePath(`/admin/products/${input.productId}`);
}

/** 画廊图：删除一张（连带删 R2 文件）。 */
export async function removeProductImage(imageId: string, productId: string) {
  const factory = await authedFactory();
  await assertOwned(productId, factory.id);
  const img = await prisma.productImage.findUnique({ where: { id: imageId } });
  if (!img || img.productId !== productId) throw await adminErr("imageNotFound");
  await prisma.productImage.delete({ where: { id: imageId } });
  await deleteFromR2(img.url);
  revalidatePath(`/admin/products/${productId}`);
}

/** 画廊图：按给定 id 顺序重排 sortOrder（越权/外来 id 自动过滤）。 */
export async function reorderProductImages(
  productId: string,
  orderedIds: string[],
) {
  const factory = await authedFactory();
  await assertOwned(productId, factory.id);
  const imgs = await prisma.productImage.findMany({
    where: { productId },
    select: { id: true },
  });
  const own = new Set(imgs.map((i) => i.id));
  const ids = orderedIds.filter((id) => own.has(id));
  await prisma.$transaction(
    ids.map((id, i) =>
      prisma.productImage.update({ where: { id }, data: { sortOrder: i } }),
    ),
  );
  revalidatePath(`/admin/products/${productId}`);
}

/** 封面图：设置 / 清空（传空字符串即清空）。 */
export async function setProductCover(productId: string, url: string) {
  const factory = await authedFactory();
  await assertOwned(productId, factory.id);
  await prisma.product.update({
    where: { id: productId },
    data: { coverImage: url.trim() || null },
  });
  revalidatePath(`/admin/products/${productId}`);
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
 * 译文包做完整性校验：源里非空的板块（场景/图文详情/盒内清单/安装/FAQ…）译文必须
 * 都在，缺板块视为该语言失败并重试一次；失败语言保留旧译文（合并写入，不整体覆盖）。
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
      contentI18n: true,
      documents: { select: { title: true }, orderBy: { sortOrder: "asc" } },
      videos: { select: { title: true }, orderBy: { sortOrder: "asc" } },
    },
  });
  if (!product) throw await adminErr("productNotFound");

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
    // 字典 key 不属于可翻译内容，发给 AI 前剥掉（防 AI 改坏/回传带 key）
    specs: parseSpecs(product.specs).map((s) => {
      const { key: _key, ...rest } = s;
      void _key;
      return rest;
    }),
    docTitles: product.documents.map((d) => d.title),
    videoTitles: product.videos.map((v) => v.title),
  };

  const sourceLocale = normalizeLocale(product.sourceLocale) ?? "es";
  const targets = routing.locales.filter((l) => l !== sourceLocale);
  const srcJson = JSON.stringify(source);

  // 源里非空的板块，译文包必须同样非空——AI 偶发丢板块（场景/图文详情/盒内清单等）
  // 时不能当成功入库，否则前台该语言整块回退源语言。
  const requiredKeys = (
    [
      ["name", !!source.name.trim()],
      ["description", !!source.description.trim()],
      ["tagline", !!source.tagline.trim()],
      ["highlights", source.highlights.length > 0],
      ["applications", source.applications.length > 0],
      ["faq", source.faq.length > 0],
      ["boxContents", source.boxContents.length > 0],
      ["install", !!source.install],
      ["dimensions", !!source.dimensions],
      ["detailBlocks", source.detailBlocks.length > 0],
      ["specs", source.specs.length > 0],
      ["docTitles", source.docTitles.length > 0],
      ["videoTitles", source.videoTitles.length > 0],
    ] as const
  )
    .filter(([, has]) => has)
    .map(([k]) => k);
  const missingKeys = (lc: LocalizedContent) =>
    requiredKeys.filter((k) => {
      const v = lc[k as keyof LocalizedContent];
      return v == null || (Array.isArray(v) && v.length === 0);
    });

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
      "Translate each string in 'docTitles' (document titles) and " +
      "'videoTitles' (video titles). " +
      "Natural, consumer-facing tone. Never add contact info, prices, or any " +
      "seller/manufacturer/procurement wording. Output ONLY the JSON object.",
  };

  const results = await Promise.all(
    targets.map(async (loc) => {
      // 完整性不达标（缺板块）按失败算，重试一次
      for (let attempt = 0; attempt < 2; attempt++) {
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
          const lc = parseLocalizedContent(raw);
          if (missingKeys(lc).length === 0) return [loc, lc] as const;
        } catch {
          /* retry */
        }
      }
      return [loc, null] as const;
    })
  );

  // 合并写入：失败语言保留已有旧译文，不被整体覆盖清空
  const contentI18n = parseContentI18n(product.contentI18n);
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
      // 记录本次翻译所基于的源内容指纹，供"过期"检测。
      // 只有全部目标语言都翻成功才盖戳；部分失败保留旧戳，让「译文过期/未译」继续提示重跑。
      ...(ok === targets.length
        ? {
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
              specs: product.specs,
              sourceLocale: product.sourceLocale,
            }),
          }
        : {}),
    },
  });

  // 译文 + 可能的新翻译戳变了：translatedCount(读时算) 与 stale 都受影响
  await recomputeReadiness(productId);
  revalidatePath(`/admin/products/${productId}`);
  return { ok, total: targets.length };
}

/**
 * 保存某一种语言的人工审校译文（语言模式编辑器）。只覆盖编辑器管理的字段，
 * 保留该语言已有的 specs 译文；尺寸沿用源 w/h/d/unit + 译文 cutout。
 * 不动 translationStamp（手改译文不影响"源是否变更"的判断）。
 */
export async function saveTranslation(input: {
  productId: string;
  locale: string;
  name?: string;
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
  if (!loc) throw await adminErr("unknownLocale");

  const product = await prisma.product.findUnique({
    where: { id: input.productId },
    select: { contentI18n: true, dimensions: true, specs: true, sourceLocale: true },
  });
  if (!product) throw await adminErr("productNotFound");
  if (loc === (normalizeLocale(product.sourceLocale) ?? "es")) {
    throw await adminErr("useSourceSave");
  }

  const all = parseContentI18n(product.contentI18n);
  const prev = all[loc] ?? {};
  const built: LocalizedContent = {};
  // 译名：编辑器传了就用（清空 = 前台回退源名）；老调用方没传则保留原值
  if (input.name !== undefined) {
    if (input.name.trim()) built.name = input.name.trim();
  } else if (prev.name) built.name = prev.name;
  if (prev.specs?.length) built.specs = prev.specs; // 保留规格译文
  // 文档/视频标题译文不归这个编辑器管，保存时原样保留，防止整包重建时丢失
  if (prev.docTitles?.length) built.docTitles = prev.docTitles;
  if (prev.videoTitles?.length) built.videoTitles = prev.videoTitles;
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
      // 先按新展示内容刷一遍（万一下面翻译抛错也不会留下过期的就绪度）
      await recomputeReadiness(p.id);
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
  if (!product) throw await adminErr("productNotFound");

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

/**
 * AI 图文排版：客户上传若干图片 + 一段描述 → 生成图文穿插的长详情块序列。
 * **只生成、不入库**——返回给编辑器，客户过目后保存。图片必须来自客户提供的
 * URL 列表（AI 禁止编 URL；越界的 image 块服务端丢弃，漏排的图补到末尾）。
 */
export async function generateDetailLayout(input: {
  productId: string;
  images: string[];
  brief: string;
}) {
  const factory = await authedFactory();
  await assertOwned(input.productId, factory.id);

  const images = input.images.map((u) => u.trim()).filter(Boolean).slice(0, 12);
  const brief = input.brief.trim();
  if (!images.length || !brief) throw await adminErr("needImgBrief");

  const product = await prisma.product.findUnique({
    where: { id: input.productId },
    select: { name: true, modelNumber: true, luminaireType: true, tagline: true },
  });
  if (!product) throw await adminErr("productNotFound");

  // 图片用编号指代，AI 输出 {kind:"image", index:N}，服务端换回真实 URL——
  // 既省 token 也从结构上杜绝编造 URL。
  const system: ChatMessage = {
    role: "system",
    content:
      "你是照明产品展示页的图文详情排版师。本站是【纯展示种草站】：面向终端顾客，顾客看完回原零售店购买。" +
      "必须严格遵守：" +
      "1) 文案只基于客户描述与产品事实组织语言，禁止编造数字参数、认证、尺寸、价格。" +
      "2) 禁止联系方式、价格、厂家/制造商导向及采购术语（OEM、ODM、MOQ、批发、报价）。" +
      "3) 输出语言与客户描述的语言一致。" +
      "4) 只输出一个 JSON 对象，不要额外解释。",
  };

  const user: ChatMessage = {
    role: "user",
    content:
      `产品：${product.name}（型号 ${product.modelNumber}）` +
      (product.luminaireType
        ? `，类型 ${luminaireLabel(product.luminaireType, "zh")}`
        : "") +
      (product.tagline ? `，卖点 ${product.tagline}` : "") +
      `\n\n客户描述（排版的内容依据）：\n${brief}\n\n` +
      `客户提供了 ${images.length} 张图片，编号 1 到 ${images.length}（顺序即客户上传顺序，通常 1 为主图）。\n\n` +
      `请生成京东式自上而下的图文长详情，输出 JSON：\n` +
      `{"blocks":[{"kind":"heading","text":"小标题"},{"kind":"text","text":"段落"},{"kind":"image","index":1,"caption":"图注(可选)"}]}\n` +
      `要求：标题/段落/图片交替穿插、节奏舒服；每张图片恰好使用一次、放在与其内容最相关的文字附近；` +
      `共 ${Math.min(6 + images.length * 2, 18)} 块左右；段落每段 2-3 句、面向终端顾客自然种草。`,
  };

  const raw = (await openRouterJSON([system, user])) as Record<string, unknown>;
  const list = Array.isArray(raw.blocks) ? raw.blocks : [];

  const used = new Set<number>();
  const blocks: ({ kind: "heading" | "text"; text: string } | {
    kind: "image";
    url: string;
    caption?: string;
  })[] = [];
  for (const b of list) {
    if (!b || typeof b !== "object") continue;
    const r = b as Record<string, unknown>;
    if (r.kind === "heading" || r.kind === "text") {
      if (typeof r.text === "string" && r.text.trim()) {
        blocks.push({ kind: r.kind, text: r.text.trim() });
      }
    } else if (r.kind === "image") {
      const i = Number(r.index);
      if (Number.isInteger(i) && i >= 1 && i <= images.length && !used.has(i)) {
        used.add(i);
        blocks.push({
          kind: "image",
          url: images[i - 1],
          caption:
            typeof r.caption === "string" && r.caption.trim()
              ? r.caption.trim()
              : undefined,
        });
      }
    }
  }
  // AI 漏排的图片补到末尾，保证客户传的图一张不丢
  for (let i = 1; i <= images.length; i++) {
    if (!used.has(i)) blocks.push({ kind: "image", url: images[i - 1] });
  }

  return parseDetailBlocks(blocks);
}

/** 采纳一条自动匹配建议 → 写入权威 ProductLink。 */
export async function adoptSuggestion(
  fromId: string,
  toId: string,
  relation: string,
) {
  const factory = await authedFactory();
  const rel = await asRelation(relation);
  await assertOwned(fromId, factory.id);
  await assertOwned(toId, factory.id);
  if (fromId === toId) throw await adminErr("selfLink");

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
  const rel = await asRelation(relation);
  await assertOwned(fromId, factory.id);

  const target = await prisma.product.findFirst({
    where: { factoryId: factory.id, modelNumber: toModel.trim() },
    select: { id: true },
  });
  if (!target) throw await adminErr("modelNotFound", { model: toModel });
  if (target.id === fromId) throw await adminErr("selfLink");

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

/**
 * 保存产品规格表（specs）与认证（certifications）。
 * 这两项原本只能靠 xlsx 重导，这里支持后台即时编辑。
 * specs 经 parseSpecs 清洗（缺 label/value 的行静默丢弃）；空集合存 [] 表示"无"。
 */
export async function saveProductSpecs(input: {
  productId: string;
  specs: unknown; // [{ group?, label, value, unit?, key? }]
  certifications: unknown; // string[]
}) {
  const factory = await authedFactory();
  await assertOwned(input.productId, factory.id);

  // 规格行可挂字典 key；不在当前工厂字典内的 key 剥掉、行保留
  const validKeys = new Set((await listAttributes(factory.id)).map((d) => d.key));
  const specs = parseSpecs(input.specs).map((s) => {
    if (s.key && !validKeys.has(s.key)) {
      const { key: _key, ...rest } = s;
      void _key;
      return rest;
    }
    return s;
  });
  const certifications = Array.isArray(input.certifications)
    ? input.certifications
        .map((c) => String(c).trim())
        .filter(Boolean)
        .slice(0, 24)
    : [];

  await prisma.product.update({
    where: { id: input.productId },
    data: { specs, certifications },
  });

  // specs 在 contentSourceHash 内：改规格 → 译文可能过期，stale 需重算
  await recomputeReadiness(input.productId);
  revalidatePath(`/admin/products/${input.productId}`);
}

/**
 * 删除产品（连带级联清除图片 / 文档 / 视频 / 关系 / 扫码记录）。
 * 删库前尽力清掉 R2 上的图片 / 文档 / 视频文件，避免留孤儿；外链 URL 自动跳过。
 */
export async function deleteProduct(productId: string) {
  const factory = await authedFactory();
  await assertOwned(productId, factory.id);

  const product = await prisma.product.findUnique({
    where: { id: productId },
    select: {
      coverImage: true,
      images: { select: { url: true } },
      documents: { select: { fileUrl: true } },
      videos: { select: { url: true } },
    },
  });

  // 先删库（级联清子表），再清 R2 文件（best-effort，失败不影响删除结果）
  await prisma.product.delete({ where: { id: productId } });

  if (product) {
    const urls = [
      product.coverImage,
      ...product.images.map((i) => i.url),
      ...product.documents.map((d) => d.fileUrl),
      ...product.videos.map((v) => v.url),
    ].filter((u): u is string => !!u);
    await Promise.all(
      urls.map((u) => deleteFromR2(u).catch(() => {})),
    );
  }

  revalidatePath("/admin/products");
  revalidatePath("/admin");
}

/**
 * 手动新建产品（不依赖导入）。sourceId = 型号，便于将来导入对账；型号冲突报错。
 * 可选直接归入分类 / 系列，并同步镜像字符串。返回新产品 id 供前端跳转编辑页。
 */
export async function createProduct(input: {
  name: string;
  modelNumber: string;
  categoryId?: string | null;
  seriesId?: string | null;
}): Promise<string> {
  const factory = await authedFactory();
  const name = input.name.trim();
  const modelNumber = input.modelNumber.trim();
  if (!name) throw await adminErr("nameRequired");
  if (!modelNumber) throw await adminErr("modelRequired");

  const dupe = await prisma.product.findUnique({
    where: { factoryId_sourceId: { factoryId: factory.id, sourceId: modelNumber } },
    select: { id: true },
  });
  if (dupe) throw await adminErr("modelExists");

  // slug 全局唯一
  const base = catalogSlug(modelNumber, "product");
  let slug = base;
  let i = 1;
  while (
    await prisma.product.findUnique({ where: { slug }, select: { id: true } })
  ) {
    slug = `${base}-${i++}`;
  }

  // 归类/归系列时同步镜像字符串
  let category: string | null = null;
  let series: string | null = null;
  if (input.categoryId) {
    const c = await prisma.category.findUnique({ where: { id: input.categoryId } });
    if (c?.factoryId === factory.id) category = c.kind;
  }
  if (input.seriesId) {
    const s = await prisma.series.findUnique({ where: { id: input.seriesId } });
    if (s?.factoryId === factory.id) series = s.name;
  }

  const p = await prisma.product.create({
    data: {
      factoryId: factory.id,
      sourceId: modelNumber,
      slug,
      modelNumber,
      name,
      category,
      categoryId: input.categoryId || null,
      series,
      seriesId: input.seriesId || null,
      sourceLocale: "es",
    },
  });

  revalidatePath("/admin/products");
  return p.id;
}

/** 批量删除产品（仅删属于当前工厂的）。级联清子表 + best-effort 清 R2。 */
export async function bulkDeleteProducts(ids: string[]) {
  const factory = await authedFactory();
  if (!ids.length) return { deleted: 0 };
  const products = await prisma.product.findMany({
    where: { id: { in: ids }, factoryId: factory.id },
    select: {
      id: true,
      coverImage: true,
      images: { select: { url: true } },
      documents: { select: { fileUrl: true } },
      videos: { select: { url: true } },
    },
  });
  const ownIds = products.map((p) => p.id);
  if (ownIds.length) {
    await prisma.product.deleteMany({ where: { id: { in: ownIds } } });
    const urls = products
      .flatMap((p) => [
        p.coverImage,
        ...p.images.map((i) => i.url),
        ...p.documents.map((d) => d.fileUrl),
        ...p.videos.map((v) => v.url),
      ])
      .filter((u): u is string => !!u);
    await Promise.all(urls.map((u) => deleteFromR2(u).catch(() => {})));
  }
  revalidatePath("/admin/products");
  return { deleted: ownIds.length };
}

/** 批量设类目（空字符串 = 清空）。仅当前工厂。 */
export async function bulkSetCategory(ids: string[], category: string) {
  const factory = await authedFactory();
  if (!ids.length) return { updated: 0 };
  let cat: string | null = null;
  if (category) {
    if (!isCategory(category)) throw await adminErr("unknownCategory");
    cat = category;
  }
  const categoryId = await categoryIdByKind(factory.id, cat);
  const r = await prisma.product.updateMany({
    where: { id: { in: ids }, factoryId: factory.id },
    data: { category: cat, categoryId },
  });
  revalidatePath("/admin/products");
  return { updated: r.count };
}

/** 批量设系列（空字符串 = 清空）。仅当前工厂。 */
export async function bulkSetSeries(ids: string[], series: string) {
  const factory = await authedFactory();
  if (!ids.length) return { updated: 0 };
  const name = series.trim() || null;
  const seriesId = await seriesIdByName(factory.id, name);
  const r = await prisma.product.updateMany({
    where: { id: { in: ids }, factoryId: factory.id },
    data: { series: name, seriesId },
  });
  revalidatePath("/admin/products");
  return { updated: r.count };
}

/* ── 变体组（同款不同规格，如 50W/100W/150W） ─────────────────── */

/** 组内仅剩 ≤1 个成员时解散该组（单品没有"变体"可言）。 */
async function dissolveIfSingleton(variantGroupId: string) {
  const rest = await prisma.product.findMany({
    where: { variantGroupId },
    select: { id: true },
  });
  if (rest.length === 1) {
    await prisma.product.update({
      where: { id: rest[0].id },
      data: { variantGroupId: null },
    });
  }
}

/**
 * 把另一产品并入当前产品的变体组；当前无组则新建（组 key 取当前产品 id，稳定唯一）。
 * 对方已在别的组时视为「移动」，其旧组只剩单品则自动解散。
 */
export async function addVariantMember(input: {
  productId: string;
  otherId: string;
}) {
  const factory = await authedFactory();
  await assertOwned(input.productId, factory.id);
  await assertOwned(input.otherId, factory.id);
  if (input.productId === input.otherId) throw await adminErr("selfVariant");

  const [me, other] = await Promise.all([
    prisma.product.findUnique({
      where: { id: input.productId },
      select: { variantGroupId: true },
    }),
    prisma.product.findUnique({
      where: { id: input.otherId },
      select: { variantGroupId: true },
    }),
  ]);
  const gid = me?.variantGroupId ?? input.productId;
  await prisma.$transaction([
    prisma.product.update({
      where: { id: input.productId },
      data: { variantGroupId: gid },
    }),
    prisma.product.update({
      where: { id: input.otherId },
      data: { variantGroupId: gid },
    }),
  ]);
  if (other?.variantGroupId && other.variantGroupId !== gid) {
    await dissolveIfSingleton(other.variantGroupId);
  }
  revalidatePath(`/admin/products/${input.productId}`);
  revalidatePath(`/admin/products/${input.otherId}`);
}

/** 把成员移出变体组；组里只剩一个时顺带解散。 */
export async function removeVariantMember(input: {
  productId: string;
  memberId: string;
}) {
  const factory = await authedFactory();
  await assertOwned(input.productId, factory.id);
  await assertOwned(input.memberId, factory.id);

  const member = await prisma.product.findUnique({
    where: { id: input.memberId },
    select: { variantGroupId: true },
  });
  if (!member?.variantGroupId) return;
  await prisma.product.update({
    where: { id: input.memberId },
    data: { variantGroupId: null },
  });
  await dissolveIfSingleton(member.variantGroupId);
  revalidatePath(`/admin/products/${input.productId}`);
  revalidatePath(`/admin/products/${input.memberId}`);
}

/** 保存组内某成员的规格标签（前台规格选择按钮文案；空 = 回退型号）。 */
export async function saveVariantLabel(input: {
  productId: string;
  memberId: string;
  label: string;
}) {
  const factory = await authedFactory();
  await assertOwned(input.productId, factory.id);
  await assertOwned(input.memberId, factory.id);
  await prisma.product.update({
    where: { id: input.memberId },
    data: { variantLabel: input.label.trim() || null },
  });
  revalidatePath(`/admin/products/${input.productId}`);
  revalidatePath(`/admin/products/${input.memberId}`);
}

/* ── 产品复制（非父子变体模型的配套：快速复制一份再改细节） ───── */

/**
 * 复制产品：内容字段全量带走（含规格/亮点/图文详情/译文），R2 图片物理复制
 * （删除互不连坐）；文档/视频/统计不带（datasheet 等资料按型号各自上传）。
 * asVariant = true 时复制体加入源产品的变体组（源无组则就地建组），用于
 * 「同款不同规格」工作流。返回新产品 id 供前端跳转。
 */
export async function duplicateProduct(input: {
  productId: string;
  asVariant?: boolean;
}): Promise<string> {
  const factory = await authedFactory();
  await assertOwned(input.productId, factory.id);

  const src = await prisma.product.findUnique({
    where: { id: input.productId },
    include: { images: { orderBy: { sortOrder: "asc" } } },
  });
  if (!src) throw await adminErr("productNotFound");

  // 型号 / sourceId 唯一：-COPY、-COPY2、…
  let modelNumber = `${src.modelNumber}-COPY`;
  for (let i = 2; ; i++) {
    const dupe = await prisma.product.findUnique({
      where: {
        factoryId_sourceId: { factoryId: factory.id, sourceId: modelNumber },
      },
      select: { id: true },
    });
    if (!dupe) break;
    modelNumber = `${src.modelNumber}-COPY${i}`;
  }

  // slug 全局唯一（与 createProduct 同法）
  const base = catalogSlug(modelNumber, "product");
  let slug = base;
  for (
    let i = 1;
    await prisma.product.findUnique({ where: { slug }, select: { id: true } });
    i++
  ) {
    slug = `${base}-${i}`;
  }

  // R2 图片物理复制（外链原样共享，删除对外链本就 no-op）
  const coverImage = src.coverImage
    ? await copyInR2(src.coverImage, "copies")
    : null;
  const imageRows = await Promise.all(
    src.images.map(async (img, i) => ({
      url: await copyInR2(img.url, "copies"),
      alt: img.alt,
      sortOrder: i,
    }))
  );

  // 变体组：作为变体复制时与源同组（源无组则以源 id 建组）
  let variantGroupId: string | null = null;
  if (input.asVariant) {
    variantGroupId = src.variantGroupId ?? src.id;
    if (!src.variantGroupId) {
      await prisma.product.update({
        where: { id: src.id },
        data: { variantGroupId },
      });
    }
  }

  // Prisma Json 列：null 不能直接回写 create，置 undefined 跳过
  const j = <T>(v: T | null): T | undefined => (v === null ? undefined : v);

  const copy = await prisma.product.create({
    data: {
      factoryId: factory.id,
      sourceId: modelNumber,
      slug,
      modelNumber,
      name: src.name,
      description: src.description,
      specs: j(src.specs),
      certifications: src.certifications,
      coverImage,
      category: src.category,
      series: src.series,
      categoryId: src.categoryId,
      seriesId: src.seriesId,
      attributes: j(src.attributes),
      tagline: src.tagline,
      variantLabel: null,
      variantGroupId,
      highlights: j(src.highlights),
      detailBlocks: j(src.detailBlocks),
      applications: j(src.applications),
      faq: j(src.faq),
      luminaireType: src.luminaireType,
      boxContents: j(src.boxContents),
      install: j(src.install),
      dimensions: j(src.dimensions),
      sourceLocale: src.sourceLocale,
      contentI18n: j(src.contentI18n),
      translationStamp: src.translationStamp,
      images: imageRows.length ? { createMany: { data: imageRows } } : undefined,
    },
    select: { id: true },
  });

  // 复制体带走了源的全部内容/译文：按拷贝后的实际内容算就绪度
  await recomputeReadiness(copy.id);
  revalidatePath("/admin/products");
  revalidatePath(`/admin/products/${src.id}`);
  return copy.id;
}
