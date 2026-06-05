import "server-only";
import * as XLSX from "xlsx";
import { prisma } from "@/lib/prisma";
import type { ProductSpec, ProductAttributes } from "@/lib/products";

/**
 * 批量导入：多 Sheet 工作簿（产品 / 规格 / 图片 / 配件），靠"型号"做主键关联。
 * 核心原则：永远先预览（buildPlan，不写库）再写库（commitPlan）。
 * 写库走 (factoryId, sourceId=型号) upsert，与主站同步产品共用唯一约束、天然幂等。
 */

// ── Sheet / 表头 别名 ─────────────────────────────────────────────

const SHEET_ALIASES: Record<SheetKey, string[]> = {
  products: ["产品", "products", "product"],
  specs: ["规格", "specs", "spec", "specifications"],
  images: ["图片", "images", "image"],
  links: ["配件", "accessories", "links", "link"],
};

type SheetKey = "products" | "specs" | "images" | "links";

const COL = {
  model: ["型号", "model", "modelnumber", "产品型号"],
  name: ["名称", "name", "产品名称"],
  description: ["描述", "description", "desc"],
  series: ["系列", "series"],
  category: ["类目", "category", "分类"],
  certifications: ["认证", "certifications", "certs", "认证徽章"],
  coverImage: ["封面图url", "封面图", "coverimage", "cover", "封面"],
  group: ["分组", "group"],
  specLabel: ["参数名", "label", "参数"],
  specValue: ["参数值", "value", "值"],
  unit: ["单位", "unit"],
  imageUrl: ["图片url", "url", "图片", "图片链接"],
  alt: ["说明", "alt", "备注"],
  sortOrder: ["排序", "sortorder", "sort", "顺序"],
  targetModel: ["适配型号", "targetmodel", "tomodel", "配件型号"],
  relation: ["关系", "relation", "类型"],
  pcbWidth: ["pcb宽度", "pcbwidth", "pcb", "板宽"],
  attrVoltage: ["电压", "voltage"],
  watt: ["功率", "watt", "瓦数"],
} satisfies Record<string, string[]>;

/** 中文类目 → schema enum；也接受直接填英文 enum。 */
const CATEGORY_MAP: Record<string, string> = {
  灯带: "strip",
  铝槽: "channel",
  电源: "power",
  变压器: "power",
  连接件: "connector",
  连接器: "connector",
  配件: "accessory",
  strip: "strip",
  channel: "channel",
  power: "power",
  connector: "connector",
  accessory: "accessory",
};

const RELATIONS = new Set(["accessory", "alternative"]);

// ── 解析 ──────────────────────────────────────────────────────────

type RawRow = Record<string, unknown>;

export interface ParsedWorkbook {
  products: RawRow[];
  specs: RawRow[];
  images: RawRow[];
  links: RawRow[];
}

/** 在 header 已规范化（小写去空格）的 row 上按别名取第一个非空值，统一成 trim 后字符串。 */
function pick(row: RawRow, aliases: string[]): string {
  for (const a of aliases) {
    const v = row[a];
    if (v !== undefined && v !== null && String(v).trim() !== "") {
      return String(v).trim();
    }
  }
  return "";
}

/** 表头规范化：小写、去除所有空白，方便中英别名匹配。 */
function normalizeHeader(h: string): string {
  return h.toLowerCase().replace(/\s+/g, "");
}

function sheetToRows(ws: XLSX.WorkSheet): RawRow[] {
  const rows = XLSX.utils.sheet_to_json<RawRow>(ws, { defval: "", raw: false });
  return rows.map((r) => {
    const out: RawRow = {};
    for (const [k, v] of Object.entries(r)) out[normalizeHeader(k)] = v;
    return out;
  });
}

function findSheet(wb: XLSX.WorkBook, key: SheetKey): XLSX.WorkSheet | null {
  const aliases = SHEET_ALIASES[key];
  for (const name of wb.SheetNames) {
    if (aliases.includes(normalizeHeader(name))) return wb.Sheets[name];
  }
  return null;
}

