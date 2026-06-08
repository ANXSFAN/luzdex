"use client";

import { useState, useTransition } from "react";
import {
  Plus,
  Trash2,
  ArrowUp,
  ArrowDown,
  GripVertical,
  Sparkles,
  Languages,
} from "lucide-react";
import { toast } from "sonner";
import {
  saveProductShowcase,
  generateShowcaseDraft,
  translateShowcase,
  saveTranslation,
} from "@/app/admin/products/actions";
import { LOCALE_LABELS, LOCALE_ORDER } from "@/i18n/routing";
import { LUMINAIRE_TYPES } from "@/lib/luminaire";

type Highlight = { icon: string; label: string; value: string };
type Application = { icon: string; title: string; desc: string; image: string };
type Faq = { q: string; a: string };
type BoxItem = { item: string; qty: string };
type Block =
  | { kind: "heading"; text: string }
  | { kind: "text"; text: string }
  | { kind: "image"; url: string; caption: string };

// 每种语言可编辑的内容（语言模式编辑器在源/各译文之间切换时整体加载）
type LocaleContent = {
  tagline: string;
  description: string;
  highlights: Highlight[];
  blocks: Block[];
  applications: Application[];
  faq: Faq[];
  boxContents: BoxItem[];
  installMethod: string;
  installSteps: string[];
  dimCutout: string;
};

const EMPTY_CONTENT: LocaleContent = {
  tagline: "",
  description: "",
  highlights: [],
  blocks: [],
  applications: [],
  faq: [],
  boxContents: [],
  installMethod: "",
  installSteps: [],
  dimCutout: "",
};

const ICONS: { key: string; label: string }[] = [
  { key: "shield", label: "防护 / 认证" },
  { key: "droplet", label: "防水" },
  { key: "zap", label: "功率 / 电气" },
  { key: "clock", label: "寿命" },
  { key: "award", label: "质保 / 奖项" },
  { key: "sun", label: "亮度 / 光效" },
  { key: "temp", label: "温度" },
  { key: "ruler", label: "尺寸" },
  { key: "gauge", label: "性能指标" },
  { key: "bulb", label: "光源 / 显色" },
  { key: "battery", label: "电池 / 续航" },
  { key: "dot", label: "通用" },
];

const inputCls =
  "w-full rounded-lg border border-[var(--color-rule)] bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-ink)] outline-none transition focus:border-[var(--color-ink)]";
// 定宽字段用：与 inputCls 同样式但不含 w-full，避免 w-full 覆盖 w-32/w-36
const inputBase = inputCls.replace("w-full ", "");
const labelCls =
  "font-mono text-[10px] font-medium uppercase tracking-[0.22em] text-[var(--color-ink-muted)]";

