"use client";

import { useMemo, useState, useTransition } from "react";
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
} from "lucide-react";
import { toast } from "sonner";
import { bulkDeleteProducts, createProduct } from "@/app/admin/products/actions";
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
  { key: "all", label: "全部" },
  { key: "noimage", label: "无图" },
  { key: "noshowcase", label: "缺展示" },
  { key: "untranslated", label: "未译" },
  { key: "stale", label: "译文过期" },
] as const;

function relTime(iso: string) {
  const d = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  if (d <= 0) return "今天";
  if (d === 1) return "昨天";
  if (d < 30) return `${d} 天前`;
  if (d < 365) return `${Math.floor(d / 30)} 月前`;
  return `${Math.floor(d / 365)} 年前`;
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

  function run(fn: () => Promise<unknown>, ok: string) {
    start(async () => {
      try {
        await fn();
        toast.success(ok);
        setSelected(new Set());
        router.refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "操作失败");
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
      ? "全部产品"
      : node.type === "uncat"
        ? "未分类"
        : node.type === "cat"
          ? categories.find((c) => c.id === node.id)?.name ?? "分类"
          : activeSeries?.name ?? "系列";
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
            <FolderTree className="h-3.5 w-3.5" /> 目录
          </span>
          <Link
            href="/admin/categories"
            className="flex items-center gap-0.5 text-sm text-[var(--color-ink-muted)] transition hover:text-[var(--color-ink)]"
            title="去分类管理"
          >
            管理 <ChevronRight className="h-3.5 w-3.5" />
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
              <span>全部产品</span>
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
                <span>未分类</span>
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
              未归分类的系列
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
          <ChevronRight className="h-3.5 w-3.5" /> 去系列管理
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
            <Plus className="h-3.5 w-3.5" /> 新建产品
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
              placeholder="搜索名称 / 型号"
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
                {n.label}
              </button>
            ))}
          </div>
        </div>

        {/* 批量操作栏 */}
        {ids.length > 0 && (
          <div className="mt-3 flex flex-wrap items-center gap-2 rounded-xl border border-[var(--color-ink)] bg-[var(--color-surface)] px-3 py-2.5">
            <span className="font-mono text-sm font-medium text-[var(--color-ink)]">
              已选 {ids.length}
            </span>
            <button
              onClick={() => setSelected(new Set(panelProducts.map((p) => p.id)))}
              className="text-sm text-[var(--color-ink-muted)] hover:underline"
            >
              选当前 {panelProducts.length}
            </button>
            <button
              onClick={() => setSelected(new Set())}
              className="flex items-center gap-0.5 text-sm text-[var(--color-ink-muted)] hover:text-[var(--color-ink)]"
            >
              <X className="h-3 w-3" /> 清空
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
                  "已归类",
                );
              }}
              className="rounded-lg border border-[var(--color-rule)] bg-[var(--color-surface)] px-2 py-1 text-sm text-[var(--color-ink)] outline-none focus:border-[var(--color-ink)]"
            >
              <option value="">归入分类…</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
              <option value="__none">（移出分类）</option>
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
                  "已归系列",
                );
              }}
              className="rounded-lg border border-[var(--color-rule)] bg-[var(--color-surface)] px-2 py-1 text-sm text-[var(--color-ink)] outline-none focus:border-[var(--color-ink)]"
            >
              <option value="">归入系列…</option>
              {series.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
              <option value="__none">（移出系列）</option>
            </select>
            <span className="mx-1 h-4 w-px bg-[var(--color-rule)]" />
            <button
              onClick={() => {
                if (window.confirm(`删除选中的 ${ids.length} 个产品？不可恢复。`))
                  run(() => bulkDeleteProducts(ids), "已删除");
              }}
              disabled={pending}
              className="flex items-center gap-1 rounded-lg border border-red-300 px-2.5 py-1 text-sm text-red-700 transition hover:bg-red-600 hover:text-white disabled:opacity-40"
            >
              {pending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Trash2 className="h-3.5 w-3.5" />
              )}
              删除
            </button>
          </div>
        )}

        {/* 产品列表 */}
        {panelProducts.length === 0 ? (
          <p className="mt-10 text-center text-sm text-[var(--color-ink-muted)]">
            该节点下没有匹配的产品
          </p>
        ) : (
          <ul className="mt-4 space-y-1">
            {panelProducts.map((p) => (
              <Row
                key={p.id}
                p={p}
                selected={selected.has(p.id)}
                onToggle={() => toggleSel(p.id)}
              />
            ))}
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
  const [name, setName] = useState("");
  const [model, setModel] = useState("");
  const [pending, start] = useTransition();

  function submit() {
    if (!name.trim() || !model.trim()) {
      toast.error("请填写名称和型号");
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
        toast.success("已创建，进入编辑");
        router.push(`/admin/products/${id}`);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "创建失败");
      }
    });
  }

  return (
    <div className="mt-3 flex flex-wrap items-center gap-2 rounded-xl border border-dashed border-[var(--color-rule-strong)] bg-[var(--color-surface-sunken)] p-3">
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="产品名称"
        className="min-w-0 flex-1 rounded-lg border border-[var(--color-rule)] bg-[var(--color-surface)] px-3 py-1.5 text-sm outline-none focus:border-[var(--color-ink)]"
      />
      <input
        value={model}
        onChange={(e) => setModel(e.target.value)}
        placeholder="型号"
        className="w-40 rounded-lg border border-[var(--color-rule)] bg-[var(--color-surface)] px-3 py-1.5 font-mono text-sm outline-none focus:border-[var(--color-ink)]"
      />
      <button
        onClick={submit}
        disabled={pending}
        className="flex items-center gap-1 rounded-lg bg-[var(--color-ink)] px-3 py-1.5 text-sm text-white transition hover:opacity-90 disabled:opacity-50"
      >
        {pending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
        创建并编辑
      </button>
      <button
        onClick={onClose}
        className="rounded-lg px-2 py-1.5 text-sm text-[var(--color-ink-muted)] hover:text-[var(--color-ink)]"
      >
        取消
      </button>
    </div>
  );
}

