"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getActiveFactory } from "@/lib/active-factory";
import { uniqueCategorySlug, uniqueSeriesSlug } from "@/lib/catalog";
import { openRouterJSON, type ChatMessage } from "@/lib/ai";
import { routing } from "@/i18n/routing";

async function authedFactory() {
  const session = await auth();
  if (!session) throw new Error("未授权");
  const factory = await getActiveFactory();
  if (!factory) throw new Error("未选择工厂");
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
  if (!c || c.factoryId !== factoryId) throw new Error("分类不存在");
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
  if (!name) throw new Error("分类名不能为空");
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
    if (!name) throw new Error("分类名不能为空");
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
      if (pid === id) throw new Error("不能移到自身下");
      await assertCategoryOwned(pid, factory.id);
      const desc = await descendantIds(factory.id, id);
      if (desc.has(pid)) throw new Error("不能移到自己的子分类下");
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
    throw new Error(
      `该分类（含子分类）下还有 ${productCount} 个产品，请先把产品移到别的分类，再删除分类`,
    );
  }
  await prisma.category.deleteMany({
    where: { id: { in: subtree }, factoryId: factory.id },
  });
  revalidate();
}

/** AI 把分类名（源语言 es）翻译到其余 8 种语言，写入 nameI18n。 */
export async function translateCategory(id: string) {
  const factory = await authedFactory();
  const cat = await assertCategoryOwned(id, factory.id);
  const targets = routing.locales.filter((l) => l !== "es");
  const sys: ChatMessage = {
    role: "system",
    content:
      "You translate a product-category name for a consumer LED lighting catalog. " +
      "Output ONLY a JSON object mapping locale code to the translated name. " +
      "Keep names short, natural and consumer-facing. No extra text.",
  };
  const user: ChatMessage = {
    role: "user",
    content: `Source (Spanish) category name: "${cat.name}". Translate to: ${targets.join(", ")}. Return e.g. {"en":"...","zh":"..."}`,
  };
  const raw = (await openRouterJSON([sys, user])) as Record<string, unknown>;
  const nameI18n: Record<string, string> = {};
  for (const l of targets) if (typeof raw[l] === "string") nameI18n[l] = raw[l] as string;
  await prisma.category.update({ where: { id }, data: { nameI18n } });
  revalidate();
  return nameI18n;
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
  if (!name) throw new Error("系列名不能为空");
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
  if (!ser || ser.factoryId !== factory.id) throw new Error("系列不存在");

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
    if (!name) throw new Error("系列名不能为空");
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

/** AI 把系列名 + 简介（源语言 es）翻译到其余 8 种语言，写入 nameI18n / introI18n。 */
export async function translateSeries(id: string) {
  const factory = await authedFactory();
  const ser = await prisma.series.findUnique({ where: { id } });
  if (!ser || ser.factoryId !== factory.id) throw new Error("系列不存在");
  const targets = routing.locales.filter((l) => l !== "es");
  const sys: ChatMessage = {
    role: "system",
    content:
      "You translate product-series copy for a consumer LED lighting catalog. " +
      "Output ONLY a JSON object of shape {\"name\":{locale:translated},\"intro\":{locale:translated}}. " +
      "Natural, consumer-facing. No contact info / prices. No extra text.",
  };
  const user: ChatMessage = {
    role: "user",
    content:
      `Source (Spanish):\nname: "${ser.name}"\nintro: ${JSON.stringify(ser.intro ?? "")}\n` +
      `Translate to locales: ${targets.join(", ")}.`,
  };
  const raw = (await openRouterJSON([sys, user])) as {
    name?: Record<string, unknown>;
    intro?: Record<string, unknown>;
  };
  const nameI18n: Record<string, string> = {};
  const introI18n: Record<string, string> = {};
  for (const l of targets) {
    if (typeof raw.name?.[l] === "string") nameI18n[l] = raw.name[l] as string;
    if (ser.intro && typeof raw.intro?.[l] === "string")
      introI18n[l] = raw.intro[l] as string;
  }
  await prisma.series.update({ where: { id }, data: { nameI18n, introI18n } });
  revalidate();
  return { nameI18n, introI18n };
}

export async function deleteSeries(id: string) {
  const factory = await authedFactory();
  const ser = await prisma.series.findUnique({ where: { id } });
  if (!ser || ser.factoryId !== factory.id) throw new Error("系列不存在");
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
    if (!cat || cat.factoryId !== factory.id) throw new Error("分类不存在");
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
    if (!ser || ser.factoryId !== factory.id) throw new Error("系列不存在");
    name = ser.name;
  }
  const r = await prisma.product.updateMany({
    where: { id: { in: productIds }, factoryId: factory.id },
    data: { seriesId, series: name },
  });
  revalidate();
  return { updated: r.count };
}
