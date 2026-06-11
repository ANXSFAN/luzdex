// 批量把所有产品的展示内容从源语言翻译成其余 8 种语言，写入 contentI18n。
// 复用后台「AI 翻译补全」同一套 prompt 与红线（纯展示种草站：只译文字、保结构/数字/
// 图标/URL，禁联系/价格/厂家/采购词）。specs 不翻译（保持源语言）。
// 运行：npm run db:translate-all
import "dotenv/config";
import { PrismaClient, Prisma } from "../src/generated/prisma/client.js";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({ connectionString: process.env.DIRECT_URL! });
const prisma = new PrismaClient({ adapter });

const LOCALES = ["es", "en", "fr", "de", "it", "pt", "nl", "pl", "zh"] as const;
type Locale = (typeof LOCALES)[number];
const LANG_NAMES: Record<Locale, string> = {
  es: "Spanish",
  en: "English",
  fr: "French",
  de: "German",
  it: "Italian",
  pt: "Portuguese",
  nl: "Dutch",
  pl: "Polish",
  zh: "Chinese",
};

const API_KEY = process.env.OPENROUTER_API_KEY;
const MODEL = process.env.OPENROUTER_MODEL || "anthropic/claude-sonnet-4.5";

const SYSTEM =
  "You are a professional translator for a consumer product showcase site. " +
  "Translate ONLY the human-readable text values in the given JSON. " +
  "Keep the JSON structure and keys, icon keys, image URLs, the 'kind' field, " +
  "all numbers, units and quantity symbols (e.g. ×1) EXACTLY unchanged. " +
  "For dimensions translate only the 'cutout' text; keep w/h/d/unit unchanged. " +
  "For specs translate 'group', 'label', and any descriptive words in 'value' " +
  "(e.g. material names, '已通过' → 'passed'); but keep numbers, measurements, " +
  "units and codes unchanged (e.g. 50000, IP66, AC 100-277V, lm/W, K, Ra, °, Ø75). " +
  "Translate each string in 'docTitles' (document titles) and 'videoTitles' (video titles). " +
  "Natural, consumer-facing tone. Never add contact info, prices, or any " +
  "seller/manufacturer/procurement wording. Output ONLY the JSON object.";

// 与 src/lib/products.ts 的 specsWithoutKeys 保持一致：指纹口径剥掉字典 key
function specsWithoutKeys(specs: unknown): unknown {
  if (!Array.isArray(specs)) return specs;
  return specs.map((row) => {
    if (!row || typeof row !== "object" || Array.isArray(row)) return row;
    const { key: _key, ...rest } = row as Record<string, unknown>;
    void _key;
    return rest;
  });
}

// 与 src/lib/products.ts 的 contentSourceHash 保持一致（同字段、同顺序、同 djb2 算法）。
// 少一个字段戳就永远对不上 → 全部产品被误标「译文过期」。
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

function normalizeLocale(input: string | null | undefined): Locale {
  if (!input) return "zh";
  const low = input.toLowerCase();
  if (low === "zh" || low.startsWith("zh-") || low.startsWith("zh_")) return "zh";
  const base = low.split(/[-_]/)[0];
  return (LOCALES as readonly string[]).includes(base) ? (base as Locale) : "zh";
}

function safeParseJSON(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    const s = text.indexOf("{");
    const e = text.lastIndexOf("}");
    if (s >= 0 && e > s) return JSON.parse(text.slice(s, e + 1));
    throw new Error("AI 返回不是合法 JSON");
  }
}

