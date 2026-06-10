"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus, Trash2, ImageOff, Languages, Globe } from "lucide-react";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { LOCALE_LABELS, LOCALE_ORDER, type AppLocale } from "@/i18n/routing";
import { useFileDrop } from "@/components/use-file-drop";
import { confirmDialog } from "@/components/confirm-dialog";
import { MarkdownInput } from "@/components/markdown-input";
import {
  updateCategory,
  deleteCategory,
  translateCategory,
  updateSeries,
  deleteSeries,
  translateSeries,
} from "@/app/admin/products/catalog-actions";

const SRC: AppLocale = "es"; // 源语言（与产品源语言一致）

type Cat = {
  id: string;
  name: string;
  nameI18n: Record<string, string>;
  image: string | null;
  icon: string | null;
  kind: string | null;
  parentId: string | null;
};
type CatOpt = { id: string; name: string; parentId: string | null };
type Ser = {
  id: string;
  name: string;
  nameI18n: Record<string, string>;
  intro: string | null;
  introI18n: Record<string, string>;
  categoryId: string | null;
  coverImage: string | null;
};

const inputCls =
  "w-full rounded-lg border border-[var(--color-rule)] bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-ink)] outline-none transition focus:border-[var(--color-ink)]";
const labelCls =
  "font-mono text-sm font-medium uppercase tracking-[0.22em] text-[var(--color-ink-muted)]";

async function uploadImage(file: File): Promise<string> {
  const fd = new FormData();
  fd.append("file", file);
  fd.append("kind", "image");
  const res = await fetch("/api/upload", { method: "POST", body: fd });
  if (!res.ok) {
    const m = await res.json().catch(() => null);
    throw new Error(m?.error ?? "上传失败");
  }
  return (await res.json()).url as string;
}

/** 9 语言可切换的单值编辑：源语言(es)编辑 source，其余编辑 i18n[loc]。 */
function MultiLang({
  source,
  setSource,
  i18n,
  setI18n,
  placeholder,
  multiline,
}: {
  source: string;
  setSource: (v: string) => void;
  i18n: Record<string, string>;
  setI18n: (m: Record<string, string>) => void;
  placeholder?: string;
  multiline?: boolean;
}) {
  const [loc, setLoc] = useState<AppLocale>(SRC);
  const isSrc = loc === SRC;
  const value = isSrc ? source : i18n[loc] ?? "";
  const onChange = (v: string) => {
    if (isSrc) setSource(v);
    else setI18n({ ...i18n, [loc]: v });
  };
  return (
    <div>
      <div className="mb-1.5 flex flex-wrap gap-1">
        {LOCALE_ORDER.map((l) => {
          const has = l === SRC ? !!source.trim() : !!(i18n[l] ?? "").trim();
          return (
            <button
              key={l}
              type="button"
              onClick={() => setLoc(l)}
              className={`rounded-full border px-2 py-0.5 text-sm transition ${
                loc === l
                  ? "border-[var(--color-ink)] bg-[var(--color-ink)] text-[var(--color-surface)]"
                  : has
                    ? "border-[var(--color-rule-strong)] text-[var(--color-ink-soft)]"
                    : "border-[var(--color-rule)] text-[var(--color-ink-faint)]"
              }`}
            >
              {LOCALE_LABELS[l]}
            </button>
          );
        })}
      </div>
      {multiline ? (
        <MarkdownInput
          value={value}
          onChange={onChange}
          placeholder={isSrc ? placeholder : LOCALE_LABELS[loc]}
          rows={3}
        />
      ) : (
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={isSrc ? placeholder : LOCALE_LABELS[loc]}
          className={inputCls}
        />
      )}
    </div>
  );
}