/** 解析上传的工作簿。缺失的 sheet 视为空表（不报错，允许只导部分维度）。 */
export function parseWorkbook(buffer: Buffer): ParsedWorkbook {
  const wb = XLSX.read(buffer, { type: "buffer" });
  const get = (k: SheetKey) => {
    const ws = findSheet(wb, k);
    return ws ? sheetToRows(ws) : [];
  };
  return {
    products: get("products"),
    specs: get("specs"),
    images: get("images"),
    links: get("links"),
  };
}

// ── 校验后的规范化数据 ─────────────────────────────────────────────

interface NormProduct {
  excelRow: number; // 1-based 数据行号（含表头偏移，用于错误定位）
  model: string;
  name: string;
  description: string | null;
  series: string | null;
  category: string | null;
  certifications: string[];
  coverImage: string | null;
  attributes: ProductAttributes | null;
}

interface NormImage {
  model: string;
  url: string;
  alt: string | null;
  sortOrder: number;
}
interface NormLink {
  fromModel: string;
  toModel: string;
  relation: string;
}

export interface RowError {
  sheet: string;
  row: number;
  model: string;
  message: string;
}

export interface ImportPlan {
  summary: {
    totalProducts: number;
    create: number;
    update: number;
    errorRows: number;
    specRows: number;
    imageRows: number;
    linkRows: number;
  };
  /** 每个有效产品的预览动作 */
  products: {
    model: string;
    name: string;
    action: "create" | "update";
    specCount: number;
    imageCount: number;
  }[];
  errors: RowError[];
}

interface BuiltPlan extends ImportPlan {
  /** 仅含校验通过、可写库的规范化数据 */
  valid: {
    products: NormProduct[];
    specsByModel: Map<string, ProductSpec[]>;
    imagesByModel: Map<string, NormImage[]>;
    links: NormLink[];
  };
}

// Excel 表头占第 1 行，sheet_to_json 第 i 个对象对应文件第 i+2 行。
const ROW_OFFSET = 2;

function intOr(v: string, fallback: number): number {
  const n = Number.parseInt(v, 10);
  return Number.isFinite(n) ? n : fallback;
}

/**
 * 校验 + 构建计划，绝不写库。错误行级隔离：坏行进 errors，好行照常进 valid。
 * 引用完整性：规格 / 图片 / 配件引用的型号必须在产品表（本次导入 ∪ 库中已有）能解析。
 */
