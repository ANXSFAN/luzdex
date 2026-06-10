"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getActiveFactory } from "@/lib/active-factory";
import {
  parseSpecs,
  parseHighlights,
  parseBoxContents,
  parseInstall,
  parseDimensionsJson,
  parseAttributes,
  type ProductSpec,
  type ProductHighlight,
  type BoxItem,
  type Install,
  type Dimensions,
  type ProductAttributes,
} from "@/lib/products";
import { openRouterJSONRich, type ContentPart } from "@/lib/ai";
import { isR2Url, deleteFromR2 } from "@/lib/r2";
import { routing, normalizeLocale } from "@/i18n/routing";
import { LUMINAIRE_TYPES } from "@/lib/luminaire";
import { createProduct } from "./actions";

/**
 * AI PDF 录入流水线：客户上传一份技术文档 PDF，AI 抽取所有能抽的字段，
 * 客户勾选确认后入库——理想流是「传 PDF → 全字段填好 → 点 AI 翻译 → 发布」。
 *
 * 红线：抽取是「搬运」不是「创作」——只填文档里明确写了的，缺就留空，
 * 严禁编造数字 / 认证 / 尺寸（对齐 PLAN.md §7 与 generateShowcaseDraft 的约束）。
 */

/** 登录 + 选中工厂校验（与 actions.ts 同约定）。 */
async function authedFactory() {
  const session = await auth();
  if (!session) throw new Error("未授权");
  const factory = await getActiveFactory();
  if (!factory) throw new Error("未选择工厂");
  return factory;
}

async function assertOwned(productId: string, factoryId: string) {
  const p = await prisma.product.findUnique({
    where: { id: productId },
    select: { factoryId: true },
  });
  if (!p || p.factoryId !== factoryId) {
    throw new Error("产品不存在或不属于当前工厂");
  }
}

/** 与展示编辑器一致的图标白名单；AI 给了未知 key 回退 dot。 */
const ICON_KEYS = [
  "shield", "droplet", "zap", "clock", "award", "sun",
  "temp", "ruler", "gauge", "bulb", "battery", "dot",
];

const LUMINAIRE_KEYS = new Set<string>(LUMINAIRE_TYPES.map((t) => t.key));

/** PDF 抽取草稿：全部字段可缺省（文档里没有就空）。 */
export type PdfDraft = {
  name: string | null;
  modelNumber: string | null;
  tagline: string | null;
  description: string | null;
  luminaireType: string | null;
  sourceLocale: string | null;
  specs: ProductSpec[];
  certifications: string[];
  attributes: ProductAttributes;
  highlights: ProductHighlight[];
  boxContents: BoxItem[];
  install: Install | null;
  dimensions: Dimensions | null;
};

/** 可单独勾选应用的字段组 key（与前端预览复选框一一对应）。 */
export type PdfDraftField =
  | "basics"
  | "tagline"
  | "description"
  | "luminaireType"
  | "sourceLocale"
  | "specs"
  | "certifications"
  | "attributes"
  | "highlights"
  | "boxContents"
  | "install"
  | "dimensions";

const str = (v: unknown): string | null =>
  typeof v === "string" && v.trim() ? v.trim() : null;

/** 把 AI 返回（或客户端回传）的 unknown 清洗成 PdfDraft：非法项静默丢弃。 */
function cleanDraft(raw: unknown): PdfDraft {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const fixIcon = <T extends { icon: string }>(x: T): T =>
    ICON_KEYS.includes(x.icon) ? x : { ...x, icon: "dot" };

  const lum = str(r.luminaireType);
  const certs = Array.isArray(r.certifications)
    ? r.certifications
        .map((c) => String(c).trim())
        .filter(Boolean)
        .slice(0, 24)
    : [];

  const attrsRaw = (r.attributes && typeof r.attributes === "object"
    ? r.attributes
    : {}) as Record<string, unknown>;
  const attributes: ProductAttributes = {};
  const pcb = str(attrsRaw.pcbWidth);
  const volt = str(attrsRaw.voltage);
  if (pcb) attributes.pcbWidth = pcb;
  if (volt) attributes.voltage = volt;
  if (Number.isFinite(Number(attrsRaw.watt)) && attrsRaw.watt !== null && attrsRaw.watt !== "") {
    attributes.watt = Number(attrsRaw.watt);
  }

  return {
    name: str(r.name),
    modelNumber: str(r.modelNumber),
    tagline: str(r.tagline),
    description: str(r.description),
    luminaireType: lum && LUMINAIRE_KEYS.has(lum) ? lum : null,
    sourceLocale: normalizeLocale(str(r.sourceLocale) ?? "") ?? null,
    specs: parseSpecs(r.specs).slice(0, 80),
    certifications: certs,
    attributes,
    highlights: parseHighlights(r.highlights).map(fixIcon).slice(0, 6),
    boxContents: parseBoxContents(r.boxContents).slice(0, 12),
    install: parseInstall(r.install),
    dimensions: parseDimensionsJson(r.dimensions),
  };
}