export function CategoryEditor({
  category,
  categories,
  onDeleted,
}: {
  category: Cat;
  categories: CatOpt[];
  onDeleted: () => void;
}) {
  const router = useRouter();
  const t = useTranslations("admin");
  const [name, setName] = useState(category.name);
  const [nameI18n, setNameI18n] = useState<Record<string, string>>(
    category.nameI18n,
  );
  const [image, setImage] = useState(category.image ?? "");
  const [icon, setIcon] = useState(category.icon ?? "");
  const [parentId, setParentId] = useState(category.parentId ?? "");
  const [uploading, setUploading] = useState(false);
  const [pending, start] = useTransition();
  const [translating, startTr] = useTransition();

  // 父级选项：排除自己与自己的后代
  const descendants = (() => {
    const childrenOf = new Map<string | null, string[]>();
    for (const c of categories) {
      if (!childrenOf.has(c.parentId)) childrenOf.set(c.parentId, []);
      childrenOf.get(c.parentId)!.push(c.id);
    }
    const out = new Set<string>([category.id]);
    const stack = [category.id];
    while (stack.length) {
      const cur = stack.pop()!;
      for (const ch of childrenOf.get(cur) ?? [])
        if (!out.has(ch)) {
          out.add(ch);
          stack.push(ch);
        }
    }
    return out;
  })();
  const parentOpts = categories.filter((c) => !descendants.has(c.id));

  async function uploadOne(f: File) {
    setUploading(true);
    try {
      setImage(await uploadImage(f));
      toast.success("图片已上传，记得保存");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "上传失败");
    } finally {
      setUploading(false);
    }
  }

  function pickImage(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (f) uploadOne(f);
  }

  const { dragging, dropProps } = useFileDrop((files) => uploadOne(files[0]), {
    accept: "image",
    disabled: uploading,
  });

  function save() {
    if (!name.trim()) return toast.error("分类名（源语言）不能为空");
    start(async () => {
      try {
        await updateCategory(category.id, {
          name,
          nameI18n,
          image,
          icon,
          parentId: parentId || null,
        });
        toast.success("分类已保存");
        router.refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "保存失败");
      }
    });
  }

  function translate() {
    if (!name.trim()) return toast.error("先填源语言分类名再翻译");
    startTr(async () => {
      try {
        const r = await translateCategory(category.id);
        setNameI18n(r);
        toast.success("已翻译其余语言");
        router.refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "翻译失败");
      }
    });
  }

  async function del() {
    if (
      !(await confirmDialog({
        message: t("category.deleteConfirm", { name }),
        confirmText: t("category.deleteCat"),
        danger: true,
      }))
    )
      return;
    start(async () => {
      try {
        await deleteCategory(category.id);
        toast.success("已删除分类");
        onDeleted();
        router.refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "删除失败");
      }
    });
  }

  return (
    <section className="mb-5 rounded-2xl border border-[var(--color-rule)] bg-[var(--color-surface)] p-5">
      <div className="flex items-baseline justify-between border-b border-[var(--color-rule)] pb-2">
        <p className="font-mono text-sm font-medium uppercase tracking-[0.22em] text-[var(--color-ink)]">
{t("category.cardTitle")}
        </p>
        <button
          onClick={del}
          disabled={pending}
          className="flex items-center gap-1 text-sm text-[var(--color-ink-muted)] transition hover:text-red-600 disabled:opacity-50"
        >
          <Trash2 className="h-3.5 w-3.5" /> {t("category.deleteCat")}
        </button>
      </div>

      <div className="mt-4 flex flex-col gap-4 sm:flex-row">
        <div className="flex flex-col gap-2 sm:w-40 sm:shrink-0">
          <div
            {...dropProps}
            className={`relative aspect-square overflow-hidden rounded-lg border bg-[var(--color-surface-sunken)] transition ${
              dragging
                ? "border-[var(--color-ink)] ring-2 ring-[var(--color-ink)]"
                : "border-[var(--color-rule)]"
            }`}
          >
            {image ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img src={image} alt="" className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-[var(--color-ink-faint)]">
                <ImageOff className="h-6 w-6" />
              </div>
            )}
          </div>
          <label className="flex cursor-pointer items-center justify-center gap-1.5 rounded-full border border-[var(--color-rule)] px-3 py-1.5 text-sm transition hover:bg-[var(--color-surface-sunken)]">
            {uploading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Plus className="h-3.5 w-3.5" />
            )}
            {image ? t("category.replaceImg") : t("category.uploadImg")}
            <input type="file" accept="image/*" hidden onChange={pickImage} />
          </label>
        </div>

        <div className="min-w-0 flex-1 space-y-4">
          <div>
            <div className="mb-1 flex items-center justify-between">
              <label className={labelCls}>{t("category.nameLabel")}</label>
              <button
                onClick={translate}
                disabled={translating}
                className="flex items-center gap-1 rounded-full border border-[var(--color-ink)] px-2.5 py-1 text-sm text-[var(--color-ink)] transition hover:bg-[var(--color-ink)] hover:text-[var(--color-surface)] disabled:opacity-50"
              >
                {translating ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <Languages className="h-3 w-3" />
                )}
                {t("category.aiTranslate")}
              </button>
            </div>
            <MultiLang
              source={name}
              setSource={setName}
              i18n={nameI18n}
              setI18n={setNameI18n}
              placeholder=""
            />
          </div>

          <div>
            <label className={labelCls}>{t("category.parent")}</label>
            <select
              value={parentId}
              onChange={(e) => setParentId(e.target.value)}
              className={`${inputCls} mt-1.5`}
            >
              <option value="">{t("category.topLevel")}</option>
              {parentOpts.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className={labelCls}>{t("category.iconLabel")}</label>
            <div className="mt-1.5 flex items-center gap-2">
              <Globe className="h-4 w-4 shrink-0 text-[var(--color-ink-faint)]" />
              <input
                value={icon}
                onChange={(e) => setIcon(e.target.value)}
                placeholder="如 Lightbulb / https://…"
                className={inputCls}
              />
            </div>
          </div>

          <div className="flex justify-end">
            <button
              onClick={save}
              disabled={pending}
              className="rounded-lg bg-[var(--color-ink)] px-4 py-2 text-sm font-medium text-[var(--color-surface)] transition hover:opacity-90 disabled:opacity-50"
            >
              {pending ? t("common.saving") : t("common.save")}
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}

