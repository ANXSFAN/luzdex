// 真实数据导入：FactorLED（西班牙 LED 品牌）12 个产品 + 4 分类 + 4 系列。
// 数据源：factorled.com 各产品页 JSON-LD（名称 / SKU / 西语描述 / 图片）抓取到 _fl-data.json，
// 规格 / 卖点 / 分类 / 系列为人工依据西语描述编写。源语言 es，其余 8 语言留待后台 AI 翻译。
// 幂等：工厂 / 分类 / 系列按唯一键 upsert；产品按 (factoryId, sourceId=SKU) upsert，图片每次重建。
// 运行：npx tsx prisma/seed-factorled.ts
import "dotenv/config";
import { PrismaClient, Prisma } from "../src/generated/prisma/client.js";
import { PrismaPg } from "@prisma/adapter-pg";

// 抓自 factorled.com 各产品页 JSON-LD（西语描述 + 图片 CDN URL）。
// 11626 / 26169 两条原文含「PACK de 10 / 1 caja = 10 unidades」批发口径，
// 已按纯展示定位（PLAN.md §7.1：零价格 / 零采购出口）改写为消费者向描述。
const FL: Record<string, { description: string; cover: string; images: string[] }> = {
  "2776": {
    description:
      "Foco empotrable LED Circular BLANCO de aluminio con 5W-8W- 12W (Seleccionable la potencia deseada en el Driver). Con un ángulo de apertura de 40º, por lo que la iluminación es más directa para centrar la luz un puntos específicos. Fácil montaje e instalación. Alto índice de rendimiento cromático +92- Expert Color- . Bajo deslumbramiento UGR<11. CCT: COLOR SELECCIONABLE: 3000K-4000K-6000K.",
    cover: "https://www.factorled.com/web/image/product.template/2776/image_1920",
    images: [
      "https://www.factorled.com/web/image/product.template/2776/image_1920",
      "https://www.factorled.com/web/image/product.image/68945/image_1920",
      "https://www.factorled.com/web/image/product.image/68946/image_1920",
      "https://www.factorled.com/web/image/product.image/68947/image_1920",
      "https://www.factorled.com/web/image/product.image/68948/image_1920",
      "https://www.factorled.com/web/image/product.image/68949/image_1920",
    ],
  },
  "3067": {
    description:
      "El Downlight LED Circular FREYA ofrece máxima versatilidad con selector de potencia 2W - 4W - 6W y tecnología 3CCT para elegir la temperatura de color ideal en cada espacio. Su chip COB Bridgelux de 130Lm/W garantiza alta eficiencia, mientras que el ángulo de 40° proporciona una iluminación focalizada y precisa. Con UGR<11 evita deslumbramientos, asegurando confort visual. Además, su diseño permite un montaje rápido y sencillo, ideal para proyectos profesionales y de hogar.",
    cover: "https://www.factorled.com/web/image/product.template/3067/image_1920",
    images: [
      "https://www.factorled.com/web/image/product.template/3067/image_1920",
      "https://www.factorled.com/web/image/product.image/79636/image_1920",
      "https://www.factorled.com/web/image/product.image/79637/image_1920",
      "https://www.factorled.com/web/image/product.image/79638/image_1920",
      "https://www.factorled.com/web/image/product.image/79639/image_1920",
      "https://www.factorled.com/web/image/product.image/79640/image_1920",
    ],
  },
  "10207": {
    description:
      "Fuente de Alimentación 60W 24V DC para Tiras LED – Eficiencia y Tecnología Avanzada, equipada con tecnología de nitruro de galio (GaN) para una mayor eficiencia y menor tamaño. Su diseño compacto, silencioso y de alta eficiencia garantiza un suministro de energía estable y confiable. Además, cuenta con refrigeración por convección natural, evitando el sobrecalentamiento. La elección perfecta para una iluminación LED segura, duradera y de alto rendimiento. Incorpora un regulador manual programables: 1- 100%. 2-50% 3- 20% 4-10%",
    cover: "https://www.factorled.com/web/image/product.template/10207/image_1920",
    images: [
      "https://www.factorled.com/web/image/product.template/10207/image_1920",
      "https://www.factorled.com/web/image/product.image/49778/image_1920",
      "https://www.factorled.com/web/image/product.image/49779/image_1920",
      "https://www.factorled.com/web/image/product.image/49780/image_1920",
      "https://www.factorled.com/web/image/product.image/49781/image_1920",
    ],
  },
  "10208": {
    description:
      "Fuente de Alimentación 100W 24V DC para Tiras LED – Eficiencia y Tecnología Avanzada, equipada con tecnología de nitruro de galio (GaN) para una mayor eficiencia y menor tamaño. Su diseño compacto, silencioso y de alta eficiencia garantiza un suministro de energía estable y confiable. Además, cuenta con refrigeración por convección natural, evitando el sobrecalentamiento. La elección perfecta para una iluminación LED segura, duradera y de alto rendimiento. Incorpora un regulador manual programables: 1- 100%. 2-50% 3- 20% 4-10%",
    cover: "https://www.factorled.com/web/image/product.template/10208/image_1920",
    images: [
      "https://www.factorled.com/web/image/product.template/10208/image_1920",
      "https://www.factorled.com/web/image/product.image/111347/image_1920",
      "https://www.factorled.com/web/image/product.image/111348/image_1920",
      "https://www.factorled.com/web/image/product.image/111349/image_1920",
      "https://www.factorled.com/web/image/product.image/111350/image_1920",
    ],
  },
  "10506": {
    description:
      "El Empotrable LED Lucerna de 18 a 24 vatios es una solución de iluminación versátil y eficiente. Con un ángulo de apertura de 38 grados y una baja emisión de deslumbramiento (UGR11), proporciona una iluminación precisa y cómoda. Su temperatura de color ajustable (2700K+CCT) permite adaptar el ambiente según las necesidades. Una elección ideal para espacios donde se busca una iluminación funcional y agradable.",
    cover: "https://www.factorled.com/web/image/product.template/10506/image_1920",
    images: [
      "https://www.factorled.com/web/image/product.template/10506/image_1920",
      "https://www.factorled.com/web/image/product.image/50708/image_1920",
      "https://www.factorled.com/web/image/product.image/50709/image_1920",
      "https://www.factorled.com/web/image/product.image/50710/image_1920",
      "https://www.factorled.com/web/image/product.image/50711/image_1920",
      "https://www.factorled.com/web/image/product.image/50712/image_1920",
    ],
  },
  "11455": {
    description:
      "Panel LED Philips Driver 40W 60x60 con marco ultradelgado Slim Frame. Su innovador diseño sin marco visible ofrece una estética limpia y moderna, integrándose perfectamente en cualquier techo. Fabricado en aluminio de alta calidad, garantiza durabilidad, fiabilidad y una iluminación uniforme sin parpadeos (No Flicker). Con certificación ENEC05 y 5 años de garantía, es la elección ideal para proyectos profesionales que buscan rendimiento, diseño y calidad superior.",
    cover: "https://www.factorled.com/web/image/product.template/11455/image_1920",
    images: [
      "https://www.factorled.com/web/image/product.template/11455/image_1920",
      "https://www.factorled.com/web/image/product.image/89689/image_1920",
      "https://www.factorled.com/web/image/product.image/89690/image_1920",
      "https://www.factorled.com/web/image/product.image/89691/image_1920",
      "https://www.factorled.com/web/image/product.image/89692/image_1920",
      "https://www.factorled.com/web/image/product.image/89693/image_1920",
    ],
  },
  "11626": {
    description:
      "Panel LED 60x60 40W con Driver Philips y tecnología backlight, que garantiza una iluminación potente y uniforme en blanco neutro (4000K) y blanco frío (5700K). Fabricado en acero con un diseño elegante y delgado, ofrece mayor superficie de luz y un acabado profesional. Sin parpadeos (No Flicker), con certificación ENEC05 y 5 años de garantía, es la solución ideal para proyectos exigentes que buscan eficiencia, calidad y estilo.",
    cover: "https://www.factorled.com/web/image/product.template/11626/image_1920",
    images: [
      "https://www.factorled.com/web/image/product.template/11626/image_1920",
      "https://www.factorled.com/web/image/product.image/54502/image_1920",
      "https://www.factorled.com/web/image/product.image/54503/image_1920",
      "https://www.factorled.com/web/image/product.image/54504/image_1920",
      "https://www.factorled.com/web/image/product.image/54505/image_1920",
      "https://www.factorled.com/web/image/product.image/54506/image_1920",
    ],
  },
  "11767": {
    description:
      "La nueva generación de pantallas estancas LED COREPLUS EVO 60 cm combina potencia y versatilidad con selección de potencia (12W / 15W / 18W / 20W) y temperatura de color 3CCT (3000K / 4000K / 6000K). Equipada con driver Philips Xitanium y LEDs SMD2835 de 140 Lm/W, ofrece máxima eficiencia (FP > 0.9), protección IP66 e IK10, y una luz uniforme y brillante en cualquier entorno. Su cubierta semitransparente y conexión por ambos extremos facilitan instalaciones en serie. Personalizable con sensor de movimiento radar Plug & Play.",
    cover: "https://www.factorled.com/web/image/product.template/11767/image_1920",
    images: [
      "https://www.factorled.com/web/image/product.template/11767/image_1920",
      "https://www.factorled.com/web/image/product.image/112380/image_1920",
      "https://www.factorled.com/web/image/product.image/112381/image_1920",
      "https://www.factorled.com/web/image/product.image/112382/image_1920",
      "https://www.factorled.com/web/image/product.image/112383/image_1920",
      "https://www.factorled.com/web/image/product.image/112384/image_1920",
    ],
  },
  "11768": {
    description:
      "La nueva generación de pantallas estancas LED COREPLUS EVO 120 cm combina potencia y versatilidad con selección de potencia (25W / 30W / 35W / 40W) y temperatura de color 3CCT (3000K / 4000K / 6000K). Equipada con driver Philips Xitanium y LEDs SMD2835 de 140 Lm/W, ofrece máxima eficiencia (FP > 0.9), protección IP66 e IK10, y una luz uniforme y brillante en cualquier entorno. Su cubierta semitransparente y conexión por ambos extremos facilitan instalaciones en serie. Personalizable con kit de emergencia y sensor de movimiento radar Plug & Play.",
    cover: "https://www.factorled.com/web/image/product.template/11768/image_1920",
    images: [
      "https://www.factorled.com/web/image/product.template/11768/image_1920",
      "https://www.factorled.com/web/image/product.image/112538/image_1920",
      "https://www.factorled.com/web/image/product.image/112539/image_1920",
      "https://www.factorled.com/web/image/product.image/112540/image_1920",
      "https://www.factorled.com/web/image/product.image/112541/image_1920",
      "https://www.factorled.com/web/image/product.image/112542/image_1920",
    ],
  },
  "11769": {
    description:
      "La nueva generación de pantallas estancas LED COREPLUS EVO 150 cm combina potencia y versatilidad con selección de potencia (30W / 40W / 45W / 55W) y temperatura de color 3CCT (3000K / 4000K / 6000K). Equipada con driver Philips Xitanium y LEDs SMD2835 de 140 Lm/W, ofrece máxima eficiencia (FP > 0.9), protección IP66 e IK10, y una luz uniforme y brillante en cualquier entorno. Su cubierta semitransparente y conexión por ambos extremos facilitan instalaciones en serie. Personalizable con kit de emergencia y sensor de movimiento radar Plug & Play.",
    cover: "https://www.factorled.com/web/image/product.template/11769/image_1920",
    images: [
      "https://www.factorled.com/web/image/product.template/11769/image_1920",
      "https://www.factorled.com/web/image/product.image/112944/image_1920",
      "https://www.factorled.com/web/image/product.image/112945/image_1920",
      "https://www.factorled.com/web/image/product.image/112946/image_1920",
      "https://www.factorled.com/web/image/product.image/112947/image_1920",
      "https://www.factorled.com/web/image/product.image/112948/image_1920",
    ],
  },
  "26169": {
    description:
      "Panel LED 62x62 42W con Philips Certa Driver. Equipado con tecnología backlight y chips SMD2835 de 120 lm/W, ofrece una iluminación potente, uniforme y de alto rendimiento. Incorpora 3CCT con temperatura seleccionable (3000K / 4000K / 5700K) para adaptarse a cualquier espacio, y UGR<19, garantizando una luz sin deslumbramientos, ideal para oficinas y entornos de trabajo. Fabricado en aluminio con diseño elegante y minimalista, cuenta con sistema No Flicker, certificación ENEC05 y TÜV, y 5 años de garantía, asegurando fiabilidad y larga vida útil.",
    cover: "https://www.factorled.com/web/image/product.template/26169/image_1920",
    images: [
      "https://www.factorled.com/web/image/product.template/26169/image_1920",
      "https://www.factorled.com/web/image/product.image/114948/image_1920",
      "https://www.factorled.com/web/image/product.image/114902/image_1920",
      "https://www.factorled.com/web/image/product.image/114903/image_1920",
      "https://www.factorled.com/web/image/product.image/114904/image_1920",
      "https://www.factorled.com/web/image/product.image/114905/image_1920",
    ],
  },
  "26269": {
    description:
      "Fuente de Alimentación 150W 24V DC para Tiras LED – Eficiencia y Tecnología Avanzada, equipada con tecnología de nitruro de galio (GaN) para una mayor eficiencia y menor tamaño. Su diseño compacto, silencioso y de alta eficiencia garantiza un suministro de energía estable y confiable. Además, cuenta con refrigeración por convección natural, evitando el sobrecalentamiento. La elección perfecta para una iluminación LED segura, duradera y de alto rendimiento. Incorpora un regulador manual programables: 1- 100%. 2-50% 3- 20% 4-10%",
    cover: "https://www.factorled.com/web/image/product.template/26269/image_1920",
    images: [
      "https://www.factorled.com/web/image/product.template/26269/image_1920",
      "https://www.factorled.com/web/image/product.image/114829/image_1920",
      "https://www.factorled.com/web/image/product.image/114830/image_1920",
      "https://www.factorled.com/web/image/product.image/114831/image_1920",
      "https://www.factorled.com/web/image/product.image/114832/image_1920",
    ],
  },
};

