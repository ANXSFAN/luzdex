import "server-only";
import { prisma } from "@/lib/prisma";

export type ProductSpec = {
  /** Optional group label, e.g. "Electrical" / "Photometric" */
  group?: string;
  label: string;
  value: string;
  unit?: string;
};

export function findPublicProductBySlug(slug: string) {
  return prisma.product.findUnique({
    where: { slug },
    include: {
      factory: true,
      documents: { orderBy: { sortOrder: "asc" } },
      videos: { orderBy: { sortOrder: "asc" } },
      images: { orderBy: { sortOrder: "asc" } },
    },
  });
}

export type PublicProduct = NonNullable<
  Awaited<ReturnType<typeof findPublicProductBySlug>>
>;

/** Safe runtime parse for the Json `specs` column. */
export function parseSpecs(json: unknown): ProductSpec[] {
  if (!Array.isArray(json)) return [];
  const out: ProductSpec[] = [];
  for (const raw of json) {
    if (!raw || typeof raw !== "object") continue;
    const r = raw as Record<string, unknown>;
    if (typeof r.label !== "string" || typeof r.value !== "string") continue;
    out.push({
      group: typeof r.group === "string" ? r.group : undefined,
      label: r.label,
      value: r.value,
      unit: typeof r.unit === "string" ? r.unit : undefined,
    });
  }
  return out;
}

/** 自动匹配用的产品属性（PCB 宽度决定铝槽，电压 + 功率决定电源）。 */
export type ProductAttributes = {
  pcbWidth?: string;
  voltage?: string;
  watt?: number;
};

/** Safe runtime parse for the Json `attributes` column. */
export function parseAttributes(json: unknown): ProductAttributes {
  if (!json || typeof json !== "object") return {};
  const r = json as Record<string, unknown>;
  const out: ProductAttributes = {};
  if (typeof r.pcbWidth === "string" && r.pcbWidth.trim()) out.pcbWidth = r.pcbWidth.trim();
  if (typeof r.voltage === "string" && r.voltage.trim()) out.voltage = r.voltage.trim();
  if (typeof r.watt === "number" && Number.isFinite(r.watt)) out.watt = r.watt;
  else if (typeof r.watt === "string" && r.watt.trim() && Number.isFinite(Number(r.watt))) {
    out.watt = Number(r.watt);
  }
  return out;
}

/** Group a flat ProductSpec[] by `.group` while preserving insertion order. */
export function groupSpecs(specs: ProductSpec[]) {
  const groups: { name: string; items: ProductSpec[] }[] = [];
  const index = new Map<string, number>();
  for (const s of specs) {
    const key = s.group ?? "";
    let i = index.get(key);
    if (i === undefined) {
      i = groups.length;
      index.set(key, i);
      groups.push({ name: key, items: [] });
    }
    groups[i].items.push(s);
  }
  return groups;
}

/** 亮点图标排：京东详情页标题下的"卖点 + 图标"短排。icon 为白名单 key（见前端映射）。 */
export type ProductHighlight = {
  icon: string;
  label: string;
  value?: string;
};

/** Safe runtime parse for the Json `highlights` column. */
export function parseHighlights(json: unknown): ProductHighlight[] {
  if (!Array.isArray(json)) return [];
  const out: ProductHighlight[] = [];
  for (const raw of json) {
    if (!raw || typeof raw !== "object") continue;
    const r = raw as Record<string, unknown>;
    if (typeof r.label !== "string" || !r.label.trim()) continue;
    out.push({
      icon: typeof r.icon === "string" ? r.icon : "dot",
      label: r.label,
      value:
        typeof r.value === "string" && r.value.trim() ? r.value : undefined,
    });
  }
  return out;
}

/** 应用场景：「用在哪里」的图标 / 实景图卡片。icon 复用亮点白名单，image 可选实景图。 */
export type Application = {
  icon: string;
  title: string;
  desc?: string;
  image?: string;
};