export function SeriesEditor({
  series,
  categories,
  onDeleted,
}: {
  series: Ser;
  categories: { id: string; name: string }[];
  onDeleted: () => void;
}) {
  const router = useRouter();
  const t = useTranslations("admin");
  const [name, setName] = useState(series.name);
  const [nameI18n, setNameI18n] = useState<Record<string, string>>(
    series.nameI18n,
  );
  const [intro, setIntro] = useState(series.intro ?? "");
  const [introI18n, setIntroI18n] = useState<Record<string, string>>(
    series.introI18n,
  );
  const [categoryId, setCategoryId] = useState(series.categoryId ?? "");
  const [cover, setCover] = useState(series.coverImage ?? "");
  const [uploading, setUploading] = useState(false);
  const [pending, start] = useTransition();
  const [translating, startTr] = useTransition();

  async function uploadOne(f: File) {
    setUploading(true);
    try {
      setCover(await uploadImage(f));
      toast.success("封面已上传，记得保存");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "上传失败");
    } finally {
      setUploading(false);
    }
  }

  const { dragging, dropProps } = useFileDrop((files) => uploadOne(files[0]), {
    accept: "image",
    disabled: uploading,
  });

  function pickCover(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (f) uploadOne(f);
  }

  function save() {
    if (!name.trim()) return toast.error("系列名（源语言）不能为空");
    start(async () => {
      try {
        await updateSeries(series.id, {
          name,
          nameI18n,
          intro,
          introI18n,
          categoryId: categoryId || null,
          coverImage: cover,
        });
        toast.success("系列已保存");
        router.refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "保存失败");
      }
    });
  }

  function translate() {
    if (!name.trim()) return toast.error("先填源语言内容再翻译");
    startTr(async () => {
      try {
        const r = await translateSeries(series.id);
        setNameI18n(r.nameI18n);
        setIntroI18n(r.introI18n);
        toast.success("已翻译其余语言");
        router.refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "翻译失败");
      }
    });
  }

  async function del() {
    if (
      !(await confirmDialog({
        message: t("series.deleteConfirm", { name }),
        confirmText: t("common.delete"),
        danger: true,
      }))
    )
      return;
    start(async () => {
      try {
        await deleteSeries(series.id);
        toast.success("已删除系列");
        onDeleted();
        router.refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "删除失败");
      }
    });
  }

  return (
    <section className="mb-5 rounded-2xl border border-[var(--color-rule)] bg-[var(--color-surface)] p-5">
      <div className="flex items-center justify-between border-b border-[var(--color-rule)] pb-2">
        <p className="font-mono text-sm font-medium uppercase tracking-[0.22em] text-[var(--color-ink)]">
{t("series.cardTitle")}
        </p>
        <div className="flex items-center gap-3">
          <button
            onClick={translate}
            disabled={translating}
            className="flex items-center gap-1 rounded-full border border-[var(--color-ink)] px-2.5 py-1 text-sm text-[var(--color-ink)] transition hover:bg-[var(--color-ink)] hover:text-[var(--color-surface)] disabled:opacity-50"
          >
            {translating ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <Languages className="h-3 w-3" />
            )}
            {t("series.aiTranslate")}
          </button>
          <button
            onClick={del}
            disabled={pending}
            className="flex items-center gap-1 text-sm text-[var(--color-ink-muted)] transition hover:text-red-600 disabled:opacity-50"
          >
            <Trash2 className="h-3.5 w-3.5" /> {t("common.delete")}
          </button>
        </div>
      </div>

      <div className="mt-4 flex flex-col gap-4 sm:flex-row">
        <div className="flex flex-col gap-2 sm:w-44 sm:shrink-0">
          <div
            {...dropProps}
            className={`relative aspect-[4/3] overflow-hidden rounded-lg border bg-[var(--color-surface-sunken)] transition ${
              dragging
                ? "border-[var(--color-ink)] ring-2 ring-[var(--color-ink)]"
                : "border-[var(--color-rule)]"
            }`}
          >
            {cover ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img src={cover} alt="" className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-[var(--color-ink-faint)]">
                <ImageOff className="h-6 w-6" />
              </div>
            )}
          </div>
          <label className="flex cursor-pointer items-center justify-center gap-1.5 rounded-full border border-[var(--color-rule)] px-3 py-1.5 text-sm transition hover:bg-[var(--color-surface-sunken)]">
            {uploading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Plus className="h-3.5 w-3.5" />
            )}
            {cover ? t("series.replaceCover") : t("series.uploadCover")}
            <input type="file" accept="image/*" hidden onChange={pickCover} />
          </label>
        </div>

        <div className="min-w-0 flex-1 space-y-4">
          <div>
            <label className={labelCls}>{t("series.nameLabel")}</label>
            <div className="mt-1.5">
              <MultiLang
                source={name}
                setSource={setName}
                i18n={nameI18n}
                setI18n={setNameI18n}
                placeholder=""
              />
            </div>
          </div>
          <div>
            <label className={labelCls}>{t("series.intro")}</label>
            <div className="mt-1.5">
              <MultiLang
                source={intro}
                setSource={setIntro}
                i18n={introI18n}
                setI18n={setIntroI18n}
                placeholder={t("series.introPh")}
                multiline
              />
            </div>
          </div>
          <div>
            <label className={labelCls}>{t("series.category")}</label>
            <select
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              className={`${inputCls} mt-1.5`}
            >
              <option value="">{t("series.noCategory")}</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div className="flex justify-end">
            <button
              onClick={save}
              disabled={pending}
              className="rounded-lg bg-[var(--color-ink)] px-4 py-2 text-sm font-medium text-[var(--color-surface)] transition hover:opacity-90 disabled:opacity-50"
            >
              {pending ? t("common.saving") : t("common.save")}
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