const adapter = new PrismaPg({ connectionString: process.env.DIRECT_URL! });
const prisma = new PrismaClient({ adapter });

type Spec = { group?: string; label: string; value: string; unit?: string };
type Highlight = { icon: string; label: string; value?: string };

type P = {
  id: string; // factorled product.template id（= _fl-data.json 的 key）
  name: string; // 整理后的消费者向名称（西语）
  modelNumber: string;
  luminaireType: string;
  variantLabel?: string;
  variantGroup?: string; // 变体组 key：同组 = 同款不同规格（写入 variantGroupId）
  tagline: string;
  certifications: string[];
  attributes: Prisma.InputJsonValue;
  highlights: Highlight[];
  specs: Spec[];
};

// ───────────── 分类（kind 仅 power 用于自动配件匹配；灯具本体留空）─────────────
const CATEGORIES = [
  { slug: "pantallas-estancas-led", name: "Pantallas Estancas LED", kind: null as string | null },
  { slug: "paneles-led", name: "Paneles LED", kind: null },
  { slug: "downlights-led", name: "Downlights LED", kind: null },
  { slug: "fuentes-alimentacion-24v", name: "Fuentes de Alimentación 24V", kind: "power" },
];

// ───────────── 系列（intro 西语；归属对应分类）─────────────
const SERIES = [
  {
    slug: "coreplus-evo",
    name: "CorePlus Evo",
    categorySlug: "pantallas-estancas-led",
    intro:
      "La nueva generación de pantallas estancas LED de FactorLED: selector de potencia, 3CCT, driver Philips Xitanium y protección IP66 · IK10. Conexión por ambos extremos para instalaciones en serie y compatible con sensor radar y kit de emergencia Plug & Play.",
  },
  {
    slug: "slim-frame",
    name: "Slim Frame",
    categorySlug: "paneles-led",
    intro:
      "Paneles LED con marco ultradelgado Slim Frame: estética limpia sin marco visible, luz uniforme sin parpadeo (No Flicker), driver Philips y certificación ENEC05 con 5 años de garantía.",
  },
  {
    slug: "empotrables-cob",
    name: "Empotrables COB",
    categorySlug: "downlights-led",
    intro:
      "Focos empotrables con chip Bridgelux COB de alta eficiencia: potencia seleccionable, temperatura de color 3CCT, alto índice de reproducción cromática (CRI +92) y bajo deslumbramiento UGR<11. Iluminación focalizada y precisa para hogar y proyectos profesionales.",
  },
  {
    slug: "gxtronic",
    name: "GXtronic",
    categorySlug: "fuentes-alimentacion-24v",
    intro:
      "Fuentes de alimentación 24V DC para tiras LED con tecnología de nitruro de galio (GaN): diseño compacto y silencioso, refrigeración por convección natural y regulador manual de 4 niveles. Suministro estable para una instalación LED segura y duradera.",
  },
];

