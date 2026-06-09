import "server-only";
import { prisma } from "@/lib/prisma";

/** 解析多语言名 Json → { [locale]: string }。 */
export function parseNameI18n(json: unknown): Record<string, string> {
  if (!json || typeof json !== "object" || Array.isArray(json)) return {};
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(json as Record<string, unknown>)) {
    if (typeof v === "string" && v.trim()) out[k] = v;
  }
  return out;
}

/** 取某语言的名字：优先该语言译名，缺则回退源 name。 */
export function localizedName(
  name: string,
  nameI18n: unknown,
  locale: string,
): string {
  return parseNameI18n(nameI18n)[locale] || name;
}

/** 生成 slug：保留中英数字，其余转连字符。 */
export function catalogSlug(name: string, fallback: string): string {
  const base = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9一-龥]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return base || fallback;
}

export async function uniqueSeriesSlug(
  factoryId: string,
  name: string,
  excludeId?: string,
): Promise<string> {
  const base = catalogSlug(name, "series");
  let slug = base;
  let n = 1;
  for (;;) {
    const ex = await prisma.series.findUnique({
      where: { factoryId_slug: { factoryId, slug } },
      select: { id: true },
    });
    if (!ex || ex.id === excludeId) return slug;
    slug = `${base}-${n++}`;
  }
}

export async function uniqueCategorySlug(
  factoryId: string,
  name: string,
  excludeId?: string,
): Promise<string> {
  const base = catalogSlug(name, "category");
  let slug = base;
  let n = 1;
  for (;;) {
    const ex = await prisma.category.findUnique({
      where: { factoryId_slug: { factoryId, slug } },
      select: { id: true },
    });
    if (!ex || ex.id === excludeId) return slug;
    slug = `${base}-${n++}`;
  }
}

/** 由 kind 字符串解析当前工厂对应的 categoryId；空 / 找不到 → null。 */
export async function categoryIdByKind(
  factoryId: string,
  kind: string | null,
): Promise<string | null> {
  if (!kind) return null;
  const c = await prisma.category.findFirst({
    where: { factoryId, kind },
    select: { id: true },
  });
  return c?.id ?? null;
}

/**
 * 由系列名解析 seriesId；不存在则创建——保证 ProductRelations 里直接填系列名时
 * 也会落成 Series 实体，目录与编辑器两边永不漂移。空 → null。
 */
export async function seriesIdByName(
  factoryId: string,
  name: string | null,
): Promise<string | null> {
  const nm = name?.trim();
  if (!nm) return null;
  const existing = await prisma.series.findFirst({
    where: { factoryId, name: nm },
    select: { id: true },
  });
  if (existing) return existing.id;
  const slug = await uniqueSeriesSlug(factoryId, nm);
  const count = await prisma.series.count({ where: { factoryId } });
  const created = await prisma.series.create({
    data: { factoryId, name: nm, slug, sortOrder: count },
  });
  return created.id;
}