/** Safe runtime parse for the Json `applications` column. */
export function parseApplications(json: unknown): Application[] {
  if (!Array.isArray(json)) return [];
  const out: Application[] = [];
  for (const raw of json) {
    if (!raw || typeof raw !== "object") continue;
    const r = raw as Record<string, unknown>;
    if (typeof r.title !== "string" || !r.title.trim()) continue;
    out.push({
      icon: typeof r.icon === "string" ? r.icon : "dot",
      title: r.title,
      desc: typeof r.desc === "string" && r.desc.trim() ? r.desc : undefined,
      image:
        typeof r.image === "string" && r.image.trim() ? r.image : undefined,
    });
  }
  return out;
}

/**
 * 常见问题：终端顾客、产品使用向的问答（安装 / 色温 / 防护 / 质保 / 配件）。
 * 纯展示种草站定位（PLAN.md §7）：不放采购向内容（OEM / 起订 / 交期 / 样品），
 * 也不出现任何联系 / 价格 / 厂家出口，避免把顾客从原零售店拉走。
 */
export type FaqItem = { q: string; a: string };

/** Safe runtime parse for the Json `faq` column. */
export function parseFaq(json: unknown): FaqItem[] {
  if (!Array.isArray(json)) return [];
  const out: FaqItem[] = [];
  for (const raw of json) {
    if (!raw || typeof raw !== "object") continue;
    const r = raw as Record<string, unknown>;
    if (typeof r.q !== "string" || !r.q.trim()) continue;
    if (typeof r.a !== "string" || !r.a.trim()) continue;
    out.push({ q: r.q, a: r.a });
  }
  return out;
}

/** 盒内清单一项：物品 + 可选数量。AI 草稿 + 人工，前台统一标"以实际包装为准"。 */
export type BoxItem = { item: string; qty?: string };

/** Safe runtime parse for the Json `boxContents` column. */
export function parseBoxContents(json: unknown): BoxItem[] {
  if (!Array.isArray(json)) return [];
  const out: BoxItem[] = [];
  for (const raw of json) {
    if (!raw || typeof raw !== "object") continue;
    const r = raw as Record<string, unknown>;
    if (typeof r.item !== "string" || !r.item.trim()) continue;
    out.push({
      item: r.item,
      qty: typeof r.qty === "string" && r.qty.trim() ? r.qty : undefined,
    });
  }
  return out;
}

/** 安装方式 + 步骤。method 一句话定性，steps 有序步骤。 */
export type Install = { method?: string; steps: string[] };

/** Safe runtime parse for the Json `install` column。空内容回 null。 */
export function parseInstall(json: unknown): Install | null {
  if (!json || typeof json !== "object" || Array.isArray(json)) return null;
  const r = json as Record<string, unknown>;
  const method =
    typeof r.method === "string" && r.method.trim() ? r.method.trim() : undefined;
  const steps = Array.isArray(r.steps)
    ? r.steps.filter((s): s is string => typeof s === "string" && s.trim().length > 0)
    : [];
  if (!method && steps.length === 0) return null;
  return { method, steps };
}

/** 认证术语解释字典（全站通用，纯展示用，不含任何卖家/联系内容）。 */
export type CertInfo = { zh: string; en: string };
const CERT_INFO: Record<string, CertInfo> = {
  CE: { zh: "欧盟安全与合规标志", en: "EU safety & compliance mark" },
  ROHS: { zh: "限制有害物质（无铅等）", en: "Restriction of hazardous substances" },
  REACH: { zh: "欧盟化学品安全法规", en: "EU chemical safety regulation" },
  "LM-80": { zh: "LED 光源光衰测试标准", en: "LED lumen-maintenance test standard" },
  LM80: { zh: "LED 光源光衰测试标准", en: "LED lumen-maintenance test standard" },
  "TM-21": { zh: "LED 寿命外推方法", en: "LED lifetime projection method" },
  ENEC: { zh: "欧洲电气产品认证", en: "European electrical certification" },
  UL: { zh: "北美安全认证", en: "North American safety certification" },
  ETL: { zh: "北美安全检测标志", en: "North American safety listing" },
  CB: { zh: "国际电工安全互认证书", en: "IEC international safety scheme" },
  SAA: { zh: "澳洲安全认证", en: "Australian safety certification" },
  PSE: { zh: "日本电气安全认证", en: "Japan electrical safety mark" },
  FCC: { zh: "美国电磁兼容认证", en: "US electromagnetic-compatibility mark" },
  CCC: { zh: "中国强制性产品认证", en: "China Compulsory Certification" },
  DLC: { zh: "北美高效照明认证", en: "North American efficient-lighting listing" },
  TUV: { zh: "德国 TÜV 安全认证", en: "German TÜV safety certification" },
};