// ───────────── 产品（按分类→系列分组）─────────────
const PRODUCTS: (P & { categorySlug: string; seriesSlug: string })[] = [
  // ── Pantallas Estancas · CorePlus Evo ──
  {
    id: "11767",
    categorySlug: "pantallas-estancas-led",
    seriesSlug: "coreplus-evo",
    name: "Pantalla Estanca LED 20W CorePlus Evo 60cm · 3CCT · IP66",
    modelNumber: "TPPHL20W-CCT-91455",
    luminaireType: "linear",
    variantLabel: "60 cm",
    variantGroup: "coreplus-evo-tubo",
    tagline: "Selector de potencia · 3CCT 3000/4000/6000K · IP66 · IK10 · Driver Philips Xitanium",
    certifications: ["CE", "RoHS", "ENEC", "IP66", "IK10"],
    attributes: { voltage: "AC 220-240V", watt: 20, length: "600mm" },
    highlights: [
      { icon: "zap", label: "Potencia", value: "12 / 15 / 18 / 20W" },
      { icon: "sun", label: "Eficacia", value: "140 lm/W" },
      { icon: "droplet", label: "Protección", value: "IP66 · IK10" },
      { icon: "shield", label: "Driver", value: "Philips Xitanium" },
    ],
    specs: [
      { group: "Eléctrico", label: "Potencia seleccionable", value: "12 / 15 / 18 / 20", unit: "W" },
      { group: "Eléctrico", label: "Tensión de entrada", value: "AC 220-240", unit: "V" },
      { group: "Eléctrico", label: "Factor de potencia", value: "> 0.9" },
      { group: "Eléctrico", label: "Driver", value: "Philips Xitanium" },
      { group: "Fotométrico", label: "Eficacia luminosa", value: "140", unit: "lm/W" },
      { group: "Fotométrico", label: "Temperatura de color (3CCT)", value: "3000 / 4000 / 6000", unit: "K" },
      { group: "Fotométrico", label: "Fuente LED", value: "SMD2835" },
      { group: "Mecánico", label: "Longitud", value: "600", unit: "mm" },
      { group: "Mecánico", label: "Protección", value: "IP66 · IK10" },
      { group: "Mecánico", label: "Cubierta", value: "Semitransparente" },
    ],
  },
  {
    id: "11768",
    categorySlug: "pantallas-estancas-led",
    seriesSlug: "coreplus-evo",
    name: "Pantalla Estanca LED 40W CorePlus Evo 120cm · 3CCT · IP66",
    modelNumber: "TPPHL40W-CCT-91456",
    luminaireType: "linear",
    variantLabel: "120 cm",
    variantGroup: "coreplus-evo-tubo",
    tagline: "Selector de potencia · 3CCT 3000/4000/6000K · IP66 · IK10 · Driver Philips Xitanium",
    certifications: ["CE", "RoHS", "ENEC", "IP66", "IK10"],
    attributes: { voltage: "AC 220-240V", watt: 40, length: "1200mm" },
    highlights: [
      { icon: "zap", label: "Potencia", value: "25 / 30 / 35 / 40W" },
      { icon: "sun", label: "Eficacia", value: "140 lm/W" },
      { icon: "droplet", label: "Protección", value: "IP66 · IK10" },
      { icon: "shield", label: "Driver", value: "Philips Xitanium" },
    ],
    specs: [
      { group: "Eléctrico", label: "Potencia seleccionable", value: "25 / 30 / 35 / 40", unit: "W" },
      { group: "Eléctrico", label: "Tensión de entrada", value: "AC 220-240", unit: "V" },
      { group: "Eléctrico", label: "Factor de potencia", value: "> 0.9" },
      { group: "Eléctrico", label: "Driver", value: "Philips Xitanium" },
      { group: "Fotométrico", label: "Eficacia luminosa", value: "140", unit: "lm/W" },
      { group: "Fotométrico", label: "Temperatura de color (3CCT)", value: "3000 / 4000 / 6000", unit: "K" },
      { group: "Fotométrico", label: "Fuente LED", value: "SMD2835" },
      { group: "Mecánico", label: "Longitud", value: "1200", unit: "mm" },
      { group: "Mecánico", label: "Protección", value: "IP66 · IK10" },
      { group: "Mecánico", label: "Opciones", value: "Sensor radar + kit emergencia Plug & Play" },
    ],
  },
  {
    id: "11769",
    categorySlug: "pantallas-estancas-led",
    seriesSlug: "coreplus-evo",
    name: "Pantalla Estanca LED 55W CorePlus Evo 150cm · 3CCT · IP66",
    modelNumber: "TPPHL55W-CCT-91457",
    luminaireType: "linear",
    variantLabel: "150 cm",
    variantGroup: "coreplus-evo-tubo",
    tagline: "Selector de potencia · 3CCT 3000/4000/6000K · IP66 · IK10 · Driver Philips Xitanium",
    certifications: ["CE", "RoHS", "ENEC", "IP66", "IK10"],
    attributes: { voltage: "AC 220-240V", watt: 55, length: "1500mm" },
    highlights: [
      { icon: "zap", label: "Potencia", value: "30 / 40 / 45 / 55W" },
      { icon: "sun", label: "Eficacia", value: "140 lm/W" },
      { icon: "droplet", label: "Protección", value: "IP66 · IK10" },
      { icon: "shield", label: "Driver", value: "Philips Xitanium" },
    ],
    specs: [
      { group: "Eléctrico", label: "Potencia seleccionable", value: "30 / 40 / 45 / 55", unit: "W" },
      { group: "Eléctrico", label: "Tensión de entrada", value: "AC 220-240", unit: "V" },
      { group: "Eléctrico", label: "Factor de potencia", value: "> 0.9" },
      { group: "Eléctrico", label: "Driver", value: "Philips Xitanium" },
      { group: "Fotométrico", label: "Eficacia luminosa", value: "140", unit: "lm/W" },
      { group: "Fotométrico", label: "Temperatura de color (3CCT)", value: "3000 / 4000 / 6000", unit: "K" },
      { group: "Fotométrico", label: "Fuente LED", value: "SMD2835" },
      { group: "Mecánico", label: "Longitud", value: "1500", unit: "mm" },
      { group: "Mecánico", label: "Protección", value: "IP66 · IK10" },
      { group: "Mecánico", label: "Opciones", value: "Sensor radar + kit emergencia Plug & Play" },
    ],
  },

  // ── Paneles · Slim Frame ──
  {
    id: "11455",
    categorySlug: "paneles-led",
    seriesSlug: "slim-frame",
    name: "Panel LED 60x60 40W Slim Frame Premium · UGR19 · Driver Philips",
    modelNumber: "PNPHL40WUGR19-91146",
    luminaireType: "panel",
    tagline: "Marco ultradelgado · Sin parpadeo · UGR<19 · Driver Philips · 5 años de garantía",
    certifications: ["CE", "RoHS", "ENEC05"],
    attributes: { watt: 40, size: "595x595mm" },
    highlights: [
      { icon: "ruler", label: "Tamaño", value: "60×60 cm" },
      { icon: "zap", label: "Potencia", value: "40 W" },
      { icon: "gauge", label: "Deslumbramiento", value: "UGR<19" },
      { icon: "award", label: "Garantía", value: "5 años" },
    ],
    specs: [
      { group: "Eléctrico", label: "Potencia", value: "40", unit: "W" },
      { group: "Eléctrico", label: "Driver", value: "Philips" },
      { group: "Fotométrico", label: "Temperatura de color", value: "4000", unit: "K" },
      { group: "Fotométrico", label: "Deslumbramiento", value: "UGR < 19" },
      { group: "Fotométrico", label: "Parpadeo", value: "No Flicker" },
      { group: "Mecánico", label: "Dimensiones", value: "595 × 595 × 10", unit: "mm" },
      { group: "Mecánico", label: "Marco", value: "Slim Frame · Aluminio" },
      { group: "Garantía", label: "Certificación", value: "ENEC05" },
      { group: "Garantía", label: "Garantía", value: "5", unit: "años" },
    ],
  },
  {
    id: "11626",
    categorySlug: "paneles-led",
    seriesSlug: "slim-frame",
    name: "Panel LED 60x60 40W New Slim Frame · 4000 lm · Driver Philips",
    modelNumber: "NEWPNPHL40W-1420",
    luminaireType: "panel",
    tagline: "Tecnología backlight · 4000 lm · Sin parpadeo · Driver Philips · 5 años de garantía",
    certifications: ["CE", "RoHS", "ENEC05"],
    attributes: { watt: 40, size: "595x595mm" },
    highlights: [
      { icon: "ruler", label: "Tamaño", value: "60×60 cm" },
      { icon: "sun", label: "Flujo luminoso", value: "4000 lm" },
      { icon: "bulb", label: "Tecnología", value: "Backlight" },
      { icon: "award", label: "Garantía", value: "5 años" },
    ],
    specs: [
      { group: "Eléctrico", label: "Potencia", value: "40", unit: "W" },
      { group: "Eléctrico", label: "Driver", value: "Philips" },
      { group: "Fotométrico", label: "Flujo luminoso", value: "4000", unit: "lm" },
      { group: "Fotométrico", label: "Temperatura de color", value: "4000 / 5700", unit: "K" },
      { group: "Fotométrico", label: "Tecnología", value: "Backlight" },
      { group: "Fotométrico", label: "Parpadeo", value: "No Flicker" },
      { group: "Mecánico", label: "Dimensiones", value: "595 × 595 × 10", unit: "mm" },
      { group: "Mecánico", label: "Material", value: "Acero · Slim Frame" },
      { group: "Garantía", label: "Certificación", value: "ENEC05" },
      { group: "Garantía", label: "Garantía", value: "5", unit: "años" },
    ],
  },
  {
    id: "26169",
    categorySlug: "paneles-led",
    seriesSlug: "slim-frame",
    name: "Panel LED 62x62 42W · 3CCT · UGR19 · Driver Philips Certa",
    modelNumber: "PNPHL42W-CCT-91535",
    luminaireType: "panel",
    tagline: "4200 lm · 3CCT · UGR<19 · Driver Philips Certa · ENEC05 + TÜV · 5 años",
    certifications: ["CE", "RoHS", "ENEC05", "TÜV"],
    attributes: { watt: 42, size: "620x620mm" },
    highlights: [
      { icon: "ruler", label: "Tamaño", value: "62×62 cm" },
      { icon: "sun", label: "Flujo luminoso", value: "4200 lm" },
      { icon: "gauge", label: "Deslumbramiento", value: "UGR<19" },
      { icon: "award", label: "Garantía", value: "5 años" },
    ],
    specs: [
      { group: "Eléctrico", label: "Potencia", value: "42", unit: "W" },
      { group: "Eléctrico", label: "Driver", value: "Philips Certa" },
      { group: "Fotométrico", label: "Flujo luminoso", value: "4200", unit: "lm" },
      { group: "Fotométrico", label: "Eficacia luminosa", value: "120", unit: "lm/W" },
      { group: "Fotométrico", label: "Temperatura de color (3CCT)", value: "3000 / 4000 / 5700", unit: "K" },
      { group: "Fotométrico", label: "Deslumbramiento", value: "UGR < 19" },
      { group: "Fotométrico", label: "Fuente LED", value: "SMD2835" },
      { group: "Mecánico", label: "Dimensiones", value: "620 × 620 × 10", unit: "mm" },
      { group: "Mecánico", label: "Material", value: "Aluminio" },
      { group: "Garantía", label: "Certificación", value: "ENEC05 · TÜV" },
      { group: "Garantía", label: "Garantía", value: "5", unit: "años" },
    ],
  },

  // ── Downlights · Empotrables COB ──
  {
    id: "2776",
    categorySlug: "downlights-led",
    seriesSlug: "empotrables-cob",
    name: "Foco Empotrable LED 5/8/12W · Bridgelux · CRI 92 · UGR11",
    modelNumber: "FL-EMP-90594",
    luminaireType: "downlight",
    tagline: "Potencia seleccionable · 3CCT · Chip Bridgelux · CRI +92 · UGR<11",
    certifications: ["CE", "RoHS"],
    attributes: { watt: 12, beam: "40°", cri: 92 },
    highlights: [
      { icon: "zap", label: "Potencia", value: "5 / 8 / 12W" },
      { icon: "bulb", label: "Reproducción cromática", value: "CRI +92" },
      { icon: "gauge", label: "Deslumbramiento", value: "UGR<11" },
      { icon: "sun", label: "Color (CCT)", value: "3000-6000K" },
    ],
    specs: [
      { group: "Eléctrico", label: "Potencia seleccionable", value: "5 / 8 / 12", unit: "W" },
      { group: "Fotométrico", label: "Temperatura de color (CCT)", value: "3000 / 4000 / 6000", unit: "K" },
      { group: "Fotométrico", label: "Reproducción cromática", value: "≥ 92", unit: "Ra" },
      { group: "Fotométrico", label: "Deslumbramiento", value: "UGR < 11" },
      { group: "Fotométrico", label: "Ángulo de apertura", value: "40", unit: "°" },
      { group: "Fotométrico", label: "Chip LED", value: "Bridgelux" },
      { group: "Mecánico", label: "Forma", value: "Circular" },
      { group: "Mecánico", label: "Material / color", value: "Aluminio · Blanco" },
    ],
  },
  {
    id: "3067",
    categorySlug: "downlights-led",
    seriesSlug: "empotrables-cob",
    name: "Foco Empotrable LED Freya 2/4/6W · 3CCT · Bridgelux COB · Negro Cromo",
    modelNumber: "FL-FREYA-8051",
    luminaireType: "downlight",
    tagline: "Selector de potencia · 3CCT · Bridgelux COB 130 lm/W · UGR<11",
    certifications: ["CE", "RoHS"],
    attributes: { watt: 6, beam: "24°", cri: 90 },
    highlights: [
      { icon: "zap", label: "Potencia", value: "2 / 4 / 6W" },
      { icon: "sun", label: "Eficacia", value: "130 lm/W" },
      { icon: "gauge", label: "Deslumbramiento", value: "UGR<11" },
      { icon: "bulb", label: "Chip", value: "Bridgelux COB" },
    ],
    specs: [
      { group: "Eléctrico", label: "Potencia seleccionable", value: "2 / 4 / 6", unit: "W" },
      { group: "Fotométrico", label: "Temperatura de color (3CCT)", value: "3000 / 4000 / 6000", unit: "K" },
      { group: "Fotométrico", label: "Eficacia luminosa", value: "130", unit: "lm/W" },
      { group: "Fotométrico", label: "Deslumbramiento", value: "UGR < 11" },
      { group: "Fotométrico", label: "Ángulo de apertura", value: "24", unit: "°" },
      { group: "Fotométrico", label: "Chip LED", value: "Bridgelux COB" },
      { group: "Mecánico", label: "Forma", value: "Circular" },
      { group: "Mecánico", label: "Color", value: "Negro Cromo" },
    ],
  },
  {
    id: "10506",
    categorySlug: "downlights-led",
    seriesSlug: "empotrables-cob",
    name: "Foco Empotrable LED Lucerna 18/24W · 38° · UGR11",
    modelNumber: "FL-LUCERNA-8052",
    luminaireType: "downlight",
    tagline: "Potencia seleccionable · 2700K + CCT · Ángulo 38° · UGR<11",
    certifications: ["CE", "RoHS"],
    attributes: { watt: 24, beam: "38°" },
    highlights: [
      { icon: "zap", label: "Potencia", value: "18 / 24W" },
      { icon: "sun", label: "Color (CCT)", value: "2700K + CCT" },
      { icon: "gauge", label: "Deslumbramiento", value: "UGR<11" },
      { icon: "ruler", label: "Ángulo", value: "38°" },
    ],
    specs: [
      { group: "Eléctrico", label: "Potencia seleccionable", value: "18 / 24", unit: "W" },
      { group: "Fotométrico", label: "Temperatura de color", value: "2700K + CCT" },
      { group: "Fotométrico", label: "Deslumbramiento", value: "UGR < 11" },
      { group: "Fotométrico", label: "Ángulo de apertura", value: "38", unit: "°" },
      { group: "Mecánico", label: "Forma", value: "Circular · Empotrable" },
    ],
  },

  // ── Fuentes de Alimentación · GXtronic ──
  {
    id: "10207",
    categorySlug: "fuentes-alimentacion-24v",
    seriesSlug: "gxtronic",
    name: "Fuente de Alimentación 24V 60W · Aluminio · IP20",
    modelNumber: "GX-24V-60W-91884",
    luminaireType: "other",
    variantLabel: "60 W",
    variantGroup: "gx-24v",
    tagline: "Tecnología GaN · Regulador manual 4 niveles · Convección natural · IP20",
    certifications: ["CE", "RoHS"],
    attributes: { voltage: "24V", watt: 60, current: "2.5A" },
    highlights: [
      { icon: "zap", label: "Salida", value: "24V · 60W" },
      { icon: "gauge", label: "Corriente", value: "2.5 A" },
      { icon: "shield", label: "Tecnología", value: "GaN" },
      { icon: "droplet", label: "Protección", value: "IP20" },
    ],
    specs: [
      { group: "Eléctrico", label: "Tensión de salida", value: "24", unit: "V DC" },
      { group: "Eléctrico", label: "Potencia", value: "60", unit: "W" },
      { group: "Eléctrico", label: "Corriente", value: "2.5", unit: "A" },
      { group: "Eléctrico", label: "Tecnología", value: "Nitruro de galio (GaN)" },
      { group: "Eléctrico", label: "Regulador manual", value: "100% / 50% / 20% / 10%" },
      { group: "Mecánico", label: "Carcasa", value: "Aluminio" },
      { group: "Mecánico", label: "Refrigeración", value: "Convección natural" },
      { group: "Mecánico", label: "Protección", value: "IP20" },
    ],
  },
  {
    id: "10208",
    categorySlug: "fuentes-alimentacion-24v",
    seriesSlug: "gxtronic",
    name: "Fuente de Alimentación 24V 100W · Aluminio · IP20",
    modelNumber: "GX-24V-100W-91885",
    luminaireType: "other",
    variantLabel: "100 W",
    variantGroup: "gx-24v",
    tagline: "Tecnología GaN · Regulador manual 4 niveles · Convección natural · IP20",
    certifications: ["CE", "RoHS"],
    attributes: { voltage: "24V", watt: 100, current: "4.1A" },
    highlights: [
      { icon: "zap", label: "Salida", value: "24V · 100W" },
      { icon: "gauge", label: "Corriente", value: "4.1 A" },
      { icon: "shield", label: "Tecnología", value: "GaN" },
      { icon: "droplet", label: "Protección", value: "IP20" },
    ],
    specs: [
      { group: "Eléctrico", label: "Tensión de salida", value: "24", unit: "V DC" },
      { group: "Eléctrico", label: "Potencia", value: "100", unit: "W" },
      { group: "Eléctrico", label: "Corriente", value: "4.1", unit: "A" },
      { group: "Eléctrico", label: "Tecnología", value: "Nitruro de galio (GaN)" },
      { group: "Eléctrico", label: "Regulador manual", value: "100% / 50% / 20% / 10%" },
      { group: "Mecánico", label: "Carcasa", value: "Aluminio" },
      { group: "Mecánico", label: "Refrigeración", value: "Convección natural" },
      { group: "Mecánico", label: "Protección", value: "IP20" },
    ],
  },
  {
    id: "26269",
    categorySlug: "fuentes-alimentacion-24v",
    seriesSlug: "gxtronic",
    name: "Fuente de Alimentación 24V 150W · Aluminio · IP20",
    modelNumber: "GX-24V-150W-91886",
    luminaireType: "other",
    variantLabel: "150 W",
    variantGroup: "gx-24v",
    tagline: "Tecnología GaN · Regulador manual 4 niveles · Convección natural · IP20",
    certifications: ["CE", "RoHS"],
    attributes: { voltage: "24V", watt: 150, current: "6.25A" },
    highlights: [
      { icon: "zap", label: "Salida", value: "24V · 150W" },
      { icon: "gauge", label: "Corriente", value: "6.25 A" },
      { icon: "shield", label: "Tecnología", value: "GaN" },
      { icon: "droplet", label: "Protección", value: "IP20" },
    ],
    specs: [
      { group: "Eléctrico", label: "Tensión de salida", value: "24", unit: "V DC" },
      { group: "Eléctrico", label: "Potencia", value: "150", unit: "W" },
      { group: "Eléctrico", label: "Corriente", value: "6.25", unit: "A" },
      { group: "Eléctrico", label: "Tecnología", value: "Nitruro de galio (GaN)" },
      { group: "Eléctrico", label: "Regulador manual", value: "100% / 50% / 20% / 10%" },
      { group: "Mecánico", label: "Carcasa", value: "Aluminio" },
      { group: "Mecánico", label: "Refrigeración", value: "Convección natural" },
      { group: "Mecánico", label: "Protección", value: "IP20" },
    ],
  },
];

