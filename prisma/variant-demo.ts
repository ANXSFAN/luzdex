// 演示用：投光灯功率变体组。让公开页出现京东式「规格选择」切换栏。
// 现有的 100W（led-floodlight-100w）+ 这里新增的 50W / 150W 共用同一 series，
// 三者互为变体。单一数据源：seed.ts 建库、backfill-showcase.ts 补库共用。

import { img } from "./product-images.js";

export const FLOODLIGHT_SERIES = "floodlight-pro";
export const FLOODLIGHT_MAIN_SLUG = "led-floodlight-100w";
export const FLOODLIGHT_MAIN_VARIANT_LABEL = "100W";

type SpecRow = { group?: string; label: string; value: string; unit?: string };
type Highlight = { icon: string; label: string; value?: string };

export type VariantProduct = {
  slug: string;
  sourceId: string;
  modelNumber: string;
  name: string;
  description: string;
  certifications: string[];
  specs: SpecRow[];
  coverImage: string;
  variantLabel: string;
  tagline: string;
  highlights: Highlight[];
};

export const FLOODLIGHT_VARIANTS: VariantProduct[] = [
  {
    slug: "led-floodlight-50w",
    sourceId: "seed-floodlight-50w",
    modelNumber: "FL-50W-IP66",
    name: "LED 投光灯 50W 户外防水",
    description:
      "中小场景户外 LED 投光灯，IP66 全防水 + IK08 抗冲击，130 lm/W 高光效，适用于庭院、招牌、门头与小型广告牌的近距离泛光照明。",
    certifications: ["CE", "RoHS", "IP66", "IK08"],
    coverImage: img("floodlightMast"),
    variantLabel: "50W",
    tagline: "IP66 全防水 · IK08 抗冲击 · 130lm/W 高光效",
    highlights: [
      { icon: "droplet", label: "防水防尘", value: "IP66" },
      { icon: "shield", label: "抗冲击", value: "IK08" },
      { icon: "sun", label: "整灯光效", value: "130lm/W" },
      { icon: "gauge", label: "总光通量", value: "6,500lm" },
    ],
    specs: [
      { group: "Electrical", label: "功率", value: "50", unit: "W" },
      { group: "Electrical", label: "输入电压", value: "AC 100–277", unit: "V" },
      { group: "Photometric", label: "光通量", value: "6,500", unit: "lm" },
      { group: "Photometric", label: "光效", value: "130", unit: "lm/W" },
      { group: "Photometric", label: "色温", value: "4000 / 5000", unit: "K" },
      { group: "Mechanical", label: "尺寸", value: "220 × 180 × 55", unit: "mm" },
      { group: "Mechanical", label: "防护等级", value: "IP66 / IK08" },
      { group: "Lifetime", label: "寿命 L70", value: "50,000", unit: "h" },
    ],
  },
  {
    slug: "led-floodlight-150w",
    sourceId: "seed-floodlight-150w",
    modelNumber: "FL-150W-IP66",
    name: "LED 投光灯 150W 户外防水",
    description:
      "大场景户外 LED 投光灯，IP66 全防水 + IK08 抗冲击，130 lm/W 高光效，适用于体育场、大型广告牌、堆场与建筑立面的远距离大面积投射。",
    certifications: ["CE", "RoHS", "ENEC", "IP66", "IK08"],
    coverImage: img("floodlightStadium"),
    variantLabel: "150W",
    tagline: "IP66 全防水 · IK08 抗冲击 · 19,500lm 大光通",
    highlights: [
      { icon: "droplet", label: "防水防尘", value: "IP66" },
      { icon: "shield", label: "抗冲击", value: "IK08" },
      { icon: "sun", label: "整灯光效", value: "130lm/W" },
      { icon: "gauge", label: "总光通量", value: "19,500lm" },
    ],
    specs: [
      { group: "Electrical", label: "功率", value: "150", unit: "W" },
      { group: "Electrical", label: "输入电压", value: "AC 100–277", unit: "V" },
      { group: "Photometric", label: "光通量", value: "19,500", unit: "lm" },
      { group: "Photometric", label: "光效", value: "130", unit: "lm/W" },
      { group: "Photometric", label: "色温", value: "4000 / 5000", unit: "K" },
      { group: "Mechanical", label: "尺寸", value: "320 × 250 × 65", unit: "mm" },
      { group: "Mechanical", label: "防护等级", value: "IP66 / IK08" },
      { group: "Lifetime", label: "寿命 L70", value: "50,000", unit: "h" },
    ],
  },
];

/**
 * 把投光灯变体组写入库：现有 100W 补 series + variantLabel，新增 50W / 150W。
 * prisma 用 any 以兼容 seed / backfill 各自创建的 client 实例，避免类型耦合。
 */
export async function applyFloodlightVariants(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  prisma: any,
  factoryId: string
) {
  await prisma.product.updateMany({
    where: { slug: FLOODLIGHT_MAIN_SLUG },
    data: {
      series: FLOODLIGHT_SERIES,
      variantLabel: FLOODLIGHT_MAIN_VARIANT_LABEL,
    },
  });

  for (const v of FLOODLIGHT_VARIANTS) {
    const data = {
      modelNumber: v.modelNumber,
      name: v.name,
      description: v.description,
      specs: v.specs,
      certifications: v.certifications,
      coverImage: v.coverImage,
      tagline: v.tagline,
      highlights: v.highlights,
      series: FLOODLIGHT_SERIES,
      variantLabel: v.variantLabel,
    };
    await prisma.product.upsert({
      where: { slug: v.slug },
      update: data,
      create: { ...data, slug: v.slug, sourceId: v.sourceId, factoryId },
    });
  }
}
