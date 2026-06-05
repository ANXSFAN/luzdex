import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client.js";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";

const adapter = new PrismaPg({ connectionString: process.env.DIRECT_URL! });
const prisma = new PrismaClient({ adapter });

const SAMPLE_PDF =
  "https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf";

type SpecRow = { group?: string; label: string; value: string; unit?: string };

type SeedProduct = {
  slug: string;
  sourceId: string;
  modelNumber: string;
  name: string;
  description: string;
  certifications: string[];
  specs: SpecRow[];
  coverImage: string;
  extraImages: { url: string; alt?: string }[];
  documents: { title: string; fileName: string }[];
  videos: { title: string; url: string; coverImage: string | null }[];
};

const u = (id: string, w = 1600) =>
  `https://images.unsplash.com/photo-${id}?w=${w}&q=80`;

const products: SeedProduct[] = [
  {
    slug: "led-strip-2835-ip65",
    sourceId: "seed-strip-2835",
    modelNumber: "LS-2835-IP65",
    name: "LED 柔性灯带 2835 IP65",
    description:
      "户外建筑、标识与景观照明用 IP65 防水柔性灯带，每米 120 颗 2835 灯珠，PU 灌封工艺，支持现场按段剪裁与端接连接，适合长距离连续布灯。",
    certifications: ["CE", "RoHS", "IP65"],
    specs: [
      { group: "Electrical", label: "功率", value: "14.4", unit: "W/m" },
      { group: "Electrical", label: "输入电压", value: "DC 24", unit: "V" },
      { group: "Electrical", label: "灯珠密度", value: "120", unit: "LEDs/m" },
      { group: "Photometric", label: "光通量", value: "1,200", unit: "lm/m" },
      { group: "Photometric", label: "色温", value: "3000 / 4000 / 6500", unit: "K" },
      { group: "Photometric", label: "显色指数", value: "≥ 80", unit: "Ra" },
      { group: "Photometric", label: "光束角", value: "120", unit: "°" },
      { group: "Mechanical", label: "宽度", value: "10", unit: "mm" },
      { group: "Mechanical", label: "厚度", value: "2.5", unit: "mm" },
      { group: "Mechanical", label: "外壳", value: "PU 灌封" },
      { group: "Mechanical", label: "防护等级", value: "IP65" },
      { group: "Lifetime", label: "寿命 L70", value: "50,000", unit: "h" },
      { group: "Lifetime", label: "工作温度", value: "-20 ~ +50", unit: "℃" },
    ],
    coverImage: u("1558002038-1055907df827"),
    extraImages: [
      { url: u("1565814329452-e1efa11c5b89"), alt: "LED 灯带应用 1" },
      { url: u("1513506003901-1e6a229e2d15"), alt: "LED 灯带应用 2" },
    ],
    documents: [
      { title: "产品规格书", fileName: "LS-2835-IP65-datasheet.pdf" },
      { title: "安装说明书", fileName: "LS-2835-IP65-install.pdf" },
      { title: "CE 认证证书", fileName: "LS-2835-IP65-CE.pdf" },
    ],
    videos: [
      {
        title: "产品介绍",
        url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
        coverImage: u("1565814329452-e1efa11c5b89", 800),
      },
    ],
  },

  {
    slug: "led-downlight-9w",
    sourceId: "seed-downlight-9w",
    modelNumber: "DL-9W-3CCT",
    name: "LED 嵌入式筒灯 9W 三色温",
    description:
      "商铺、酒店与家居通用嵌入式 LED 筒灯，9W 高显色光源，色温可在 3000 / 4000 / 6500K 之间一键切换，标准 75mm 开孔，适配国内主流吊顶系统。",
    certifications: ["CE", "RoHS", "ENEC"],
    specs: [
      { group: "Electrical", label: "功率", value: "9", unit: "W" },
      { group: "Electrical", label: "输入电压", value: "AC 220, 50/60", unit: "V/Hz" },
      { group: "Electrical", label: "功率因数", value: "> 0.9" },
      { group: "Photometric", label: "光通量", value: "810", unit: "lm" },
      { group: "Photometric", label: "色温", value: "3000 / 4000 / 6500", unit: "K" },
      { group: "Photometric", label: "显色指数", value: "≥ 85", unit: "Ra" },
      { group: "Photometric", label: "光束角", value: "60", unit: "°" },
      { group: "Mechanical", label: "直径 × 高", value: "Ø85 × 38", unit: "mm" },
      { group: "Mechanical", label: "开孔尺寸", value: "Ø75", unit: "mm" },
      { group: "Mechanical", label: "外壳材料", value: "压铸铝 + PC" },
      { group: "Mechanical", label: "防护等级", value: "IP44" },
      { group: "Lifetime", label: "寿命 L70", value: "30,000", unit: "h" },
      { group: "Lifetime", label: "工作温度", value: "-10 ~ +45", unit: "℃" },
    ],
    coverImage: u("1565538810643-b5bdb714032a"),
    extraImages: [
      { url: u("1513506003901-1e6a229e2d15"), alt: "筒灯应用场景 1" },
      { url: u("1497366216548-37526070297c"), alt: "筒灯应用场景 2" },
    ],
    documents: [
      { title: "产品规格书", fileName: "DL-9W-datasheet.pdf" },
      { title: "安装说明书", fileName: "DL-9W-install.pdf" },
    ],
    videos: [
      {
        title: "安装演示",
        url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
        coverImage: u("1513506003901-1e6a229e2d15", 800),
      },
    ],
  },

  {
    slug: "led-floodlight-100w",
    sourceId: "seed-floodlight-100w",
    modelNumber: "FL-100W-IP66",
    name: "LED 投光灯 100W 户外防水",
    description:
      "户外高功率 LED 投光灯，IP66 全防水 + IK08 抗冲击外壳，130 lm/W 高光效，适用于广告牌、体育场、建筑外立面与园区道路的远距离投射照明。",
    certifications: ["CE", "RoHS", "ENEC", "IP66", "IK08"],
    specs: [
      { group: "Electrical", label: "功率", value: "100", unit: "W" },
      { group: "Electrical", label: "输入电压", value: "AC 100–277", unit: "V" },
      { group: "Electrical", label: "功率因数", value: "> 0.95" },
      { group: "Photometric", label: "光通量", value: "13,000", unit: "lm" },
      { group: "Photometric", label: "光效", value: "130", unit: "lm/W" },
      { group: "Photometric", label: "色温", value: "4000 / 5000", unit: "K" },
      { group: "Photometric", label: "显色指数", value: "≥ 80", unit: "Ra" },
      { group: "Photometric", label: "光束角", value: "120", unit: "°" },
      { group: "Mechanical", label: "尺寸", value: "280 × 220 × 60", unit: "mm" },
      { group: "Mechanical", label: "重量", value: "2.1", unit: "kg" },
      { group: "Mechanical", label: "外壳", value: "压铸铝 + 钢化玻璃" },
      { group: "Mechanical", label: "防护等级", value: "IP66 / IK08" },
      { group: "Lifetime", label: "寿命 L70", value: "50,000", unit: "h" },
      { group: "Lifetime", label: "工作温度", value: "-30 ~ +50", unit: "℃" },
    ],
    coverImage: u("1542736667-069246bdbc6d"),
    extraImages: [
      { url: u("1518837695005-2083093ee35b"), alt: "投光灯户外应用" },
      { url: u("1581094794329-c8112a89af12"), alt: "投光灯安装现场" },
    ],
    documents: [
      { title: "产品规格书", fileName: "FL-100W-datasheet.pdf" },
      { title: "光学配光曲线 (IES)", fileName: "FL-100W-ies.pdf" },
      { title: "CE / RoHS 证书", fileName: "FL-100W-cert.pdf" },
    ],
    videos: [
      {
        title: "户外应用案例",
        url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
        coverImage: u("1518837695005-2083093ee35b", 800),
      },
      {
        title: "防水测试",
        url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
        coverImage: null,
      },
    ],
  },

  {
    slug: "led-streetlight-solar-60w",
    sourceId: "seed-streetlight-60w",
    modelNumber: "SL-60W-SOLAR",
    name: "LED 一体化太阳能路灯 60W",
    description:
      "一体化太阳能路灯，搭载 80W 单晶硅光伏板与 30Ah 磷酸铁锂电池，雨天可续航 3 天，整灯无需外部布线，适用于乡村道路、园区与无市电场景。",
    certifications: ["CE", "RoHS", "IP65"],
    specs: [
      { group: "Electrical", label: "LED 功率", value: "60", unit: "W" },
      { group: "Electrical", label: "光伏板", value: "80W 单晶硅" },
      { group: "Electrical", label: "电池", value: "30Ah LiFePO₄" },
      { group: "Photometric", label: "光通量", value: "7,800", unit: "lm" },
      { group: "Photometric", label: "色温", value: "5000", unit: "K" },
      { group: "Photometric", label: "显色指数", value: "≥ 75", unit: "Ra" },
      { group: "Photometric", label: "光束角", value: "140 × 60 (路面配光)", unit: "°" },
      { group: "Mechanical", label: "尺寸", value: "950 × 360 × 95", unit: "mm" },
      { group: "Mechanical", label: "重量", value: "12", unit: "kg" },
      { group: "Mechanical", label: "外壳", value: "铝合金 + PC 透镜" },
      { group: "Mechanical", label: "防护等级", value: "IP65" },
      { group: "Lifetime", label: "LED 寿命 L70", value: "50,000", unit: "h" },
      { group: "Lifetime", label: "电池循环", value: "≥ 2,000", unit: "次" },
      { group: "Lifetime", label: "雨天续航", value: "3", unit: "天" },
    ],
    coverImage: u("1518837695005-2083093ee35b"),
    extraImages: [
      { url: u("1545063328-c8e3faffa16f"), alt: "太阳能路灯安装" },
    ],
    documents: [
      { title: "产品规格书", fileName: "SL-60W-datasheet.pdf" },
      { title: "杆件结构图", fileName: "SL-60W-pole.pdf" },
    ],
    videos: [],
  },

  {
    slug: "led-highbay-200w",
    sourceId: "seed-highbay-200w",
    modelNumber: "HB-200W-UFO",
    name: "LED UFO 工矿灯 200W",
    description:
      "仓库、厂房与体育馆通用 UFO 高棚灯，200W 大功率 + 140 lm/W 高光效，圆形铝鳍片散热，标配 90° 与 120° 配光可选，适配安装高度 8–15 米。",
    certifications: ["CE", "RoHS", "ENEC", "IP65", "LM-80"],
    specs: [
      { group: "Electrical", label: "功率", value: "200", unit: "W" },
      { group: "Electrical", label: "输入电压", value: "AC 100–277", unit: "V" },
      { group: "Electrical", label: "功率因数", value: "> 0.95" },
      { group: "Photometric", label: "光通量", value: "28,000", unit: "lm" },
      { group: "Photometric", label: "光效", value: "140", unit: "lm/W" },
      { group: "Photometric", label: "色温", value: "4000 / 5000", unit: "K" },
      { group: "Photometric", label: "显色指数", value: "≥ 80", unit: "Ra" },
      { group: "Photometric", label: "光束角", value: "90 / 120 (可选)", unit: "°" },
      { group: "Mechanical", label: "直径 × 高", value: "Ø350 × 140", unit: "mm" },
      { group: "Mechanical", label: "重量", value: "3.8", unit: "kg" },
      { group: "Mechanical", label: "外壳", value: "压铸铝散热鳍片" },
      { group: "Mechanical", label: "防护等级", value: "IP65" },
      { group: "Lifetime", label: "寿命 L70", value: "50,000", unit: "h" },
      { group: "Lifetime", label: "LM-80 测试", value: "已通过 6,000h" },
      { group: "Lifetime", label: "工作温度", value: "-30 ~ +50", unit: "℃" },
    ],
    coverImage: u("1581094794329-c8112a89af12"),
    extraImages: [
      { url: u("1567502352061-a8b8f9d12068"), alt: "工矿灯应用场景" },
      { url: u("1542736667-069246bdbc6d"), alt: "工矿灯散热细节" },
    ],
    documents: [
      { title: "产品规格书", fileName: "HB-200W-datasheet.pdf" },
      { title: "安装说明书", fileName: "HB-200W-install.pdf" },
      { title: "LM-80 测试报告", fileName: "HB-200W-lm80.pdf" },
    ],
    videos: [
      {
        title: "仓库照明应用",
        url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
        coverImage: null,
      },
    ],
  },

  {
    slug: "led-panel-36w-600",
    sourceId: "seed-panel-36w",
    modelNumber: "PL-36W-600x600",
    name: "LED 面板灯 36W 600×600",
    description:
      "办公、医院与教室通用 600×600 嵌入式 LED 面板灯，超薄导光板设计 + UGR<19 无眩光光学，支持 DALI / 0–10V 调光，适配主流硅钙板与轻钢龙骨吊顶。",
    certifications: ["CE", "RoHS", "ENEC", "UGR<19"],
    specs: [
      { group: "Electrical", label: "功率", value: "36", unit: "W" },
      { group: "Electrical", label: "输入电压", value: "AC 100–277", unit: "V" },
      { group: "Electrical", label: "功率因数", value: "> 0.95" },
      { group: "Electrical", label: "调光", value: "DALI / 0–10V (可选)" },
      { group: "Photometric", label: "光通量", value: "4,300", unit: "lm" },
      { group: "Photometric", label: "光效", value: "120", unit: "lm/W" },
      { group: "Photometric", label: "色温", value: "3000 / 4000 / 6500", unit: "K" },
      { group: "Photometric", label: "显色指数", value: "≥ 85", unit: "Ra" },
      { group: "Photometric", label: "眩光指数", value: "UGR < 19" },
      { group: "Mechanical", label: "尺寸", value: "595 × 595 × 12", unit: "mm" },
      { group: "Mechanical", label: "重量", value: "3.2", unit: "kg" },
      { group: "Mechanical", label: "外壳", value: "铝边框 + PMMA 导光板" },
      { group: "Mechanical", label: "防护等级", value: "IP40" },
      { group: "Lifetime", label: "寿命 L70", value: "40,000", unit: "h" },
      { group: "Lifetime", label: "工作温度", value: "0 ~ +40", unit: "℃" },
    ],
    coverImage: u("1497366216548-37526070297c"),
    extraImages: [
      { url: u("1567502352061-a8b8f9d12068"), alt: "面板灯办公应用" },
      { url: u("1565538810643-b5bdb714032a"), alt: "面板灯吊顶安装" },
    ],
    documents: [
      { title: "产品规格书", fileName: "PL-36W-datasheet.pdf" },
      { title: "DALI 调光接线图", fileName: "PL-36W-dali.pdf" },
    ],
    videos: [],
  },
];