/** 草稿里某字段组是否有内容（前端只展示有内容的组；应用时空组直接跳过）。 */
function draftHas(d: PdfDraft, f: PdfDraftField): boolean {
  switch (f) {
    case "basics":
      return !!(d.name || d.modelNumber);
    case "tagline":
      return !!d.tagline;
    case "description":
      return !!d.description;
    case "luminaireType":
      return !!d.luminaireType;
    case "sourceLocale":
      return !!d.sourceLocale;
    case "specs":
      return d.specs.length > 0;
    case "certifications":
      return d.certifications.length > 0;
    case "attributes":
      return Object.keys(d.attributes).length > 0;
    case "highlights":
      return d.highlights.length > 0;
    case "boxContents":
      return d.boxContents.length > 0;
    case "install":
      return !!d.install;
    case "dimensions":
      return !!d.dimensions;
  }
}

const ALL_FIELDS: PdfDraftField[] = [
  "basics", "tagline", "description", "luminaireType", "sourceLocale",
  "specs", "certifications", "attributes", "highlights",
  "boxContents", "install", "dimensions",
];

/** 从 R2 公开 URL 回读 PDF 字节（限本桶，挡 SSRF；读完即删临时文件）。 */
async function fetchPdfBytes(pdfUrl: string): Promise<Buffer> {
  if (!isR2Url(pdfUrl)) throw new Error("无效的文件地址");
  const res = await fetch(pdfUrl);
  if (!res.ok) throw new Error("读取 PDF 失败，请重新上传");
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length > 25 * 1024 * 1024) throw new Error("PDF 过大（上限 25MB）");
  // 临时文件用完即清，避免 R2 留孤儿（失败不影响主流程）
  await deleteFromR2(pdfUrl).catch(() => {});
  return buf;
}

/** PDF 字节 → AI 抽取草稿。供编辑页填充与「从 PDF 新建」共用。 */
async function extractDraft(pdf: Buffer, fileName: string): Promise<PdfDraft> {
  const system =
    "你是照明产品技术文档的字段抽取器。从用户给的 PDF 中抽取产品资料，输出一个 JSON 对象。" +
    "铁律：你是搬运工不是作者——只输出文档里明确写了的信息；文档里没有的字段一律给 null 或空数组，" +
    "严禁推测、估算或编造任何数字、参数、认证、尺寸。数值与单位保持文档原样。" +
    "忽略价格、订购信息、联系方式、公司宣传、OEM/MOQ 等采购内容，绝不放进任何字段。" +
    "只输出 JSON，不要解释。";

  const schema =
    `输出 JSON 结构（找不到的字段给 null / []）：\n` +
    `{\n` +
    `  "name": "产品名称（不含型号代码）",\n` +
    `  "modelNumber": "型号 / 货号",\n` +
    `  "tagline": "卖点短语带：从文档真实特性提炼 3-4 个短语，用 · 分隔；文档信息太少则 null",\n` +
    `  "description": "1-2 段产品介绍，只组织文档里的事实，面向终端顾客",\n` +
    `  "luminaireType": "灯具类型，只能选: ${LUMINAIRE_TYPES.map((t) => t.key).join(", ")}，判断不了给 null",\n` +
    `  "sourceLocale": "文档正文主要语言，只能选: ${routing.locales.join(", ")}，其他语言给 null",\n` +
    `  "specs": [{"group":"分组(如 电气/光学/物理/环境，用文档语言)","label":"参数名","value":"参数值","unit":"单位(可选)"}],\n` +
    `  "certifications": ["认证标志，如 CE, RoHS, IP65, UL"],\n` +
    `  "attributes": {"pcbWidth":"PCB/灯板宽度(灯带类才有,含单位,如 10mm)","voltage":"工作电压(如 DC24V / AC220-240V)","watt": 功率数字},\n` +
    `  "highlights": [{"icon":"只能选: ${ICON_KEYS.join(", ")}","label":"亮点说明","value":"短数值(可选,如 IP65)"}],\n` +
    `  "boxContents": [{"item":"盒内物品","qty":"数量(可选,如 ×1)"}] 仅文档明确列了包装清单才填,\n` +
    `  "install": {"method":"安装方式一句话","steps":["步骤1","步骤2"]} 仅文档有安装说明才填,\n` +
    `  "dimensions": {"w":数字,"h":数字,"d":数字或null,"unit":"mm","cutout":"开孔说明(如 Ø75)或 null"} 仅文档明确给了产品尺寸才填\n` +
    `}\n` +
    `tagline/description/highlights 的文字用文档正文语言写。specs 按文档的参数表完整搬运、保持顺序、能分组就分组。`;

  const parts: ContentPart[] = [
    { type: "text", text: schema },
    {
      type: "file",
      file: {
        filename: fileName || "datasheet.pdf",
        file_data: `data:application/pdf;base64,${pdf.toString("base64")}`,
      },
    },
  ];

  const raw = await openRouterJSONRich(
    [
      { role: "system", content: system },
      { role: "user", content: parts },
    ],
    { temperature: 0.1 },
  );
  return cleanDraft(raw);
}