export async function buildPlan(
  factoryId: string,
  parsed: ParsedWorkbook,
): Promise<BuiltPlan> {
  const errors: RowError[] = [];

  // 1) 产品行校验
  const products: NormProduct[] = [];
  const productModels = new Set<string>();
  parsed.products.forEach((row, i) => {
    const excelRow = i + ROW_OFFSET;
    const model = pick(row, COL.model);
    const name = pick(row, COL.name);
    if (!model) {
      errors.push({ sheet: "产品", row: excelRow, model: "", message: "缺少型号" });
      return;
    }
    if (!name) {
      errors.push({ sheet: "产品", row: excelRow, model, message: "缺少名称" });
      return;
    }
    if (productModels.has(model)) {
      errors.push({ sheet: "产品", row: excelRow, model, message: "型号在文件内重复" });
      return;
    }
    const categoryRaw = pick(row, COL.category);
    let category: string | null = null;
    if (categoryRaw) {
      const mapped = CATEGORY_MAP[normalizeHeader(categoryRaw)];
      if (!mapped) {
        errors.push({
          sheet: "产品",
          row: excelRow,
          model,
          message: `未知类目「${categoryRaw}」（应为 灯带/铝槽/电源/连接件/配件）`,
        });
        return;
      }
      category = mapped;
    }
    const certifications = pick(row, COL.certifications)
      .split(/[,，;；\s]+/)
      .map((c) => c.trim())
      .filter(Boolean);

    const attrs: ProductAttributes = {};
    const pcb = pick(row, COL.pcbWidth);
    if (pcb) attrs.pcbWidth = pcb;
    const volt = pick(row, COL.attrVoltage);
    if (volt) attrs.voltage = volt;
    const watt = pick(row, COL.watt);
    if (watt && Number.isFinite(Number(watt))) attrs.watt = Number(watt);

    productModels.add(model);
    products.push({
      excelRow,
      model,
      name,
      description: pick(row, COL.description) || null,
      series: pick(row, COL.series) || null,
      category,
      certifications,
      coverImage: pick(row, COL.coverImage) || null,
      attributes: Object.keys(attrs).length ? attrs : null,
    });
  });

  // 库中已有的同工厂产品（决定 create / update，并扩充可被引用的型号集合）
  const existing = await prisma.product.findMany({
    where: { factoryId },
    select: { id: true, sourceId: true, slug: true },
  });
  const existingByModel = new Map(existing.map((p) => [p.sourceId, p]));
  // 引用解析域：本次导入的产品 + 库中已有产品
  const knownModels = new Set<string>(productModels);
  for (const p of existing) knownModels.add(p.sourceId);

  // 2) 规格行
  const specsByModel = new Map<string, ProductSpec[]>();
  parsed.specs.forEach((row, i) => {
    const excelRow = i + ROW_OFFSET;
    const model = pick(row, COL.model);
    const label = pick(row, COL.specLabel);
    const value = pick(row, COL.specValue);
    if (!model && !label && !value) return; // 整行空，跳过
    if (!model) {
      errors.push({ sheet: "规格", row: excelRow, model: "", message: "缺少型号" });
      return;
    }
    if (!knownModels.has(model)) {
      errors.push({ sheet: "规格", row: excelRow, model, message: "型号在产品表与库中均不存在" });
      return;
    }
    if (!label || !value) {
      errors.push({ sheet: "规格", row: excelRow, model, message: "参数名 / 参数值不能为空" });
      return;
    }
    const spec: ProductSpec = {
      group: pick(row, COL.group) || undefined,
      label,
      value,
      unit: pick(row, COL.unit) || undefined,
    };
    const arr = specsByModel.get(model) ?? [];
    arr.push(spec);
    specsByModel.set(model, arr);
  });

  // 3) 图片行
  const imagesByModel = new Map<string, NormImage[]>();
  let imageRows = 0;
  parsed.images.forEach((row, i) => {
    const excelRow = i + ROW_OFFSET;
    const model = pick(row, COL.model);
    const url = pick(row, COL.imageUrl);
    if (!model && !url) return;
    if (!model) {
      errors.push({ sheet: "图片", row: excelRow, model: "", message: "缺少型号" });
      return;
    }
    if (!knownModels.has(model)) {
      errors.push({ sheet: "图片", row: excelRow, model, message: "型号在产品表与库中均不存在" });
      return;
    }
    if (!url || !/^https?:\/\//i.test(url)) {
      errors.push({ sheet: "图片", row: excelRow, model, message: "图片URL 缺失或非 http(s)" });
      return;
    }
    imageRows++;
    const arr = imagesByModel.get(model) ?? [];
    arr.push({
      model,
      url,
      alt: pick(row, COL.alt) || null,
      sortOrder: intOr(pick(row, COL.sortOrder), arr.length),
    });
    imagesByModel.set(model, arr);
  });

  // 4) 配件关系行
  const links: NormLink[] = [];
  parsed.links.forEach((row, i) => {
    const excelRow = i + ROW_OFFSET;
    const fromModel = pick(row, COL.model);
    const toModel = pick(row, COL.targetModel);
    if (!fromModel && !toModel) return;
    if (!fromModel || !toModel) {
      errors.push({ sheet: "配件", row: excelRow, model: fromModel, message: "型号 / 适配型号不能为空" });
      return;
    }
    if (fromModel === toModel) {
      errors.push({ sheet: "配件", row: excelRow, model: fromModel, message: "型号不能与适配型号相同" });
      return;
    }
    if (!knownModels.has(fromModel)) {
      errors.push({ sheet: "配件", row: excelRow, model: fromModel, message: "型号在产品表与库中均不存在" });
      return;
    }
    if (!knownModels.has(toModel)) {
      errors.push({ sheet: "配件", row: excelRow, model: toModel, message: "适配型号在产品表与库中均不存在" });
      return;
    }
    const relRaw = normalizeHeader(pick(row, COL.relation)) || "accessory";
    if (!RELATIONS.has(relRaw)) {
      errors.push({ sheet: "配件", row: excelRow, model: fromModel, message: `未知关系「${relRaw}」（应为 accessory/alternative）` });
      return;
    }
    links.push({ fromModel, toModel, relation: relRaw });
  });

  // 计划摘要
  let create = 0;
  let update = 0;
  const productPreview = products.map((p) => {
    const isUpdate = existingByModel.has(p.model);
    if (isUpdate) update++;
    else create++;
    return {
      model: p.model,
      name: p.name,
      action: isUpdate ? ("update" as const) : ("create" as const),
      specCount: specsByModel.get(p.model)?.length ?? 0,
      imageCount: imagesByModel.get(p.model)?.length ?? 0,
    };
  });

  let specRows = 0;
  for (const arr of specsByModel.values()) specRows += arr.length;

  return {
    summary: {
      totalProducts: products.length,
      create,
      update,
      errorRows: errors.length,
      specRows,
      imageRows,
      linkRows: links.length,
    },
    products: productPreview,
    errors,
    valid: { products, specsByModel, imagesByModel, links },
  };
}