async function main() {
  const password = await bcrypt.hash("admin123", 12);
  await prisma.adminUser.upsert({
    where: { username: "admin" },
    update: {},
    create: { username: "admin", password, name: "管理员" },
  });

  const factory = await prisma.factory.upsert({
    where: { slug: "default" },
    update: {
      brandShort: "LUMOS·LED",
      contactEmail: "sales@lumos-led.example",
      contactWhatsapp: "+8613800001234",
      inquiryNote: "工厂直供 · 支持 OEM/ODM 定制 · 24h 内回复询盘",
    },
    create: {
      slug: "default",
      name: "Lumos LED Manufacturing",
      brandShort: "LUMOS·LED",
      contactEmail: "sales@lumos-led.example",
      contactWhatsapp: "+8613800001234",
      inquiryNote: "工厂直供 · 支持 OEM/ODM 定制 · 24h 内回复询盘",
    },
  });

  for (const p of products) {
    const product = await prisma.product.upsert({
      where: { slug: p.slug },
      update: {
        modelNumber: p.modelNumber,
        name: p.name,
        description: p.description,
        specs: p.specs,
        certifications: p.certifications,
        coverImage: p.coverImage,
      },
      create: {
        slug: p.slug,
        sourceId: p.sourceId,
        modelNumber: p.modelNumber,
        name: p.name,
        description: p.description,
        specs: p.specs,
        certifications: p.certifications,
        coverImage: p.coverImage,
        factoryId: factory.id,
      },
    });

    // Wipe & reinsert so re-running the seed produces a deterministic set.
    await prisma.document.deleteMany({ where: { productId: product.id } });
    await prisma.video.deleteMany({ where: { productId: product.id } });
    await prisma.productImage.deleteMany({ where: { productId: product.id } });

    await prisma.document.createMany({
      data: p.documents.map((d, i) => ({
        productId: product.id,
        title: d.title,
        fileUrl: SAMPLE_PDF,
        fileName: d.fileName,
        fileSize: 128 * 1024,
        mimeType: "application/pdf",
        sortOrder: i,
      })),
    });

    if (p.videos.length) {
      await prisma.video.createMany({
        data: p.videos.map((v, i) => ({
          productId: product.id,
          title: v.title,
          url: v.url,
          coverImage: v.coverImage,
          sortOrder: i,
        })),
      });
    }

    if (p.extraImages.length) {
      await prisma.productImage.createMany({
        data: p.extraImages.map((img, i) => ({
          productId: product.id,
          url: img.url,
          alt: img.alt ?? null,
          sortOrder: i,
        })),
      });
    }
  }

  console.log(
    `Seed done — admin: admin / admin123, factory: default, products: ${products.length}`
  );
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    prisma.$disconnect();
    process.exit(1);
  });
