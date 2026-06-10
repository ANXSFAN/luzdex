"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  ChevronRight,
  ChevronDown,
  Plus,
  Pencil,
  FolderPlus,
  FolderTree,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { useTranslations, useLocale } from "next-intl";
import { createCategory } from "@/app/admin/products/catalog-actions";
import { CategoryEditor } from "@/components/catalog-editors";

type Cat = {
  id: string;
  name: string;
  nameI18n: Record<string, string>;
  image: string | null;
  icon: string | null;
  kind: string | null;
  parentId: string | null;
};

export function CategoryManager({
  categories,
  catCounts,
}: {
  categories: Cat[];
  catCounts: Record<string, number>;
}) {
  const router = useRouter();
  const t = useTranslations("admin");
  const locale = useLocale();
  const [selId, setSelId] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [pending, start] = useTransition();

  // 树标签按后台语言显示译名（缺译回退源名）；右侧编辑器仍编辑全部语言。
  const disp = (c: Cat) =>
    c.nameI18n[locale]?.trim() ? c.nameI18n[locale] : c.name;

  const childrenOf = new Map<string | null, Cat[]>();
  for (const c of categories) {
    if (!childrenOf.has(c.parentId)) childrenOf.set(c.parentId, []);
    childrenOf.get(c.parentId)!.push(c);
  }
  const roots = childrenOf.get(null) ?? [];

  const descOf = new Map<string, Set<string>>();
  const build = (id: string): Set<string> => {
    if (descOf.has(id)) return descOf.get(id)!;
    const s = new Set<string>([id]);
    for (const ch of childrenOf.get(id) ?? []) for (const d of build(ch.id)) s.add(d);
    descOf.set(id, s);
    return s;
  };
  categories.forEach((c) => build(c.id));
  const rollup = (id: string) => {
    let n = 0;
    for (const d of descOf.get(id) ?? [id]) n += catCounts[d] ?? 0;
    return n;
  };

  // 新建分类：不弹框，直接建一个草稿并选中 → 右侧表单里填名称/多语言/图片后保存
  function createCat(parentId?: string) {
    start(async () => {
      try {
        const id = await createCategory({ name: "新分类", parentId });
        if (parentId) setExpanded((p) => new Set(p).add(parentId));
        setSelId(id);
        toast.success(t("category.draftOk"));
        router.refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "新建失败");
      }
    });
  }
  function toggle(id: string) {
    setExpanded((p) => {
      const n = new Set(p);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }

  const activeCat = selId ? categories.find((c) => c.id === selId) ?? null : null;

  function renderCat(cat: Cat, depth: number): React.ReactNode {
    const kids = childrenOf.get(cat.id) ?? [];
    const open = expanded.has(cat.id);
    const active = selId === cat.id;
    return (
      <li key={cat.id}>
        <div
          className={`group flex items-center gap-1 rounded-lg pr-1 transition ${
            active
              ? "bg-[var(--color-ink)] text-[var(--color-surface)]"
              : "text-[var(--color-ink-soft)] hover:bg-[var(--color-surface-sunken)]"
          }`}
          style={{ paddingLeft: depth * 12 }}
        >
          <span className="flex w-4 shrink-0 justify-center">
            {kids.length > 0 && (
              <button onClick={() => toggle(cat.id)} className="opacity-70">
                {open ? (
                  <ChevronDown className="h-3.5 w-3.5" />
                ) : (
                  <ChevronRight className="h-3.5 w-3.5" />
                )}
              </button>
            )}
          </span>
          <button
            onClick={() => setSelId(cat.id)}
            className="flex min-w-0 flex-1 items-center gap-1.5 py-1.5 text-left text-sm"
          >
            <span className="truncate">{disp(cat)}</span>
            {cat.kind && (
              <span className="shrink-0 rounded bg-[var(--color-surface-sunken)] px-1 text-sm text-[var(--color-ink-faint)]">
                {cat.kind}
              </span>
            )}
            <span
              className={`ml-auto shrink-0 font-mono text-sm ${active ? "opacity-70" : "text-[var(--color-ink-faint)]"}`}
            >
              {rollup(cat.id)}
            </span>
          </button>
          <span className="flex shrink-0 items-center gap-0.5 opacity-0 transition group-hover:opacity-100">
            <button
              title={t("category.addSub")}
              onClick={() => createCat(cat.id)}
              className="p-1"
            >
              <FolderPlus className="h-4 w-4" />
            </button>
            <button
              title={t("common.edit")}
              onClick={() => setSelId(cat.id)}
              className="p-1"
            >
              <Pencil className="h-4 w-4" />
            </button>
          </span>
        </div>
        {open && kids.length > 0 && (
          <ul className="space-y-0.5">{kids.map((k) => renderCat(k, depth + 1))}</ul>
        )}
      </li>
    );
  }

  return (
    <div className="mt-6 grid gap-6 lg:grid-cols-[300px_1fr]">
      <aside className="lg:sticky lg:top-6 lg:self-start">
        <div className="flex items-center justify-between px-1 pb-2">
          <span className="flex items-center gap-1.5 font-mono text-sm font-medium uppercase tracking-[0.18em] text-[var(--color-ink-muted)]">
            <FolderTree className="h-3.5 w-3.5" /> {t("category.tree")}
          </span>
          <button
            onClick={() => createCat()}
            disabled={pending}
            className="flex items-center gap-1 rounded-lg bg-[var(--color-ink)] px-3 py-1.5 text-sm text-[var(--color-surface)] transition hover:opacity-90 disabled:opacity-50"
          >
            {pending ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <Plus className="h-3.5 w-3.5" />
            )}
            {t("category.addTop")}
          </button>
        </div>

        {categories.length === 0 ? (
          <p className="px-1 py-6 text-center text-sm text-[var(--color-ink-faint)]">
            {t("category.empty")}
          </p>
        ) : (
          <ul className="space-y-0.5">{roots.map((c) => renderCat(c, 0))}</ul>
        )}
      </aside>

      <div className="min-w-0">
        {activeCat ? (
          <CategoryEditor
            key={activeCat.id}
            category={activeCat}
            categories={categories.map((c) => ({
              id: c.id,
              name: disp(c),
              parentId: c.parentId,
            }))}
            onDeleted={() => setSelId(null)}
          />
        ) : (
          <div className="flex min-h-[280px] items-center justify-center rounded-2xl border border-dashed border-[var(--color-rule)] text-center">
            <div className="px-6">
              <FolderTree className="mx-auto h-8 w-8 text-[var(--color-ink-faint)]" />
              <p className="mt-3 text-sm text-[var(--color-ink-muted)]">
                {t("category.selectHint")}
              </p>
              <p className="mt-1 text-sm text-[var(--color-ink-faint)]">
                {t("category.selectSub")}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