// ── slug ──────────────────────────────────────────────────────────

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

// ── 写库（两 Pass，单事务）─────────────────────────────────────────

export interface CommitResult {
  jobId: string;
  created: number;
  updated: number;
  errorRows: number;
  linkRows: number;
}

/**
 * 确认导入：buildPlan 后只写有效行，整体放一个事务（写入部分一致）。
 * Pass 1 产品 + 认证 + 规格 + 图片；Pass 2 配件关系（等产品全建完才能解析型号→id）。
 * 全程按 (factoryId, sourceId=型号) upsert，重复导入更新而非新增。
 */
export async function commitPlan(
  factoryId: string,
  fileName: string,
  parsed: ParsedWorkbook,
): Promise<CommitResult> {
  const plan = await buildPlan(factoryId, parsed);
  const { products, specsByModel, imagesByModel, links } = plan.valid;

  let created = 0;
  let updated = 0;

  // 事务外预取已占用的全局 slug，减少事务内查询；事务内仍兜底唯一化。
  const takenSlugs = new Set(
    (await prisma.product.findMany({ select: { slug: true } })).map((p) => p.slug),
  );

  await prisma.$transaction(
    async (tx) => {
      const modelToId = new Map<string, string>();

      // Pass 1
      for (const p of products) {
        const specs = specsByModel.get(p.model);
        const images = imagesByModel.get(p.model);

        const existing = await tx.product.findUnique({
          where: { factoryId_sourceId: { factoryId, sourceId: p.model } },
          select: { id: true },
        });

        const base = {
          name: p.name,
          description: p.description,
          series: p.series,
          category: p.category,
          certifications: p.certifications,
          coverImage: p.coverImage,
          // 仅当该型号在规格 sheet 出现才覆盖，避免误清空
          ...(specs ? { specs } : {}),
          // 同理，属性留空则不动已有值
          ...(p.attributes ? { attributes: p.attributes } : {}),
        };

        let productId: string;
        if (existing) {
          await tx.product.update({ where: { id: existing.id }, data: base });
          productId = existing.id;
          updated++;
        } else {
          // 生成全局唯一 slug
          let slug = slugify(p.model) || `p-${slugify(factoryId).slice(0, 8)}`;
          if (takenSlugs.has(slug)) {
            let n = 2;
            while (takenSlugs.has(`${slug}-${n}`)) n++;
            slug = `${slug}-${n}`;
          }
          takenSlugs.add(slug);
          const row = await tx.product.create({
            data: {
              sourceId: p.model,
              modelNumber: p.model,
              slug,
              factoryId,
              ...base,
            },
            select: { id: true },
          });
          productId = row.id;
          created++;
        }
        modelToId.set(p.model, productId);

        // 图片：该型号在图片 sheet 出现才重建（幂等）
        if (images) {
          await tx.productImage.deleteMany({ where: { productId } });
          if (images.length > 0) {
            await tx.productImage.createMany({
              data: images.map((img) => ({
                productId,
                url: img.url,
                alt: img.alt,
                sortOrder: img.sortOrder,
              })),
            });
          }
        }
      }

      // 型号→id：优先本批新建/更新的，缺失再查库（引用已有产品的情形）。
      const resolveId = async (model: string): Promise<string | null> => {
        const hit = modelToId.get(model);
        if (hit) return hit;
        const p = await tx.product.findUnique({
          where: { factoryId_sourceId: { factoryId, sourceId: model } },
          select: { id: true },
        });
        return p?.id ?? null;
      };

      // Pass 2 — 配件关系（等产品全建完才能解析型号→id）。
      for (const link of links) {
        const fromId = await resolveId(link.fromModel);
        const toId = await resolveId(link.toModel);
        if (!fromId || !toId) continue; // 理论上 buildPlan 已校验，防御性跳过

        await tx.productLink.upsert({
          where: { fromId_toId_relation: { fromId, toId, relation: link.relation } },
          create: { factoryId, fromId, toId, relation: link.relation },
          update: {},
        });
      }
    },
    { timeout: 60_000, maxWait: 10_000 },
  );

  const job = await prisma.importJob.create({
    data: {
      factoryId,
      fileName,
      status: "done",
      totalRows: plan.summary.totalProducts,
      createdRows: created,
      updatedRows: updated,
      errorRows: plan.summary.errorRows,
      // 序列化成纯 JSON 以匹配 Prisma 的 InputJsonValue（RowError[] 缺 index signature）
      report: JSON.parse(JSON.stringify({ errors: plan.errors, summary: plan.summary })),
    },
    select: { id: true },
  });

  return {
    jobId: job.id,
    created,
    updated,
    errorRows: plan.summary.errorRows,
    linkRows: links.length,
  };
}

