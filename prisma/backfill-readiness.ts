// 给存量产品回填就绪度派生列（lacksShowcase / stale）。一次性、可重复安全运行。
// 仅 update products 的这两列,绝不触碰其它字段 / 其它表 / Factory / AdminUser。
// 加完 lacksShowcase/stale 列后跑一次；任何批量 seed/抓数脚本之后也可再跑一次刷新。
// 判定口径与 src/lib/products.ts 的 productReadiness 严格一致（见下注释）。
// 运行：npm run db:backfill-readiness
import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client.js";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({ connectionString: process.env.DIRECT_URL! });
const prisma = new PrismaClient({ adapter });

// 与 src/lib/products.ts 的 specsWithoutKeys 一致：指纹口径剥掉字典 key
function specsWithoutKeys(specs: unknown): unknown {
  if (!Array.isArray(specs)) return specs;
  return specs.map((row) => {
    if (row && typeof row === "object" && "key" in (row as object)) {
      const { key: _key, ...rest } = row as Record<string, unknown>;
      void _key;
      return rest;
    }
    return row;
  });
}

// 与 contentSourceHash 一致（同字段 / 同顺序 / 同 djb2）。少一字段戳就永远对不上
// → 全部产品被误标「译文过期」。改这里务必同步 src/lib/products.ts。
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function srcHash(p: any): string {
  const s = JSON.stringify([
    p.name, p.description, p.tagline, p.highlights, p.applications,
    p.faq, p.boxContents, p.install, p.dimensions, p.detailBlocks,
    specsWithoutKeys(p.specs), p.sourceLocale,
  ]);
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h * 33) ^ s.charCodeAt(i)) >>> 0;
  return h.toString(16);
}

// 与 parseHighlights / parseApplications 的「有效项」判定一致：label / title 为非空字符串
function hasLabeled(json: unknown, key: "label" | "title"): boolean {
  if (!Array.isArray(json)) return false;
  return json.some((r) => {
    if (!r || typeof r !== "object") return false;
    const v = (r as Record<string, unknown>)[key];
    return typeof v === "string" && v.trim().length > 0;
  });
}

// 与 parseDetailBlocks 一致：image 需 url；heading/text 需 text
function hasDetailBlock(json: unknown): boolean {
  if (!Array.isArray(json)) return false;
  return json.some((r) => {
    if (!r || typeof r !== "object") return false;
    const x = r as Record<string, unknown>;
    if (x.kind === "image") return typeof x.url === "string" && x.url.trim().length > 0;
    if (x.kind === "heading" || x.kind === "text")
      return typeof x.text === "string" && x.text.trim().length > 0;
    return false;
  });
}

async function main() {
  const products = await prisma.product.findMany({
    select: {
      id: true, name: true, description: true, tagline: true,
      highlights: true, applications: true, faq: true, boxContents: true,
      install: true, dimensions: true, detailBlocks: true, specs: true,
      sourceLocale: true, contentI18n: true, translationStamp: true,
    },
  });

  let changed = 0;
  for (const p of products) {
    const lacksShowcase =
      !hasLabeled(p.highlights, "label") &&
      !hasLabeled(p.applications, "title") &&
      !hasDetailBlock(p.detailBlocks);

    const ci = p.contentI18n;
    const translatedCount =
      ci && typeof ci === "object" && !Array.isArray(ci)
        ? Object.keys(ci as object).length
        : 0;
    const stale =
      translatedCount > 0 &&
      !!p.translationStamp &&
      srcHash(p) !== p.translationStamp;

    await prisma.product.update({
      where: { id: p.id },
      data: { lacksShowcase, stale },
    });
    changed++;
  }

  console.log(`✓ backfilled readiness (lacksShowcase/stale) for ${changed} products`);
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    return prisma.$disconnect().finally(() => process.exit(1));
  });
