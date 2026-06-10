import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import { getActiveFactory } from "@/lib/active-factory";
import { getAdminLocale } from "@/lib/admin-locale";
import {
  parseHighlights,
  parseApplications,
  parseDetailBlocks,
  parseContentI18n,
  contentSourceHash,
  localizedProductName,
} from "@/lib/products";
import { routing, LOCALE_LABELS, type AppLocale } from "@/i18n/routing";

export const dynamic = "force-dynamic";

// 目标译文语言数（全部语言去掉源语言）
const TARGET_LANGS = routing.locales.length - 1;

function dateKey(d: Date) {
  return d.toISOString().slice(0, 10);
}

export default async function AdminAnalyticsPage() {
  const factory = await getActiveFactory();
  const locale = await getAdminLocale();
  const t = await getTranslations({ locale, namespace: "admin.page" });
  const a = await getTranslations({ locale, namespace: "more" });

  // Intentional: page is `force-dynamic`, every render must use current time.
  // eslint-disable-next-line react-hooks/purity
  const now = Date.now();
  const since = new Date(now - 30 * 86400 * 1000);
  const today = new Date(now);

  const products = factory
    ? await prisma.product.findMany({
        where: { factoryId: factory.id },
        select: {
          id: true,
          modelNumber: true,
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
          translationStamp: true,
        },
      })
    : [];
  const productIds = products.map((p) => p.id);
  const productById = new Map(products.map((p) => [p.id, p]));
  // 显示名按后台语言取译名（不动 p.name 源字段——contentSourceHash 用它算指纹）
  const dispName = (p: { name: string; contentI18n: unknown }) =>
    localizedProductName(p.name, p.contentI18n, locale);

  // 内容覆盖度：每个产品是否有展示内容、译文是否齐全 / 过期
  const coverage = products.map((p) => {
    const hasShowcase =
      parseHighlights(p.highlights).length > 0 ||
      parseApplications(p.applications).length > 0 ||
      parseDetailBlocks(p.detailBlocks).length > 0;
    const transCount = Object.keys(parseContentI18n(p.contentI18n)).length;
    const stale =
      transCount > 0 &&
      !!p.translationStamp &&
      contentSourceHash(p) !== p.translationStamp;
    return { p, hasShowcase, transCount, stale };
  });
  const covFull = coverage.filter(
    (c) => c.hasShowcase && c.transCount >= TARGET_LANGS && !c.stale
  ).length;
  const covNoShowcase = coverage.filter((c) => !c.hasShowcase).length;
  const attention = coverage.filter(
    (c) => !c.hasShowcase || c.transCount < TARGET_LANGS || c.stale
  );

  const scans =
    productIds.length > 0
      ? await prisma.scanLog.findMany({
          where: {
            productId: { in: productIds },
            scannedAt: { gte: since },
          },
          select: {
            productId: true,
            scannedAt: true,
            source: true,
            locale: true,
            country: true,
          },
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

  // 按语言分布
  const perLocale = new Map<string, number>();
  for (const s of scans) {
    const k = s.locale ?? "__unknown";
    perLocale.set(k, (perLocale.get(k) ?? 0) + 1);
  }
  const localeRows = [...perLocale.entries()].sort((a, b) => b[1] - a[1]);

  // 按地区（国家）分布
  const perCountry = new Map<string, number>();
  for (const s of scans) {
    const k = s.country ?? "__unknown";
    perCountry.set(k, (perCountry.get(k) ?? 0) + 1);
  }
  const countryRows = [...perCountry.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8);

  const localeLabel = (k: string) =>
    k === "__unknown"
      ? a("anaUnknown")
      : (LOCALE_LABELS[k as AppLocale] ?? k);

  const activeProducts = perProduct.size;

  return (
    <div>
      <div>
        <h1 className="headline-lg text-[26px] text-[var(--color-ink)]">
          {t("analytics")}
        </h1>
        <p className="mt-1 text-sm text-[var(--color-ink-muted)]">
          {factory ? (
            <>
              <span className="font-medium text-[var(--color-ink)]">
                {factory.name}
              </span>
              {" · "}
              {a("anaRange", { a: dateKey(since), b: dateKey(today) })}
            </>
          ) : (
            a("anaNoFactory")
          )}
        </p>
      </div>

      {/* 内容覆盖度（与扫码量无关，始终展示） */}
      {factory && products.length > 0 && (
        <section className="mt-8 rounded-2xl border border-[var(--color-rule)] bg-[var(--color-surface)] p-6">
          <div className="flex items-baseline justify-between border-b border-[var(--color-rule)] pb-3">
            <p className="font-mono text-[10px] font-medium uppercase tracking-[0.22em] text-[var(--color-ink)]">
              {a("anaCoverage")}
            </p>
            <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-[var(--color-ink-muted)]">
              {a("anaTarget", { n: TARGET_LANGS })}
            </p>
          </div>

          <div className="mt-5 grid grid-cols-2 gap-6 sm:grid-cols-4">
            <Stat label={a("anaProducts")} value={products.length} />
            <Stat label={a("anaReady")} value={covFull} />
            <Stat label={a("anaNoShowcase")} value={covNoShowcase} />
            <Stat label={a("anaTodo")} value={attention.length} />
          </div>

          {attention.length === 0 ? (
            <p className="mt-5 text-sm text-[var(--color-ink-muted)]">
              {a("anaAllGood")}
            </p>
          ) : (
            <div className="mt-5">
              <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--color-ink-muted)]">
                {a("anaTodoList", { n: attention.length })}
              </p>
              <div className="mt-3 space-y-1">
                {attention.slice(0, 12).map(({ p, hasShowcase, transCount, stale }) => (
                  <Link
                    key={p.id}
                    href={`/admin/products/${p.id}`}
                    className="group flex items-center gap-3 rounded-lg px-2 py-2 transition hover:bg-[var(--color-surface-sunken)]"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm text-[var(--color-ink)]">
                        {dispName(p)}
                      </p>
                      <p className="truncate font-mono text-[11px] text-[var(--color-ink-muted)]">
                        {p.modelNumber}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-1.5">
                      {!hasShowcase && <Tag tone="bad">{a("anaNoShowcase")}</Tag>}
                      {hasShowcase && transCount < TARGET_LANGS && (
                        <Tag tone="warn">{a("anaTransN", { a: transCount, b: TARGET_LANGS })}</Tag>
                      )}
                      {stale && <Tag tone="warn">{a("anaStale")}</Tag>}
                    </div>
                    <ChevronRight className="h-3.5 w-3.5 shrink-0 text-[var(--color-ink-faint)] transition group-hover:text-[var(--color-ink-muted)]" />
                  </Link>
                ))}
                {attention.length > 12 && (
                  <p className="px-2 pt-1 font-mono text-[11px] text-[var(--color-ink-muted)]">
                    {a("anaMore", { n: attention.length - 12 })}
                  </p>
                )}
              </div>
            </div>
          )}
        </section>
      )}

      {totalScans === 0 ? (
        <div className="mt-10 rounded-2xl border border-dashed border-[var(--color-rule)] py-20 text-center">
          <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-[var(--color-ink-muted)]">
            {a("anaNoScansTitle")}
          </p>
          <p className="mt-3 text-sm text-[var(--color-ink-soft)]">
            {a("anaNoScans")}
          </p>
        </div>
      ) : (
        <>
          {/* 总览 + 趋势 */}
          <section className="mt-8 rounded-2xl border border-[var(--color-rule)] bg-[var(--color-surface)] p-6">
            <div className="flex items-baseline justify-between border-b border-[var(--color-rule)] pb-3">
              <p className="font-mono text-[10px] font-medium uppercase tracking-[0.22em] text-[var(--color-ink)]">
                {a("anaOverview")}
              </p>
              <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-[var(--color-ink-muted)]">
                {a("anaPeak")} · {maxDay}
              </p>
            </div>

            <div className="mt-5 grid grid-cols-2 gap-6 sm:grid-cols-4">
              <Stat label={a("anaTotalScans")} value={totalScans} />
              <Stat label={a("anaPdf")} value={pdfDownloads} />
              <Stat label={a("anaConv")} value={pdfConv} suffix="%" />
              <Stat label={a("anaActiveProd")} value={activeProducts} />
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
                <span>{a("anaDaysAgo")}</span>
                <span>{a("anaTodayLabel")}</span>
              </div>
            </div>
          </section>

          <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
            {/* TOP 产品 */}
            <section className="rounded-2xl border border-[var(--color-rule)] bg-[var(--color-surface)] p-6">
              <p className="font-mono text-[10px] font-medium uppercase tracking-[0.22em] text-[var(--color-ink)]">
                {a("anaTopProd")}
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
                          {dispName(p)}
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
                {a("anaBySource")}
              </p>
              <div className="mt-4 space-y-3">
                {sourceRows.map(([key, n]) => {
                  const label =
                    key === "__direct" ? a("anaDirect") : key;
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

            {/* 语言分布 */}
            <section className="rounded-2xl border border-[var(--color-rule)] bg-[var(--color-surface)] p-6">
              <p className="font-mono text-[10px] font-medium uppercase tracking-[0.22em] text-[var(--color-ink)]">
                {a("anaByLang")}
              </p>
              <div className="mt-4 space-y-3">
                {localeRows.map(([key, n]) => {
                  const pct = Math.round((n / totalScans) * 100);
                  return (
                    <div key={key} className="flex items-center gap-3">
                      <span className="w-36 shrink-0 truncate font-mono text-xs text-[var(--color-ink)]">
                        {localeLabel(key)}
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

            {/* 地区分布 */}
            <section className="rounded-2xl border border-[var(--color-rule)] bg-[var(--color-surface)] p-6">
              <p className="font-mono text-[10px] font-medium uppercase tracking-[0.22em] text-[var(--color-ink)]">
                {a("anaByRegion")}
              </p>
              <div className="mt-4 space-y-3">
                {countryRows.map(([key, n]) => {
                  const pct = Math.round((n / totalScans) * 100);
                  return (
                    <div key={key} className="flex items-center gap-3">
                      <span className="w-36 shrink-0 truncate font-mono text-xs text-[var(--color-ink)]">
                        {key === "__unknown" ? a("anaUnknown") : key}
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

function Tag({
  children,
  tone,
}: {
  children: React.ReactNode;
  tone: "bad" | "warn";
}) {
  const cls =
    tone === "bad"
      ? "bg-[#fdecec] text-[#b4232a]"
      : "bg-amber-50 text-amber-700";
  return (
    <span
      className={`rounded-full px-2 py-0.5 font-mono text-[10px] tracking-[0.04em] ${cls}`}
    >
      {children}
    </span>
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
