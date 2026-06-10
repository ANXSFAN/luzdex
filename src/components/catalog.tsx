"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ChevronRight,
  ChevronDown,
  FileText,
  Film,
  Search,
  Layers,
  Trash2,
  Loader2,
  ImageOff,
  X,
  Plus,
  FolderTree,
  Tag,
  Boxes,
  Copy as CopyIcon,
} from "lucide-react";
import { toast } from "sonner";
import { confirmDialog } from "@/components/confirm-dialog";
import { useTranslations } from "next-intl";
import {
  bulkDeleteProducts,
  createProduct,
  duplicateProduct,
} from "@/app/admin/products/actions";
import { createProductFromPdf } from "@/app/admin/products/pdf-actions";
import {
  assignProductsToCategory,
  assignProductsToSeries,
} from "@/app/admin/products/catalog-actions";

export type CatalogProduct = {
  id: string;
  name: string;
  modelNumber: string;
  coverImage: string | null;
  categoryId: string | null;
  seriesId: string | null;
  variantGroupId: string | null;
  variantLabel: string | null;
  videos: number;
  documents: number;
  scans30d: number;
  updatedAt: string;
  noImage: boolean;
  lacksShowcase: boolean;
  translatedCount: number;
  stale: boolean;
};
export type CatalogCategory = {
  id: string;
  name: string;
  nameI18n: Record<string, string>;
  image: string | null;
  icon: string | null;
  kind: string | null;
  parentId: string | null;
};
export type CatalogSeries = {
  id: string;
  name: string;
  nameI18n: Record<string, string>;
  categoryId: string | null;
  intro: string | null;
  introI18n: Record<string, string>;
  coverImage: string | null;
};

type Node =
  | { type: "all" }
  | { type: "cat"; id: string }
  | { type: "uncat" }
  | { type: "series"; id: string };

const NEEDS = [
  { key: "all", tk: "fAll" },
  { key: "noimage", tk: "fNoImage" },
  { key: "noshowcase", tk: "fNoShowcase" },
  { key: "untranslated", tk: "fUntranslated" },
  { key: "stale", tk: "fStale" },
] as const;

function relTime(iso: string, today: string, yesterday: string) {
  const d = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  if (d <= 0) return today;
  if (d === 1) return yesterday;
  return new Date(iso).toISOString().slice(0, 10);
}

