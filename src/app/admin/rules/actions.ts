"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getActiveFactory } from "@/lib/active-factory";
import { parseAttributes } from "@/lib/products";
import { adminErr } from "@/lib/admin-err";
import {
  parseConditions,
  suggestByRules,
  type CompatCondition,
  type CompatRuleData,
} from "@/lib/compat";

async function authedFactory() {
  const session = await auth();
  if (!session) throw await adminErr("unauthorized");
  const factory = await getActiveFactory();
  if (!factory) throw await adminErr("noFactory");
  return factory;
}

async function assertCat(id: string, factoryId: string) {
  const c = await prisma.category.findUnique({ where: { id }, select: { factoryId: true } });
  if (!c || c.factoryId !== factoryId) throw await adminErr("catNotFound");
}

const RELATIONS = ["accessory", "alternative", "required"];

async function clean(input: {
  label: string;
  description?: string;
  fromCategoryId: string;
  toCategoryId: string;
  relation: string;
  bidirectional: boolean;
  conditions: unknown;
  autoLink: boolean;
  enabled: boolean;
  priority: number;
}) {
  const label = input.label.trim();
  if (!label) throw await adminErr("ruleNameRequired");
  if (!input.fromCategoryId || !input.toCategoryId) throw await adminErr("ruleCatsRequired");
  const relation = RELATIONS.includes(input.relation) ? input.relation : "accessory";
  return {
    label,
    description: input.description?.trim() || null,
    relation,
    bidirectional: !!input.bidirectional,
    conditions: parseConditions(input.conditions) as unknown as object,
    autoLink: !!input.autoLink,
    enabled: !!input.enabled,
    priority: Number.isFinite(input.priority) ? Math.trunc(input.priority) : 0,
  };
}

export async function createRule(input: {
  label: string;
  description?: string;
  fromCategoryId: string;
  toCategoryId: string;
  relation: string;
  bidirectional: boolean;
  conditions: unknown;
  autoLink: boolean;
  enabled: boolean;
  priority: number;
}) {
  const factory = await authedFactory();
  await assertCat(input.fromCategoryId, factory.id);
  await assertCat(input.toCategoryId, factory.id);
  const data = await clean(input);
  const created = await prisma.compatRule.create({
    data: {
      factoryId: factory.id,
      fromCategoryId: input.fromCategoryId,
      toCategoryId: input.toCategoryId,
      ...data,
    },
  });
  revalidatePath("/admin/rules");
  return created.id;
}

export async function updateRule(
  id: string,
  input: {
    label: string;
    description?: string;
    fromCategoryId: string;
    toCategoryId: string;
    relation: string;
    bidirectional: boolean;
    conditions: unknown;
    autoLink: boolean;
    enabled: boolean;
    priority: number;
  },
) {
  const factory = await authedFactory();
  const r = await prisma.compatRule.findUnique({ where: { id }, select: { factoryId: true } });
  if (!r || r.factoryId !== factory.id) throw await adminErr("ruleNotFound");
  await assertCat(input.fromCategoryId, factory.id);
  await assertCat(input.toCategoryId, factory.id);
  const data = await clean(input);
  await prisma.compatRule.update({
    where: { id },
    data: {
      fromCategoryId: input.fromCategoryId,
      toCategoryId: input.toCategoryId,
      ...data,
    },
  });
  revalidatePath("/admin/rules");
}

export async function deleteRule(id: string) {
  const factory = await authedFactory();
  await prisma.compatRule.deleteMany({ where: { id, factoryId: factory.id } });
  revalidatePath("/admin/rules");
}

export async function toggleRule(id: string, enabled: boolean) {
  const factory = await authedFactory();
  await prisma.compatRule.updateMany({
    where: { id, factoryId: factory.id },
    data: { enabled },
  });
  revalidatePath("/admin/rules");
}

/**
 * 按「自动建链」规则在全工厂跑一遍：对每个产品计算建议，命中 autoLink 规则的直接建 ProductLink。
 * 幂等(upsert)；只动 autoLink=true 的规则，不碰仅建议的。返回新建链接数。
 */
export async function applyAutoLinkRules(): Promise<{ created: number; scanned: number }> {
  const factory = await authedFactory();

  const [products, cats, rawRules] = await Promise.all([
    prisma.product.findMany({
      where: { factoryId: factory.id },
      select: { id: true, modelNumber: true, name: true, categoryId: true, attributes: true },
    }),
    prisma.category.findMany({
      where: { factoryId: factory.id },
      select: { id: true, parentId: true },
    }),
    prisma.compatRule.findMany({
      where: { factoryId: factory.id, enabled: true, autoLink: true },
      orderBy: { priority: "desc" },
    }),
  ]);
  if (rawRules.length === 0) return { created: 0, scanned: products.length };

  const rules: CompatRuleData[] = rawRules.map((r) => ({
    id: r.id,
    label: r.label,
    fromCategoryId: r.fromCategoryId,
    toCategoryId: r.toCategoryId,
    relation: r.relation,
    bidirectional: r.bidirectional,
    conditions: parseConditions(r.conditions) as CompatCondition[],
    enabled: r.enabled,
    priority: r.priority,
  }));

  const cps = products.map((p) => ({
    id: p.id,
    modelNumber: p.modelNumber,
    name: p.name,
    categoryId: p.categoryId,
    attributes: parseAttributes(p.attributes) as Record<string, unknown>,
  }));

  // 收集全部目标链接并去重，再 createMany(skipDuplicates) → 拿到真实新建数（幂等）
  const seen = new Set<string>();
  const rows: { factoryId: string; fromId: string; toId: string; relation: string }[] = [];
  for (const p of cps) {
    const suggestions = suggestByRules({ product: p, candidates: cps, rules, categories: cats });
    for (const s of suggestions) {
      const relation = s.relation === "alternative" ? "alternative" : "accessory";
      const key = `${p.id}|${s.toId}|${relation}`;
      if (seen.has(key)) continue;
      seen.add(key);
      rows.push({ factoryId: factory.id, fromId: p.id, toId: s.toId, relation });
    }
  }
  const res = rows.length
    ? await prisma.productLink.createMany({ data: rows, skipDuplicates: true })
    : { count: 0 };

  revalidatePath("/admin/rules");
  revalidatePath("/admin/products");
  return { created: res.count, scanned: cps.length };
}