/**
 * 编辑页「从 PDF 填充」第一步：PDF（已传 R2）→ AI 抽取草稿返回前端预览。
 * 只抽取、不入库；客户勾选字段后走 applyProductPdfDraft。
 */
export async function extractProductFromPdf(input: {
  pdfUrl: string;
  fileName?: string;
}): Promise<PdfDraft> {
  await authedFactory();
  const bytes = await fetchPdfBytes(input.pdfUrl);
  return extractDraft(bytes, input.fileName ?? "datasheet.pdf");
}

/**
 * 第二步：把客户勾选的字段组写入产品。draft 来自前端回传，重新清洗后才落库；
 * attributes 与现有合并（PDF 没写的属性不清掉），其余字段组整组覆盖。
 */
export async function applyProductPdfDraft(input: {
  productId: string;
  draft: unknown;
  fields: PdfDraftField[];
}): Promise<{ applied: number }> {
  const factory = await authedFactory();
  await assertOwned(input.productId, factory.id);

  const draft = cleanDraft(input.draft);
  const fields = input.fields.filter(
    (f) => ALL_FIELDS.includes(f) && draftHas(draft, f),
  );
  if (!fields.length) return { applied: 0 };

  const data: Record<string, unknown> = {};
  for (const f of fields) {
    switch (f) {
      case "basics":
        if (draft.name) data.name = draft.name;
        if (draft.modelNumber) data.modelNumber = draft.modelNumber;
        break;
      case "tagline":
        data.tagline = draft.tagline;
        break;
      case "description":
        data.description = draft.description;
        break;
      case "luminaireType":
        data.luminaireType = draft.luminaireType;
        break;
      case "sourceLocale":
        data.sourceLocale = draft.sourceLocale;
        break;
      case "specs":
        data.specs = draft.specs;
        break;
      case "certifications":
        data.certifications = draft.certifications;
        break;
      case "attributes": {
        const cur = await prisma.product.findUnique({
          where: { id: input.productId },
          select: { attributes: true },
        });
        data.attributes = { ...parseAttributes(cur?.attributes), ...draft.attributes };
        break;
      }
      case "highlights":
        data.highlights = draft.highlights;
        break;
      case "boxContents":
        data.boxContents = draft.boxContents;
        break;
      case "install":
        data.install = draft.install ?? {};
        break;
      case "dimensions":
        data.dimensions = draft.dimensions ?? {};
        break;
    }
  }

  await prisma.product.update({ where: { id: input.productId }, data });
  revalidatePath(`/admin/products/${input.productId}`);
  revalidatePath("/admin/products");
  return { applied: fields.length };
}

/**
 * 「从 PDF 新建」：上传 PDF → 抽取 → 建产品 → 全字段应用 → 返回新 id 跳编辑页。
 * 型号抽不到时报错让客户手动新建（型号是建档必填且作 sourceId）。
 */
export async function createProductFromPdf(input: {
  pdfUrl: string;
  fileName?: string;
  categoryId?: string | null;
  seriesId?: string | null;
}): Promise<string> {
  await authedFactory();
  const bytes = await fetchPdfBytes(input.pdfUrl);
  const draft = await extractDraft(bytes, input.fileName ?? "datasheet.pdf");

  if (!draft.modelNumber) {
    throw new Error("未能从 PDF 识别出型号，请手动新建后再用「从 PDF 填充」");
  }
  const id = await createProduct({
    name: draft.name ?? draft.modelNumber,
    modelNumber: draft.modelNumber,
    categoryId: input.categoryId,
    seriesId: input.seriesId,
  });
  await applyProductPdfDraft({
    productId: id,
    draft,
    fields: ALL_FIELDS.filter((f) => f !== "basics"),
  });
  return id;
}
