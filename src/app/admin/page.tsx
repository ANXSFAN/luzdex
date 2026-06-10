import Link from "next/link";
import { ChevronRight, ScanLine, FileDown, Package, Languages } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import { getActiveFactory } from "@/lib/active-factory";
import { getAdminLocale } from "@/lib/admin-locale";
import { productReadiness, localizedProductName } from "@/lib/products";

export const dynamic = "force-dynamic";

export default async function AdminDashboardPage() {
  const factory = await getActiveFactory();
  const locale = await getAdminLocale();
  const t = await getTranslations({ locale, namespace: "admin" });

  if (!factory) {
    return (
      <div>
        <h1 className="headline-lg text-[26px] text-[var(--color-ink)]">{t("page.dashboard")}</h1>
        <div className="mt-12 rounded-2xl border border-dashed border-[var(--color-rule)] py-16 text-center">
          <p className="text-sm text-[var(--color-ink-muted)]">
            {t("common.noFactory")}
          </p>
        </div>
      </div>
    );
  }

  // Intentional: force-dynamic page, current time each render.
  // eslint-disable-next-line react-hooks/purity
  const now = Date.now();
  const since = new Date(now - 30 * 86400 * 1000);
  const todayStart = new Date(new Date(now).toISOString().slice(0, 10));
  const scanWhere = { product: { factoryId: factory.id } };

  const [products, scans30d, scansToday, pdf30d, topScans] = await Promise.all([
    prisma.product.findMany({
      where: { factoryId: factory.id },
      select: {
        id: true,
        name: true,
        coverImage: true,
        highlights: true,
        applications: true,
        detailBlocks: true,
        contentI18n: true,
        translationStamp: true,
        description: true,
        tagline: true,
        faq: true,
        boxContents: true,
        install: true,
        dimensions: true,
        specs: true,
        sourceLocale: true,
        _count: { select: { images: true } },
      },
    }),
    prisma.scanLog.count({ where: { ...scanWhere, scannedAt: { gte: since } } }),
    prisma.scanLog.count({
      where: { ...scanWhere, scannedAt: { gte: todayStart } },
    }),
    prisma.pdfDownload.count({
      where: { product: { factoryId: factory.id }, downloadedAt: { gte: since } },
    }),
    prisma.scanLog.groupBy({
      by: ["productId"],
      where: { ...scanWhere, scannedAt: { gte: since } },
      _count: { _all: true },
      orderBy: { _count: { productId: "desc" } },
      take: 5,
    }),
  ]);

  let noImage = 0;
  let lacksShowcase = 0;
  let untranslated = 0;
  let stale = 0;
  for (const p of products) {
    const r = productReadiness({ ...p, imageCount: p._count.images });
    if (r.noImage) noImage++;
    if (r.lacksShowcase) lacksShowcase++;
    if (r.translatedCount === 0) untranslated++;
    else if (r.stale) stale++;
  }

  const nameById = new Map(
    products.map((p) => [p.id, localizedProductName(p.name, p.contentI18n, locale)])
  );
  const top = topScans
    .map((g) => ({ id: g.productId, name: nameById.get(g.productId) ?? "—", scans: g._count._all }))
    .filter((t) => t.scans > 0);

  return (
    <div>
      <div className="flex items-baseline justify-between">
        <div>
          <h1 className="headline-lg text-[26px] text-[var(--color-ink)]">{t("page.dashboard")}</h1>
          <p className="mt-1 text-sm text-[var(--color-ink-muted)]">
            <span className="font-medium text-[var(--color-ink)]">{factory.name}</span>
            {" · "}
            {t("dashboard.last30")}
          </p>
        </div>
        <Link
          href="/admin/products"
          className="flex items-center gap-1 text-sm text-[var(--color-ink-muted)] transition hover:text-[var(--color-ink)]"
        >
          {t("dashboard.manageProducts")} <ChevronRight className="h-3.5 w-3.5" />
        </Link>
      </div>

      {/* KPI */}
      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Kpi
          icon={<Package className="h-4 w-4" />}
          label={t("dashboard.kpiProducts")}
          value={products.length}
          href="/admin/products"
        />
        <Kpi
          icon={<ScanLine className="h-4 w-4" />}
          label={t("dashboard.kpiToday")}
          value={scansToday}
          href="/admin/analytics"
        />
        <Kpi
          icon={<ScanLine className="h-4 w-4" />}
          label={t("dashboard.kpiScans30")}
          value={scans30d}
          href="/admin/analytics"
        />
        <Kpi
          icon={<FileDown className="h-4 w-4" />}
          label={t("dashboard.kpiPdf30")}
          value={pdf30d}
          href="/admin/analytics"
        />
      </div>

      {/* 内容就绪 */}
      <section className="mt-8">
        <div className="flex items-baseline justify-between">
          <h2 className="font-mono text-sm font-medium uppercase tracking-[0.22em] text-[var(--color-ink-muted)]">
            {t("dashboard.readyTitle")}
          </h2>
          <Link
            href="/admin/products"
            className="text-sm text-[var(--color-ink-muted)] underline-offset-2 hover:underline"
          >
            {t("dashboard.goFix")}
          </Link>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Ready label={t("dashboard.noImage")} value={noImage} tone="red" need="noimage" />
          <Ready label={t("dashboard.noShowcase")} value={lacksShowcase} tone="amber" need="noshowcase" />
          <Ready label={t("dashboard.untranslated")} value={untranslated} tone="amber" need="untranslated" />
          <Ready label={t("dashboard.stale")} value={stale} tone="amber" need="stale" />
        </div>
      </section>

      {/* 热门产品 */}
      <section className="mt-8">
        <div className="flex items-baseline justify-between">
          <h2 className="font-mono text-sm font-medium uppercase tracking-[0.22em] text-[var(--color-ink-muted)]">
            {t("dashboard.hotTitle")}
          </h2>
          <Link
            href="/admin/analytics"
            className="text-sm text-[var(--color-ink-muted)] underline-offset-2 hover:underline"
          >
            {t("dashboard.fullData")}
          </Link>
        </div>
        {top.length === 0 ? (
          <p className="mt-3 text-sm text-[var(--color-ink-faint)]">{t("dashboard.noScans")}</p>
        ) : (
          <ul className="mt-3 space-y-1">
            {top.map((tp, i) => (
              <li key={tp.id}>
                <Link
                  href={`/admin/products/${tp.id}`}
                  className="doc-row flex items-center justify-between gap-4 px-4 py-3"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="w-4 shrink-0 font-mono text-sm text-[var(--color-ink-faint)]">
                      {i + 1}
                    </span>
                    <span className="truncate text-sm font-medium text-[var(--color-ink)]">
                      {tp.name}
                    </span>
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    <span className="font-mono text-sm text-[var(--color-ink-muted)]">
                      {tp.scans} {t("dashboard.scans")}
                    </span>
                    <ChevronRight className="h-4 w-4 text-[var(--color-ink-muted)]" />
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* 多语言概览 */}
      <section className="mt-8 flex items-center gap-2 rounded-xl border border-[var(--color-rule)] bg-[var(--color-surface)] px-4 py-3 text-sm text-[var(--color-ink-muted)]">
        <Languages className="h-4 w-4 shrink-0" />
        <span>
          {t("dashboard.langReady")}{" "}
          <span className="font-medium text-[var(--color-ink)]">
            {products.length - untranslated - stale}
          </span>{" "}
          / {products.length} · {t("dashboard.langPending")}{" "}
          <span className="font-medium text-[var(--color-ink)]">{untranslated + stale}</span>
        </span>
      </section>
    </div>
  );
}

function Kpi({
  icon,
  label,
  value,
  href,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  href?: string;
}) {
  const inner = (
    <>
      <div className="flex items-center gap-1.5 text-[var(--color-ink-muted)]">
        {icon}
        <span className="font-mono text-sm font-medium uppercase tracking-[0.18em]">
          {label}
        </span>
      </div>
      <p className="mt-2 font-mono text-[28px] font-medium tabular-nums leading-none text-[var(--color-ink)]">
        {value}
      </p>
    </>
  );
  const cls =
    "block rounded-2xl border border-[var(--color-rule)] bg-[var(--color-surface)] p-4";
  return href ? (
    <Link href={href} className={`${cls} transition hover:border-[var(--color-ink)]`}>
      {inner}
    </Link>
  ) : (
    <div className={cls}>{inner}</div>
  );
}

function Ready({
  label,
  value,
  tone,
  need,
}: {
  label: string;
  value: number;
  tone: "red" | "amber";
  need: string;
}) {
  const ok = value === 0;
  const valueCls = ok
    ? "text-[var(--color-ink-faint)]"
    : tone === "red"
      ? "text-red-600"
      : "text-amber-700";
  return (
    <Link
      href={`/admin/products?need=${need}`}
      className="rounded-2xl border border-[var(--color-rule)] bg-[var(--color-surface)] p-4 transition hover:border-[var(--color-ink)]"
    >
      <p className="font-mono text-sm font-medium uppercase tracking-[0.18em] text-[var(--color-ink-muted)]">
        {label}
      </p>
      <p className={`mt-2 font-mono text-[28px] font-medium tabular-nums leading-none ${valueCls}`}>
        {value}
      </p>
    </Link>
  );
}
