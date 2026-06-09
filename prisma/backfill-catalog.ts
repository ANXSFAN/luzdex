// 把现有「类目枚举字符串 / 系列文本」回填成 Category / Series 管理实体，并回填产品外键。
// 安全、幂等、可重复运行；只动 catalog 与产品的 categoryId/seriesId，绝不触碰 Factory / AdminUser。
// 运行：npm run db:backfill-catalog
import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client.js";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({ connectionString: process.env.DIRECT_URL! });
const prisma = new PrismaClient({ adapter });

function slugify(s: string, fallback: string): string {
  const base = s
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9一-龥]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return base || fallback;
}

async function main() {
  const factories = await prisma.factory.findMany({
    select: { id: true, name: true },
  });

  for (const f of factories) {
    // 分类完全交给后台自建（多级目录树），脚本不再预置任何分类。
    // 仅把现有 series 字符串回填成 Series 实体 + 回填 seriesId。
    const rows = await prisma.product.findMany({
      where: { factoryId: f.id, series: { not: null } },
      select: { series: true, category: true },
    });
    const seriesNames = [...new Set(rows.map((r) => r.series!).filter(Boolean))];
    const usedSlugs = new Set<string>();
    let si = 0;
    for (const name of seriesNames) {
      const baseSlug = slugify(name, `series-${si}`);
      let slug = baseSlug;
      let n = 1;
      while (usedSlugs.has(slug)) slug = `${baseSlug}-${n++}`;
      usedSlugs.add(slug);

      const ser = await prisma.series.upsert({
        where: { factoryId_slug: { factoryId: f.id, slug } },
        update: {},
        create: { factoryId: f.id, name, slug, sortOrder: si },
      });
      await prisma.product.updateMany({
        where: { factoryId: f.id, series: name, seriesId: null },
        data: { seriesId: ser.id },
      });
      si++;
    }

    console.log(`工厂「${f.name}」：系列 ${seriesNames.length} 个已回填`);
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    prisma.$disconnect();
    process.exit(1);
  });