// ── 错误报告 CSV ───────────────────────────────────────────────────

export function errorsToCsv(errors: RowError[]): string {
  const head = "工作表,行号,型号,错误原因";
  const esc = (s: string) => `"${s.replace(/"/g, '""')}"`;
  const lines = errors.map(
    (e) => [e.sheet, String(e.row), e.model, e.message].map(esc).join(","),
  );
  // BOM 让 Excel 正确识别 UTF-8
  return "﻿" + [head, ...lines].join("\r\n");
}

// ── 模板工作簿 ─────────────────────────────────────────────────────

/** 生成四 Sheet 模板（带一行示例），返回 xlsx 二进制。 */
export function buildTemplateWorkbook(): Buffer {
  const wb = XLSX.utils.book_new();

  const productsAoa = [
    ["型号", "名称", "描述", "系列", "类目", "认证", "封面图URL", "PCB宽度", "电压", "功率"],
    [
      "COB-480-24V",
      "星光 COB 高密度灯带",
      "480 灯珠/米，无光斑连续光带",
      "星光系列",
      "灯带",
      "CE,RoHS",
      "https://example.com/cob-480.jpg",
      "10mm",
      "24V",
      "14.4",
    ],
    ["AL-PROFILE-10", "10mm 嵌入式铝槽", "配 10mm PCB 灯带", "嵌入系列", "铝槽", "", "", "10mm", "", ""],
    ["PWR-24V-100W", "24V 100W 开关电源", "恒压防水电源", "电源系列", "电源", "CE", "", "", "24V", "100"],
  ];
  const specsAoa = [
    ["型号", "分组", "参数名", "参数值", "单位"],
    ["COB-480-24V", "电气", "电压", "24", "V"],
    ["COB-480-24V", "电气", "功率", "14.4", "W/m"],
    ["COB-480-24V", "光学", "色温", "3000", "K"],
  ];
  const imagesAoa = [
    ["型号", "图片URL", "说明", "排序"],
    ["COB-480-24V", "https://example.com/cob-480-1.jpg", "主图", "0"],
    ["COB-480-24V", "https://example.com/cob-480-2.jpg", "安装效果", "1"],
  ];
  const linksAoa = [
    ["型号", "适配型号", "关系"],
    ["COB-480-24V", "AL-PROFILE-10", "accessory"],
  ];

  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(productsAoa), "产品");
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(specsAoa), "规格");
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(imagesAoa), "图片");
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(linksAoa), "配件");

  return XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
}
