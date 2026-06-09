import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getActiveFactory } from "@/lib/active-factory";
import { fetchMainSiteProducts, productName } from "@/lib/main-site";

// Pull the product catalog from the main site into the local mirror.
// Upsert only — never deletes, so a discontinued product keeps its datasheet.
// Scoped to the admin's currently-selected factory (see lib/active-factory).
export async function POST() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "未授权" }, { status: 401 });

  const factory = await getActiveFactory();
  if (!factory) {
    return NextResponse.json(
      { error: "未找到工厂记录，请先运行 db:seed" },
      { status: 500 },
    );
  }

  let products;
  try {
    products = await fetchMainSiteProducts();
  } catch (e) {
    const msg = e instanceof Error ? e.message : "拉取主站产品失败";
    return NextResponse.json({ error: msg }, { status: 502 });
  }

  let created = 0;
  let updated = 0;

  for (const p of products) {
    const name = productName(p.content) || p.modelNumber;
    const coverImage = p.images?.[0]?.url ?? null;

    const existing = await prisma.product.findUnique({
      where: { factoryId_sourceId: { factoryId: factory.id, sourceId: p.id } },
    });

    if (existing) {
      // 本地编辑为准：已建档的产品，同步只更新 syncedAt，不回写 name/型号/封面，
      // 避免覆盖后台对名称 / 型号 / 封面的手动修改。主站只负责「第一批建档」。
      await prisma.product.update({
        where: { id: existing.id },
        data: { syncedAt: new Date() },
      });
      updated++;
    } else {
      await prisma.product.create({
        data: {
          sourceId: p.id,
          slug: p.slug,
          modelNumber: p.modelNumber,
          name,
          coverImage,
          factoryId: factory.id,
        },
      });
      created++;
    }
  }

  return NextResponse.json({ created, updated, total: products.length });
}
