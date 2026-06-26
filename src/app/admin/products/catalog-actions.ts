"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getActiveFactory } from "@/lib/active-factory";
import { uniqueCategorySlug, uniqueSeriesSlug } from "@/lib/catalog";
import { openRouterJSON, type ChatMessage } from "@/lib/ai";
import { adminErr } from "@/lib/admin-err";
import { routing } from "@/i18n/routing";

async function authedFactory() {
  const session = await auth();
  if (!session) throw await adminErr("unauthorized");
  const factory = await getActiveFactory();
  if (!factory) throw await adminErr("noFactory");
  return factory;
}

function revalidate() {
  revalidatePath("/admin/products");
  revalidatePath("/admin");
}

/* ───────────── 分类 Category ───────────── */

const KINDS = ["strip", "channel", "power", "connector", "accessory"];

async function assertCategoryOwned(id: string, factoryId: string) {
  const c = await prisma.category.findUnique({ where: { id } });
  if (!c || c.factoryId !== factoryId) throw await adminErr("catNotFound");
  return c;
}

/** 该分类的所有后代 id（用于移动时防成环）。 */
async function descendantIds(factoryId: string, rootId: string): Promise<Set<string>> {
  const all = await prisma.category.findMany({
    where: { factoryId },
    select: { id: true, parentId: true },
  });
  const childrenOf = new Map<string, string[]>();
  for (const c of all) {
    if (!c.parentId) continue;
    if (!childrenOf.has(c.parentId)) childrenOf.set(c.parentId, []);
    childrenOf.get(c.parentId)!.push(c.id);
  }
  const out = new Set<string>();
  const stack = [rootId];
  while (stack.length) {
    const cur = stack.pop()!;
    for (const ch of childrenOf.get(cur) ?? []) {
      if (!out.has(ch)) {
        out.add(ch);
        stack.push(ch);
      }
    }
  }
  return out;
}

export async function createCategory(input: {
  name: string;
  parentId?: string | null;
  kind?: string;
}) {
  const factory = await authedFactory();
  const name = input.name.trim();
  if (!name) throw await adminErr("catNameRequired");
  if (input.parentId) await assertCategoryOwned(input.parentId, factory.id);
  const kind = input.kind && KINDS.includes(input.kind) ? input.kind : null;
  const slug = await uniqueCategorySlug(factory.id, name);
  const count = await prisma.category.count({
    where: { factoryId: factory.id, parentId: input.parentId || null },
  });
  const created = await prisma.category.create({
    data: {
      factoryId: factory.id,
      parentId: input.parentId || null,
      name,
      slug,
      kind,
      sortOrder: count,
    },
  });
  revalidate();
  return created.id;
}

export async function updateCategory(
  id: string,
  input: {
    name?: string;
    nameI18n?: Record<string, string>;
    image?: string;
    icon?: string;
    kind?: string | null;
    parentId?: string | null;
  },
) {
  const factory = await authedFactory();
  await assertCategoryOwned(id, factory.id);
  const data: {
    name?: string;
    nameI18n?: Record<string, string>;
    image?: string | null;
    icon?: string | null;
    kind?: string | null;
    parentId?: string | null;
  } = {};
  if (input.name !== undefined) {
    const name = input.name.trim();
    if (!name) throw await adminErr("catNameRequired");
    data.name = name;
  }
  if (input.nameI18n !== undefined) {
    const clean: Record<string, string> = {};
    for (const [k, v] of Object.entries(input.nameI18n))
      if (routing.locales.includes(k as never) && v.trim()) clean[k] = v.trim();
    data.nameI18n = clean;
  }
  if (input.image !== undefined) data.image = input.image.trim() || null;
  if (input.icon !== undefined) data.icon = input.icon.trim() || null;
  if (input.parentId !== undefined) {
    const pid = input.parentId || null;
    if (pid) {
      if (pid === id) throw await adminErr("moveIntoSelf");
      await assertCategoryOwned(pid, factory.id);
      const desc = await descendantIds(factory.id, id);
      if (desc.has(pid)) throw await adminErr("moveIntoChild");
    }
    data.parentId = pid;
  }
  if (input.kind !== undefined) {
    data.kind = input.kind && KINDS.includes(input.kind) ? input.kind : null;
    await prisma.product.updateMany({
      where: { factoryId: factory.id, categoryId: id },
      data: { category: data.kind },
    });
  }
  await prisma.category.update({ where: { id }, data });
  revalidate();
}

/**
 * 删除分类。安全语义（对齐 ERP 做法）：该分类**及其所有子分类**下只要还有产品，
 * 一律**拒绝删除**并提示先移走——产品永远不会被连带删除。空分类树才允许整棵删除。
 */
export async function deleteCategory(id: string) {
  const factory = await authedFactory();
  await assertCategoryOwned(id, factory.id);
  const desc = await descendantIds(factory.id, id);
  const subtree = [id, ...desc];
  const productCount = await prisma.product.count({
    where: { factoryId: factory.id, categoryId: { in: subtree } },
  });
  if (productCount > 0) {
    throw await adminErr("catHasProducts", { n: productCount });
  }
  await prisma.category.deleteMany({
    where: { id: { in: subtree }, factoryId: factory.id },
  });
  revalidate();
}