async function main() {
  // 1) 工厂（白标租户）
  const factory = await prisma.factory.upsert({
    where: { slug: "factorled" },
    update: { name: "FactorLED", brandShort: "FactorLED", defaultLocale: "es" },
    create: {
      slug: "factorled",
      name: "FactorLED",
      brandShort: "FactorLED",
      defaultLocale: "es",
      isActive: true,
    },
  });
  console.log(`Factory: ${factory.name} (${factory.id})`);

  // 2) 分类
  const catId: Record<string, string> = {};
  for (let i = 0; i < CATEGORIES.length; i++) {
    const c = CATEGORIES[i];
    const cat = await prisma.category.upsert({
      where: { factoryId_slug: { factoryId: factory.id, slug: c.slug } },
      update: { name: c.name, kind: c.kind, sortOrder: i },
      create: { factoryId: factory.id, slug: c.slug, name: c.name, kind: c.kind, sortOrder: i },
    });
    catId[c.slug] = cat.id;
  }
  console.log(`Categorías: ${Object.keys(catId).length}`);

  // 3) 系列
  const serId: Record<string, string> = {};
  const serName: Record<string, string> = {};
  for (let i = 0; i < SERIES.length; i++) {
    const s = SERIES[i];
    const ser = await prisma.series.upsert({
      where: { factoryId_slug: { factoryId: factory.id, slug: s.slug } },
      update: { name: s.name, intro: s.intro, categoryId: catId[s.categorySlug], sortOrder: i },
      create: {
        factoryId: factory.id,
        slug: s.slug,
        name: s.name,
        intro: s.intro,
        categoryId: catId[s.categorySlug],
        sortOrder: i,
      },
    });
    serId[s.slug] = ser.id;
    serName[s.slug] = ser.name;
  }
  console.log(`Series: ${Object.keys(serId).length}`);

  // 4) 产品
  for (const p of PRODUCTS) {
    const fl = FL[p.id];
    if (!fl) throw new Error(`_fl-data.json 缺少 ${p.id}`);
    const cat = CATEGORIES.find((c) => c.slug === p.categorySlug)!;
    const slug = `factorled-${p.id}`;
    const extras = (fl.images || []).filter((u) => u && u !== fl.cover);

    const data = {
      modelNumber: p.modelNumber,
      name: p.name,
      description: fl.description,
      specs: p.specs,
      certifications: p.certifications,
      coverImage: fl.cover,
      category: cat.kind, // 镜像 kind（power/null）
      series: serName[p.seriesSlug], // 镜像系列名
      categoryId: catId[p.categorySlug],
      seriesId: serId[p.seriesSlug],
      attributes: p.attributes,
      tagline: p.tagline,
      variantLabel: p.variantLabel ?? null,
      variantGroupId: p.variantGroup ?? null,
      highlights: p.highlights,
      luminaireType: p.luminaireType,
      sourceLocale: "es",
    };

    const product = await prisma.product.upsert({
      where: { factoryId_sourceId: { factoryId: factory.id, sourceId: p.modelNumber } },
      update: data,
      create: { ...data, slug, sourceId: p.modelNumber, factoryId: factory.id },
    });

    // 图片每次重建（封面外的前几张作为附图）
    await prisma.productImage.deleteMany({ where: { productId: product.id } });
    if (extras.length) {
      await prisma.productImage.createMany({
        data: extras.slice(0, 5).map((url, i) => ({
          productId: product.id,
          url,
          alt: `${p.name} ${i + 1}`,
          sortOrder: i,
        })),
      });
    }
    console.log(`  ✓ ${slug} · ${p.name}`);
  }

  console.log(`\n完成：工厂 factorled · 分类 ${CATEGORIES.length} · 系列 ${SERIES.length} · 产品 ${PRODUCTS.length}`);
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    prisma.$disconnect();
    process.exit(1);
  });
