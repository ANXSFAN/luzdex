"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Tag, Plus, Loader2, ImageOff } from "lucide-react";
import { toast } from "sonner";
import { useTranslations, useLocale } from "next-intl";
import { createSeries } from "@/app/admin/products/catalog-actions";
import { SeriesEditor } from "@/components/catalog-editors";

type Cat = { id: string; name: string };
type Ser = {
  id: string;
  name: string;
  nameI18n: Record<string, string>;
  categoryId: string | null;
  intro: string | null;
  introI18n: Record<string, string>;
  coverImage: string | null;
};

export function SeriesManager({
  series,
  categories,
  serCounts,
}: {
  series: Ser[];
  categories: Cat[];
  serCounts: Record<string, number>;
}) {
  const router = useRouter();
  const t = useTranslations("admin");
  const locale = useLocale();
  const [selId, setSelId] = useState<string | null>(null);
  const [pending, start] = useTransition();

  // 列表标签按后台语言显示译名（缺译回退源名）；右侧编辑器仍编辑全部语言。
  const disp = (s: Ser) =>
    s.nameI18n[locale]?.trim() ? s.nameI18n[locale] : s.name;
  const catName = (id: string | null) =>
    id ? categories.find((c) => c.id === id)?.name ?? "—" : t("series.noCategory");
  const active = selId ? series.find((s) => s.id === selId) ?? null : null;

  // 新建系列：不弹框，建草稿并选中 → 右侧表单填名称/简介/多语言/主视觉后保存
  function newSeries() {
    start(async () => {
      try {
        const id = await createSeries({ name: t("series.defaultName") });
        setSelId(id);
        toast.success(t("series.draftOk"));
        router.refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : t("common.createFail"));
      }
    });
  }

  return (
    <div className="mt-6 grid gap-6 lg:grid-cols-[300px_1fr]">
      <aside className="lg:sticky lg:top-6 lg:self-start">
        <div className="flex items-center justify-between px-1 pb-2">
          <span className="flex items-center gap-1.5 font-mono text-sm font-medium uppercase tracking-[0.18em] text-[var(--color-ink-muted)]">
            <Tag className="h-3.5 w-3.5" /> {t("series.listLabel")}
          </span>
          <button
            onClick={newSeries}
            disabled={pending}
            className="flex items-center gap-0.5 text-sm text-[var(--color-ink-muted)] transition hover:text-[var(--color-ink)] disabled:opacity-50"
          >
            {pending ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <Plus className="h-3.5 w-3.5" />
            )}
            {t("series.newSeries")}
          </button>
        </div>

        {series.length === 0 ? (
          <p className="px-1 py-6 text-center text-sm text-[var(--color-ink-faint)]">
            {t("series.empty")}
          </p>
        ) : (
          <ul className="space-y-1">
            {series.map((s) => {
              const sel = selId === s.id;
              return (
                <li key={s.id}>
                  <button
                    onClick={() => setSelId(s.id)}
                    className={`flex w-full items-center gap-2 rounded-lg border px-2 py-2 text-left transition ${
                      sel
                        ? "border-[var(--color-ink)] bg-[var(--color-surface-sunken)]"
                        : "border-transparent hover:border-[var(--color-rule)] hover:bg-[var(--color-surface-sunken)]"
                    }`}
                  >
                    <div className="relative h-9 w-12 shrink-0 overflow-hidden rounded border border-[var(--color-rule)] bg-[var(--color-surface-sunken)]">
                      {s.coverImage ? (
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <img src={s.coverImage} alt="" className="h-full w-full object-cover" />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-[var(--color-ink-faint)]">
                          <ImageOff className="h-3.5 w-3.5" />
                        </div>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm text-[var(--color-ink)]">{disp(s)}</p>
                      <p className="truncate text-sm text-[var(--color-ink-muted)]">
                        {catName(s.categoryId)}
                      </p>
                    </div>
                    <span className="shrink-0 font-mono text-sm text-[var(--color-ink-faint)]">
                      {serCounts[s.id] ?? 0}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </aside>

      <div className="min-w-0">
        {active ? (
          <SeriesEditor
            key={active.id}
            series={active}
            categories={categories}
            onDeleted={() => setSelId(null)}
          />
        ) : (
          <div className="flex min-h-[280px] items-center justify-center rounded-2xl border border-dashed border-[var(--color-rule)] text-center">
            <div className="px-6">
              <Tag className="mx-auto h-8 w-8 text-[var(--color-ink-faint)]" />
              <p className="mt-3 text-sm text-[var(--color-ink-muted)]">
                {t("series.selectHint")}
              </p>
              <p className="mt-1 text-sm text-[var(--color-ink-faint)]">
                {t("series.selectSub")}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