/**
 * 查认证码的通俗解释。先查字典；IPxx / IKxx 走前缀通用解释（防护 / 抗冲击）。
 * 未收录返回 null，前台回退只显示缩写。
 */
export function lookupCert(code: string): CertInfo | null {
  const key = code.trim().toUpperCase();
  if (CERT_INFO[key]) return CERT_INFO[key];
  if (/^IP\d{2}$/.test(key)) {
    return {
      zh: "防尘防水等级，两位数越大防护越强",
      en: "Ingress protection — higher digits, stronger sealing",
    };
  }
  if (/^IK\d{2}$/.test(key)) {
    return {
      zh: "外壳抗机械冲击等级",
      en: "Mechanical impact-resistance rating",
    };
  }
  return null;
}

/** 取字符串里第一个数字（去千分位逗号），用于参数可视化定比例。 */
function firstNum(s: string): number | null {
  const m = s.replace(/,/g, "").match(/-?\d+(\.\d+)?/);
  return m ? Number(m[0]) : null;
}

/** 参数可视化的一项：bar 带百分比进度，badge 纯数值徽章。icon 取亮点白名单 key。 */
export type SpecVizItem =
  | { kind: "bar"; icon: string; label: string; display: string; pct: number; note?: string }
  | { kind: "badge"; icon: string; label: string; display: string };

/**
 * 从现有 specs 派生「参数可视化」（Apple 式把数字变直观）。纯确定性映射，不碰 AI、
 * 不编造：识别不到 / 无数值的项直接跳过，下方规格表照常兜底。每类只取首个命中。
 */
export function buildSpecViz(
  specs: ProductSpec[],
  display?: ProductSpec[]
): SpecVizItem[] {
  const picked = new Set<string>();
  const items: Partial<Record<string, SpecVizItem>> = {};
  const disp = (s: ProductSpec) => (s.unit ? `${s.value} ${s.unit}` : s.value);

  specs.forEach((s, i) => {
    // 识别用源（启发式正则按源语言写，必须跑在源上）；展示文字用译文（按序对应，缺失回退源）。
    const d = display?.[i] ?? s;
    const oLabel = d.label;
    const label = s.label;
    const unit = s.unit ?? "";
    const hay = `${label} ${unit}`;
    const n = firstNum(s.value);

    if (!picked.has("ra") && /显色|\bRa\b|CRI/i.test(label) && n !== null) {
      picked.add("ra");
      items.ra = {
        kind: "bar",
        icon: "bulb",
        label: oLabel,
        display: disp(d),
        pct: Math.min(100, Math.round((n / 100) * 100)),
      };
    } else if (
      !picked.has("efficacy") &&
      (/光效/.test(label) || /lm\/?w/i.test(unit)) &&
      n !== null
    ) {
      picked.add("efficacy");
      items.efficacy = {
        kind: "bar",
        icon: "sun",
        label: oLabel,
        display: disp(d),
        pct: Math.min(100, Math.round((n / 160) * 100)),
        note: "/ 160 lm/W",
      };
    } else if (
      !picked.has("flux") &&
      (/光通|流明/.test(label) || (/\blm\b/i.test(unit) && !/\/w/i.test(unit)))
    ) {
      picked.add("flux");
      items.flux = { kind: "badge", icon: "gauge", label: oLabel, display: disp(d) };
    } else if (!picked.has("life") && /寿命|L70|L80|lifespan/i.test(label)) {
      picked.add("life");
      items.life = { kind: "badge", icon: "clock", label: oLabel, display: disp(d) };
    } else if (!picked.has("ip") && (/防护|防水|防尘/.test(label) || /IP\d|IK\d/i.test(s.value))) {
      picked.add("ip");
      items.ip = { kind: "badge", icon: "shield", label: oLabel, display: d.value };
    } else if (!picked.has("beam") && (/光束|配光|beam/i.test(label) || hay.includes("°"))) {
      picked.add("beam");
      items.beam = { kind: "badge", icon: "ruler", label: oLabel, display: disp(d) };
    }
  });

  // 固定展示顺序
  return (["ra", "efficacy", "flux", "life", "ip", "beam"] as const)
    .map((k) => items[k])
    .filter((x): x is SpecVizItem => !!x);
}