export function Catalog({
  categories,
  series,
  products,
  initialNeed = "all",
}: {
  categories: CatalogCategory[];
  series: CatalogSeries[];
  products: CatalogProduct[];
  initialNeed?: string;
}) {
  const router = useRouter();
  const t = useTranslations("admin");
  const [node, setNode] = useState<Node>({ type: "all" });
  const [q, setQ] = useState("");
  const [need, setNeed] = useState<string>(
    NEEDS.some((n) => n.key === initialNeed) ? initialNeed : "all",
  );
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [pending, start] = useTransition();
  const [newProdOpen, setNewProdOpen] = useState(false);
  const query = q.trim().toLowerCase();

  // 分类树结构
  const childrenOf = useMemo(() => {
    const m = new Map<string | null, CatalogCategory[]>();
    for (const c of categories) {
      const k = c.parentId;
      if (!m.has(k)) m.set(k, []);
      m.get(k)!.push(c);
    }
    return m;
  }, [categories]);
  const roots = childrenOf.get(null) ?? [];

  // 每个分类的后代集（含自身），用于计数与选中过滤
  const descSelf = useMemo(() => {
    const m = new Map<string, Set<string>>();
    const build = (id: string): Set<string> => {
      if (m.has(id)) return m.get(id)!;
      const set = new Set<string>([id]);
      for (const ch of childrenOf.get(id) ?? [])
        for (const d of build(ch.id)) set.add(d);
      m.set(id, set);
      return set;
    };
    for (const c of categories) build(c.id);
    return m;
  }, [categories, childrenOf]);

  const directByCat = useMemo(() => {
    const m = new Map<string, number>();
    for (const p of products)
      if (p.categoryId) m.set(p.categoryId, (m.get(p.categoryId) ?? 0) + 1);
    return m;
  }, [products]);
  const catCount = (id: string) => {
    let n = 0;
    for (const d of descSelf.get(id) ?? [id]) n += directByCat.get(d) ?? 0;
    return n;
  };
  const uncatCount = products.filter((p) => !p.categoryId).length;
  const seriesCount = (id: string) =>
    products.filter((p) => p.seriesId === id).length;
  const seriesByCat = (catId: string | null) =>
    series.filter((s) => s.categoryId === catId);

  const activeSeries =
    node.type === "series" ? series.find((s) => s.id === node.id) ?? null : null;

  const panelProducts = useMemo(() => {
    let list = products;
    if (node.type === "cat") {
      const set = descSelf.get(node.id) ?? new Set([node.id]);
      list = list.filter((p) => p.categoryId && set.has(p.categoryId));
    } else if (node.type === "uncat") list = list.filter((p) => !p.categoryId);
    else if (node.type === "series")
      list = list.filter((p) => p.seriesId === node.id);
    if (query)
      list = list.filter(
        (p) =>
          p.name.toLowerCase().includes(query) ||
          p.modelNumber.toLowerCase().includes(query),
      );
    if (need === "noimage") list = list.filter((p) => p.noImage);
    else if (need === "noshowcase") list = list.filter((p) => p.lacksShowcase);
    else if (need === "untranslated")
      list = list.filter((p) => p.translatedCount === 0);
    else if (need === "stale") list = list.filter((p) => p.stale);
    return list;
  }, [products, node, query, need, descSelf]);

  // 同变体组聚簇相邻（整组落在首个成员出现的位置），≥2 个可见成员时框起来。
  const clusters = useMemo(() => {
    const out: { key: string; items: CatalogProduct[] }[] = [];
    const idx = new Map<string, number>();
    for (const p of panelProducts) {
      if (p.variantGroupId) {
        const gi = idx.get(p.variantGroupId);
        if (gi === undefined) {
          idx.set(p.variantGroupId, out.length);
          out.push({ key: "g:" + p.variantGroupId, items: [p] });
        } else {
          out[gi].items.push(p);
        }
      } else {
        out.push({ key: p.id, items: [p] });
      }
    }
    return out;
  }, [panelProducts]);

  function run(fn: () => Promise<unknown>, ok: string) {
    start(async () => {
      try {
        await fn();
        toast.success(ok);
        setSelected(new Set());
        router.refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : t("common.opFail"));
      }
    });
  }

  function toggleExpand(id: string) {
    setExpanded((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }
  function toggleSel(id: string) {
    setSelected((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }

  const ids = [...selected];
  const nodeTitle =
    node.type === "all"
      ? t("catalog.allProducts")
      : node.type === "uncat"
        ? t("catalog.uncat")
        : node.type === "cat"
          ? categories.find((c) => c.id === node.id)?.name ?? t("nav.categories")
          : activeSeries?.name ?? t("nav.series");
  const currentCatId = node.type === "cat" ? node.id : null;
  const currentSeriesId = node.type === "series" ? node.id : null;

  // 递归渲染一个分类节点
  function renderCat(cat: CatalogCategory, depth: number): React.ReactNode {
    const kids = childrenOf.get(cat.id) ?? [];
    const subs = seriesByCat(cat.id);
    const hasChildren = kids.length > 0 || subs.length > 0;
    const isOpen = expanded.has(cat.id);
    const active = node.type === "cat" && node.id === cat.id;
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
            {hasChildren ? (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  toggleExpand(cat.id);
                }}
                className="opacity-70"
              >
                {isOpen ? (
                  <ChevronDown className="h-3.5 w-3.5" />
                ) : (
                  <ChevronRight className="h-3.5 w-3.5" />
                )}
              </button>
            ) : null}
          </span>
          <button
            onClick={() => setNode({ type: "cat", id: cat.id })}
            className="flex min-w-0 flex-1 items-center gap-1.5 py-1.5 text-left text-sm"
          >
            <span className="truncate">{cat.name}</span>
            {cat.kind && (
              <span className="shrink-0 rounded bg-[var(--color-surface-sunken)] px-1 text-sm text-[var(--color-ink-faint)]">
                {cat.kind}
              </span>
            )}
            <span
              className={`ml-auto shrink-0 font-mono text-sm ${active ? "opacity-70" : "text-[var(--color-ink-faint)]"}`}
            >
              {catCount(cat.id)}
            </span>
          </button>
        </div>
        {isOpen && (
          <ul className="space-y-0.5">
            {kids.map((k) => renderCat(k, depth + 1))}
            {subs.map((s) => (
              <li key={s.id}>
                <button
                  onClick={() => setNode({ type: "series", id: s.id })}
                  style={{ paddingLeft: (depth + 1) * 12 + 16 }}
                  className={`flex w-full items-center gap-1.5 rounded-lg py-1.5 pr-1 text-left text-sm transition ${
                    node.type === "series" && node.id === s.id
                      ? "bg-[var(--color-ink)] text-[var(--color-surface)]"
                      : "text-[var(--color-ink-soft)] hover:bg-[var(--color-surface-sunken)]"
                  }`}
                >
                  <Tag className="h-3 w-3 shrink-0 opacity-60" />
                  <span className="truncate">{s.name}</span>
                  <span className="ml-auto shrink-0 font-mono text-sm opacity-70">
                    {seriesCount(s.id)}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </li>
    );
  }

  return (
    <div className="mt-6 grid gap-6 lg:grid-cols-[260px_1fr]">
      {/* ───── 左侧目录树 ───── */}
      <aside className="lg:sticky lg:top-6 lg:self-start">
        <div className="flex items-center justify-between px-1 pb-2">
          <span className="flex items-center gap-1.5 font-mono text-sm font-medium uppercase tracking-[0.18em] text-[var(--color-ink-muted)]">
            <FolderTree className="h-3.5 w-3.5" /> {t("catalog.catalogLabel")}
          </span>
          <Link
            href="/admin/categories"
            className="flex items-center gap-0.5 text-sm text-[var(--color-ink-muted)] transition hover:text-[var(--color-ink)]"
            title={t("nav.categories")}
          >
            {t("common.manage")} <ChevronRight className="h-3.5 w-3.5" />
          </Link>
        </div>

        <ul className="space-y-0.5 text-sm">
          <li>
            <button
              onClick={() => setNode({ type: "all" })}
              className={`flex w-full items-center gap-1.5 rounded-lg px-1 py-1.5 text-left transition ${
                node.type === "all"
                  ? "bg-[var(--color-ink)] text-[var(--color-surface)]"
                  : "text-[var(--color-ink-soft)] hover:bg-[var(--color-surface-sunken)]"
              }`}
            >
              <Layers className="ml-4 h-3.5 w-3.5 shrink-0 opacity-70" />
              <span>{t("catalog.allProducts")}</span>
              <span className="ml-auto font-mono text-sm opacity-70">
                {products.length}
              </span>
            </button>
          </li>

          {roots.map((c) => renderCat(c, 0))}

          {uncatCount > 0 && (
            <li>
              <button
                onClick={() => setNode({ type: "uncat" })}
                className={`flex w-full items-center gap-1.5 rounded-lg px-1 py-1.5 text-left transition ${
                  node.type === "uncat"
                    ? "bg-[var(--color-ink)] text-[var(--color-surface)]"
                    : "text-[var(--color-ink-soft)] hover:bg-[var(--color-surface-sunken)]"
                }`}
              >
                <Layers className="ml-4 h-3.5 w-3.5 shrink-0 opacity-40" />
                <span>{t("catalog.uncat")}</span>
                <span className="ml-auto font-mono text-sm opacity-70">
                  {uncatCount}
                </span>
              </button>
            </li>
          )}
        </ul>

        {seriesByCat(null).length > 0 && (
          <div className="mt-3 px-1">
            <span className="font-mono text-sm uppercase tracking-[0.18em] text-[var(--color-ink-faint)]">
              {t("catalog.otherSeries")}
            </span>
            <ul className="mt-1 space-y-0.5">
              {seriesByCat(null).map((s) => (
                <li key={s.id}>
                  <button
                    onClick={() => setNode({ type: "series", id: s.id })}
                    className={`flex w-full items-center gap-1.5 rounded-lg px-1 py-1.5 text-left text-sm transition ${
                      node.type === "series" && node.id === s.id
                        ? "bg-[var(--color-ink)] text-[var(--color-surface)]"
                        : "text-[var(--color-ink-soft)] hover:bg-[var(--color-surface-sunken)]"
                    }`}
                  >
                    <Tag className="h-3 w-3 shrink-0 opacity-60" />
                    <span className="truncate">{s.name}</span>
                    <span className="ml-auto font-mono text-sm opacity-70">
                      {seriesCount(s.id)}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        <Link
          href="/admin/series"
          className="mt-2 flex w-full items-center gap-1 rounded-lg border border-dashed border-[var(--color-rule)] px-2 py-1.5 text-sm text-[var(--color-ink-muted)] transition hover:border-[var(--color-ink)] hover:text-[var(--color-ink)]"
        >
          <ChevronRight className="h-3.5 w-3.5" /> {t("catalog.toSeries")}
        </Link>
      </aside>

      {/* ───── 右侧产品面板 ───── */}
      <div className="min-w-0">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-sm font-medium text-[var(--color-ink)]">
            {nodeTitle}
            <span className="ml-2 font-mono text-sm text-[var(--color-ink-faint)]">
              {panelProducts.length}
            </span>
          </h2>
          <button
            onClick={() => setNewProdOpen((o) => !o)}
            className="flex shrink-0 items-center gap-1 rounded-full bg-[var(--color-ink)] px-3 py-1.5 text-sm text-white transition hover:bg-[#424245]"
          >
            <Plus className="h-3.5 w-3.5" /> {t("catalog.newProduct")}
          </button>
        </div>

        {newProdOpen && (
          <NewProductForm
            categoryId={currentCatId}
            seriesId={currentSeriesId}
            onClose={() => setNewProdOpen(false)}
          />
        )}

        {/* 搜索 + 待补筛选 */}
        <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative max-w-xs flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--color-ink-faint)]" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={t("catalog.search")}
              className="w-full rounded-full border border-[var(--color-rule)] bg-[var(--color-surface)] py-1.5 pl-9 pr-3 text-sm text-[var(--color-ink)] outline-none transition focus:border-[var(--color-ink)]"
            />
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            {NEEDS.map((n) => (
              <button
                key={n.key}
                onClick={() => setNeed(n.key)}
                className={`rounded-full border px-2.5 py-1 text-sm transition ${
                  need === n.key
                    ? "border-[var(--color-ink)] bg-[var(--color-ink)] text-[var(--color-surface)]"
                    : "border-[var(--color-rule)] text-[var(--color-ink-soft)] hover:border-[var(--color-ink)]"
                }`}
              >
                {t(`catalog.${n.tk}`)}
              </button>
            ))}
          </div>
        </div>

        {/* 批量操作栏 */}
        {ids.length > 0 && (
          <div className="mt-3 flex flex-wrap items-center gap-2 rounded-xl border border-[var(--color-ink)] bg-[var(--color-surface)] px-3 py-2.5">
            <span className="font-mono text-sm font-medium text-[var(--color-ink)]">
              {t("catalog.selected")} {ids.length}
            </span>
            <button
              onClick={() => setSelected(new Set(panelProducts.map((p) => p.id)))}
              className="text-sm text-[var(--color-ink-muted)] hover:underline"
            >
              {t("catalog.selectCur")} {panelProducts.length}
            </button>
            <button
              onClick={() => setSelected(new Set())}
              className="flex items-center gap-0.5 text-sm text-[var(--color-ink-muted)] hover:text-[var(--color-ink)]"
            >
              <X className="h-3 w-3" /> {t("catalog.clear")}
            </button>
            <span className="mx-1 h-4 w-px bg-[var(--color-rule)]" />
            <select
              defaultValue=""
              disabled={pending}
              onChange={(e) => {
                const v = e.target.value;
                e.target.value = "";
                if (!v) return;
                run(
                  () => assignProductsToCategory(ids, v === "__none" ? null : v),
                  t("category.cardTitle"),
                );
              }}
              className="rounded-lg border border-[var(--color-rule)] bg-[var(--color-surface)] px-2 py-1 text-sm text-[var(--color-ink)] outline-none focus:border-[var(--color-ink)]"
            >
              <option value="">{t("catalog.assignCat")}</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
              <option value="__none">{t("catalog.assignCatNone")}</option>
            </select>
            <select
              defaultValue=""
              disabled={pending}
              onChange={(e) => {
                const v = e.target.value;
                e.target.value = "";
                if (!v) return;
                run(
                  () => assignProductsToSeries(ids, v === "__none" ? null : v),
                  t("series.cardTitle"),
                );
              }}
              className="rounded-lg border border-[var(--color-rule)] bg-[var(--color-surface)] px-2 py-1 text-sm text-[var(--color-ink)] outline-none focus:border-[var(--color-ink)]"
            >
              <option value="">{t("catalog.assignSeries")}</option>
              {series.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
              <option value="__none">{t("catalog.assignSeriesNone")}</option>
            </select>
            <span className="mx-1 h-4 w-px bg-[var(--color-rule)]" />
            <button
              onClick={async () => {
                if (
                  await confirmDialog({
                    message: t("catalog.bulkDeleteConfirm", { n: ids.length }),
                    confirmText: t("common.delete"),
                    danger: true,
                  })
                )
                  run(() => bulkDeleteProducts(ids), t("common.delete"));
              }}
              disabled={pending}
              className="flex items-center gap-1 rounded-lg border border-red-300 px-2.5 py-1 text-sm text-red-700 transition hover:bg-red-600 hover:text-white disabled:opacity-40"
            >
              {pending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Trash2 className="h-3.5 w-3.5" />
              )}
              {t("common.delete")}
            </button>
          </div>
        )}

        {/* 产品列表 */}
        {panelProducts.length === 0 ? (
          <p className="mt-10 text-center text-sm text-[var(--color-ink-muted)]">
            {t("catalog.noMatch")}
          </p>
        ) : (
          <ul className="mt-4 space-y-1.5">
            {clusters.map((c) =>
              c.items.length > 1 ? (
                <li
                  key={c.key}
                  className="rounded-2xl border border-[var(--color-rule)] bg-[var(--color-surface-sunken)]/60 p-1.5"
                >
                  <div className="flex items-center gap-1.5 px-2 pb-1.5 pt-1 font-mono text-[11px] uppercase tracking-[0.16em] text-[var(--color-ink-muted)]">
                    <Boxes className="h-3.5 w-3.5" />
                    {t("catalog.variantGroup")} · {c.items.length}
                  </div>
                  <ul className="space-y-1">
                    {c.items.map((p) => (
                      <Row
                        key={p.id}
                        p={p}
                        inGroup
                        selected={selected.has(p.id)}
                        onToggle={() => toggleSel(p.id)}
                      />
                    ))}
                  </ul>
                </li>
              ) : (
                <Row
                  key={c.key}
                  p={c.items[0]}
                  selected={selected.has(c.items[0].id)}
                  onToggle={() => toggleSel(c.items[0].id)}
                />
              ),
            )}
          </ul>
        )}
      </div>
    </div>
  );
}

function NewProductForm({
  categoryId,
  seriesId,
  onClose,
}: {
  categoryId: string | null;
  seriesId: string | null;
  onClose: () => void;
}) {
  const router = useRouter();
  const t = useTranslations("admin");
  const tp = useTranslations("pdf");
  const [name, setName] = useState("");
  const [model, setModel] = useState("");
  const [pending, start] = useTransition();
  const [pdfBusy, setPdfBusy] = useState(false);
  const pdfRef = useRef<HTMLInputElement>(null);

  // 从 PDF 新建：传技术文档 → AI 抽取建档并填好字段 → 跳编辑页审核
  async function fromPdf(file: File) {
    if (file.type !== "application/pdf" && !/\.pdf$/i.test(file.name)) {
      toast.error(tp("onlyPdf"));
      return;
    }
    setPdfBusy(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      if (!res.ok) {
        const msg = await res.json().catch(() => null);
        throw new Error(msg?.error ?? tp("extractFail"));
      }
      const { url } = (await res.json()) as { url: string };
      const id = await createProductFromPdf({
        pdfUrl: url,
        fileName: file.name,
        categoryId,
        seriesId,
      });
      toast.success(tp("createdOk"));
      router.push(`/admin/products/${id}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : tp("extractFail"));
      setPdfBusy(false);
    }
  }

  function submit() {
    if (!name.trim() || !model.trim()) {
      toast.error(t("catalog.needFill"));
      return;
    }
    start(async () => {
      try {
        const id = await createProduct({
          name,
          modelNumber: model,
          categoryId,
          seriesId,
        });
        toast.success(t("catalog.createdOk"));
        router.push(`/admin/products/${id}`);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : t("catalog.needFill"));
      }
    });
  }

  return (
    <div className="mt-3 flex flex-wrap items-center gap-2 rounded-xl border border-dashed border-[var(--color-rule-strong)] bg-[var(--color-surface-sunken)] p-3">
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder={t("catalog.prodName")}
        className="min-w-0 flex-1 rounded-lg border border-[var(--color-rule)] bg-[var(--color-surface)] px-3 py-1.5 text-sm outline-none focus:border-[var(--color-ink)]"
      />
      <input
        value={model}
        onChange={(e) => setModel(e.target.value)}
        placeholder={t("catalog.prodModel")}
        className="w-40 rounded-lg border border-[var(--color-rule)] bg-[var(--color-surface)] px-3 py-1.5 font-mono text-sm outline-none focus:border-[var(--color-ink)]"
      />
      <button
        onClick={submit}
        disabled={pending}
        className="flex items-center gap-1 rounded-lg bg-[var(--color-ink)] px-3 py-1.5 text-sm text-white transition hover:opacity-90 disabled:opacity-50"
      >
        {pending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
        {t("catalog.create")}
      </button>
      <button
        onClick={() => pdfRef.current?.click()}
        disabled={pdfBusy || pending}
        title={tp("fromPdfHint")}
        className="flex items-center gap-1 rounded-lg border border-[var(--color-rule-strong)] px-3 py-1.5 text-sm text-[var(--color-ink)] transition hover:border-[var(--color-ink)] disabled:opacity-50"
      >
        {pdfBusy ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <FileText className="h-3.5 w-3.5" />
        )}
        {pdfBusy ? tp("creating") : tp("fromPdf")}
      </button>
      <input
        ref={pdfRef}
        type="file"
        accept="application/pdf,.pdf"
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (pdfRef.current) pdfRef.current.value = "";
          if (f) fromPdf(f);
        }}
      />
      <button
        onClick={onClose}
        className="rounded-lg px-2 py-1.5 text-sm text-[var(--color-ink-muted)] hover:text-[var(--color-ink)]"
      >
        {t("common.cancel")}
      </button>
    </div>
  );
}

function Row({
  p,
  selected,
  onToggle,
  inGroup = false,
}: {
  p: CatalogProduct;
  selected: boolean;
  onToggle: () => void;
  inGroup?: boolean;
}) {
  const t = useTranslations("admin");
  const tp = useTranslations("prod");
  const router = useRouter();
  const [copying, startCopy] = useTransition();

  function copy() {
    startCopy(async () => {
      try {
        const id = await duplicateProduct({ productId: p.id });
        toast.success(tp("duplicatedOk"));
        router.push(`/admin/products/${id}`);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : t("common.opFail"));
      }
    });
  }

  return (
    <li
      className={`flex items-center gap-3 rounded-xl border px-3 py-2.5 transition ${
        selected
          ? "border-[var(--color-ink)] bg-[var(--color-surface-sunken)]"
          : inGroup
            ? "border-transparent bg-[var(--color-surface)] hover:border-[var(--color-rule)]"
            : "border-transparent hover:border-[var(--color-rule)] hover:bg-[var(--color-surface-sunken)]"
      }`}
    >
      <input
        type="checkbox"
        checked={selected}
        onChange={onToggle}
        className="h-4 w-4 shrink-0 cursor-pointer accent-[var(--color-ink)]"
        aria-label={t("common.select")}
      />
      <Link
        href={`/admin/products/${p.id}`}
        className="flex min-w-0 flex-1 items-center gap-3"
      >
        <div className="relative h-11 w-14 shrink-0 overflow-hidden rounded-md border border-[var(--color-rule)] bg-[var(--color-surface-sunken)]">
          {p.coverImage ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img src={p.coverImage} alt="" className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-[var(--color-ink-faint)]">
              <ImageOff className="h-4 w-4" />
            </div>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-[var(--color-ink)]">
            {p.name}
          </p>
          <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
            <span className="font-mono text-sm text-[var(--color-ink-muted)]">
              {p.modelNumber}
            </span>
            {p.variantLabel && (
              <Badge tone="ink">{p.variantLabel}</Badge>
            )}
            {p.noImage && <Badge tone="red">{t("catalog.fNoImage")}</Badge>}
            {p.lacksShowcase && <Badge tone="amber">{t("catalog.fNoShowcase")}</Badge>}
            {p.translatedCount === 0 ? (
              <Badge tone="amber">{t("catalog.fUntranslated")}</Badge>
            ) : p.stale ? (
              <Badge tone="amber">{t("catalog.fStale")}</Badge>
            ) : (
              <Badge tone="muted">{t("catalog.badgeTrans")} {p.translatedCount}</Badge>
            )}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-3 text-sm text-[var(--color-ink-muted)]">
          <span className="hidden font-mono sm:inline">
            {p.scans30d} {t("catalog.scans")}
          </span>
          <span className="hidden items-center gap-1 sm:flex">
            <Film className="h-3.5 w-3.5" />
            {p.videos}
          </span>
          <span className="hidden items-center gap-1 sm:flex">
            <FileText className="h-3.5 w-3.5" />
            {p.documents}
          </span>
          <span className="hidden w-14 text-right font-mono text-sm text-[var(--color-ink-faint)] md:inline">
            {relTime(p.updatedAt, t("catalog.today"), t("catalog.yesterday"))}
          </span>
          <ChevronRight className="h-4 w-4" />
        </div>
      </Link>
      <button
        type="button"
        onClick={copy}
        disabled={copying}
        title={tp("duplicate")}
        aria-label={tp("duplicate")}
        className="shrink-0 rounded-lg p-1.5 text-[var(--color-ink-faint)] transition hover:bg-[var(--color-surface-deep)] hover:text-[var(--color-ink)] disabled:opacity-50"
      >
        {copying ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <CopyIcon className="h-4 w-4" />
        )}
      </button>
    </li>
  );
}

function Badge({
  tone,
  children,
}: {
  tone: "red" | "amber" | "muted" | "ink";
  children: React.ReactNode;
}) {
  const cls =
    tone === "red"
      ? "bg-red-50 text-red-600"
      : tone === "amber"
        ? "bg-amber-50 text-amber-700"
        : tone === "ink"
          ? "bg-[var(--color-ink)] font-mono text-[var(--color-surface)]"
          : "bg-[var(--color-surface-sunken)] text-[var(--color-ink-faint)]";
  return (
    <span className={`rounded-full px-1.5 py-0.5 text-sm font-medium leading-none ${cls}`}>
      {children}
    </span>
  );
}