export function ShowcaseEditor({
  productId,
  initialTagline,
  initialVariantLabel,
  initialDescription,
  initialLuminaireType,
  initialHighlights,
  initialBlocks,
  initialApplications,
  initialFaq,
  initialBoxContents,
  initialInstallMethod,
  initialInstallSteps,
  initialDim,
  initialSourceLocale,
  translatedLocales,
  translationStale,
  initialTranslations,
}: {
  productId: string;
  initialTagline: string;
  initialVariantLabel: string;
  initialDescription: string;
  initialLuminaireType: string;
  initialHighlights: Highlight[];
  initialBlocks: Block[];
  initialApplications: Application[];
  initialFaq: Faq[];
  initialBoxContents: BoxItem[];
  initialInstallMethod: string;
  initialInstallSteps: string[];
  initialDim: {
    w: string;
    h: string;
    d: string;
    unit: string;
    cutout: string;
  };
  initialSourceLocale: string;
  translatedLocales: string[];
  translationStale: boolean;
  initialTranslations: Record<string, LocaleContent>;
}) {
  const [tagline, setTagline] = useState(initialTagline);
  const [variantLabel, setVariantLabel] = useState(initialVariantLabel);
  const [description, setDescription] = useState(initialDescription);
  const [luminaireType, setLuminaireType] = useState(initialLuminaireType);
  const [highlights, setHighlights] = useState<Highlight[]>(initialHighlights);
  const [blocks, setBlocks] = useState<Block[]>(initialBlocks);
  const [applications, setApplications] =
    useState<Application[]>(initialApplications);
  const [faq, setFaq] = useState<Faq[]>(initialFaq);
  const [boxContents, setBoxContents] = useState<BoxItem[]>(initialBoxContents);
  const [installMethod, setInstallMethod] = useState(initialInstallMethod);
  const [installSteps, setInstallSteps] =
    useState<string[]>(initialInstallSteps);
  const [dimW, setDimW] = useState(initialDim.w);
  const [dimH, setDimH] = useState(initialDim.h);
  const [dimD, setDimD] = useState(initialDim.d);
  const [dimUnit, setDimUnit] = useState(initialDim.unit);
  const [dimCutout, setDimCutout] = useState(initialDim.cutout);
  const [sourceLocale, setSourceLocale] = useState(initialSourceLocale || "zh");
  const baseLocale = initialSourceLocale || "zh";
  const [editingLocale, setEditingLocale] = useState(baseLocale);
  const isSource = editingLocale === baseLocale;
  const [pending, start] = useTransition();
  const [genPending, startGen] = useTransition();
  const [transPending, startTrans] = useTransition();

  // 源语言内容快照（初始 props），切回源语言时还原
  const sourceContent: LocaleContent = {
    tagline: initialTagline,
    description: initialDescription,
    highlights: initialHighlights,
    blocks: initialBlocks,
    applications: initialApplications,
    faq: initialFaq,
    boxContents: initialBoxContents,
    installMethod: initialInstallMethod,
    installSteps: initialInstallSteps,
    dimCutout: initialDim.cutout,
  };

  // 把一份内容载入到可编辑字段（不动源专属字段：变体标签/灯具类型/尺寸 w·h·d·unit）
  function applyContent(c: LocaleContent) {
    setTagline(c.tagline);
    setDescription(c.description);
    setHighlights(c.highlights);
    setBlocks(c.blocks);
    setApplications(c.applications);
    setFaq(c.faq);
    setBoxContents(c.boxContents);
    setInstallMethod(c.installMethod);
    setInstallSteps(c.installSteps);
    setDimCutout(c.dimCutout);
  }

  // 切换正在编辑的语言（切换会丢弃未保存修改，故确认）
  function switchLocale(loc: string) {
    if (loc === editingLocale) return;
    if (!window.confirm("切换语言会丢弃当前未保存的修改，确定切换？")) return;
    applyContent(loc === baseLocale ? sourceContent : initialTranslations[loc] ?? EMPTY_CONTENT);
    setEditingLocale(loc);
  }

  // AI 翻译补全其余语言：读已保存的源语言内容，翻译入库（直接保存、可重跑）。
  function translate() {
    if (
      !window.confirm(
        "将把【已保存的】源语言内容翻译成其余 8 种语言并入库。请先保存当前内容，再翻译。继续？"
      )
    )
      return;
    startTrans(async () => {
      try {
        const r = await translateShowcase(productId);
        toast.success(`已翻译 ${r.ok}/${r.total} 种语言`);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "翻译失败");
      }
    });
  }

  function addBox() {
    setBoxContents((b) => [...b, { item: "", qty: "" }]);
  }
  function updateBox(i: number, patch: Partial<BoxItem>) {
    setBoxContents((b) => b.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  }
  function removeBox(i: number) {
    setBoxContents((b) => b.filter((_, j) => j !== i));
  }

  function addStep() {
    setInstallSteps((s) => [...s, ""]);
  }
  function updateStep(i: number, v: string) {
    setInstallSteps((s) => s.map((x, j) => (j === i ? v : x)));
  }
  function removeStep(i: number) {
    setInstallSteps((s) => s.filter((_, j) => j !== i));
  }

  // AI 一键生成草稿 → 覆盖当前编辑器内容（人工再改后保存）。
  function generate() {
    if (
      !window.confirm(
        "将用 AI 生成的草稿覆盖当前展示内容（不会直接入库，仍需点保存）。继续？"
      )
    )
      return;
    startGen(async () => {
      try {
        const d = await generateShowcaseDraft(productId);
        setTagline(d.tagline);
        setDescription(d.description);
        setHighlights(
          d.highlights.map((h) => ({
            icon: h.icon,
            label: h.label,
            value: h.value ?? "",
          }))
        );
        setApplications(
          d.applications.map((a) => ({
            icon: a.icon,
            title: a.title,
            desc: a.desc ?? "",
            image: "",
          }))
        );
        setFaq(d.faq);
        setBoxContents(
          d.boxContents.map((b) => ({ item: b.item, qty: b.qty ?? "" }))
        );
        setInstallMethod(d.install?.method ?? "");
        setInstallSteps(d.install?.steps ?? []);
        if (d.dimensions) {
          setDimW(String(d.dimensions.w));
          setDimH(String(d.dimensions.h));
          setDimD(d.dimensions.d != null ? String(d.dimensions.d) : "");
          setDimUnit(d.dimensions.unit);
          setDimCutout(d.dimensions.cutout ?? "");
        }
        setBlocks(
          d.detailBlocks.map((b) =>
            b.kind === "image"
              ? { kind: "image" as const, url: b.url, caption: b.caption ?? "" }
              : b
          )
        );
        toast.success("AI 草稿已填入，请过目修改后保存");
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "AI 生成失败");
      }
    });
  }

  function addApplication() {
    setApplications((a) => [
      ...a,
      { icon: "dot", title: "", desc: "", image: "" },
    ]);
  }
  function updateApplication(i: number, patch: Partial<Application>) {
    setApplications((a) => a.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  }
  function removeApplication(i: number) {
    setApplications((a) => a.filter((_, j) => j !== i));
  }

  function addFaq() {
    setFaq((f) => [...f, { q: "", a: "" }]);
  }
  function updateFaq(i: number, patch: Partial<Faq>) {
    setFaq((f) => f.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  }
  function removeFaq(i: number) {
    setFaq((f) => f.filter((_, j) => j !== i));
  }

  function addHighlight() {
    setHighlights((h) => [...h, { icon: "dot", label: "", value: "" }]);
  }
  function updateHighlight(i: number, patch: Partial<Highlight>) {
    setHighlights((h) => h.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  }
  function removeHighlight(i: number) {
    setHighlights((h) => h.filter((_, j) => j !== i));
  }

  function addBlock(kind: Block["kind"]) {
    setBlocks((b) => [
      ...b,
      kind === "image"
        ? { kind: "image", url: "", caption: "" }
        : { kind, text: "" },
    ]);
  }
  function updateBlock(i: number, patch: Partial<Block>) {
    setBlocks((b) =>
      b.map((x, j) => (j === i ? ({ ...x, ...patch } as Block) : x))
    );
  }
  function removeBlock(i: number) {
    setBlocks((b) => b.filter((_, j) => j !== i));
  }
  function moveBlock(i: number, dir: -1 | 1) {
    setBlocks((b) => {
      const j = i + dir;
      if (j < 0 || j >= b.length) return b;
      const next = [...b];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  }

  function save() {
    const cleanHighlights = highlights
      .map((h) => ({
        icon: h.icon,
        label: h.label.trim(),
        value: h.value.trim() || undefined,
      }))
      .filter((h) => h.label);
    const cleanBlocks = blocks
      .map((b) =>
        b.kind === "image"
          ? {
              kind: "image" as const,
              url: b.url.trim(),
              caption: b.caption.trim() || undefined,
            }
          : { kind: b.kind, text: b.text.trim() }
      )
      .filter((b) => (b.kind === "image" ? b.url : b.text));
    const cleanApplications = applications
      .map((a) => ({
        icon: a.icon,
        title: a.title.trim(),
        desc: a.desc.trim() || undefined,
        image: a.image.trim() || undefined,
      }))
      .filter((a) => a.title);
    const cleanFaq = faq
      .map((f) => ({ q: f.q.trim(), a: f.a.trim() }))
      .filter((f) => f.q && f.a);
    const cleanBox = boxContents
      .map((b) => ({ item: b.item.trim(), qty: b.qty.trim() || undefined }))
      .filter((b) => b.item);
    const cleanInstall = {
      method: installMethod.trim() || undefined,
      steps: installSteps.map((s) => s.trim()).filter(Boolean),
    };
    const cleanDim = {
      w: dimW.trim(),
      h: dimH.trim(),
      d: dimD.trim() || undefined,
      unit: dimUnit.trim() || "mm",
      cutout: dimCutout.trim() || undefined,
    };

    start(async () => {
      try {
        if (isSource) {
          await saveProductShowcase({
            productId,
            tagline,
            variantLabel,
            description,
            luminaireType,
            highlights: cleanHighlights,
            detailBlocks: cleanBlocks,
            applications: cleanApplications,
            faq: cleanFaq,
            boxContents: cleanBox,
            install: cleanInstall,
            dimensions: cleanDim,
            sourceLocale,
          });
          toast.success("展示内容已保存");
        } else {
          await saveTranslation({
            productId,
            locale: editingLocale,
            tagline,
            description,
            highlights: cleanHighlights,
            detailBlocks: cleanBlocks,
            applications: cleanApplications,
            faq: cleanFaq,
            boxContents: cleanBox,
            install: cleanInstall,
            dimCutout: dimCutout.trim(),
          });
          toast.success(
            `已保存 ${LOCALE_LABELS[editingLocale as keyof typeof LOCALE_LABELS] ?? editingLocale} 译文`
          );
        }
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "保存失败");
      }
    });
  }

  return (
    <section className="mt-6 rounded-2xl border border-[var(--color-rule)] bg-[var(--color-surface)] p-6">
      <div className="flex items-baseline justify-between border-b border-[var(--color-rule)] pb-3">
        <p className="font-mono text-[10px] font-medium uppercase tracking-[0.22em] text-[var(--color-ink)]">
          Showcase · 展示内容
        </p>
        <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-[var(--color-ink-muted)]">
          卖点 · 亮点 · 应用场景 · 图文 · FAQ
        </span>
      </div>

      {/* 语言模式：切换正在编辑的语言（源语言可改全部；译文逐语言审校） */}
      <div className="mt-4 flex flex-wrap items-center gap-1.5">
        <span className="mr-1 font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--color-ink-muted)]">
          编辑语言
        </span>
        {LOCALE_ORDER.map((loc) => {
          const isCur = loc === editingLocale;
          const isSrc = loc === baseLocale;
          const has = isSrc || translatedLocales.includes(loc);
          return (
            <button
              key={loc}
              type="button"
              onClick={() => switchLocale(loc)}
              className={`rounded-full border px-2.5 py-1 text-[12px] transition ${
                isCur
                  ? "border-[var(--color-ink)] bg-[var(--color-ink)] text-[var(--color-surface)]"
                  : has
                    ? "border-[var(--color-rule-strong)] text-[var(--color-ink-soft)] hover:border-[var(--color-ink)]"
                    : "border-[var(--color-rule)] text-[var(--color-ink-faint)] hover:border-[var(--color-ink)]"
              }`}
            >
              {LOCALE_LABELS[loc]}
              {isSrc ? " ·源" : ""}
            </button>
          );
        })}
      </div>
      {!isSource && (
        <p className="mt-2 text-[11px] text-[var(--color-ink-faint)]">
          正在审校译文——名称与规格译文由 AI 维护、此处不改；变体标签 / 灯具类型 / 尺寸数值是源语言专属，仅在「源」下编辑。
        </p>
      )}

      {isSource && (
      <>
      {/* AI 一键生成草稿 */}
      <div className="mt-5 flex items-center justify-between gap-4 rounded-xl border border-dashed border-[var(--color-rule-strong)] bg-[var(--color-surface-sunken)] p-3.5">
        <div className="min-w-0">
          <p className="text-[13px] font-medium text-[var(--color-ink)]">
            AI 生成展示文案草稿
          </p>
          <p className="mt-0.5 text-[11px] text-[var(--color-ink-faint)]">
            按「灯具类型 + 规格」生成卖点 / 亮点 / 场景 / FAQ / 盒内清单 / 安装 / 图文。仅草稿，需过目后保存。
          </p>
        </div>
        <button
          type="button"
          onClick={generate}
          disabled={genPending}
          className="flex shrink-0 items-center gap-1.5 rounded-lg border border-[var(--color-ink)] px-3.5 py-2 text-sm font-medium text-[var(--color-ink)] transition hover:bg-[var(--color-ink)] hover:text-[var(--color-surface)] disabled:opacity-50"
        >
          <Sparkles className="h-4 w-4" />
          {genPending ? "生成中…" : "AI 生成草稿"}
        </button>
      </div>

      {/* AI 翻译补全其余语言 */}
      <div className="mt-3 rounded-xl border border-dashed border-[var(--color-rule-strong)] bg-[var(--color-surface-sunken)] p-3.5">
        <div className="flex items-center justify-between gap-4">
          <div className="min-w-0">
            <p className="text-[13px] font-medium text-[var(--color-ink)]">
              多语言：填一种，AI 补全其余 8 种
            </p>
            <p className="mt-0.5 text-[11px] text-[var(--color-ink-faint)]">
              选好下面的「源语言」，先保存内容，再点翻译。译文直接入库、可重跑。
            </p>
          </div>
          <button
            type="button"
            onClick={translate}
            disabled={transPending}
            className="flex shrink-0 items-center gap-1.5 rounded-lg border border-[var(--color-ink)] px-3.5 py-2 text-sm font-medium text-[var(--color-ink)] transition hover:bg-[var(--color-ink)] hover:text-[var(--color-surface)] disabled:opacity-50"
          >
            <Languages className="h-4 w-4" />
            {transPending ? "翻译中…" : "AI 翻译补全"}
          </button>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-[11px] text-[var(--color-ink-muted)]">
            源语言
            <select
              value={sourceLocale}
              onChange={(e) => setSourceLocale(e.target.value)}
              className="rounded-lg border border-[var(--color-rule)] bg-[var(--color-surface)] px-2 py-1 text-[13px] text-[var(--color-ink)] outline-none focus:border-[var(--color-ink)]"
            >
              {LOCALE_ORDER.map((l) => (
                <option key={l} value={l}>
                  {LOCALE_LABELS[l]}
                </option>
              ))}
            </select>
          </label>
          {translatedLocales.length > 0 && (
            <span className="text-[11px] text-[var(--color-ink-faint)]">
              已翻译：
              {translatedLocales
                .map((l) => LOCALE_LABELS[l as keyof typeof LOCALE_LABELS] ?? l)
                .join(" · ")}
            </span>
          )}
        </div>
        {translationStale && (
          <p className="mt-2.5 rounded-lg bg-amber-50 px-3 py-2 text-[12px] text-amber-700">
            ⚠ 源语言内容已改动，译文可能已过期——建议重新点「AI 翻译补全」。
          </p>
        )}
      </div>
      </>
      )}

      {/* Tagline */}
      <div className="mt-5">
        <label className={labelCls}>卖点短语带（用 · 或 、 分隔多个短语）</label>
        <input
          value={tagline}
          onChange={(e) => setTagline(e.target.value)}
          placeholder="如：IP65 防水 · 五年质保 · 高显指 Ra90"
          className={`${inputCls} mt-2`}
        />
      </div>

      {isSource && (
      <>
      {/* Variant label */}
      <div className="mt-5">
        <label className={labelCls}>规格变体标签</label>
        <input
          value={variantLabel}
          onChange={(e) => setVariantLabel(e.target.value)}
          placeholder="如：100W / 暖光 3000K（同款不同规格的短标签）"
          className={`${inputCls} mt-2`}
        />
        <p className="mt-1.5 text-[11px] text-[var(--color-ink-faint)]">
          仅当本产品与其它型号设了<b>相同系列（series）</b>时，公开页才会出现「规格选择」切换栏；系列在下方「关系 / 属性」区设置。
        </p>
      </div>

      {/* Luminaire type */}
      <div className="mt-5">
        <label className={labelCls}>灯具类型（喂给 AI 的上下文）</label>
        <select
          value={luminaireType}
          onChange={(e) => setLuminaireType(e.target.value)}
          className={`${inputCls} mt-2`}
        >
          <option value="">（未设置）</option>
          {LUMINAIRE_TYPES.map((t) => (
            <option key={t.key} value={t.key}>
              {t.zh}
            </option>
          ))}
          {luminaireType &&
            !LUMINAIRE_TYPES.some((t) => t.key === luminaireType) && (
              <option value={luminaireType}>{luminaireType}（自定义）</option>
            )}
        </select>
        <p className="mt-1.5 text-[11px] text-[var(--color-ink-faint)]">
          选一个标准类型。AI 据此生成更准的盒内清单与安装方式；也用于将来按类目筛选。
        </p>
      </div>
      </>
      )}

      {/* Description */}
      <div className="mt-5">
        <label className={labelCls}>产品描述（公开页 H1 下方段落）</label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="1–2 段产品介绍，面向终端顾客…"
          rows={3}
          className={`${inputCls} mt-2 resize-y`}
        />
      </div>

      {/* Highlights */}
      <div className="mt-6">
        <div className="flex items-center justify-between">
          <label className={labelCls}>亮点图标排</label>
          <button
            type="button"
            onClick={addHighlight}
            className="flex items-center gap-1 font-mono text-[11px] text-[var(--color-ink-muted)] transition hover:text-[var(--color-ink)]"
          >
            <Plus className="h-3.5 w-3.5" /> 添加亮点
          </button>
        </div>
        <div className="mt-3 space-y-2">
          {highlights.length === 0 && (
            <p className="text-[12px] text-[var(--color-ink-faint)]">
              暂无亮点。建议加 3–4 个，如「防水 IP65」「质保 5 年」。
            </p>
          )}
          {highlights.map((h, i) => (
            <div key={i} className="flex items-center gap-2">
              <select
                value={h.icon}
                onChange={(e) => updateHighlight(i, { icon: e.target.value })}
                className={`${inputBase} w-32 shrink-0`}
              >
                {ICONS.map((ic) => (
                  <option key={ic.key} value={ic.key}>
                    {ic.label}
                  </option>
                ))}
              </select>
              <input
                value={h.value}
                onChange={(e) => updateHighlight(i, { value: e.target.value })}
                placeholder="数值（可选）如 IP65"
                className={`${inputBase} w-36 shrink-0`}
              />
              <input
                value={h.label}
                onChange={(e) => updateHighlight(i, { label: e.target.value })}
                placeholder="说明，如 防水防尘"
                className={inputCls}
              />
              <button
                type="button"
                onClick={() => removeHighlight(i)}
                aria-label="删除"
                className="shrink-0 p-2 text-[var(--color-ink-faint)] transition hover:text-red-500"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Applications */}
      <div className="mt-6">
        <div className="flex items-center justify-between">
          <label className={labelCls}>应用场景（用在哪里）</label>
          <button
            type="button"
            onClick={addApplication}
            className="flex items-center gap-1 font-mono text-[11px] text-[var(--color-ink-muted)] transition hover:text-[var(--color-ink)]"
          >
            <Plus className="h-3.5 w-3.5" /> 添加场景
          </button>
        </div>
        <div className="mt-3 space-y-2">
          {applications.length === 0 && (
            <p className="text-[12px] text-[var(--color-ink-faint)]">
              暂无场景。建议加 3–6 个，如「商业空间」「户外景观」「工业厂房」，可配实景图。
            </p>
          )}
          {applications.map((a, i) => (
            <div
              key={i}
              className="flex items-start gap-2 rounded-lg border border-[var(--color-rule)] bg-[var(--color-surface-sunken)] p-2.5"
            >
              <select
                value={a.icon}
                onChange={(e) => updateApplication(i, { icon: e.target.value })}
                className={`${inputBase} mt-px w-32 shrink-0`}
              >
                {ICONS.map((ic) => (
                  <option key={ic.key} value={ic.key}>
                    {ic.label}
                  </option>
                ))}
              </select>
              <div className="min-w-0 flex-1 space-y-2">
                <input
                  value={a.title}
                  onChange={(e) =>
                    updateApplication(i, { title: e.target.value })
                  }
                  placeholder="场景名，如 商业空间照明"
                  className={inputCls}
                />
                <input
                  value={a.desc}
                  onChange={(e) =>
                    updateApplication(i, { desc: e.target.value })
                  }
                  placeholder="一句话说明（可选）"
                  className={inputCls}
                />
                <input
                  value={a.image}
                  onChange={(e) =>
                    updateApplication(i, { image: e.target.value })
                  }
                  placeholder="实景图 URL（可选，https://…）"
                  className={inputCls}
                />
                {a.image && (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    src={a.image}
                    alt=""
                    className="max-h-28 rounded-md border border-[var(--color-rule)] object-cover"
                  />
                )}
              </div>
              <button
                type="button"
                onClick={() => removeApplication(i)}
                aria-label="删除"
                className="shrink-0 p-2 text-[var(--color-ink-faint)] transition hover:text-red-500"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Detail blocks */}
      <div className="mt-6">
        <div className="flex items-center justify-between">
          <label className={labelCls}>图文长详情（京东式，自上而下铺陈）</label>
          <div className="flex items-center gap-2 font-mono text-[11px] text-[var(--color-ink-muted)]">
            <button
              type="button"
              onClick={() => addBlock("heading")}
              className="flex items-center gap-1 transition hover:text-[var(--color-ink)]"
            >
              <Plus className="h-3.5 w-3.5" /> 标题
            </button>
            <button
              type="button"
              onClick={() => addBlock("text")}
              className="flex items-center gap-1 transition hover:text-[var(--color-ink)]"
            >
              <Plus className="h-3.5 w-3.5" /> 段落
            </button>
            <button
              type="button"
              onClick={() => addBlock("image")}
              className="flex items-center gap-1 transition hover:text-[var(--color-ink)]"
            >
              <Plus className="h-3.5 w-3.5" /> 图片
            </button>
          </div>
        </div>
        <div className="mt-3 space-y-2">
          {blocks.length === 0 && (
            <p className="text-[12px] text-[var(--color-ink-faint)]">
              暂无详情。可交替添加「标题 / 段落 / 图片」拼出长详情页。
            </p>
          )}
          {blocks.map((b, i) => (
            <div
              key={i}
              className="flex items-start gap-2 rounded-lg border border-[var(--color-rule)] bg-[var(--color-surface-sunken)] p-2.5"
            >
              <div className="flex shrink-0 flex-col items-center gap-1 pt-1">
                <GripVertical className="h-4 w-4 text-[var(--color-ink-faint)]" />
                <span className="font-mono text-[9px] uppercase tracking-wider text-[var(--color-ink-muted)]">
                  {b.kind === "heading"
                    ? "标题"
                    : b.kind === "text"
                      ? "段落"
                      : "图片"}
                </span>
              </div>
              <div className="min-w-0 flex-1 space-y-2">
                {b.kind === "image" ? (
                  <>
                    <input
                      value={b.url}
                      onChange={(e) => updateBlock(i, { url: e.target.value })}
                      placeholder="图片 URL（https://…）"
                      className={inputCls}
                    />
                    <input
                      value={b.caption}
                      onChange={(e) =>
                        updateBlock(i, { caption: e.target.value })
                      }
                      placeholder="图注（可选）"
                      className={inputCls}
                    />
                    {b.url && (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img
                        src={b.url}
                        alt=""
                        className="max-h-32 rounded-md border border-[var(--color-rule)] object-cover"
                      />
                    )}
                  </>
                ) : (
                  <textarea
                    value={b.text}
                    onChange={(e) => updateBlock(i, { text: e.target.value })}
                    placeholder={
                      b.kind === "heading" ? "小标题文字" : "段落正文…"
                    }
                    rows={b.kind === "heading" ? 1 : 3}
                    className={`${inputCls} resize-y`}
                  />
                )}
              </div>
              <div className="flex shrink-0 flex-col gap-0.5">
                <button
                  type="button"
                  onClick={() => moveBlock(i, -1)}
                  disabled={i === 0}
                  aria-label="上移"
                  className="p-1 text-[var(--color-ink-faint)] transition hover:text-[var(--color-ink)] disabled:opacity-30"
                >
                  <ArrowUp className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => moveBlock(i, 1)}
                  disabled={i === blocks.length - 1}
                  aria-label="下移"
                  className="p-1 text-[var(--color-ink-faint)] transition hover:text-[var(--color-ink)] disabled:opacity-30"
                >
                  <ArrowDown className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => removeBlock(i)}
                  aria-label="删除"
                  className="p-1 text-[var(--color-ink-faint)] transition hover:text-red-500"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Box contents */}
      <div className="mt-6">
        <div className="flex items-center justify-between">
          <label className={labelCls}>盒内清单（以实际包装为准）</label>
          <button
            type="button"
            onClick={addBox}
            className="flex items-center gap-1 font-mono text-[11px] text-[var(--color-ink-muted)] transition hover:text-[var(--color-ink)]"
          >
            <Plus className="h-3.5 w-3.5" /> 添加物品
          </button>
        </div>
        <div className="mt-3 space-y-2">
          {boxContents.length === 0 && (
            <p className="text-[12px] text-[var(--color-ink-faint)]">
              暂无。如：灯体 ×1、安装附件 ×1、说明书 ×1、保修卡 ×1。
            </p>
          )}
          {boxContents.map((b, i) => (
            <div key={i} className="flex items-center gap-2">
              <input
                value={b.item}
                onChange={(e) => updateBox(i, { item: e.target.value })}
                placeholder="物品，如 灯体"
                className={inputCls}
              />
              <input
                value={b.qty}
                onChange={(e) => updateBox(i, { qty: e.target.value })}
                placeholder="数量(可选) 如 ×1"
                className={`${inputBase} w-32 shrink-0`}
              />
              <button
                type="button"
                onClick={() => removeBox(i)}
                aria-label="删除"
                className="shrink-0 p-2 text-[var(--color-ink-faint)] transition hover:text-red-500"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Dimensions */}
      <div className="mt-6">
        <label className={labelCls}>
          尺寸（{isSource ? "用于尺寸示意图；留空则回退从规格表自动解析" : "数值为源语言专属，此处仅译开孔说明"}）
        </label>
        {isSource && (
          <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
            <input
              value={dimW}
              onChange={(e) => setDimW(e.target.value)}
              placeholder="宽 W"
              className={inputCls}
            />
            <input
              value={dimH}
              onChange={(e) => setDimH(e.target.value)}
              placeholder="高 H"
              className={inputCls}
            />
            <input
              value={dimD}
              onChange={(e) => setDimD(e.target.value)}
              placeholder="厚 D（可选）"
              className={inputCls}
            />
            <input
              value={dimUnit}
              onChange={(e) => setDimUnit(e.target.value)}
              placeholder="单位 mm"
              className={inputCls}
            />
          </div>
        )}
        <input
          value={dimCutout}
          onChange={(e) => setDimCutout(e.target.value)}
          placeholder="开孔说明（可选）如 Ø75"
          className={`${inputCls} mt-2`}
        />
      </div>

      {/* Install */}
      <div className="mt-6">
        <label className={labelCls}>安装方式 / 步骤</label>
        <input
          value={installMethod}
          onChange={(e) => setInstallMethod(e.target.value)}
          placeholder="安装方式一句话，如 开孔嵌入 + 弹簧卡扣固定"
          className={`${inputCls} mt-2`}
        />
        <div className="mt-2 flex items-center justify-between">
          <span className="text-[11px] text-[var(--color-ink-faint)]">安装步骤</span>
          <button
            type="button"
            onClick={addStep}
            className="flex items-center gap-1 font-mono text-[11px] text-[var(--color-ink-muted)] transition hover:text-[var(--color-ink)]"
          >
            <Plus className="h-3.5 w-3.5" /> 添加步骤
          </button>
        </div>
        <div className="mt-2 space-y-2">
          {installSteps.map((s, i) => (
            <div key={i} className="flex items-center gap-2">
              <span className="w-5 shrink-0 text-center font-mono text-[11px] text-[var(--color-ink-muted)]">
                {i + 1}
              </span>
              <input
                value={s}
                onChange={(e) => updateStep(i, e.target.value)}
                placeholder={`步骤 ${i + 1}`}
                className={inputCls}
              />
              <button
                type="button"
                onClick={() => removeStep(i)}
                aria-label="删除"
                className="shrink-0 p-2 text-[var(--color-ink-faint)] transition hover:text-red-500"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* FAQ */}
      <div className="mt-6">
        <div className="flex items-center justify-between">
          <label className={labelCls}>常见问题 FAQ</label>
          <button
            type="button"
            onClick={addFaq}
            className="flex items-center gap-1 font-mono text-[11px] text-[var(--color-ink-muted)] transition hover:text-[var(--color-ink)]"
          >
            <Plus className="h-3.5 w-3.5" /> 添加问答
          </button>
        </div>
        <div className="mt-3 space-y-2">
          {faq.length === 0 && (
            <p className="text-[12px] text-[var(--color-ink-faint)]">
              暂无问答。面向终端顾客、产品使用向：怎么安装、色温怎么选、能否户外用、质保多久、包装含什么。请勿放采购 / 联系 / 价格类内容。
            </p>
          )}
          {faq.map((f, i) => (
            <div
              key={i}
              className="flex items-start gap-2 rounded-lg border border-[var(--color-rule)] bg-[var(--color-surface-sunken)] p-2.5"
            >
              <div className="min-w-0 flex-1 space-y-2">
                <input
                  value={f.q}
                  onChange={(e) => updateFaq(i, { q: e.target.value })}
                  placeholder="问题，如 安装方便吗？／ 色温怎么选？"
                  className={inputCls}
                />
                <textarea
                  value={f.a}
                  onChange={(e) => updateFaq(i, { a: e.target.value })}
                  placeholder="答案…"
                  rows={2}
                  className={`${inputCls} resize-y`}
                />
              </div>
              <button
                type="button"
                onClick={() => removeFaq(i)}
                aria-label="删除"
                className="shrink-0 p-2 text-[var(--color-ink-faint)] transition hover:text-red-500"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-6 flex justify-end border-t border-[var(--color-rule)] pt-4">
        <button
          type="button"
          onClick={save}
          disabled={pending}
          className="rounded-lg bg-[var(--color-ink)] px-5 py-2 text-sm font-medium text-[var(--color-surface)] transition hover:opacity-90 disabled:opacity-50"
        >
          {pending
            ? "保存中…"
            : isSource
              ? "保存展示内容"
              : `保存 ${LOCALE_LABELS[editingLocale as keyof typeof LOCALE_LABELS] ?? editingLocale} 译文`}
        </button>
      </div>
    </section>
  );
}