/** 色温（CCT）：lo/hi 为开尔文区间端点（单值时相等），display 为原始展示串，label 为规格行标题。 */
export type Cct = { lo: number; hi: number; display: string; label: string };

/**
 * 从 specs 找色温行并解析。用于色温刻度可视化——只在产品真有色温时出现，且端点取真实值。
 * 命中规则：标题含 色温/CCT/color temp，或单位是 K。抓 1000–10000 范围的四位数为开尔文值。
 * 解析不到回 null（不画刻度）。传 displaySpecs 进来可让 label 跟随当前语言。
 */
export function parseCct(specs: ProductSpec[]): Cct | null {
  for (const s of specs) {
    const unit = s.unit ?? "";
    const isCct =
      /色温|CCT|colou?r\s*temp/i.test(s.label) || /^K$/i.test(unit.trim());
    if (!isCct) continue;
    const nums = (`${s.value} ${unit}`.match(/\d{3,5}/g) ?? [])
      .map(Number)
      .filter((n) => n >= 1000 && n <= 10000);
    if (nums.length === 0) continue;
    return {
      lo: Math.min(...nums),
      hi: Math.max(...nums),
      display: unit ? `${s.value} ${unit}` : s.value,
      label: s.label,
    };
  }
  return null;
}

/**
 * 配光（光束角）。两种可画模式：
 * - cone：对称角，画侧视光锥；angles 多个=多挡可选（selectable）。
 * - asymmetric：双轴非对称（如 140×60 路面配光），画俯视光斑椭圆，major/minor 为长短轴角度。
 */
export type Beam =
  | { mode: "cone"; angles: number[]; display: string; label: string; selectable: boolean }
  | { mode: "asymmetric"; major: number; minor: number; display: string; label: string };

/**
 * 从 specs 解析光束角，用于「配光示意图」。保守且零编造：
 * - 命中规则：标题含 光束/配光/beam/apertura，或单位是 °（排除 °C/°F 温度）。
 * - "140 × 60"（双轴非对称/路面配光）→ asymmetric 模式，俯视光斑。
 * - 单角度→一个锥；"90 / 120 (可选)" 等→多挡可选锥（cone 模式）。
 * - 命名配光（蝙蝠翼 / Type III）或无干净角度 → 返回 null，留规格表/徽章兜底。
 * 传 displaySpecs 进来可让标题/取值跟随当前语言。
 */
export function parseBeam(specs: ProductSpec[]): Beam | null {
  const inRange = (n: number) => n >= 5 && n <= 180;
  for (const s of specs) {
    const unit = s.unit ?? "";
    const unitIsAngle = /°|deg|grado/i.test(unit) && !/[℃℉]|°\s*[CF]\b/i.test(unit);
    const isBeam = /光束|配光|beam|apertura|óptica|optica/i.test(s.label) || unitIsAngle;
    if (!isBeam) continue;
    const raw = `${s.value}`;
    const display = unit ? `${s.value} ${unit}` : s.value;
    // 双轴非对称（140 × 60）
    const asym = raw.match(/(\d{1,3})\s*[×x*]\s*(\d{1,3})/i);
    if (asym) {
      const a = Number(asym[1]);
      const b = Number(asym[2]);
      if (inRange(a) && inRange(b)) {
        return {
          mode: "asymmetric",
          major: Math.max(a, b),
          minor: Math.min(a, b),
          display,
          label: s.label,
        };
      }
      return null;
    }
    const angles = [
      ...new Set((raw.match(/\d{1,3}/g) ?? []).map(Number).filter(inRange)),
    ];
    if (angles.length === 0) continue; // 命名配光/无角度
    return {
      mode: "cone",
      angles: angles.slice(0, 4),
      display,
      label: s.label,
      selectable: /可选|optional|seleccionable|\/|,|，/i.test(raw),
    };
  }
  return null;
}

