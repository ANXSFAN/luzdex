"use client";

import { useLocale, useTranslations } from "next-intl";
import { useRef, useState, useTransition } from "react";
import {
  Plus,
  Trash2,
  ArrowUp,
  ArrowDown,
  GripVertical,
  Sparkles,
  Languages,
  Upload,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { MarkdownInput } from "@/components/markdown-input";
import {
  saveProductShowcase,
  generateShowcaseDraft,
  generateDetailLayout,
  translateShowcase,
  saveTranslation,
} from "@/app/admin/products/actions";
import { LOCALE_LABELS, LOCALE_ORDER } from "@/i18n/routing";
import { confirmDialog } from "@/components/confirm-dialog";
import { LUMINAIRE_TYPES } from "@/lib/luminaire";
import { useFileDrop } from "@/components/use-file-drop";
import { MAX_IMAGE_BYTES } from "@/lib/upload-rules";

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
  name: string; // 译名（源语言名在「基本信息」卡维护，此字段仅译文模式用）
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
  name: "",
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

// 图标白名单；显示名走 show.icons.* 的 i18n key
const ICONS: { key: string }[] = [
  { key: "shield" },
  { key: "droplet" },
  { key: "zap" },
  { key: "clock" },
  { key: "award" },
  { key: "sun" },
  { key: "temp" },
  { key: "ruler" },
  { key: "gauge" },
  { key: "bulb" },
  { key: "battery" },
  { key: "dot" },
];

const inputCls =
  "w-full rounded-lg border border-[var(--color-rule)] bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-ink)] outline-none transition focus:border-[var(--color-ink)]";
// 定宽字段用：与 inputCls 同样式但不含 w-full，避免 w-full 覆盖 w-32/w-36
const inputBase = inputCls.replace("w-full ", "");
const labelCls =
  "font-mono text-[10px] font-medium uppercase tracking-[0.22em] text-[var(--color-ink-muted)]";

/** 上传图片到 R2（kind=image，后端拒绝非图片），返回公开 URL。 */
async function uploadImageFile(file: File): Promise<string> {
  const fd = new FormData();
  fd.append("file", file);
  fd.append("kind", "image");
  const res = await fetch("/api/upload", { method: "POST", body: fd });
  if (!res.ok) {
    const msg = await res.json().catch(() => null);
    throw new Error(msg?.error ?? ""); // 空消息时调用方回退本地化文案
  }
  const data = (await res.json()) as { url: string };
  return data.url;
}

/** 图片字段：URL 输入 + 上传按钮 + 缩略图预览。上传成功即回填 URL。 */
function ImageUrlField({
  value,
  onChange,
  placeholder,
  previewMaxH = "max-h-32",
}: {
  value: string;
  onChange: (url: string) => void;
  placeholder: string;
  previewMaxH?: string;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const sIcons = useTranslations("show");
  const tc = useTranslations("admin.common");
  const te = useTranslations("err");
  const [busy, setBusy] = useState(false);

  async function uploadOne(file: File) {
    if (file.size > MAX_IMAGE_BYTES) {
      toast.error(te("imageTooLarge"));
      return;
    }
    setBusy(true);
    try {
      const url = await uploadImageFile(file);
      onChange(url);
      toast.success(sIcons("imgUploaded"));
    } catch (err) {
      toast.error(err instanceof Error && err.message ? err.message : tc("uploadFail"));
    } finally {
      setBusy(false);
    }
  }

  function pick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (ref.current) ref.current.value = "";
    if (file) uploadOne(file);
  }

  const { dragging, dropProps } = useFileDrop((files) => uploadOne(files[0]), {
    accept: "image",
    disabled: busy,
  });

  return (
    <div
      {...dropProps}
      className={`space-y-2 rounded-lg transition ${
        dragging
          ? "ring-2 ring-[var(--color-ink)] ring-offset-2 ring-offset-[var(--color-surface)]"
          : ""
      }`}
    >
      <div className="flex gap-2">
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className={inputCls}
        />
        <button
          type="button"
          onClick={() => ref.current?.click()}
          disabled={busy}
          className="flex shrink-0 items-center gap-1 rounded-lg border border-[var(--color-rule)] px-3 text-xs text-[var(--color-ink-muted)] transition hover:bg-[var(--color-surface)] hover:text-[var(--color-ink)] disabled:opacity-50"
        >
          {busy ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Upload className="h-3.5 w-3.5" />
          )}
          {tc("upload")}
        </button>
        <input ref={ref} type="file" accept="image/*" hidden onChange={pick} />
      </div>
      {value && (
        /* eslint-disable-next-line @next/next/no-img-element */
        <img
          src={value}
          alt=""
          className={`${previewMaxH} rounded-md border border-[var(--color-rule)] object-cover`}
        />
      )}
    </div>
  );
}

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
  const [transName, setTransName] = useState(""); // 当前译文语言的产品译名
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
  const [sourceLocale, setSourceLocale] = useState(initialSourceLocale || "es");
  const baseLocale = initialSourceLocale || "es";
  const [editingLocale, setEditingLocale] = useState(baseLocale);
  const isSource = editingLocale === baseLocale;
  const tr = useTranslations("prod");
  const s = useTranslations("show");
  const tc = useTranslations("admin.common");
  const te = useTranslations("err");
  const uiLocale = useLocale();
  const [pending, start] = useTransition();
  const [genPending, startGen] = useTransition();
  const [transPending, startTrans] = useTransition();

  // AI 图文排版面板：客户传图 + 写描述 → 生成 heading/text/image 块序列
  const [aiImages, setAiImages] = useState<string[]>([]);
  const [aiBrief, setAiBrief] = useState("");
  const [aiUploading, setAiUploading] = useState(false);
  const [layoutPending, startLayout] = useTransition();
  const aiPickRef = useRef<HTMLInputElement>(null);

  async function aiAddFiles(files: File[]) {
    const imgs = files
      .filter((f) => f.type.startsWith("image/"))
      .filter((f) => {
        if (f.size > MAX_IMAGE_BYTES) {
          toast.error(te("imageTooLarge"));
          return false;
        }
        return true;
      });
    if (!imgs.length) return;
    setAiUploading(true);
    try {
      for (const f of imgs) {
        const url = await uploadImageFile(f);
        setAiImages((list) => [...list, url]);
      }
    } catch (err) {
      toast.error(err instanceof Error && err.message ? err.message : tc("uploadFail"));
    } finally {
      setAiUploading(false);
    }
  }

  async function generateLayout() {
    if (!aiImages.length || !aiBrief.trim()) {
      toast.error(s("aiLayoutNeed"));
      return;
    }
    if (blocks.length > 0 && !(await confirmDialog({ message: s("aiLayoutConfirm") })))
      return;
    startLayout(async () => {
      try {
        const result = await generateDetailLayout({
          productId,
          images: aiImages,
          brief: aiBrief,
        });
        setBlocks(
          result.map((b) =>
            b.kind === "image"
              ? { kind: "image" as const, url: b.url, caption: b.caption ?? "" }
              : b
          )
        );
        toast.success(s("aiLayoutDone"));
      } catch (e) {
        toast.error(e instanceof Error ? e.message : tc("aiFail"));
      }
    });
  }

  // 源语言内容快照（初始 props），切回源语言时还原
  const sourceContent: LocaleContent = {
    name: "",
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
    setTransName(c.name);
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
  async function switchLocale(loc: string) {
    if (loc === editingLocale) return;
    if (!(await confirmDialog({ message: s("switchConfirm") }))) return;
    applyContent(loc === baseLocale ? sourceContent : initialTranslations[loc] ?? EMPTY_CONTENT);
    setEditingLocale(loc);
  }

  // AI 翻译补全其余语言：读已保存的源语言内容，翻译入库（直接保存、可重跑）。
  async function translate() {
    if (!(await confirmDialog({ message: s("transConfirm") }))) return;
    startTrans(async () => {
      try {
        const r = await translateShowcase(productId);
        toast.success(s("transDoneCount", { ok: r.ok, total: r.total }));
      } catch (e) {
        toast.error(e instanceof Error ? e.message : tc("transFail"));
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
  async function generate() {
    if (!(await confirmDialog({ message: s("genConfirm") }))) return;
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
        toast.success(s("genDone"));
      } catch (e) {
        toast.error(e instanceof Error ? e.message : tc("aiFail"));
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
          toast.success(s("savedOk"));
        } else {
          await saveTranslation({
            productId,
            locale: editingLocale,
            name: transName,
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
            s("transSavedOk", {
              lang:
                LOCALE_LABELS[editingLocale as keyof typeof LOCALE_LABELS] ??
                editingLocale,
            })
          );
        }
      } catch (e) {
        toast.error(e instanceof Error ? e.message : tc("saveFail"));
      }
    });
  }

  return (
    <section className="mt-6 rounded-2xl border border-[var(--color-rule)] bg-[var(--color-surface)] p-6">
      <div className="flex items-baseline justify-between border-b border-[var(--color-rule)] pb-3">
        <p className="font-mono text-[10px] font-medium uppercase tracking-[0.22em] text-[var(--color-ink)]">
{tr("showcaseTitle")}
        </p>
        <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-[var(--color-ink-muted)]">
          {s("sub")}
        </span>
      </div>

      {/* 语言模式：切换正在编辑的语言（源语言可改全部；译文逐语言审校） */}
      <div className="mt-4 flex flex-wrap items-center gap-1.5">
        <span className="mr-1 font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--color-ink-muted)]">
          {s("editLang")}
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
            </button>
          );
        })}
      </div>
      {!isSource && (
        <p className="mt-2 text-[11px] text-[var(--color-ink-faint)]">
          {s("auditNote")}
        </p>
      )}

      {isSource && (
      <>
      {/* AI 一键生成草稿 */}
      <div className="mt-5 flex items-center justify-between gap-4 rounded-xl border border-dashed border-[var(--color-rule-strong)] bg-[var(--color-surface-sunken)] p-3.5">
        <div className="min-w-0">
          <p className="text-[13px] font-medium text-[var(--color-ink)]">
            {s("aiGenTitle")}
          </p>
          <p className="mt-0.5 text-[11px] text-[var(--color-ink-faint)]">
            {s("aiGenHint")}
          </p>
        </div>
        <button
          type="button"
          onClick={generate}
          disabled={genPending}
          className="flex shrink-0 items-center gap-1.5 rounded-lg border border-[var(--color-ink)] px-3.5 py-2 text-sm font-medium text-[var(--color-ink)] transition hover:bg-[var(--color-ink)] hover:text-[var(--color-surface)] disabled:opacity-50"
        >
          <Sparkles className="h-4 w-4" />
          {genPending ? s("aiGenning") : s("aiGenBtn")}
        </button>
      </div>

      {/* AI 翻译补全其余语言 */}
      <div className="mt-3 rounded-xl border border-dashed border-[var(--color-rule-strong)] bg-[var(--color-surface-sunken)] p-3.5">
        <div className="flex items-center justify-between gap-4">
          <div className="min-w-0">
            <p className="text-[13px] font-medium text-[var(--color-ink)]">
              {s("aiTransTitle")}
            </p>
            <p className="mt-0.5 text-[11px] text-[var(--color-ink-faint)]">
              {s("aiTransHint")}
            </p>
          </div>
          <button
            type="button"
            onClick={translate}
            disabled={transPending}
            className="flex shrink-0 items-center gap-1.5 rounded-lg border border-[var(--color-ink)] px-3.5 py-2 text-sm font-medium text-[var(--color-ink)] transition hover:bg-[var(--color-ink)] hover:text-[var(--color-surface)] disabled:opacity-50"
          >
            <Languages className="h-4 w-4" />
            {transPending ? s("aiTransing") : s("aiTransBtn")}
          </button>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-[11px] text-[var(--color-ink-muted)]">
            {s("sourceLang")}
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
              {s("translated")}
              {translatedLocales
                .map((l) => LOCALE_LABELS[l as keyof typeof LOCALE_LABELS] ?? l)
                .join(" · ")}
            </span>
          )}
        </div>
        {translationStale && (
          <p className="mt-2.5 rounded-lg bg-amber-50 px-3 py-2 text-[12px] text-amber-700">
            {s("staleWarn")}
          </p>
        )}
      </div>
      </>
      )}

      {/* 译名（仅译文模式；源语言名在「基本信息」卡维护） */}
      {!isSource && (
        <div className="mt-5">
          <label className={labelCls}>{s("transName")}</label>
          <input
            value={transName}
            onChange={(e) => setTransName(e.target.value)}
            className={`${inputCls} mt-2`}
          />
          <p className="mt-1.5 text-[11px] text-[var(--color-ink-faint)]">
            {s("transNameHint")}
          </p>
        </div>
      )}

      {/* Tagline */}
      <div className="mt-5">
        <label className={labelCls}>{s("tagline")}</label>
        <input
          value={tagline}
          onChange={(e) => setTagline(e.target.value)}
          placeholder={s("taglinePh")}
          className={`${inputCls} mt-2`}
        />
      </div>

      {isSource && (
      <>
      {/* Variant label */}
      <div className="mt-5">
        <label className={labelCls}>{s("variant")}</label>
        <input
          value={variantLabel}
          onChange={(e) => setVariantLabel(e.target.value)}
          placeholder={s("variantPh")}
          className={`${inputCls} mt-2`}
        />
        <p className="mt-1.5 text-[11px] text-[var(--color-ink-faint)]">
          {s("variantHint")}
        </p>
      </div>

      {/* Luminaire type */}
      <div className="mt-5">
        <label className={labelCls}>{s("luminaire")}</label>
        <select
          value={luminaireType}
          onChange={(e) => setLuminaireType(e.target.value)}
          className={`${inputCls} mt-2`}
        >
          <option value="">{s("unset")}</option>
          {LUMINAIRE_TYPES.map((t) => (
            <option key={t.key} value={t.key}>
              {uiLocale === "zh" ? t.zh : t.en}
            </option>
          ))}
          {luminaireType &&
            !LUMINAIRE_TYPES.some((t) => t.key === luminaireType) && (
              <option value={luminaireType}>{luminaireType} {s("custom")}</option>
            )}
        </select>
        <p className="mt-1.5 text-[11px] text-[var(--color-ink-faint)]">
          {s("luminaireHint")}
        </p>
      </div>
      </>
      )}

      {/* Description */}
      <div className="mt-5">
        <label className={labelCls}>{s("description")}</label>
        <MarkdownInput
          value={description}
          onChange={setDescription}
          placeholder={s("descriptionPh")}
          rows={3}
          className="mt-2"
        />
      </div>

      {/* Highlights */}
      <div className="mt-6">
        <div className="flex items-center justify-between">
          <label className={labelCls}>{s("highlights")}</label>
          <button
            type="button"
            onClick={addHighlight}
            className="flex items-center gap-1 font-mono text-[11px] text-[var(--color-ink-muted)] transition hover:text-[var(--color-ink)]"
          >
            <Plus className="h-3.5 w-3.5" /> {s("addHighlight")}
          </button>
        </div>
        <div className="mt-3 space-y-2">
          {highlights.length === 0 && (
            <p className="text-[12px] text-[var(--color-ink-faint)]">
              {s("highlightsEmpty")}
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
                    {s(`icons.${ic.key}`)}
                  </option>
                ))}
              </select>
              <input
                value={h.value}
                onChange={(e) => updateHighlight(i, { value: e.target.value })}
                placeholder={s("hlValuePh")}
                className={`${inputBase} w-36 shrink-0`}
              />
              <input
                value={h.label}
                onChange={(e) => updateHighlight(i, { label: e.target.value })}
                placeholder={s("hlLabelPh")}
                className={inputCls}
              />
              <button
                type="button"
                onClick={() => removeHighlight(i)}
                aria-label={tc("delete")}
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
          <label className={labelCls}>{s("applications")}</label>
          <button
            type="button"
            onClick={addApplication}
            className="flex items-center gap-1 font-mono text-[11px] text-[var(--color-ink-muted)] transition hover:text-[var(--color-ink)]"
          >
            <Plus className="h-3.5 w-3.5" /> {s("addApp")}
          </button>
        </div>
        <div className="mt-3 space-y-2">
          {applications.length === 0 && (
            <p className="text-[12px] text-[var(--color-ink-faint)]">
              {s("appsEmpty")}
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
                    {s(`icons.${ic.key}`)}
                  </option>
                ))}
              </select>
              <div className="min-w-0 flex-1 space-y-2">
                <input
                  value={a.title}
                  onChange={(e) =>
                    updateApplication(i, { title: e.target.value })
                  }
                  placeholder={s("appTitlePh")}
                  className={inputCls}
                />
                <input
                  value={a.desc}
                  onChange={(e) =>
                    updateApplication(i, { desc: e.target.value })
                  }
                  placeholder={s("appDescPh")}
                  className={inputCls}
                />
                <ImageUrlField
                  value={a.image}
                  onChange={(url) => updateApplication(i, { image: url })}
                  placeholder={s("appImgPh")}
                  previewMaxH="max-h-28"
                />
              </div>
              <button
                type="button"
                onClick={() => removeApplication(i)}
                aria-label={tc("delete")}
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
          <label className={labelCls}>{s("detailBlocks")}</label>
          <div className="flex items-center gap-2 font-mono text-[11px] text-[var(--color-ink-muted)]">
            <button
              type="button"
              onClick={() => addBlock("heading")}
              className="flex items-center gap-1 transition hover:text-[var(--color-ink)]"
            >
              <Plus className="h-3.5 w-3.5" /> {s("heading")}
            </button>
            <button
              type="button"
              onClick={() => addBlock("text")}
              className="flex items-center gap-1 transition hover:text-[var(--color-ink)]"
            >
              <Plus className="h-3.5 w-3.5" /> {s("para")}
            </button>
            <button
              type="button"
              onClick={() => addBlock("image")}
              className="flex items-center gap-1 transition hover:text-[var(--color-ink)]"
            >
              <Plus className="h-3.5 w-3.5" /> {s("image")}
            </button>
          </div>
        </div>

        {/* AI 图文排版：传图 + 描述 → 自动生成穿插排版（覆盖块列表，仍需保存） */}
        {isSource && (
          <div className="mt-3 rounded-xl border border-dashed border-[var(--color-rule-strong)] bg-[var(--color-surface-sunken)] p-3.5">
            <div className="flex items-center justify-between gap-4">
              <div className="min-w-0">
                <p className="text-[13px] font-medium text-[var(--color-ink)]">
                  {s("aiLayoutTitle")}
                </p>
                <p className="mt-0.5 text-[11px] text-[var(--color-ink-faint)]">
                  {s("aiLayoutHint")}
                </p>
              </div>
              <button
                type="button"
                onClick={generateLayout}
                disabled={layoutPending || aiUploading}
                className="flex shrink-0 items-center gap-1.5 rounded-lg border border-[var(--color-ink)] px-3.5 py-2 text-sm font-medium text-[var(--color-ink)] transition hover:bg-[var(--color-ink)] hover:text-[var(--color-surface)] disabled:opacity-50"
              >
                <Sparkles className="h-4 w-4" />
                {layoutPending ? s("aiLayoutGenning") : s("aiLayoutBtn")}
              </button>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              {aiImages.map((url, i) => (
                <div key={`${url}-${i}`} className="group relative">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={url}
                    alt=""
                    className="h-16 w-16 rounded-md border border-[var(--color-rule)] object-cover"
                  />
                  <button
                    type="button"
                    onClick={() =>
                      setAiImages((list) => list.filter((_, j) => j !== i))
                    }
                    aria-label={tc("delete")}
                    className="absolute -right-1.5 -top-1.5 hidden h-5 w-5 items-center justify-center rounded-full bg-[var(--color-ink)] text-[var(--color-surface)] group-hover:flex"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={() => aiPickRef.current?.click()}
                disabled={aiUploading}
                className="flex h-16 w-16 flex-col items-center justify-center gap-1 rounded-md border border-dashed border-[var(--color-rule-strong)] text-[var(--color-ink-muted)] transition hover:border-[var(--color-ink)] hover:text-[var(--color-ink)] disabled:opacity-50"
              >
                {aiUploading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Upload className="h-4 w-4" />
                )}
                <span className="text-[10px]">{s("aiLayoutImgs")}</span>
              </button>
              <input
                ref={aiPickRef}
                type="file"
                accept="image/*"
                multiple
                hidden
                onChange={(e) => {
                  const files = Array.from(e.target.files ?? []);
                  if (aiPickRef.current) aiPickRef.current.value = "";
                  if (files.length) aiAddFiles(files);
                }}
              />
            </div>
            <textarea
              value={aiBrief}
              onChange={(e) => setAiBrief(e.target.value)}
              placeholder={s("aiLayoutBriefPh")}
              rows={3}
              className={`${inputCls} mt-3 resize-y`}
            />
          </div>
        )}

        <div className="mt-3 space-y-2">
          {blocks.length === 0 && (
            <p className="text-[12px] text-[var(--color-ink-faint)]">
              {s("blocksEmpty")}
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
                    ? s("heading")
                    : b.kind === "text"
                      ? s("para")
                      : s("image")}
                </span>
              </div>
              <div className="min-w-0 flex-1 space-y-2">
                {b.kind === "image" ? (
                  <>
                    <ImageUrlField
                      value={b.url}
                      onChange={(url) => updateBlock(i, { url })}
                      placeholder={s("imgUrlPh")}
                    />
                    <input
                      value={b.caption}
                      onChange={(e) =>
                        updateBlock(i, { caption: e.target.value })
                      }
                      placeholder={s("captionPh")}
                      className={inputCls}
                    />
                  </>
                ) : b.kind === "heading" ? (
                  <textarea
                    value={b.text}
                    onChange={(e) => updateBlock(i, { text: e.target.value })}
                    placeholder={s("headingPh")}
                    rows={1}
                    className={`${inputCls} resize-y`}
                  />
                ) : (
                  <MarkdownInput
                    value={b.text}
                    onChange={(v) => updateBlock(i, { text: v })}
                    placeholder={s("paraPh")}
                    rows={3}
                  />
                )}
              </div>
              <div className="flex shrink-0 flex-col gap-0.5">
                <button
                  type="button"
                  onClick={() => moveBlock(i, -1)}
                  disabled={i === 0}
                  aria-label={s("moveUp")}
                  className="p-1 text-[var(--color-ink-faint)] transition hover:text-[var(--color-ink)] disabled:opacity-30"
                >
                  <ArrowUp className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => moveBlock(i, 1)}
                  disabled={i === blocks.length - 1}
                  aria-label={s("moveDown")}
                  className="p-1 text-[var(--color-ink-faint)] transition hover:text-[var(--color-ink)] disabled:opacity-30"
                >
                  <ArrowDown className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => removeBlock(i)}
                  aria-label={tc("delete")}
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
          <label className={labelCls}>{s("boxContents")}</label>
          <button
            type="button"
            onClick={addBox}
            className="flex items-center gap-1 font-mono text-[11px] text-[var(--color-ink-muted)] transition hover:text-[var(--color-ink)]"
          >
            <Plus className="h-3.5 w-3.5" /> {s("addItem")}
          </button>
        </div>
        <div className="mt-3 space-y-2">
          {boxContents.length === 0 && (
            <p className="text-[12px] text-[var(--color-ink-faint)]">
              {s("boxEmpty")}
            </p>
          )}
          {boxContents.map((b, i) => (
            <div key={i} className="flex items-center gap-2">
              <input
                value={b.item}
                onChange={(e) => updateBox(i, { item: e.target.value })}
                placeholder={s("itemPh")}
                className={inputCls}
              />
              <input
                value={b.qty}
                onChange={(e) => updateBox(i, { qty: e.target.value })}
                placeholder={s("qtyPh")}
                className={`${inputBase} w-32 shrink-0`}
              />
              <button
                type="button"
                onClick={() => removeBox(i)}
                aria-label={tc("delete")}
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
          {s("dimensions")}（{isSource ? s("dimHintSrc") : s("dimHintTr")}）
        </label>
        {isSource && (
          <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
            <input
              value={dimW}
              onChange={(e) => setDimW(e.target.value)}
              placeholder={s("dimW")}
              className={inputCls}
            />
            <input
              value={dimH}
              onChange={(e) => setDimH(e.target.value)}
              placeholder={s("dimH")}
              className={inputCls}
            />
            <input
              value={dimD}
              onChange={(e) => setDimD(e.target.value)}
              placeholder={s("dimD")}
              className={inputCls}
            />
            <input
              value={dimUnit}
              onChange={(e) => setDimUnit(e.target.value)}
              placeholder={s("dimUnit")}
              className={inputCls}
            />
          </div>
        )}
        <input
          value={dimCutout}
          onChange={(e) => setDimCutout(e.target.value)}
          placeholder={s("cutoutPh")}
          className={`${inputCls} mt-2`}
        />
      </div>

      {/* Install */}
      <div className="mt-6">
        <label className={labelCls}>{s("install")}</label>
        <input
          value={installMethod}
          onChange={(e) => setInstallMethod(e.target.value)}
          placeholder={s("installPh")}
          className={`${inputCls} mt-2`}
        />
        <div className="mt-2 flex items-center justify-between">
          <span className="text-[11px] text-[var(--color-ink-faint)]">{s("installSteps")}</span>
          <button
            type="button"
            onClick={addStep}
            className="flex items-center gap-1 font-mono text-[11px] text-[var(--color-ink-muted)] transition hover:text-[var(--color-ink)]"
          >
            <Plus className="h-3.5 w-3.5" /> {s("addStep")}
          </button>
        </div>
        <div className="mt-2 space-y-2">
          {installSteps.map((st, i) => (
            <div key={i} className="flex items-center gap-2">
              <span className="w-5 shrink-0 text-center font-mono text-[11px] text-[var(--color-ink-muted)]">
                {i + 1}
              </span>
              <input
                value={st}
                onChange={(e) => updateStep(i, e.target.value)}
                placeholder={`${s("stepPh")} ${i + 1}`}
                className={inputCls}
              />
              <button
                type="button"
                onClick={() => removeStep(i)}
                aria-label={tc("delete")}
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
          <label className={labelCls}>{s("faq")}</label>
          <button
            type="button"
            onClick={addFaq}
            className="flex items-center gap-1 font-mono text-[11px] text-[var(--color-ink-muted)] transition hover:text-[var(--color-ink)]"
          >
            <Plus className="h-3.5 w-3.5" /> {s("addFaq")}
          </button>
        </div>
        <div className="mt-3 space-y-2">
          {faq.length === 0 && (
            <p className="text-[12px] text-[var(--color-ink-faint)]">
              {s("faqEmpty")}
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
                  placeholder={s("faqQPh")}
                  className={inputCls}
                />
                <textarea
                  value={f.a}
                  onChange={(e) => updateFaq(i, { a: e.target.value })}
                  placeholder={s("faqAPh")}
                  rows={2}
                  className={`${inputCls} resize-y`}
                />
              </div>
              <button
                type="button"
                onClick={() => removeFaq(i)}
                aria-label={tc("delete")}
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
          {isSource ? s("saveShowcase") : s("saveTrans")}
        </button>
      </div>
    </section>
  );
}
