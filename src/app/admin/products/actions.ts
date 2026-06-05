"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getActiveFactory } from "@/lib/active-factory";
import { isCategory } from "@/lib/matching";
import type { ProductAttributes } from "@/lib/products";

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