/** 产品尺寸（从 specs 解析）：w×h 为正面，d 为厚度，cutout 为开孔说明。 */
export type Dimensions = {
  w: number;
  h: number;
  d?: number;
  unit: string;
  cutout?: string;
};

/**
 * 从现有 specs 解析尺寸，用于「尺寸示意图」。确定性、不编造：找到「尺寸 / 外形」
 * 行（值含 ≥2 个数字）才返回；解析不到回 null（不画图）。开孔单独抓一个说明串。
 */
export function parseDimensions(specs: ProductSpec[]): Dimensions | null {
  let dim: Dimensions | null = null;
  let cutout: string | undefined;
  for (const s of specs) {
    if (!dim && /尺寸|外形|dimension|size/i.test(s.label)) {
      const nums = (s.value.match(/[\d.]+/g) ?? [])
        .map(Number)
        .filter((n) => Number.isFinite(n) && n > 0);
      if (nums.length >= 2) {
        dim = {
          w: nums[0],
          h: nums[1],
          d: nums[2],
          unit: s.unit || "mm",
        };
      }
    }
    if (!cutout && /开孔|开洞|cut[\s-]?out/i.test(s.label)) {
      cutout = s.unit ? `${s.value} ${s.unit}` : s.value;
    }
  }
  if (!dim) return null;
  if (cutout) dim.cutout = cutout;
  return dim;
}

function toNum(v: unknown): number | null {
  if (typeof v === "number") return Number.isFinite(v) && v > 0 ? v : null;
  if (typeof v === "string") {
    const n = Number(v.replace(/,/g, "").match(/[\d.]+/)?.[0]);
    return Number.isFinite(n) && n > 0 ? n : null;
  }
  return null;
}

/**
 * 解析存储的 `dimensions` 字段（AI 抽取 / 人工填）。需至少有 w、h 才有效。
 * 与 parseDimensions(specs) 互补：页面优先用本字段，缺失再回退 specs 正则。
 */
export function parseDimensionsJson(json: unknown): Dimensions | null {
  if (!json || typeof json !== "object" || Array.isArray(json)) return null;
  const r = json as Record<string, unknown>;
  const w = toNum(r.w);
  const h = toNum(r.h);
  if (w === null || h === null) return null;
  const d = toNum(r.d);
  return {
    w,
    h,
    d: d ?? undefined,
    unit: typeof r.unit === "string" && r.unit.trim() ? r.unit.trim() : "mm",
    cutout:
      typeof r.cutout === "string" && r.cutout.trim() ? r.cutout.trim() : undefined,
  };
}

/** 京东式图文长详情的一段。image 走 URL（v1 与导入一致），text/heading 走纯文本。 */
export type DetailBlock =
  | { kind: "heading"; text: string }
  | { kind: "text"; text: string }
  | { kind: "image"; url: string; caption?: string };

/** Safe runtime parse for the Json `detailBlocks` column. */
export function parseDetailBlocks(json: unknown): DetailBlock[] {
  if (!Array.isArray(json)) return [];
  const out: DetailBlock[] = [];
  for (const raw of json) {
    if (!raw || typeof raw !== "object") continue;
    const r = raw as Record<string, unknown>;
    if (r.kind === "image") {
      if (typeof r.url !== "string" || !r.url.trim()) continue;
      out.push({
        kind: "image",
        url: r.url,
        caption:
          typeof r.caption === "string" && r.caption.trim()
            ? r.caption
            : undefined,
      });
    } else if (r.kind === "heading" || r.kind === "text") {
      if (typeof r.text !== "string" || !r.text.trim()) continue;
      out.push({ kind: r.kind, text: r.text });
    }
  }
  return out;
}

export function siteUrl(): string {
  return (process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3001").replace(
    /\/$/,
    ""
  );
}

/**
 * 某一种语言的内容译文包。字段缺失即表示该语言此项未翻译，前台回退到源字段。
 * 复用各子 parser 清洗；specs 暂不入多语言（含语言相关启发式，保持源语言一致）。
 */