function Row({
  p,
  selected,
  onToggle,
}: {
  p: CatalogProduct;
  selected: boolean;
  onToggle: () => void;
}) {
  return (
    <li
      className={`flex items-center gap-3 rounded-xl border px-3 py-2.5 transition ${
        selected
          ? "border-[var(--color-ink)] bg-[var(--color-surface-sunken)]"
          : "border-transparent hover:border-[var(--color-rule)] hover:bg-[var(--color-surface-sunken)]"
      }`}
    >
      <input
        type="checkbox"
        checked={selected}
        onChange={onToggle}
        className="h-4 w-4 shrink-0 cursor-pointer accent-[var(--color-ink)]"
        aria-label="选择"
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
            {p.noImage && <Badge tone="red">无图</Badge>}
            {p.lacksShowcase && <Badge tone="amber">缺展示</Badge>}
            {p.translatedCount === 0 ? (
              <Badge tone="amber">未译</Badge>
            ) : p.stale ? (
              <Badge tone="amber">译文过期</Badge>
            ) : (
              <Badge tone="muted">译 {p.translatedCount}</Badge>
            )}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-3 text-sm text-[var(--color-ink-muted)]">
          <span className="hidden font-mono sm:inline" title="近 30 天扫码">
            {p.scans30d} 扫
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
            {relTime(p.updatedAt)}
          </span>
          <ChevronRight className="h-4 w-4" />
        </div>
      </Link>
    </li>
  );
}

function Badge({
  tone,
  children,
}: {
  tone: "red" | "amber" | "muted";
  children: React.ReactNode;
}) {
  const cls =
    tone === "red"
      ? "bg-red-50 text-red-600"
      : tone === "amber"
        ? "bg-amber-50 text-amber-700"
        : "bg-[var(--color-surface-sunken)] text-[var(--color-ink-faint)]";
  return (
    <span className={`rounded-full px-1.5 py-0.5 text-sm font-medium leading-none ${cls}`}>
      {children}
    </span>
  );
}
