import { notFound } from "next/navigation";
import Link from "next/link";
import { ChevronLeft, ExternalLink } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { siteUrl, parseAttributes } from "@/lib/products";
import { suggestAccessories } from "@/lib/matching";
import { QrCard } from "@/components/qr-card";
import { MaterialManager } from "@/components/material-manager";
import { ProductRelations } from "@/components/product-relations";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ id: string }>;
}

function dateKey(d: Date) {
  return d.toISOString().slice(0, 10);
}

export default async function ProductMaterialsPage({ params }: PageProps) {
  const { id } = await params;

  // Intentional: page is `force-dynamic`, every render must use current time.
  // eslint-disable-next-line react-hooks/purity
  const now = Date.now();
  const since = new Date(now - 30 * 86400 * 1000);
  const today = new Date(now);

  const [product, scans, pdfDownloads] = await Promise.all([
    prisma.product.findUnique({
      where: { id },
      include: {
        documents: { orderBy: { sortOrder: "asc" } },
        videos: { orderBy: { sortOrder: "asc" } },
        linksOut: {
          orderBy: { sortOrder: "asc" },
          include: {
            to: {
              select: { id: true, modelNumber: true, name: true, category: true },
            },
          },
        },
      },
    }),
    prisma.scanLog.findMany({
      where: { productId: id, scannedAt: { gte: since } },
      select: { scannedAt: true, source: true },
    }),
    prisma.pdfDownload.count({
      where: { productId: id, downloadedAt: { gte: since } },
    }),
  ]);
  if (!product) notFound();

  // 配件关系 + 自动匹配建议（同工厂候选池）
  const candidates = await prisma.product.findMany({
    where: { factoryId: product.factoryId, id: { not: product.id } },
    select: { id: true, modelNumber: true, name: true, category: true, attributes: true },
    orderBy: { name: "asc" },
  });
  const attrs = parseAttributes(product.attributes);
  const links = product.linksOut.map((l) => ({
    linkId: l.id,
    toId: l.toId,
    relation: l.relation,
    modelNumber: l.to.modelNumber,
    name: l.to.name,
    category: l.to.category,
  }));
  const excludeIds = new Set<string>([product.id, ...links.map((l) => l.toId)]);
  const suggestions = suggestAccessories(
    { category: product.category, attributes: attrs },
    candidates.map((c) => ({
      id: c.id,
      modelNumber: c.modelNumber,
      name: c.name,
      category: c.category,
      attributes: parseAttributes(c.attributes),
    })),
    excludeIds,
  );

  const datasheetUrl = `${siteUrl()}/p/${product.slug}`;

  // 30-day buckets, days[29] = today
  const buckets = new Map<string, number>();
  for (const s of scans) {
    const k = dateKey(s.scannedAt);
    buckets.set(k, (buckets.get(k) ?? 0) + 1);
  }
  const days: number[] = [];
  for (let i = 29; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    days.push(buckets.get(dateKey(d)) ?? 0);
  }
  const maxDay = Math.max(1, ...days);
  const totalScans = scans.length;

  // 来源渠道分布（30 天）。source 为 null 记为「直接访问 / 无渠道码」。
  const sourceCounts = new Map<string, number>();
  for (const s of scans) {
    const k = s.source ?? "__direct";
    sourceCounts.set(k, (sourceCounts.get(k) ?? 0) + 1);
  }
  const sourceRows = [...sourceCounts.entries()].sort((a, b) => b[1] - a[1]);

  const pdfConv =
    totalScans > 0 ? Math.round((pdfDownloads / totalScans) * 100) : 0;

  return (
    <div>
      <Link
        href="/admin"
        className="flex w-fit items-center gap-1 text-xs text-[var(--color-ink-muted)] transition hover:text-[var(--color-ink)]"
      >
        <ChevronLeft className="h-3.5 w-3.5" />
        返回产品列表
      </Link>

      <div className="mt-4 flex items-start justify-between gap-4">
        <div>
          <h1 className="headline-lg text-[26px] text-[var(--color-ink)]">{product.name}</h1>
          <p className="mt-1 font-mono text-sm text-[var(--color-ink-muted)]">
            {product.modelNumber}
          </p>
        </div>
        <a
          href={datasheetUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex shrink-0 items-center gap-1.5 text-xs text-[var(--color-ink-muted)] transition hover:text-[var(--color-ink)]"
        >
          预览公开页
          <ExternalLink className="h-3.5 w-3.5" />
        </a>
      </div>

      {/* Analytics — 30-day overview */}
      <section className="mt-8 rounded-2xl border border-[var(--color-rule)] bg-[var(--color-surface)] p-6">
        <div className="flex items-baseline justify-between border-b border-[var(--color-rule)] pb-3">
          <p className="font-mono text-[10px] font-medium uppercase tracking-[0.22em] text-[var(--color-ink)]">
            Analytics · 30 days
          </p>
          <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-[var(--color-ink-muted)]">
            {dateKey(since)} → {dateKey(today)}
          </p>
        </div>

        <div className="mt-5 grid grid-cols-3 gap-6">
          <Stat label="Scans · 扫码" value={totalScans} />
          <Stat label="PDF · 下载" value={pdfDownloads} />
          <Stat label="Conv · 下载转化" value={pdfConv} suffix="%" />
        </div>

        <div className="mt-6">
          <div className="flex items-end gap-[3px]" style={{ height: 64 }}>
            {days.map((n, i) => {
              const ratio = n / maxDay;
              const heightPct = n === 0 ? 2 : Math.max(6, ratio * 100);
              const isToday = i === 29;
              return (
                <div
                  key={i}
                  title={`-${29 - i}d · ${n}`}
                  className="flex-1"
                  style={{
                    height: `${heightPct}%`,
                    backgroundColor: isToday
                      ? "var(--color-ink)"
                      : n === 0
                        ? "var(--color-rule)"
                        : "var(--color-ink-faint)",
                    minWidth: 3,
                    borderRadius: 3,
                  }}
                />
              );
            })}
          </div>
          <div className="mt-2 flex items-baseline justify-between font-mono text-[10px] uppercase tracking-[0.22em] text-[var(--color-ink-muted)]">
            <span>30 days ago</span>
            <span>
              Peak day · {maxDay} {maxDay === 1 ? "scan" : "scans"}
            </span>
            <span>Today</span>
          </div>
        </div>

        {totalScans > 0 && (
          <div className="mt-6 border-t border-[var(--color-rule)] pt-5">
            <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-[var(--color-ink-muted)]">
              By source · 来源渠道
            </p>
            <div className="mt-3 space-y-2">
              {sourceRows.map(([key, n]) => {
                const label =
                  key === "__direct" ? "直接访问 / 无渠道码" : key;
                const pct = Math.round((n / totalScans) * 100);
                return (
                  <div key={key} className="flex items-center gap-3">
                    <span className="w-40 shrink-0 truncate font-mono text-xs text-[var(--color-ink)]">
                      {label}
                    </span>
                    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-[var(--color-surface-sunken)]">
                      <div
                        className="h-full rounded-full bg-[var(--color-ink-faint)]"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span className="w-16 shrink-0 text-right font-mono text-xs text-[var(--color-ink-muted)]">
                      {n} · {pct}%
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </section>

      <div className="mt-6">
        <QrCard url={datasheetUrl} fileBase={product.modelNumber} />
      </div>

      <ProductRelations
        productId={product.id}
        category={product.category}
        series={product.series}
        attributes={attrs}
        links={links}
        suggestions={suggestions}
        candidateModels={candidates.map((c) => c.modelNumber)}
      />

      <MaterialManager
        productId={product.id}
        documents={product.documents}
        videos={product.videos}
      />
    </div>
  );
}

function Stat({
  label,
  value,
  suffix,
}: {
  label: string;
  value: number;
  suffix?: string;
}) {
  return (
    <div>
      <p className="font-mono text-[10px] font-medium uppercase tracking-[0.22em] text-[var(--color-ink-muted)]">
        {label}
      </p>
      <p className="mt-1 font-mono text-[28px] font-medium tabular-nums leading-none text-[var(--color-ink)]">
        {value}
        {suffix}
      </p>
    </div>
  );
}