export type LocalizedContent = {
  name?: string;
  description?: string;
  tagline?: string;
  highlights?: ProductHighlight[];
  applications?: Application[];
  faq?: FaqItem[];
  boxContents?: BoxItem[];
  install?: Install;
  dimensions?: Dimensions;
  detailBlocks?: DetailBlock[];
  /** 译文规格：group/label 与描述型 value 翻译，数字/单位/型号码保持。用于规格表显示。 */
  specs?: ProductSpec[];
  /** 文档标题译文，按文档 sortOrder 顺序对应。 */
  docTitles?: string[];
  /** 视频标题译文，按视频 sortOrder 顺序对应。 */
  videoTitles?: string[];
};

/** 解析单种语言的译文包（AI 翻译结果 / 存储值通用）。空字段不写入。 */
export function parseLocalizedContent(json: unknown): LocalizedContent {
  const lc: LocalizedContent = {};
  if (!json || typeof json !== "object" || Array.isArray(json)) return lc;
  const r = json as Record<string, unknown>;
  if (typeof r.name === "string" && r.name.trim()) lc.name = r.name.trim();
  if (typeof r.description === "string" && r.description.trim())
    lc.description = r.description.trim();
  if (typeof r.tagline === "string" && r.tagline.trim())
    lc.tagline = r.tagline.trim();
  const hl = parseHighlights(r.highlights);
  if (hl.length) lc.highlights = hl;
  const ap = parseApplications(r.applications);
  if (ap.length) lc.applications = ap;
  const fq = parseFaq(r.faq);
  if (fq.length) lc.faq = fq;
  const bx = parseBoxContents(r.boxContents);
  if (bx.length) lc.boxContents = bx;
  const ins = parseInstall(r.install);
  if (ins) lc.install = ins;
  const dim = parseDimensionsJson(r.dimensions);
  if (dim) lc.dimensions = dim;
  const db = parseDetailBlocks(r.detailBlocks);
  if (db.length) lc.detailBlocks = db;
  const sp = parseSpecs(r.specs);
  if (sp.length) lc.specs = sp;
  const dt = Array.isArray(r.docTitles)
    ? r.docTitles.filter((s): s is string => typeof s === "string" && !!s.trim())
    : [];
  if (dt.length) lc.docTitles = dt;
  const vt = Array.isArray(r.videoTitles)
    ? r.videoTitles.filter((s): s is string => typeof s === "string" && !!s.trim())
    : [];
  if (vt.length) lc.videoTitles = vt;
  return lc;
}

/** 轻量读取 contentI18n 中某语言的某个字符串字段（不做完整 parse）。 */
export function localizedField(
  contentI18n: unknown,
  locale: string,
  field: string
): string | null {
  if (!contentI18n || typeof contentI18n !== "object" || Array.isArray(contentI18n))
    return null;
  const loc = (contentI18n as Record<string, unknown>)[locale];
  if (!loc || typeof loc !== "object") return null;
  const v = (loc as Record<string, unknown>)[field];
  return typeof v === "string" && v.trim() ? v : null;
}

/**
 * 计算"可翻译源内容"的指纹（djb2 哈希）。翻译时存下当时的指纹；之后源内容一变，
 * 指纹就对不上 → 译文已过期，提示重翻。入参用原始 DB 字段，确保保存/翻译两侧口径一致。
 */
export function contentSourceHash(p: {
  name: string;
  description: string | null;
  tagline: string | null;
  highlights: unknown;
  applications: unknown;
  faq: unknown;
  boxContents: unknown;
  install: unknown;
  dimensions: unknown;
  detailBlocks: unknown;
  specs: unknown;
  sourceLocale: string | null;
}): string {
  const s = JSON.stringify([
    p.name,
    p.description,
    p.tagline,
    p.highlights,
    p.applications,
    p.faq,
    p.boxContents,
    p.install,
    p.dimensions,
    p.detailBlocks,
    p.specs,
    p.sourceLocale,
  ]);
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h * 33) ^ s.charCodeAt(i)) >>> 0;
  return h.toString(16);
}

