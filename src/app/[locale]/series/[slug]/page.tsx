import { Fragment } from "react";
import { notFound } from "next/navigation";
import Link from "next/link";
import {
  ShieldCheck,
  Droplets,
  Zap,
  Clock,
  Award,
  Sun,
  Thermometer,
  Ruler,
  Gauge,
  Lightbulb,
  BatteryCharging,
  Circle,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { Metadata, Viewport } from "next";
import { hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import {
  findSeriesPage,
  buildVariantMatrix,
  siteUrl,
  type SeriesProduct,
  type ProductHighlight,
} from "@/lib/products";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { ScrollReveal } from "@/components/motion/scroll-reveal";
import { routing, type AppLocale } from "@/i18n/routing";
import { getPathname } from "@/i18n/navigation";
import { renderMarkdown, stripMarkdown } from "@/lib/md";
import { LuzHubMark } from "@/components/luzhub-mark";

interface PageProps {
  params: Promise<{ locale: string; slug: string }>;
}

const KNOWN_CATS = new Set([
  "strip",
  "channel",
  "power",
  "connector",
  "accessory",
]);

// 亮点图标白名单 → lucide（与产品页一致）。未知回退圆点。
const HL_ICONS: Record<string, LucideIcon> = {
  shield: ShieldCheck,
  droplet: Droplets,
  zap: Zap,
  clock: Clock,
  award: Award,
  sun: Sun,
  temp: Thermometer,
  ruler: Ruler,
  gauge: Gauge,
  bulb: Lightbulb,
  battery: BatteryCharging,
  dot: Circle,
};

export async function generateViewport({
  params,
}: PageProps): Promise<Viewport> {
  const { slug } = await params;
  const row = await prisma.series.findFirst({
    where: { slug },
    select: { factory: { select: { accentColor: true } } },
  });
  return { themeColor: row?.factory?.accentColor ?? "#1d1d1f" };
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { locale, slug } = await params;
  const series = await findSeriesPage(slug, locale);
  if (!series) return { title: "Series not found" };
  // 纯展示定位：标题只留系列名，不带任何工厂 / 品牌信息。
  const title = series.name;
  const description =
    stripMarkdown(series.intro).slice(0, 200) || undefined;
  // 分享卡图片：系列主视觉优先，无则取系列内第一张产品封面。
  const image =
    series.coverImage ??
    series.products.find((p) => p.coverImage)?.coverImage ??
    undefined;
  const localePrefix = locale === routing.defaultLocale ? "" : `/${locale}`;
  const url = `${siteUrl()}${localePrefix}/series/${series.slug}`;
  return {
    title,
    description,
    robots: { index: false, follow: false },
    openGraph: {
      title,
      description,
      url,
      type: "website",
      images: image ? [{ url: image }] : undefined,
    },
    twitter: {
      card: image ? "summary_large_image" : "summary",
      title,
      description,
    },
  };
}

export default async function SeriesPage({ params }: PageProps) {
  const { locale, slug } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);

  const series = await findSeriesPage(slug, locale);
  if (!series) notFound();

  const t = await getTranslations("product");
  const year = new Date().getFullYear();

  const tenantStyle = series.accentColor
    ? ({ "--color-accent": series.accentColor } as React.CSSProperties)
    : undefined;

  const heroImage =
    series.coverImage ??
    series.products.find((p) => p.coverImage)?.coverImage ??
    null;

  // 切换器只列有内容的语言（已含工厂源语言）+ 当前 locale。
  const availableLocales = new Set<string>([locale, ...series.translatedLocales]);
  const supportedLocales = routing.locales.filter((l) =>
    availableLocales.has(l)
  );

  const catLabel = (category: string | null) =>
    category && KNOWN_CATS.has(category)
      ? t(("related.cat." + category) as Parameters<typeof t>[0])
      : null;

  // 全系共性（真实聚合，守红线不瞎编）
  const catKeys = Array.from(
    new Set(series.products.map((p) => p.category).filter(Boolean))
  ) as string[];
  const coveredCats = catKeys.map((c) => catLabel(c)).filter(Boolean) as string[];
  const certLists = series.products.map((p) => p.certifications);
  const commonCerts =
    certLists.length > 0
      ? certLists.reduce((acc, cur) => acc.filter((c) => cur.includes(c)))
      : [];

  // Hero 一句话用纯文本（markdown 语法剥掉），理念区走富文本渲染。
  const introParas = stripMarkdown(series.intro ?? "")
    .split(/\n\s*\n/)
    .map((s) => s.trim())
    .filter(Boolean);
  const introRich = renderMarkdown(series.intro);

  // ── 对比矩阵：与产品页变体对比同一引擎——行 = 各款完整规格表的并集
  //    （保分组、保首现顺序），某款缺该项显示「—」，跨款取值不同的行标 differs。
  //    规格表远比卡片上的 4 个亮点全，这才是真正可选型的对比。
  const compareGroups = buildVariantMatrix(
    series.products.map((p) => ({
      id: p.id,
      slug: p.slug,
      modelNumber: p.modelNumber,
      variantLabel: null,
      specs: p.specs,
    }))
  );
  const specRowCount = compareGroups.reduce((n, g) => n + g.rows.length, 0);
  const anyCerts = series.products.some((p) => p.certifications.length > 0);
  const showCompare =
    series.products.length >= 2 && (specRowCount > 0 || anyCerts);

  const hasLineup = series.products.length > 0;

  return (
    <>
      {/* 全局头随页面滚走（Apple 产品族页行为），置顶交给下面的系列副导航。 */}
      <header className="border-b border-[var(--color-rule)] bg-[var(--color-surface)]">
        <div className="mx-auto flex h-12 max-w-[1240px] items-center justify-between px-5 sm:px-10">
          <Link
            href="/"
            className="flex items-center gap-2.5 transition hover:opacity-70"
          >
            <DatasheetMark />
            <span className="text-[14px] font-semibold tracking-tight text-[var(--color-ink)]">
              {t("header.datasheetTag")}
            </span>
          </Link>
          <LocaleSwitcher
            current={locale as AppLocale}
            supported={supportedLocales}
            slug={series.slug}
            basePath="/series"
          />
        </div>
      </header>

      {/* ── 局部副导航（Apple 产品族页的 ribbon）：钉在视口最顶，系列名 + 章节锚点 ── */}
      <nav className="glass-nav sticky top-0 z-20 border-b border-[var(--color-rule)]">
        <div className="mx-auto flex h-11 max-w-[1240px] items-center justify-between px-5 sm:px-10">
          <span className="truncate text-[14px] font-semibold tracking-tight text-[var(--color-ink)]">
            {series.name}
          </span>
          <div className="flex shrink-0 items-center gap-5 text-[12px] font-medium text-[var(--color-ink-soft)]">
            {hasLineup && (
              <a href="#lineup" className="transition hover:text-[var(--color-ink)]">
                {t("seriesPage.lineup")}
              </a>
            )}
            {showCompare && (
              <a href="#compare" className="transition hover:text-[var(--color-ink)]">
                {t("seriesPage.compare")}
              </a>
            )}
          </div>
        </div>
      </nav>

      <main
        className="relative mx-auto max-w-[1240px] px-5 pb-24 pt-6 sm:px-10 sm:pt-8"
        style={tenantStyle}
      >
        {/* ── Hero — 浅色居中开场（与全站一致），光谱条作照明签名 ── */}
        <section className="pt-10 text-center sm:pt-14 lg:pt-20">
          <p className="kicker justify-center rise-in" data-step="1">
            <span className="dot-filament" aria-hidden />
            <span>{t("seriesPage.kicker")}</span>
          </p>
          <h1
            className="headline-xl mx-auto mt-5 max-w-[16ch] text-[40px] leading-[1.04] text-[var(--color-ink)] sm:text-[56px] lg:text-[72px] rise-in"
            data-step="2"
          >
            {series.name}
          </h1>
          {introParas[0] && (
            <p
              className="mx-auto mt-6 max-w-[46ch] text-[17px] leading-[1.6] text-[var(--color-ink-soft)] sm:text-[19px] rise-in"
              data-step="3"
            >
              {introParas[0]}
            </p>
          )}
          <div className="spectrum-bar mx-auto mt-8 w-28 rise-in" data-step="4" />
          <p
            className="mt-5 font-mono text-[11px] uppercase tracking-[0.22em] text-[var(--color-ink-muted)] rise-in"
            data-step="5"
          >
            {t("seriesPage.count", { count: series.products.length })}
            {coveredCats.length > 0 && (
              <span className="text-[var(--color-ink-faint)]">
                {"  ·  " + coveredCats.join(" / ")}
              </span>
            )}
          </p>

          {heroImage && (
            <div className="mt-12 rise-in sm:mt-14" data-step="6">
              <div className="relative aspect-[16/10] w-full overflow-hidden rounded-3xl border border-[var(--color-rule)] bg-[var(--color-surface-sunken)] sm:aspect-[16/9]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={heroImage}
                  alt={series.name}
                  className="h-full w-full object-cover"
                />
              </div>
            </div>
          )}
        </section>

        {/* ── 系列理念 — 把系列想传达的东西讲清楚 ───────────── */}
        {(introParas.length > 0 || commonCerts.length > 0) && (
          <ScrollReveal>
            <section className="mt-20 grid grid-cols-1 gap-x-10 gap-y-10 border-t border-[var(--color-rule)] pt-12 lg:mt-28 lg:grid-cols-12 lg:pt-16">
              <div className="lg:col-span-4">
                <p className="kicker">
                  <span className="dot-filament" aria-hidden />
                  <span>{t("seriesPage.ethos")}</span>
                </p>

                {/* 全系速览：真实聚合数字 */}
                <dl className="mt-7 grid grid-cols-2 gap-x-6 gap-y-6">
                  <Stat
                    value={String(series.products.length).padStart(2, "0")}
                    label={t("seriesPage.products")}
                  />
                  {coveredCats.length > 0 && (
                    <Stat
                      value={String(coveredCats.length).padStart(2, "0")}
                      label={t("seriesPage.catsCovered")}
                    />
                  )}
                </dl>

                {commonCerts.length > 0 && (
                  <div className="mt-8">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--color-ink-muted)]">
                      {t("seriesPage.commonCerts")}
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {commonCerts.map((c) => (
                        <span
                          key={c}
                          className="inline-flex items-center rounded-full bg-[var(--color-surface-sunken)] px-3 py-1.5 font-mono text-[11px] font-medium uppercase tracking-[0.14em] text-[var(--color-ink)]"
                        >
                          {c}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="lg:col-span-7 lg:col-start-6">
                <div className="text-[18px] leading-[1.7] text-[var(--color-ink-soft)] sm:text-[21px] sm:leading-[1.65] [&>div]:space-y-5">
                  {introRich}
                </div>
              </div>
            </section>
          </ScrollReveal>
        )}

        {/* ── 产品阵容 — Apple「Explore the lineup」式卡片栅格 ── */}
        {hasLineup && (
          <section
            id="lineup"
            className="mt-24 scroll-mt-16 border-t border-[var(--color-rule)] pt-12 lg:mt-32 lg:pt-16"
          >
            <div className="flex items-baseline justify-between gap-4">
              <div>
                <p className="kicker">
                  <span className="dot-filament" aria-hidden />
                  <span>{t("seriesPage.lineup")}</span>
                </p>
                <h2 className="headline-lg mt-4 text-[28px] text-[var(--color-ink)] sm:text-[36px]">
                  {t("seriesPage.lineupSub")}
                </h2>
              </div>
              <span className="font-mono text-[11px] tabular-nums text-[var(--color-ink-muted)]">
                {String(series.products.length).padStart(2, "0")}
              </span>
            </div>

            <div
              className={
                "mt-10 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:mt-14" +
                (series.products.length >= 3 ? " lg:grid-cols-3" : "")
              }
            >
              {series.products.map((p) => (
                <LineupCard
                  key={p.id}
                  item={p}
                  locale={locale as AppLocale}
                  catLabel={catLabel(p.category)}
                  detailLabel={t("seriesPage.viewDetail")}
                />
              ))}
            </div>
          </section>
        )}

        {/* ── 型号对比 — Apple「Compare」式横向参数表（真实数据，缺则 —） ── */}
        {showCompare && (
          <ScrollReveal>
            <section
              id="compare"
              className="mt-24 scroll-mt-16 border-t border-[var(--color-rule)] pt-12 lg:mt-32 lg:pt-16"
            >
              <p className="kicker">
                <span className="dot-filament" aria-hidden />
                <span>{t("seriesPage.compare")}</span>
              </p>
              <h2 className="headline-lg mt-4 max-w-[24ch] text-[28px] text-[var(--color-ink)] sm:text-[36px]">
                {t("seriesPage.compareTitle")}
              </h2>

              <div className="-mx-5 mt-10 overflow-x-auto px-5 pb-2 sm:mx-0 sm:px-0 lg:mt-12">
                <table className="w-full min-w-[680px] border-collapse text-left">
                  <thead>
                    <tr className="align-bottom">
                      <th className="w-[140px] min-w-[110px]" />
                      {series.products.map((p) => (
                        <th
                          key={p.id}
                          className="min-w-[170px] pb-7 pr-6 font-normal last:pr-0"
                        >
                          <Link
                            href={getPathname({
                              href: `/p/${p.slug}`,
                              locale: locale as AppLocale,
                            })}
                            className="group block"
                          >
                            <div className="overflow-hidden rounded-2xl border border-[var(--color-rule)] bg-[var(--color-surface-sunken)]">
                              <div className="relative aspect-[4/3] w-full">
                                {p.coverImage ? (
                                  /* eslint-disable-next-line @next/next/no-img-element */
                                  <img
                                    src={p.coverImage}
                                    alt={p.name}
                                    loading="lazy"
                                    className="h-full w-full object-cover transition duration-700 group-hover:scale-[1.04]"
                                  />
                                ) : (
                                  <div className="flex h-full w-full items-center justify-center font-mono text-[10px] uppercase tracking-[0.2em] text-[var(--color-ink-faint)]">
                                    No image
                                  </div>
                                )}
                              </div>
                            </div>
                            <p className="mt-4 text-[15px] font-semibold leading-snug text-[var(--color-ink)] transition group-hover:text-[var(--color-accent)]">
                              {p.name}
                            </p>
                            <p className="mt-1 font-mono text-[10px] font-medium uppercase tracking-[0.16em] text-[var(--color-ink-muted)]">
                              {p.modelNumber}
                            </p>
                            <span className="applink mt-2 !text-[13px]">
                              {t("seriesPage.viewDetail")}
                            </span>
                          </Link>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {compareGroups.map((g, gi) => (
                      <Fragment key={g.name || `g${gi}`}>
                        {g.name && (
                          <tr>
                            <th
                              colSpan={1 + series.products.length}
                              className="pb-2 pt-9 text-left"
                            >
                              <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--color-ink-muted)]">
                                {g.name}
                              </span>
                            </th>
                          </tr>
                        )}
                        {g.rows.map((row) => (
                          <tr
                            key={row.label}
                            className="border-t border-[var(--color-rule)]"
                          >
                            <th
                              scope="row"
                              className="py-4 pr-4 align-top text-[13px] font-medium leading-snug text-[var(--color-ink-soft)]"
                            >
                              {row.label}
                            </th>
                            {row.values.map((v, i) => (
                              <td
                                key={series.products[i].id}
                                className={
                                  "py-4 pr-6 align-top font-mono text-[14px] tabular-nums leading-snug last:pr-0 " +
                                  (row.differs
                                    ? "font-medium text-[var(--color-ink)]"
                                    : "text-[var(--color-ink-muted)]")
                                }
                              >
                                {v ?? (
                                  <span className="text-[var(--color-ink-faint)]">
                                    —
                                  </span>
                                )}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </Fragment>
                    ))}
                    {anyCerts && (
                      <tr className="border-t border-[var(--color-rule)]">
                        <th
                          scope="row"
                          className="py-4 pr-4 align-top text-[13px] font-medium leading-snug text-[var(--color-ink-soft)]"
                        >
                          {t("seriesPage.certsRow")}
                        </th>
                        {series.products.map((p) => (
                          <td
                            key={p.id}
                            className="py-4 pr-6 align-top last:pr-0"
                          >
                            {p.certifications.length > 0 ? (
                              <span className="flex flex-wrap gap-1.5">
                                {p.certifications.map((c) => (
                                  <span
                                    key={c}
                                    className="inline-flex items-center rounded-full border border-[var(--color-rule)] px-2 py-0.5 font-mono text-[10px] font-medium uppercase tracking-[0.12em] text-[var(--color-ink-soft)]"
                                  >
                                    {c}
                                  </span>
                                ))}
                              </span>
                            ) : (
                              <span className="font-mono text-[14px] text-[var(--color-ink-faint)]">
                                —
                              </span>
                            )}
                          </td>
                        ))}
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          </ScrollReveal>
        )}

        {series.products.length === 0 && (
          <section className="mt-24 border-t border-[var(--color-rule)] pt-20 text-center">
            <p className="font-display text-[28px] text-[var(--color-ink-soft)]">
              {t("seriesPage.empty")}
            </p>
          </section>
        )}

        <footer className="mt-28 border-t border-[var(--color-rule-strong)] pt-6">
          <div className="flex items-center gap-2.5">
            <DatasheetMark />
            <span className="text-[14px] font-semibold tracking-tight text-[var(--color-ink)]">
              {t("header.datasheetTag")}
            </span>
          </div>
          <p className="mt-4 text-[11px] text-[var(--color-ink-faint)]">
            © {year}
          </p>
        </footer>
      </main>
    </>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div>
      <dd className="font-mono text-[34px] font-semibold leading-none tabular-nums text-[var(--color-ink)]">
        {value}
      </dd>
      <dt className="mt-2 text-[12px] uppercase tracking-[0.1em] text-[var(--color-ink-muted)]">
        {label}
      </dt>
    </div>
  );
}

// Apple「Explore the lineup」式产品卡：大图 + 名 + 定位 + 裸排图标参数 + 认证。
// 整卡即链接，apple-tile 提供悬浮上浮 + 图片缩放。
function LineupCard({
  item,
  locale,
  catLabel,
  detailLabel,
}: {
  item: SeriesProduct;
  locale: AppLocale;
  catLabel: string | null;
  detailLabel: string;
}) {
  const href = getPathname({ href: `/p/${item.slug}`, locale });
  const phrases = (item.tagline ?? "")
    .split(/[·、,，]/)
    .map((s) => s.trim())
    .filter(Boolean);

  return (
    <ScrollReveal className="h-full">
      <Link
        href={href}
        className="apple-tile group flex h-full flex-col overflow-hidden border border-[var(--color-rule)] bg-[var(--color-surface)]"
      >
        {/* 图 */}
        <div className="relative aspect-[4/3] w-full shrink-0 overflow-hidden bg-[var(--color-surface-sunken)]">
          {item.coverImage ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={item.coverImage}
              alt={item.name}
              loading="lazy"
              className="apple-tile-img h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center font-mono text-[11px] uppercase tracking-[0.22em] text-[var(--color-ink-faint)]">
              No image
            </div>
          )}
          {catLabel && (
            <span className="absolute left-4 top-4 rounded-full border border-[var(--color-rule)] bg-[var(--color-surface)]/85 px-3 py-1 font-mono text-[10px] font-medium uppercase tracking-[0.16em] text-[var(--color-ink-soft)] backdrop-blur">
              {catLabel}
            </span>
          )}
        </div>

        {/* 文字 */}
        <div className="flex flex-1 flex-col p-6">
          <p className="font-mono text-[10px] font-medium uppercase tracking-[0.18em] text-[var(--color-ink-muted)]">
            {item.modelNumber}
          </p>
          <h3 className="headline-lg mt-2 text-[22px] leading-[1.15] text-[var(--color-ink)] transition group-hover:text-[var(--color-accent)]">
            {item.name}
          </h3>

          {phrases.length > 0 && (
            <p className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] leading-relaxed text-[var(--color-ink-soft)]">
              {phrases.map((phrase, j) => (
                <span key={j} className="inline-flex items-center gap-1.5">
                  <span
                    className="h-1 w-1 rounded-full bg-[var(--color-accent)]"
                    aria-hidden
                  />
                  {phrase}
                </span>
              ))}
            </p>
          )}

          {item.highlights.length > 0 && (
            <div className="mt-6 grid grid-cols-2 gap-x-4 gap-y-4 border-t border-[var(--color-rule)] pt-5">
              {item.highlights.map((h, j) => (
                <HighlightStack key={j} h={h} />
              ))}
            </div>
          )}

          {item.certifications.length > 0 && (
            <div className="mt-5 flex flex-wrap gap-1.5">
              {item.certifications.map((c) => (
                <span
                  key={c}
                  className="inline-flex items-center rounded-full border border-[var(--color-rule)] px-2 py-0.5 font-mono text-[10px] font-medium uppercase tracking-[0.12em] text-[var(--color-ink-soft)]"
                >
                  {c}
                </span>
              ))}
            </div>
          )}

          <span className="applink mt-auto pt-6 !text-[14px]">
            {detailLabel}
          </span>
        </div>
      </Link>
    </ScrollReveal>
  );
}

// Apple lineup 卡内的「图标 + 值 + 标签」裸排（无底框，比产品页 chip 更轻）。
function HighlightStack({ h }: { h: ProductHighlight }) {
  const Icon = HL_ICONS[h.icon] ?? Circle;
  return (
    <div className="flex flex-col gap-1">
      <Icon
        className="h-[17px] w-[17px] shrink-0 text-[var(--color-accent)]"
        strokeWidth={1.5}
      />
      {h.value && (
        <p className="font-mono text-[14px] font-semibold tabular-nums leading-tight text-[var(--color-ink)]">
          {h.value}
        </p>
      )}
      <p className="text-[10px] font-medium uppercase tracking-[0.04em] leading-snug text-[var(--color-ink-muted)]">
        {h.label}
      </p>
    </div>
  );
}

// 平台品牌标识（与产品页 FactoryMark 无 logo 形态一致）。
function DatasheetMark() {
  return <LuzHubMark size={20} />;
}