async function translateTo(srcJson: string, from: Locale, to: Locale) {
  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${API_KEY}`,
      "Content-Type": "application/json",
      "X-Title": "Datasheet Showcase",
    },
    body: JSON.stringify({
      model: MODEL,
      temperature: 0.3,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: SYSTEM },
        {
          role: "user",
          content:
            `Translate from ${LANG_NAMES[from]} to ${LANG_NAMES[to]}. ` +
            `Return the same JSON shape with text translated:\n${srcJson}`,
        },
      ],
    }),
  });
  if (!res.ok) {
    const t = await res.text().catch(() => "");
    throw new Error(`OpenRouter ${res.status}: ${t.slice(0, 200)}`);
  }
  const data = await res.json();
  const content: string | undefined = data?.choices?.[0]?.message?.content;
  if (!content) throw new Error("空返回");
  return safeParseJSON(content);
}

async function main() {
  if (!API_KEY) throw new Error("未配置 OPENROUTER_API_KEY");

  const products = await prisma.product.findMany({
    select: {
      id: true,
      slug: true,
      name: true,
      description: true,
      tagline: true,
      highlights: true,
      applications: true,
      faq: true,
      boxContents: true,
      install: true,
      dimensions: true,
      detailBlocks: true,
      specs: true,
      sourceLocale: true,
      contentI18n: true,
      documents: { select: { title: true }, orderBy: { sortOrder: "asc" } },
      videos: { select: { title: true }, orderBy: { sortOrder: "asc" } },
    },
    orderBy: { slug: "asc" },
  });

  console.log(`共 ${products.length} 个产品，模型 ${MODEL}\n`);

  for (const p of products) {
    const from = normalizeLocale(p.sourceLocale);
    const source = {
      name: p.name,
      description: p.description ?? "",
      tagline: p.tagline ?? "",
      highlights: p.highlights ?? [],
      applications: p.applications ?? [],
      faq: p.faq ?? [],
      boxContents: p.boxContents ?? [],
      install: p.install ?? null,
      dimensions: p.dimensions ?? null,
      detailBlocks: p.detailBlocks ?? [],
      // 字典 key 不属于可翻译内容，发给 AI 前剥掉（防 AI 改坏/回传带 key）
      specs: specsWithoutKeys(p.specs ?? []),
      docTitles: p.documents.map((d) => d.title),
      videoTitles: p.videos.map((v) => v.title),
    };
    const srcJson = JSON.stringify(source);
    const targets = LOCALES.filter((l) => l !== from);

    // 源里非空的板块译文必须都在，缺板块按失败算（防 AI 偷工减料丢场景/详情等）
    const requiredKeys = Object.entries(source)
      .filter(([, v]) =>
        Array.isArray(v) ? v.length > 0 : typeof v === "string" ? !!v.trim() : v != null
      )
      .map(([k]) => k);
    const isComplete = (val: unknown) => {
      if (!val || typeof val !== "object" || Array.isArray(val)) return false;
      const r = val as Record<string, unknown>;
      return requiredKeys.every((k) => {
        const v = r[k];
        if (v == null) return false;
        if (Array.isArray(v)) return v.length > 0;
        if (typeof v === "string") return !!v.trim();
        return true;
      });
    };

    const results = await Promise.all(
      targets.map(async (loc) => {
        for (let attempt = 0; attempt < 2; attempt++) {
          try {
            const val = await translateTo(srcJson, from, loc);
            if (isComplete(val)) return [loc, val] as const;
            console.log(`  · ${p.slug} → ${loc} 译文缺板块，重试 ${attempt + 1}/2`);
          } catch (e) {
            console.log(
              `  · ${p.slug} → ${loc} 失败: ${e instanceof Error ? e.message : e}`
            );
          }
        }
        return [loc, null] as const;
      })
    );

    // 合并写入：失败语言保留已有旧译文，不被整体覆盖清空
    const contentI18n: Record<string, unknown> =
      p.contentI18n && typeof p.contentI18n === "object" && !Array.isArray(p.contentI18n)
        ? { ...(p.contentI18n as Record<string, unknown>) }
        : {};
    let ok = 0;
    for (const [loc, val] of results) {
      if (val) {
        contentI18n[loc] = val;
        ok++;
      }
    }
    await prisma.product.update({
      where: { id: p.id },
      data: {
        contentI18n: contentI18n as Prisma.InputJsonObject,
        // 部分失败不盖戳，让后台「译文过期/未译」继续提示重跑
        ...(ok === targets.length ? { translationStamp: srcHash(p) } : {}),
      },
    });
    console.log(`✓ ${p.slug} — 翻译 ${ok}/${targets.length} 种语言`);
  }

  console.log("\n全部完成。");
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    prisma.$disconnect();
    process.exit(1);
  });