/**
 * 产品「内容就绪度」体检：供后台 Dashboard 与产品列表统一计算各类待补标记。
 * - noImage：无封面且无画廊图
 * - lacksShowcase：卖点/场景/图文都空
 * - translatedCount：已翻译语言数（contentI18n 的 key 数，源语言不计）
 * - stale：有译文且源内容指纹与上次翻译不一致（译文过期）
 */
export function productReadiness(p: {
  coverImage: string | null;
  imageCount: number;
  highlights: unknown;
  applications: unknown;
  detailBlocks: unknown;
  contentI18n: unknown;
  translationStamp: string | null;
  name: string;
  description: string | null;
  tagline: string | null;
  faq: unknown;
  boxContents: unknown;
  install: unknown;
  dimensions: unknown;
  specs: unknown;
  sourceLocale: string | null;
}): {
  noImage: boolean;
  lacksShowcase: boolean;
  translatedCount: number;
  stale: boolean;
} {
  const noImage = !p.coverImage && p.imageCount === 0;
  const lacksShowcase =
    parseHighlights(p.highlights).length === 0 &&
    parseApplications(p.applications).length === 0 &&
    parseDetailBlocks(p.detailBlocks).length === 0;
  const translatedCount = Object.keys(parseContentI18n(p.contentI18n)).length;
  const stale =
    translatedCount > 0 &&
    !!p.translationStamp &&
    contentSourceHash(p) !== p.translationStamp;
  return { noImage, lacksShowcase, translatedCount, stale };
}

/** 解析整个 `contentI18n` 列：{ [locale]: LocalizedContent }。 */
export function parseContentI18n(
  json: unknown
): Record<string, LocalizedContent> {
  if (!json || typeof json !== "object" || Array.isArray(json)) return {};
  const out: Record<string, LocalizedContent> = {};
  for (const [loc, val] of Object.entries(json as Record<string, unknown>)) {
    out[loc] = parseLocalizedContent(val);
  }
  return out;
}

export type RelatedItem = {
  id: string;
  slug: string;
  name: string;
  modelNumber: string;
  coverImage: string | null;
  category: string | null;
};

export type RelatedAccessory = RelatedItem & { relation: string };

export type VariantOption = {
  id: string;
  slug: string;
  modelNumber: string;
  variantLabel: string | null;
};

/**
 * 同系列规格变体（京东式「选规格」）：同 `series`、同租户的所有型号（含当前自己）。
 * 仅当组内 >1 个型号时才返回，单品不显示选择器。运营在后台填 variantLabel 作为
 * 短标签（如「100W」「暖光 3000K」），未填则前台回退展示 modelNumber。
 */
export async function findVariants(product: {
  factoryId: string;
  series: string | null;
}): Promise<VariantOption[]> {
  if (!product.series) return [];
  const rows = await prisma.product.findMany({
    where: { factoryId: product.factoryId, series: product.series },
    orderBy: [{ variantLabel: "asc" }, { modelNumber: "asc" }],
    select: { id: true, slug: true, modelNumber: true, variantLabel: true },
  });
  return rows.length > 1 ? rows : [];
}

export type VariantComparison = {
  id: string;
  slug: string;
  modelNumber: string;
  variantLabel: string | null;
  specs: ProductSpec[];
};

/**
 * 同系列变体的「规格并排对比」数据（京东 SKU 对比 / Apple Compare）。
 * 复用 findVariants 的系列聚合，但额外取出每个变体的 specs 供并排成表。
 * 仅当组内 >1 个型号时返回，单品不对比。
 */
export async function findVariantComparison(product: {
  factoryId: string;
  series: string | null;
}): Promise<VariantComparison[]> {
  if (!product.series) return [];
  const rows = await prisma.product.findMany({
    where: { factoryId: product.factoryId, series: product.series },
    orderBy: [{ variantLabel: "asc" }, { modelNumber: "asc" }],
    select: {
      id: true,
      slug: true,
      modelNumber: true,
      variantLabel: true,
      specs: true,
    },
  });
  if (rows.length < 2) return [];
  return rows.map((r) => ({
    id: r.id,
    slug: r.slug,
    modelNumber: r.modelNumber,
    variantLabel: r.variantLabel,
    specs: parseSpecs(r.specs),
  }));
}

