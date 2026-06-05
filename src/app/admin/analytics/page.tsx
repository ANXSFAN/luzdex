import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { getActiveFactory } from "@/lib/active-factory";

export const dynamic = "force-dynamic";

function dateKey(d: Date) {
  return d.toISOString().slice(0, 10);
}

export default async function AdminAnalyticsPage() {
  const factory = await getActiveFactory();

  // Intentional: page is `force-dynamic`, every render must use current time.
  // eslint-disable-next-line react-hooks/purity
  const now = Date.now();
  const since = new Date(now - 30 * 86400 * 1000);
  const today = new Date(now);

  const products = factory
    ? await prisma.product.findMany({
        where: { factoryId: factory.id },
        select: { id: true, modelNumber: true, name: true },
      })
    : [];
  const productIds = products.map((p) => p.id);
  const productById = new Map(products.map((p) => [p.id, p]));

  const scans =
    productIds.length > 0
      ? await prisma.scanLog.findMany({
          where: {
            productId: { in: productIds },
            scannedAt: { gte: since },
          },
          select: { productId: true, scannedAt: true, source: true },
        })
      : [];

  const pdfDownloads =
    productIds.length > 0
      ? await prisma.pdfDownload.count({
          where: {
            productId: { in: productIds },
            downloadedAt: { gte: since },
          },
        })
      : 0;

  const totalScans = scans.length;
  const pdfConv =
    totalScans > 0 ? Math.round((pdfDownloads / totalScans) * 100) : 0;

  // 30-day sparkline buckets, days[29] = today
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

  // TOP 产品（按扫码数）
  const perProduct = new Map<string, number>();
  for (const s of scans) {
    perProduct.set(s.productId, (perProduct.get(s.productId) ?? 0) + 1);
  }
  const topProducts = [...perProduct.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([pid, n]) => ({ product: productById.get(pid), count: n }))
    .filter((r) => r.product);

  // 渠道分布汇总（全店）
  const perSource = new Map<string, number>();
  for (const s of scans) {
    const k = s.source ?? "__direct";
    perSource.set(k, (perSource.get(k) ?? 0) + 1);
  }
  const sourceRows = [...perSource.entries()].sort((a, b) => b[1] - a[1]);

  const activeProducts = perProduct.size;

  return (
    <div>
      <div>
        <h1 className="headline-lg text-[26px] text-[var(--color-ink)]">
          运营数据
        </h1>
        <p className="mt-1 text-sm text-[var(--color-ink-muted)]">
          {factory ? (
            <>
              <span className="font-medium text-[var(--color-ink)]">
                {factory.name}
              </span>
              {" · "}近 30 天 · {dateKey(since)} → {dateKey(today)}
            </>
          ) : (
            "未找到工厂记录，请先运行 db:seed"
          )}
        </p>
      </div>

      {totalScans === 0 ? (
        <div className="mt-10 rounded-2xl border border-dashed border-[var(--color-rule)] py-20 text-center">
          <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-[var(--color-ink-muted)]">
            No scans yet
          </p>
          <p className="mt-3 text-sm text-[var(--color-ink-soft)]">
            近 30 天还没有扫码记录。导出带渠道码的二维码贴到产品 / 包装上即可开始统计。
          </p>
        </div>
      ) : (
        <>
          {/* 总览 + 趋势 */}
          <section className="mt-8 rounded-2xl border border-[var(--color-rule)] bg-[var(--color-surface)] p-6">
            <div className="flex items-baseline justify-between border-b border-[var(--color-rule)] pb-3">
              <p className="font-mono text-[10px] font-medium uppercase tracking-[0.22em] text-[var(--color-ink)]">
                Overview · 30 days
              </p>
              <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-[var(--color-ink-muted)]">
                Peak day · {maxDay}
              </p>
            </div>

            <div className="mt-5 grid grid-cols-2 gap-6 sm:grid-cols-4">
              <Stat label="Scans · 总扫码" value={totalScans} />
              <Stat label="PDF · 下载" value={pdfDownloads} />
              <Stat label="Conv · 下载转化" value={pdfConv} suffix="%" />
              <Stat label="Products · 被扫产品" value={activeProducts} />
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
                <span>Today</span>
              </div>
            </div>
          </section>

          <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
            {/* TOP 产品 */}
            <section className="rounded-2xl border border-[var(--color-rule)] bg-[var(--color-surface)] p-6">
              <p className="font-mono text-[10px] font-medium uppercase tracking-[0.22em] text-[var(--color-ink)]">
                Top products · 热门产品
              </p>
              <div className="mt-4 space-y-1">
                {topProducts.map(({ product, count }, idx) => {
                  const p = product!;
                  const pct = Math.round((count / totalScans) * 100);
                  return (
                    <Link
                      key={p.id}
                      href={`/admin/products/${p.id}`}
                      className="group flex items-center gap-3 rounded-lg px-2 py-2 transition hover:bg-[var(--color-surface-sunken)]"
                    >
                      <span className="w-5 shrink-0 font-mono text-xs text-[var(--color-ink-faint)]">
                        {idx + 1}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm text-[var(--color-ink)]">
                          {p.name}
                        </p>
                        <p className="truncate font-mono text-[11px] text-[var(--color-ink-muted)]">
                          {p.modelNumber}
                        </p>
                      </div>
                      <span className="shrink-0 font-mono text-xs text-[var(--color-ink)]">
                        {count}
                        <span className="ml-1 text-[var(--color-ink-faint)]">
                          · {pct}%
                        </span>
                      </span>
                      <ChevronRight className="h-3.5 w-3.5 shrink-0 text-[var(--color-ink-faint)] transition group-hover:text-[var(--color-ink-muted)]" />
                    </Link>
                  );
                })}
              </div>
            </section>

            {/* 渠道分布 */}
            <section className="rounded-2xl border border-[var(--color-rule)] bg-[var(--color-surface)] p-6">
              <p className="font-mono text-[10px] font-medium uppercase tracking-[0.22em] text-[var(--color-ink)]">
                By source · 来源渠道
              </p>
              <div className="mt-4 space-y-3">
                {sourceRows.map(([key, n]) => {
                  const label =
                    key === "__direct" ? "直接访问 / 无渠道码" : key;
                  const pct = Math.round((n / totalScans) * 100);
                  return (
                    <div key={key} className="flex items-center gap-3">
                      <span className="w-36 shrink-0 truncate font-mono text-xs text-[var(--color-ink)]">
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
            </section>
          </div>
        </>
      )}
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
      <p className="font-mono text-[28px] leading-none text-[var(--color-ink)]">
        {value}
        {suffix}
      </p>
      <p className="mt-2 font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--color-ink-muted)]">
        {label}
      </p>
    </div>
  );
}
