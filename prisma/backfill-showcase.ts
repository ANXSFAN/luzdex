// 对既有库补写产品「展示内容」（卖点 / 亮点 / 图文详情），按 slug 定向更新。
// 只 update 产品的展示字段，绝不触碰 Factory / AdminUser，安全可重复运行。
// 运行：npm run db:backfill-showcase
import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client.js";
import { PrismaPg } from "@prisma/adapter-pg";
import { SHOWCASE, PRODUCT_EXTRAS } from "./showcase-data.js";
import { applyFloodlightVariants } from "./variant-demo.js";
import { img } from "./product-images.js";

const adapter = new PrismaPg({ connectionString: process.env.DIRECT_URL! });
const prisma = new PrismaClient({ adapter });

const IMAGE_SETS: Record<
  string,
  {
    coverImage: string;
    extraImages: { url: string; alt?: string }[];
  }
> = {
  "led-strip-2835-ip65": {
    coverImage: img("stripClose"),
    extraImages: [
      { url: img("stripApplication"), alt: "LED 灯带应用 1" },
      { url: img("stripClose"), alt: "LED 灯带应用 2" },
    ],
  },
  "led-downlight-9w": {
    coverImage: img("downlightCeiling"),
    extraImages: [
      { url: img("downlightCeiling"), alt: "筒灯应用场景 1" },
      { url: img("downlightInterior"), alt: "筒灯应用场景 2" },
    ],
  },
  "led-floodlight-100w": {
    coverImage: img("floodlightStadium"),
    extraImages: [
      { url: img("floodlightStadium"), alt: "投光灯户外应用" },
      { url: img("floodlightMast"), alt: "投光灯安装现场" },
    ],
  },
  "led-streetlight-solar-60w": {
    coverImage: img("solarStreetlight"),
    extraImages: [
      { url: img("solarStreetlightRoad"), alt: "太阳能路灯安装" },
    ],
  },
  "led-highbay-200w": {
    coverImage: img("highbayWarehouse"),
    extraImages: [
      { url: img("highbayWarehouse"), alt: "工矿灯应用场景" },
      { url: img("highbayFixture"), alt: "工矿灯散热细节" },
    ],
  },
  "led-panel-36w-600": {
    coverImage: img("panelCeiling"),
    extraImages: [
      { url: img("panelCeiling"), alt: "面板灯办公应用" },
      { url: img("downlightInterior"), alt: "面板灯吊顶安装" },
    ],
  },
};

async function main() {
  let updated = 0;
  const slugs = Object.keys(SHOWCASE);
  for (const slug of slugs) {
    const sc = SHOWCASE[slug];
    const ex = PRODUCT_EXTRAS[slug];
    const imageSet = IMAGE_SETS[slug];
    const product = await prisma.product.findUnique({
      where: { slug },
      select: { id: true },
    });
    if (!product) {
      console.log(`·（未找到） ${slug}`);
      continue;
    }

    await prisma.$transaction(async (tx) => {
      await tx.product.update({
        where: { slug },
        data: {
          coverImage: imageSet?.coverImage,
          tagline: sc.tagline,
          highlights: sc.highlights,
          detailBlocks: sc.detailBlocks,
          applications: sc.applications ?? [],
          faq: sc.faq ?? [],
          luminaireType: ex?.luminaireType ?? null,
          boxContents: ex?.boxContents ?? [],
          install: ex?.install ?? undefined,
        },
      });
      if (imageSet) {
        await tx.productImage.deleteMany({ where: { productId: product.id } });
        if (imageSet.extraImages.length) {
          await tx.productImage.createMany({
            data: imageSet.extraImages.map((image, i) => ({
              productId: product.id,
              url: image.url,
              alt: image.alt ?? null,
              sortOrder: i,
            })),
          });
        }
      }
    });

    updated++;
    console.log(`✓ ${slug}`);
  }
  console.log(`Backfill done — ${updated}/${slugs.length} products updated.`);

  // 投光灯变体组（演示「规格选择」）：给现有 100W 补系列、补建 50W / 150W。
  const main = await prisma.product.findFirst({
    where: { slug: "led-floodlight-100w" },
    select: { factoryId: true },
  });
  if (main) {
    await applyFloodlightVariants(prisma, main.factoryId);
    console.log("✓ 投光灯变体组已写入（50W / 100W / 150W）");
  } else {
    console.log("· 未找到 led-floodlight-100w，跳过变体演示");
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    prisma.$disconnect();
    process.exit(1);
  });