export type CompareRow = {
  label: string;
  /** 每个变体一格（已含单位），缺该项为 null（对应列显「—」）。顺序与传入 variants 一致。 */
  values: (string | null)[];
  /** 各变体取值是否存在差异（用于高亮"区别在哪"）。 */
  differs: boolean;
};

export type CompareGroup = { name: string; rows: CompareRow[] };

/**
 * 把变体的 specs 拢成一张对比矩阵：行 = 规格项（按首次出现顺序去重、保留分组），
 * 列 = 各变体。某变体缺该项则该格为 null。differs 标记跨列取值不一致的行。
 */
export function buildVariantMatrix(variants: VariantComparison[]): CompareGroup[] {
  // 每个变体建 label → "值+单位" 的查表
  const maps = variants.map((v) => {
    const m = new Map<string, string>();
    for (const s of v.specs) {
      m.set(s.label, s.unit ? `${s.value} ${s.unit}` : s.value);
    }
    return m;
  });

  // 按首次出现顺序收集 (group, label)
  const order: { group: string; label: string }[] = [];
  const seen = new Set<string>();
  for (const v of variants) {
    for (const s of v.specs) {
      if (seen.has(s.label)) continue;
      seen.add(s.label);
      order.push({ group: s.group ?? "", label: s.label });
    }
  }

  const groups: CompareGroup[] = [];
  const gIndex = new Map<string, number>();
  for (const o of order) {
    const values = maps.map((m) => m.get(o.label) ?? null);
    const present = values.filter((x): x is string => x !== null);
    const differs =
      present.length > 0 &&
      (present.length !== values.length ||
        new Set(present).size > 1);
    const row: CompareRow = { label: o.label, values, differs };

    let gi = gIndex.get(o.group);
    if (gi === undefined) {
      gi = groups.length;
      gIndex.set(o.group, gi);
      groups.push({ name: o.group, rows: [] });
    }
    groups[gi].rows.push(row);
  }
  return groups;
}

/**
 * 相关产品（同租户内）：
 * - siblings：同 `series` 的兄弟产品（零授权成本，纯聚合）
 * - accessories：手动 / 导入的 ProductLink（权威，优先展示）
 * 属性自动匹配兜底属于 M9，这里只取手动关系，保证展示确定、不乱推荐。
 */
export async function findRelatedProducts(
  product: {
    id: string;
    factoryId: string;
    series: string | null;
  },
  locale?: string
): Promise<{ siblings: RelatedItem[]; accessories: RelatedAccessory[] }> {
  const select = {
    id: true,
    slug: true,
    name: true,
    modelNumber: true,
    coverImage: true,
    category: true,
    contentI18n: true,
  } as const;

  const [siblings, links] = await Promise.all([
    product.series
      ? prisma.product.findMany({
          where: {
            factoryId: product.factoryId,
            series: product.series,
            id: { not: product.id },
          },
          orderBy: { name: "asc" },
          take: 8,
          select,
        })
      : Promise.resolve(
          [] as { contentI18n: unknown; name: string; id: string; slug: string; modelNumber: string; coverImage: string | null; category: string | null }[]
        ),
    prisma.productLink.findMany({
      where: { fromId: product.id },
      orderBy: { sortOrder: "asc" },
      take: 12,
      select: { relation: true, to: { select } },
    }),
  ]);

  // 按 locale 取译名，缺失回退源名；丢弃 contentI18n 不外泄
  const toItem = (r: {
    contentI18n: unknown;
    name: string;
    id: string;
    slug: string;
    modelNumber: string;
    coverImage: string | null;
    category: string | null;
  }): RelatedItem => ({
    id: r.id,
    slug: r.slug,
    name: (locale && localizedField(r.contentI18n, locale, "name")) || r.name,
    modelNumber: r.modelNumber,
    coverImage: r.coverImage,
    category: r.category,
  });

  return {
    siblings: siblings.map(toItem),
    accessories: links.map((l) => ({ ...toItem(l.to), relation: l.relation })),
  };
}