const LOCALE_NAMES: Record<string, string> = {
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
 * 从任意源语言把若干文本字段翻成其余语言。返回 { 字段: { locale: 文本 } }，
 * 其中也含源语言本身（=原文），便于调用方按 name(es) / i18n(其余) 拆分回填。
 * 空字段跳过，不调用 AI 时按字段返回仅含源语言的映射。
 */
async function aiTranslate(
  sourceLocale: string,
  fields: { key: string; text: string }[],
): Promise<Record<string, Record<string, string>>> {
  const filled = fields.filter((f) => f.text.trim());
  const out: Record<string, Record<string, string>> = {};
  for (const f of filled) out[f.key] = { [sourceLocale]: f.text.trim() };
  const targets = routing.locales.filter((l) => l !== sourceLocale);
  if (!filled.length || !targets.length) return out;

  const sys: ChatMessage = {
    role: "system",
    content:
      "You translate short product-catalog copy for a consumer LED lighting catalog. " +
      "Output ONLY a JSON object mapping each field key to an object of {locale: translation}. " +
      "Natural, short, consumer-facing. No contact info, no prices. No extra text.",
  };
  const user: ChatMessage = {
    role: "user",
    content:
      `Source language: ${LOCALE_NAMES[sourceLocale] ?? sourceLocale}.\n` +
      filled.map((f) => `${f.key}: ${JSON.stringify(f.text.trim())}`).join("\n") +
      `\nTranslate every field into these locales: ${targets.join(", ")}.\n` +
      `Return shape: {"${filled[0].key}":{"en":"...","zh":"..."}}`,
  };
  const raw = (await openRouterJSON([sys, user])) as Record<string, unknown>;
  for (const f of filled) {
    const m = raw[f.key];
    if (m && typeof m === "object" && !Array.isArray(m)) {
      for (const l of targets) {
        const v = (m as Record<string, unknown>)[l];
        if (typeof v === "string" && v.trim()) out[f.key][l] = v.trim();
      }
    }
  }
  return out;
}

/** AI 把分类名从任意源语言翻到其余语言；es 落 name 列，其余落 nameI18n。 */
export async function translateCategory(
  id: string,
  sourceLocale: string,
  name: string,
) {
  const factory = await authedFactory();
  await assertCategoryOwned(id, factory.id);
  if (!routing.locales.includes(sourceLocale as never))
    throw await adminErr("catNameRequired");
  const text = name.trim();
  if (!text) throw await adminErr("catNameRequired");

  const res = await aiTranslate(sourceLocale, [{ key: "name", text }]);
  const map = res.name ?? { [sourceLocale]: text };
  const esName = map.es || text;
  const nameI18n: Record<string, string> = {};
  for (const l of routing.locales) if (l !== "es" && map[l]) nameI18n[l] = map[l];

  await prisma.category.update({ where: { id }, data: { name: esName, nameI18n } });
  revalidate();
  return { name: esName, nameI18n };
}

export async function reorderCategories(orderedIds: string[]) {
  const factory = await authedFactory();
  const own = await prisma.category.findMany({
    where: { factoryId: factory.id },
    select: { id: true },
  });
  const ownSet = new Set(own.map((c) => c.id));
  const ids = orderedIds.filter((i) => ownSet.has(i));
  await prisma.$transaction(
    ids.map((id, i) =>
      prisma.category.update({ where: { id }, data: { sortOrder: i } }),
    ),
  );
  revalidate();
}

/* ───────────── 系列 Series ───────────── */

export async function createSeries(input: {
  name: string;
  categoryId?: string | null;
  intro?: string;
  coverImage?: string;
}) {
  const factory = await authedFactory();
  const name = input.name.trim();
  if (!name) throw await adminErr("seriesNameRequired");
  const slug = await uniqueSeriesSlug(factory.id, name);
  const count = await prisma.series.count({ where: { factoryId: factory.id } });
  const created = await prisma.series.create({
    data: {
      factoryId: factory.id,
      name,
      slug,
      categoryId: input.categoryId || null,
      intro: input.intro?.trim() || null,
      coverImage: input.coverImage?.trim() || null,
      sortOrder: count,
    },
  });
  revalidate();
  return created.id;
}

export async function updateSeries(
  id: string,
  input: {
    name?: string;
    nameI18n?: Record<string, string>;
    categoryId?: string | null;
    intro?: string;
    introI18n?: Record<string, string>;
    coverImage?: string;
  },
) {
  const factory = await authedFactory();
  const ser = await prisma.series.findUnique({ where: { id } });
  if (!ser || ser.factoryId !== factory.id) throw await adminErr("seriesNotFound");

  const data: {
    name?: string;
    nameI18n?: Record<string, string>;
    categoryId?: string | null;
    intro?: string | null;
    introI18n?: Record<string, string>;
    coverImage?: string | null;
  } = {};
  if (input.name !== undefined) {
    const name = input.name.trim();
    if (!name) throw await adminErr("seriesNameRequired");
    data.name = name;
    await prisma.product.updateMany({
      where: { factoryId: factory.id, seriesId: id },
      data: { series: name },
    });
  }
  if (input.nameI18n !== undefined) {
    const clean: Record<string, string> = {};
    for (const [k, v] of Object.entries(input.nameI18n))
      if (routing.locales.includes(k as never) && v.trim()) clean[k] = v.trim();
    data.nameI18n = clean;
  }
  if (input.introI18n !== undefined) {
    const clean: Record<string, string> = {};
    for (const [k, v] of Object.entries(input.introI18n))
      if (routing.locales.includes(k as never) && v.trim()) clean[k] = v.trim();
    data.introI18n = clean;
  }
  if (input.categoryId !== undefined) data.categoryId = input.categoryId || null;
  if (input.intro !== undefined) data.intro = input.intro.trim() || null;
  if (input.coverImage !== undefined)
    data.coverImage = input.coverImage.trim() || null;

  await prisma.series.update({ where: { id }, data });
  revalidate();
}

/** AI 把系列名 + 简介从任意源语言翻到其余语言；es 落 name/intro 列，其余落 i18n。 */
export async function translateSeries(
  id: string,
  sourceLocale: string,
  name: string,
  intro: string,
) {
  const factory = await authedFactory();
  const ser = await prisma.series.findUnique({ where: { id } });
  if (!ser || ser.factoryId !== factory.id) throw await adminErr("seriesNotFound");
  if (!routing.locales.includes(sourceLocale as never))
    throw await adminErr("seriesNameRequired");
  const nm = name.trim();
  if (!nm) throw await adminErr("seriesNameRequired");

  const res = await aiTranslate(sourceLocale, [
    { key: "name", text: nm },
    { key: "intro", text: intro.trim() },
  ]);
  const nameMap = res.name ?? { [sourceLocale]: nm };
  const introMap = res.intro ?? {};
  const esName = nameMap.es || nm;
  const esIntro = introMap.es ?? "";
  const nameI18n: Record<string, string> = {};
  const introI18n: Record<string, string> = {};
  for (const l of routing.locales) {
    if (l === "es") continue;
    if (nameMap[l]) nameI18n[l] = nameMap[l];
    if (introMap[l]) introI18n[l] = introMap[l];
  }
  await prisma.series.update({
    where: { id },
    data: { name: esName, nameI18n, intro: esIntro || null, introI18n },
  });
  revalidate();
  return { name: esName, nameI18n, intro: esIntro, introI18n };
}

export async function deleteSeries(id: string) {
  const factory = await authedFactory();
  const ser = await prisma.series.findUnique({ where: { id } });
  if (!ser || ser.factoryId !== factory.id) throw await adminErr("seriesNotFound");
  await prisma.product.updateMany({
    where: { factoryId: factory.id, seriesId: id },
    data: { series: null },
  });
  await prisma.series.delete({ where: { id } });
  revalidate();
}

export async function reorderSeries(orderedIds: string[]) {
  const factory = await authedFactory();
  const own = await prisma.series.findMany({
    where: { factoryId: factory.id },
    select: { id: true },
  });
  const ownSet = new Set(own.map((s) => s.id));
  const ids = orderedIds.filter((i) => ownSet.has(i));
  await prisma.$transaction(
    ids.map((id, i) =>
      prisma.series.update({ where: { id }, data: { sortOrder: i } }),
    ),
  );
  revalidate();
}

/* ───────────── 归类 / 归系列（产品 → 实体） ───────────── */

/** 把若干产品归入某分类（或移出）。同步 category 镜像字符串 = 该分类 kind。 */
export async function assignProductsToCategory(
  productIds: string[],
  categoryId: string | null,
) {
  const factory = await authedFactory();
  if (!productIds.length) return { updated: 0 };
  let kind: string | null = null;
  if (categoryId) {
    const cat = await prisma.category.findUnique({ where: { id: categoryId } });
    if (!cat || cat.factoryId !== factory.id) throw await adminErr("catNotFound");
    kind = cat.kind;
  }
  const r = await prisma.product.updateMany({
    where: { id: { in: productIds }, factoryId: factory.id },
    data: { categoryId, category: kind },
  });
  revalidate();
  return { updated: r.count };
}

/** 把若干产品归入某系列（或移出）。同步 series 镜像字符串 = 该系列 name。 */
export async function assignProductsToSeries(
  productIds: string[],
  seriesId: string | null,
) {
  const factory = await authedFactory();
  if (!productIds.length) return { updated: 0 };
  let name: string | null = null;
  if (seriesId) {
    const ser = await prisma.series.findUnique({ where: { id: seriesId } });
    if (!ser || ser.factoryId !== factory.id) throw await adminErr("seriesNotFound");
    name = ser.name;
  }
  const r = await prisma.product.updateMany({
    where: { id: { in: productIds }, factoryId: factory.id },
    data: { seriesId, series: name },
  });
  revalidate();
  return { updated: r.count };
}
