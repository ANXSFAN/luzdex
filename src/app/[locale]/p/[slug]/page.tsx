import { notFound } from "next/navigation";
import { after } from "next/server";
import { headers } from "next/headers";
import Link from "next/link";
import {
  Download,
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
  Plus,
  Check,
} from "lucide-react";
import { Fragment } from "react";
import type { LucideIcon } from "lucide-react";
import type { Metadata, Viewport } from "next";
import { hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import { normalizeSource } from "@/lib/channel";
import {
  findPublicProductBySlug,
  findRelatedProducts,
  findVariants,
  findVariantComparison,
  buildVariantMatrix,
  parseSpecs,
  groupSpecs,
  parseHighlights,
  parseDetailBlocks,
  parseApplications,
  parseFaq,
  parseBoxContents,
  parseInstall,
  parseDimensions,
  parseDimensionsJson,
  parseContentI18n,
  buildSpecViz,
  parseCct,
  lookupCert,
  type ProductSpec,
  type ProductHighlight,
  type DetailBlock,
  type Application,
  type FaqItem,
  type CompareGroup,
  type VariantComparison,
  type BoxItem,
  type Install,
  type SpecVizItem,
  type Dimensions,
  type Cct,
} from "@/lib/products";
import { ProductGallery } from "@/components/product-gallery";
import { RelatedProducts } from "@/components/related-products";
import { PdfDownloadLink } from "@/components/pdf-download-link";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { ShareButton } from "@/components/share-button";
import { ScrollReveal } from "@/components/motion/scroll-reveal";
import { routing, type AppLocale } from "@/i18n/routing";
import { getPathname } from "@/i18n/navigation";

interface PageProps {
  params: Promise<{ locale: string; slug: string }>;
  searchParams?: Promise<{ s?: string | string[] }>;
}

// 手机浏览器地址栏跟随工厂品牌色（白标质感）；无自定义色时回退平台墨色。
// oklch 串在支持 CSS Color 4 的浏览器生效，旧浏览器优雅忽略、用根布局默认。
export async function generateViewport({ params }: PageProps): Promise<Viewport> {
  const { slug } = await params;
  const row = await prisma.product.findUnique({
    where: { slug },
    select: { factory: { select: { accentColor: true } } },
  });
  return { themeColor: row?.factory?.accentColor ?? "#1d1d1f" };
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const product = await findPublicProductBySlug(slug);
  if (!product) return { title: "Product not found" };
  const brand = product.factory?.brandShort ?? product.factory?.name ?? "Cloud";
  return {
    title: `${product.name} · ${product.modelNumber} — ${brand}`,
    robots: { index: false, follow: false },
  };
}

function fmtSize(b: number) {
  return b < 1048576 ? `${Math.round(b / 1024)} KB` : `${(b / 1048576).toFixed(1)} MB`;
}

function fmtDate(d: Date) {
  return new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

function docRef(slug: string) {
  let h = 0;
  for (let i = 0; i < slug.length; i++) h = (h * 31 + slug.charCodeAt(i)) >>> 0;
  return h.toString(36).toUpperCase().padStart(6, "0").slice(0, 6);
}

function mimeShort(m: string) {
  if (m.includes("pdf")) return "PDF";
  if (m.includes("image")) return "IMG";
  if (m.includes("zip")) return "ZIP";
  if (m.includes("word")) return "DOC";
  if (m.includes("sheet") || m.includes("excel")) return "XLS";
  return m.split("/").pop()?.slice(0, 4).toUpperCase() ?? "FILE";
}

export default async function ProductDatasheetPage({
  params,
  searchParams,
}: PageProps) {
  const { locale, slug } = await params;
  const sp = await searchParams;
  const source = normalizeSource(Array.isArray(sp?.s) ? sp?.s[0] : sp?.s);
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);

  const product = await findPublicProductBySlug(slug);
  if (!product) notFound();

  const t = await getTranslations("product");

  // Fire-and-forget scan logging — runs after the response is sent.
  const hdrs = await headers();
  const productId = product.id;
  const userAgent = hdrs.get("user-agent")?.slice(0, 500) ?? null;
  const country =
    hdrs.get("x-vercel-ip-country") ?? hdrs.get("cf-ipcountry") ?? null;
  after(
    prisma.scanLog
      .create({ data: { productId, userAgent, country, locale, source } })
      .catch(() => undefined)
  );

  const factory = product.factory;
  const brandShort = factory?.brandShort ?? factory?.name ?? "Manufacturer";
  const ref = docRef(product.slug);
  const updated = fmtDate(product.syncedAt);
  const year = new Date().getFullYear();

  const tenantStyle = factory?.accentColor
    ? ({ "--color-accent": factory.accentColor } as React.CSSProperties)
    : undefined;

  // 源 specs 用于语言相关启发式（参数识别 / 尺寸解析 / 变体对比）
  const specs = parseSpecs(product.specs);

  // 内容层多语言：取该 locale 的译文，缺失回退源字段
  const tr = parseContentI18n(product.contentI18n)[locale];

  // 规格表显示用译文（数量一致才用，避免 AI 增删导致错位）
  const displaySpecs =
    tr?.specs && tr.specs.length === specs.length ? tr.specs : specs;
  const specGroups = groupSpecs(displaySpecs);
  // 参数可视化：用源识别、用译文展示（label 与 value 都随语言）。
  const specViz = buildSpecViz(
    specs,
    displaySpecs === specs ? undefined : displaySpecs
  );
  // 色温刻度：用展示用 specs 解析，标题随语言；无色温的产品不渲染。
  const cct = parseCct(displaySpecs);
  const name = tr?.name || product.name;
  const description = tr?.description || product.description;
  const tagline = tr?.tagline || product.tagline;
  const highlights = tr?.highlights ?? parseHighlights(product.highlights);
  const faq = tr?.faq ?? parseFaq(product.faq);

  // 图片语言无关：以源为基准（图片/图标取源），仅按序覆盖译文文字。
  // 避免译文包里拷贝的旧图 URL 与源不一致（换图无需重翻）。
  const srcApplications = parseApplications(product.applications);
  const applications = srcApplications.map((s, i) => {
    const t = tr?.applications?.[i];
    return { ...s, title: t?.title || s.title, desc: t?.desc ?? s.desc };
  });
  const srcDetailBlocks = parseDetailBlocks(product.detailBlocks);
  const detailBlocks: DetailBlock[] = srcDetailBlocks.map((s, i) => {
    const t = tr?.detailBlocks?.[i];
    if (s.kind === "image") {
      return {
        kind: "image",
        url: s.url,
        caption:
          (t && t.kind === "image" ? t.caption : undefined) ?? s.caption,
      };
    }
    const text =
      t && (t.kind === "heading" || t.kind === "text") ? t.text : s.text;
    return { kind: s.kind, text };
  });
  const boxContents = tr?.boxContents ?? parseBoxContents(product.boxContents);
  const install = tr?.install ?? parseInstall(product.install);
  // 尺寸：译文 > 存储 > specs 正则
  const dimensions =
    tr?.dimensions ??
    parseDimensionsJson(product.dimensions) ??
    parseDimensions(specs);

  const [related, variants, variantCompare] = await Promise.all([
    findRelatedProducts(product, locale),
    findVariants(product),
    findVariantComparison(product),
  ]);
  const compareGroups = buildVariantMatrix(variantCompare);
  const hasRelated =
    related.siblings.length > 0 || related.accessories.length > 0;

  const galleryImages = [
    ...(product.coverImage
      ? [{ url: product.coverImage, alt: name }]
      : []),
    ...product.images.map((img) => ({ url: img.url, alt: img.alt })),
  ];

  // 9 语言站：内容由 AI 自动补全各语言，切换器默认展示全部受支持语言。
  const supportedLocales = [...routing.locales];

  const pdfHref = getPathname({
    href: `/p/${product.slug}/pdf`,
    locale: locale as AppLocale,
  });

  return (
    <>
      <header className="glass-nav fixed inset-x-0 top-0 z-20 border-b border-[var(--color-rule)]">
        <div className="mx-auto flex h-12 max-w-[1240px] items-center justify-between px-5 sm:px-10">
          <Link
            href="/"
            className="flex items-center gap-2.5 transition hover:opacity-70"
          >
            <FactoryMark logoUrl={factory?.logoUrl ?? null} />
            <span className="text-[14px] font-semibold tracking-tight text-[var(--color-ink)]">
              {brandShort}
            </span>
            <span className="hidden text-[10px] font-medium uppercase tracking-[0.14em] text-[var(--color-ink-faint)] sm:inline">
              {t("header.datasheetTag")}
            </span>
          </Link>
          <div className="flex items-center gap-3">
            <LocaleSwitcher
              current={locale as AppLocale}
              supported={supportedLocales}
              slug={product.slug}
            />
            <ShareButton
              locale={locale}
              name={name}
              modelNumber={product.modelNumber}
              tagline={tagline ?? ""}
              brand={brandShort}
              coverImage={product.coverImage ?? galleryImages[0]?.url ?? null}
            />
          </div>
        </div>
      </header>

      <main
        className="relative mx-auto max-w-[1240px] px-5 pb-20 pt-16 sm:px-10 sm:pt-20 lg:pb-24 lg:pt-28"
        style={tenantStyle}
      >
        {/* ── Hero — product-forward catalog layout ─────────── */}
        <section className="grid grid-cols-1 gap-x-10 gap-y-8 lg:grid-cols-12 lg:gap-y-10">
          {/* A · identify — kept short so mobile sees the product fast */}
          <div className="order-1 self-start lg:col-span-5">
            <p className="kicker rise-in" data-step="1">
              <span className="dot-filament" aria-hidden />
              <span>{factory?.name ?? "Manufacturer"}</span>
            </p>

            <h1
              className="headline-xl mt-4 text-[34px] leading-[1.05] text-[var(--color-ink)] sm:mt-5 sm:text-[44px] lg:text-[52px] rise-in"
              data-step="2"
            >
              {name}
            </h1>

            <p
              className="mt-4 font-mono text-[13px] font-medium uppercase tracking-[0.18em] text-[var(--color-ink)] rise-in"
              data-step="3"
            >
              {product.modelNumber}
            </p>

            {tagline && (
              <p
                className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[14px] text-[var(--color-ink-soft)] rise-in"
                data-step="3"
              >
                {tagline
                  .split(/[·、,，]/)
                  .map((s) => s.trim())
                  .filter(Boolean)
                  .map((phrase, i) => (
                    <span key={i} className="inline-flex items-center gap-1.5">
                      <span
                        className="h-1 w-1 rounded-full bg-[var(--color-accent)]"
                        aria-hidden
                      />
                      {phrase}
                    </span>
                  ))}
              </p>
            )}

            {variants.length > 0 && (
              <div className="mt-6 rise-in" data-step="3">
                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--color-ink-muted)]">
                  {t("variants.label")}
                </p>
                <div className="mt-2.5 flex flex-wrap gap-2">
                  {variants.map((v) => {
                    const isCurrent = v.id === product.id;
                    const vlabel = v.variantLabel ?? v.modelNumber;
                    return isCurrent ? (
                      <span
                        key={v.id}
                        aria-current="true"
                        className="inline-flex items-center rounded-full border border-[var(--color-ink)] bg-[var(--color-ink)] px-3.5 py-1.5 text-[13px] font-medium text-[var(--color-surface)]"
                      >
                        {vlabel}
                      </span>
                    ) : (
                      <Link
                        key={v.id}
                        href={getPathname({
                          href: `/p/${v.slug}`,
                          locale: locale as AppLocale,
                        })}
                        className="inline-flex items-center rounded-full border border-[var(--color-rule-strong)] px-3.5 py-1.5 text-[13px] text-[var(--color-ink-soft)] transition hover:border-[var(--color-ink)] hover:text-[var(--color-ink)]"
                      >
                        {vlabel}
                      </Link>
                    );
                  })}
                </div>
              </div>
            )}

          </div>

          {/* Product image — on mobile this lands right after the title,
              so customers see the product before any prose */}
          {galleryImages.length > 0 && (
            <div className="order-2 self-start lg:col-span-7 lg:row-span-2">
              <ProductGallery
                images={galleryImages}
                modelNumber={product.modelNumber}
                fallbackAlt={name}
              />
            </div>
          )}

          {/* Key specs — right after the image on mobile; full-width band on desktop */}
          {highlights.length > 0 && (
            <div className="order-3 rise-in lg:order-4 lg:col-span-12" data-step="4">
              <SpecChips items={highlights} />
            </div>
          )}

          {/* B · description + certs — pushed below the image on mobile */}
          {(description || product.certifications.length > 0) && (
            <div className="order-4 self-start lg:order-3 lg:col-span-5">
              {description && (
                <div
                  className="space-y-3 text-[15px] leading-[1.75] text-[var(--color-ink-soft)] rise-in"
                  data-step="3"
                >
                  {description
                    .split(/\n\s*\n/)
                    .filter((s) => s.trim().length > 0)
                    .map((para, i) => (
                      <p key={i}>{para.trim()}</p>
                    ))}
                </div>
              )}

              {product.certifications.length > 0 && (
                <div className="mt-7 rise-in" data-step="5">
                  <CertList
                    certs={product.certifications}
                    label={t("identification.certs")}
                    locale={locale as AppLocale}
                  />
                </div>
              )}
            </div>
          )}

          {/* Colour-temperature scale — only when the product states a CCT;
              the band marks its real value on the 2700–6500 K reference. */}
          {cct && (
            <div className="order-5 lg:col-span-12">
              <CctScale cct={cct} />
            </div>
          )}
        </section>

        {/* ── 01 · Applications ────────────────────────────── */}
        {applications.length > 0 && (
          <SectionBlock
            no="01"
            label={t("applications.label")}
            sub={t("applications.sub")}
            count={applications.length}
          >
            <ApplicationsGrid items={applications} />
          </SectionBlock>
        )}

        {/* ── 02 · Performance (spec viz) ──────────────────── */}
        {specViz.length > 0 && (
          <SectionBlock
            no="02"
            label={t("performance.label")}
            sub={t("performance.sub")}
            count={specViz.length}
          >
            <SpecVizGrid items={specViz} />
          </SectionBlock>
        )}

        {/* ── 03 · Detail ──────────────────────────────────── */}
        {detailBlocks.length > 0 && (
          <SectionBlock
            no="03"
            label={t("detail.label")}
            sub={t("detail.sub")}
            count={detailBlocks.length}
          >
            <DetailContent blocks={detailBlocks} />
          </SectionBlock>
        )}

        {/* ── 04 · Specifications ──────────────────────────── */}
        {specs.length > 0 && (
          <SectionBlock
            no="04"
            label={t("specifications.label")}
            sub={t("specifications.sub")}
            count={specs.length}
          >
            <SpecTable groups={specGroups} />
          </SectionBlock>
        )}

        {/* ── 05 · Compare variants ────────────────────────── */}
        {compareGroups.length > 0 && (
          <SectionBlock
            no="05"
            label={t("compare.label")}
            sub={t("compare.sub")}
            count={variantCompare.length}
          >
            <CompareTable
              variants={variantCompare}
              groups={compareGroups}
              currentId={product.id}
              locale={locale as AppLocale}
            />
          </SectionBlock>
        )}

        {/* ── 06 · Size & install ──────────────────────────── */}
        {(dimensions ||
          (install && (install.method || install.steps.length > 0))) && (
          <SectionBlock
            no="06"
            label={t("install.label")}
            sub={t("install.sub")}
            count={install?.steps.length ?? 0}
          >
            <div className="space-y-10">
              {dimensions && (
                <DimensionDiagram
                  dim={dimensions}
                  labels={{
                    width: t("dim.width"),
                    height: t("dim.height"),
                    depth: t("dim.depth"),
                    cutout: t("dim.cutout"),
                  }}
                />
              )}
              {install && (install.method || install.steps.length > 0) && (
                <InstallContent install={install} />
              )}
            </div>
          </SectionBlock>
        )}

        {/* ── 07 · In the box ──────────────────────────────── */}
        {boxContents.length > 0 && (
          <SectionBlock
            no="07"
            label={t("box.label")}
            sub={t("box.sub")}
            count={boxContents.length}
          >
            <BoxList items={boxContents} note={t("box.note")} />
          </SectionBlock>
        )}

        {/* ── 08 · Documents ───────────────────────────────── */}
        {product.documents.length > 0 && (
          <SectionBlock
            no="08"
            label={t("documents.label")}
            sub={t("documents.sub")}
            count={product.documents.length}
          >
            <ul className="space-y-1">
              {product.documents.map((doc, i) => (
                <li key={doc.id}>
                  <a
                    href={doc.fileUrl}
                    download
                    target="_blank"
                    rel="noopener noreferrer"
                    className="doc-row group flex items-center gap-4 py-4 pr-4 pl-4 sm:gap-6 sm:pl-5"
                  >
                    <span className="font-mono text-[11px] font-medium uppercase tracking-[0.14em] text-[var(--color-ink-muted)]">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="font-sans text-[15px] font-medium text-[var(--color-ink)] sm:text-[16px]">
                        {tr?.docTitles?.[i] ?? doc.title}
                      </p>
                      <p className="mt-1 truncate font-mono text-[11px] text-[var(--color-ink-muted)]">
                        {doc.fileName}
                      </p>
                    </div>
                    <span className="hidden shrink-0 border border-[var(--color-rule)] px-2 py-1 font-mono text-[10px] font-medium uppercase tracking-[0.16em] text-[var(--color-ink-soft)] sm:inline-block">
                      {mimeShort(doc.mimeType)}
                    </span>
                    <span className="hidden w-20 shrink-0 text-right font-mono text-[11px] tabular-nums text-[var(--color-ink-soft)] sm:inline">
                      {fmtSize(doc.fileSize)}
                    </span>
                    <span
                      aria-label={t("documents.open")}
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--color-accent)] text-white transition group-hover:brightness-110"
                    >
                      <Download className="h-4 w-4" strokeWidth={1.75} />
                    </span>
                  </a>
                </li>
              ))}
            </ul>
          </SectionBlock>
        )}

        {/* ── 09 · Media ───────────────────────────────────── */}
        {product.videos.length > 0 && (
          <SectionBlock
            no="09"
            label={t("media.label")}
            sub={t("media.sub")}
            count={product.videos.length}
          >
            <div className="grid grid-cols-1 gap-x-6 gap-y-10 sm:grid-cols-2">
              {product.videos.map((v, i) => (
                <figure
                  key={v.id}
                  className="rise-in"
                  data-step={Math.min(i + 1, 6)}
                >
                  <div className="relative aspect-video w-full overflow-hidden rounded-2xl border border-[var(--color-rule)] bg-black">
                    <video
                      src={v.url}
                      poster={v.coverImage ?? undefined}
                      controls
                      preload="metadata"
                      className="h-full w-full object-cover"
                    />
                  </div>
                  <figcaption className="mt-3 flex items-baseline justify-between gap-4">
                    <p className="text-[15px] font-medium text-[var(--color-ink)]">
                      {tr?.videoTitles?.[i] ?? v.title}
                    </p>
                    <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-[var(--color-ink-muted)]">
                      {String(i + 1).padStart(2, "0")} /{" "}
                      {String(product.videos.length).padStart(2, "0")}
                    </span>
                  </figcaption>
                </figure>
              ))}
            </div>
          </SectionBlock>
        )}

        {/* ── 10 · FAQ ─────────────────────────────────────── */}
        {faq.length > 0 && (
          <SectionBlock
            no="10"
            label={t("faq.label")}
            sub={t("faq.sub")}
            count={faq.length}
          >
            <FaqList items={faq} />
          </SectionBlock>
        )}

        {/* ── 11 · Related ─────────────────────────────────── */}
        {hasRelated && (
          <section className="mt-12 grid grid-cols-1 gap-y-5 lg:mt-20 lg:grid-cols-12 lg:gap-x-10 lg:gap-y-8">
            <div className="lg:col-span-3">
              <SectionRail
                no="11"
                label={t("related.label")}
                sub={t("related.sub")}
                count={related.siblings.length + related.accessories.length}
              />
            </div>
            <div className="lg:col-span-9">
              <ScrollReveal>
                <RelatedProducts
                  siblings={related.siblings}
                  accessories={related.accessories}
                  locale={locale as AppLocale}
                />
              </ScrollReveal>
            </div>
          </section>
        )}

        {/* Empty state */}
        {specs.length === 0 &&
          product.videos.length === 0 &&
          product.documents.length === 0 && (
            <section className="mt-20 border-t border-[var(--color-rule)] pt-20 text-center">
              <p className="kicker">
                <span className="kicker-mark">/</span>
                <span>{t("empty.label")}</span>
              </p>
              <p className="font-display mt-4 text-[28px] text-[var(--color-ink-soft)]">
                {t("empty.text")}
              </p>
            </section>
          )}

        {/* PDF download — server-rendered, cached 60s */}
        <section className="mt-20 grid grid-cols-1 gap-y-5 lg:mt-24 lg:grid-cols-12 lg:gap-x-10">
          <div className="lg:col-span-3">
            <SectionRail no="•" label={t("pdf.label")} sub={t("pdf.sub")} />
          </div>
          <div className="lg:col-span-9">
            <PdfDownloadLink
              href={pdfHref}
              productId={product.id}
              source={source}
              className="doc-row group flex items-center gap-4 border border-[var(--color-rule)] py-5 pr-4 pl-4 sm:gap-6 sm:pl-5"
            >
              <span className="font-mono text-[11px] font-medium uppercase tracking-[0.14em] text-[var(--color-ink-muted)]">
                PDF
              </span>
              <div className="min-w-0 flex-1">
                <p className="font-sans text-[15px] font-medium text-[var(--color-ink)] sm:text-[16px]">
                  {t("pdf.title")}
                </p>
                <p className="mt-1 truncate font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--color-ink-muted)]">
                  {t("pdf.meta", { model: product.modelNumber, ref })}
                </p>
              </div>
              <span className="doc-action flex shrink-0 items-center gap-1 font-mono text-[10px] uppercase tracking-[0.18em]">
                {t("pdf.open")}
                <Download className="h-3.5 w-3.5" strokeWidth={1.5} />
              </span>
            </PdfDownloadLink>
          </div>
        </section>

        <footer className="mt-24 border-t border-[var(--color-rule-strong)] pt-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-baseline sm:justify-between">
            <div className="flex items-center gap-2.5">
              <FactoryMark logoUrl={factory?.logoUrl ?? null} />
              <span className="text-[14px] font-semibold tracking-tight text-[var(--color-ink)]">
                {factory?.name ?? brandShort}
              </span>
            </div>
            <span className="text-[12px] text-[var(--color-ink-muted)]">
              {t("footer.access", { date: updated })}
            </span>
          </div>
          <p className="mt-4 text-[11px] text-[var(--color-ink-faint)]">
            © {year} {factory?.name ?? brandShort}
          </p>
        </footer>
      </main>
    </>
  );
}

function SectionRail({
  no,
  label,
  sub,
  count,
}: {
  no: string;
  label: string;
  sub: string;
  count?: number;
}) {
  return (
    <>
      {/* Mobile compact — single header strip */}
      <div className="lg:hidden">
        <div className="flex items-baseline justify-between border-b border-[var(--color-rule-strong)] pb-2">
          <div className="flex items-baseline gap-2.5">
            <span className="font-mono text-[15px] font-semibold tracking-tight text-[var(--color-ink)] tabular-nums">
              {no}
            </span>
            <span className="kicker">
              <span className="kicker-mark">/</span>
              <span>{label}</span>
            </span>
          </div>
          {typeof count === "number" && (
            <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-[var(--color-ink-muted)] tabular-nums">
              {String(count).padStart(2, "0")}
            </span>
          )}
        </div>
        <p className="mt-1.5 text-[12px] text-[var(--color-ink-muted)]">{sub}</p>
      </div>

      {/* Desktop vertical rail */}
      <div className="hidden lg:block">
        <p className="headline-lg text-[34px] leading-none text-[var(--color-ink-faint)]">
          {no}
        </p>
        <p className="kicker mt-4">
          <span>{label}</span>
        </p>
        <p className="mt-1 text-[13px] text-[var(--color-ink-muted)]">{sub}</p>
        {typeof count === "number" && (
          <p className="mt-5 font-mono text-[10px] uppercase tracking-[0.22em] text-[var(--color-ink-muted)]">
            {String(count).padStart(2, "0")}{" "}
            {count === 1 ? "item" : "items"}
          </p>
        )}
      </div>
    </>
  );
}

function SpecTable({
  groups,
}: {
  groups: { name: string; items: ProductSpec[] }[];
}) {
  return (
    <div className="space-y-4">
      {groups.map((g, gi) => (
        <div
          key={`${g.name || "ungrouped"}-${gi}`}
          className="rounded-2xl bg-[var(--color-surface-sunken)] p-6 sm:p-7"
        >
          {g.name && (
            <div className="mb-4 flex items-center gap-3">
              <span
                className="h-2 w-2 shrink-0 rounded-full bg-[var(--color-accent)]"
                aria-hidden
              />
              <span className="text-[15px] font-semibold text-[var(--color-ink)]">
                {g.name}
              </span>
              <span className="h-px flex-1 bg-[var(--color-rule)]" />
            </div>
          )}
          <dl className="grid grid-cols-1 gap-x-10 gap-y-0 sm:grid-cols-2">
            {g.items.map((s, i) => (
              <div
                key={`${g.name}-${s.label}-${i}`}
                className="flex items-baseline justify-between gap-4 border-b border-[var(--color-rule)] py-3 last:border-b-0 sm:last:border-b"
              >
                <dt className="text-[14px] text-[var(--color-ink-soft)]">
                  {s.label}
                </dt>
                <dd className="text-right font-mono text-[14px] font-medium tabular-nums text-[var(--color-ink)]">
                  {s.value}
                  {s.unit ? (
                    <span className="ml-1 text-[var(--color-ink-muted)]">
                      {s.unit}
                    </span>
                  ) : null}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      ))}
    </div>
  );
}

function SectionBlock({
  no,
  label,
  sub,
  count,
  children,
}: {
  no: string;
  label: string;
  sub: string;
  count: number;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-12 grid grid-cols-1 gap-y-5 lg:mt-20 lg:grid-cols-12 lg:gap-x-10 lg:gap-y-8">
      <div className="lg:col-span-3">
        <SectionRail no={no} label={label} sub={sub} count={count} />
      </div>
      <div className="lg:col-span-9">
        <ScrollReveal>{children}</ScrollReveal>
      </div>
    </section>
  );
}

// 亮点图标白名单 → lucide 图标。数据里 icon 存 key，渲染时映射，未知回退圆点。
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

// 关键参数速读：首屏一排图标胶囊（功率 / 光通量 / 防护 / 寿命…）。数据复用 highlights。
function SpecChips({ items }: { items: ProductHighlight[] }) {
  return (
    <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
      {items.map((h, i) => {
        const Icon = HL_ICONS[h.icon] ?? Circle;
        return (
          <div
            key={i}
            className="flex flex-col gap-1.5 rounded-xl border border-[var(--color-rule)] bg-[var(--color-surface-sunken)] px-3.5 py-4"
          >
            <Icon
              className="h-[18px] w-[18px] shrink-0 text-[var(--color-accent)]"
              strokeWidth={1.5}
            />
            {h.value && (
              <p className="font-mono text-[15px] font-semibold tabular-nums leading-tight text-[var(--color-ink)]">
                {h.value}
              </p>
            )}
            <p className="text-[11px] font-medium uppercase tracking-[0.04em] leading-snug text-[var(--color-ink-muted)]">
              {h.label}
            </p>
          </div>
        );
      })}
    </div>
  );
}

// 京东式图文长详情：标题 / 段落 / 整幅大图依序铺陈。图片走 URL，懒加载。
function DetailContent({ blocks }: { blocks: DetailBlock[] }) {
  return (
    <div className="space-y-6">
      {blocks.map((b, i) => {
        if (b.kind === "heading") {
          return (
            <h3
              key={i}
              className="headline-lg pt-2 text-[22px] leading-tight text-[var(--color-ink)] sm:text-[26px]"
            >
              {b.text}
            </h3>
          );
        }
        if (b.kind === "text") {
          return (
            <p
              key={i}
              className="max-w-[46rem] whitespace-pre-line text-[15px] leading-[1.8] text-[var(--color-ink-soft)]"
            >
              {b.text}
            </p>
          );
        }
        return (
          <figure
            key={i}
            className="overflow-hidden rounded-2xl border border-[var(--color-rule)] bg-[var(--color-surface-sunken)]"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={b.url}
              alt={b.caption ?? ""}
              loading="lazy"
              className="h-auto w-full object-cover"
            />
            {b.caption && (
              <figcaption className="px-4 py-3 font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--color-ink-muted)]">
                {b.caption}
              </figcaption>
            )}
          </figure>
        );
      })}
    </div>
  );
}

// 应用场景：「用在哪里」。有实景图走图卡，无图走图标卡。icon 复用亮点白名单。
function ApplicationsGrid({ items }: { items: Application[] }) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {items.map((a, i) => {
        const Icon = HL_ICONS[a.icon] ?? Circle;
        return (
          <div
            key={i}
            className="group overflow-hidden rounded-2xl border border-[var(--color-rule)] bg-[var(--color-surface-sunken)]"
          >
            {a.image && (
              <div className="relative aspect-[4/3] w-full overflow-hidden">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={a.image}
                  alt={a.title}
                  loading="lazy"
                  className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]"
                />
              </div>
            )}
            <div className="p-5">
              <div className="flex items-center gap-2.5">
                <Icon
                  className="h-5 w-5 shrink-0 text-[var(--color-accent)]"
                  strokeWidth={1.5}
                />
                <p className="text-[15px] font-medium text-[var(--color-ink)]">
                  {a.title}
                </p>
              </div>
              {a.desc && (
                <p className="mt-2 text-[13px] leading-relaxed text-[var(--color-ink-soft)]">
                  {a.desc}
                </p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// 规格变体并排对比（京东 SKU 对比 / Apple Compare）。当前型号列高亮，其余列可点跳转。
// differs 行（各变体取值不同）整行加粗，一眼看出"区别在哪"。横向可滚动适配窄屏。
function CompareTable({
  variants,
  groups,
  currentId,
  locale,
}: {
  variants: VariantComparison[];
  groups: CompareGroup[];
  currentId: string;
  locale: AppLocale;
}) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-[var(--color-rule)]">
      <table className="w-full min-w-[560px] border-collapse text-left">
        <thead>
          <tr className="border-b border-[var(--color-rule-strong)]">
            <th className="sticky left-0 z-10 bg-[var(--color-surface)] px-4 py-3" />
            {variants.map((v) => {
              const isCurrent = v.id === currentId;
              const label = v.variantLabel ?? v.modelNumber;
              return (
                <th key={v.id} className="px-4 py-3 text-center">
                  {isCurrent ? (
                    <span className="inline-flex flex-col items-center gap-0.5">
                      <span className="text-[14px] font-semibold text-[var(--color-ink)]">
                        {label}
                      </span>
                      <span
                        className="font-mono text-[9px] text-[var(--color-accent)]"
                        aria-hidden
                      >
                        ●
                      </span>
                    </span>
                  ) : (
                    <Link
                      href={getPathname({
                        href: `/p/${v.slug}`,
                        locale,
                      })}
                      className="text-[14px] font-medium text-[var(--color-ink-soft)] underline-offset-4 transition hover:text-[var(--color-ink)] hover:underline"
                    >
                      {label}
                    </Link>
                  )}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {groups.map((g, gi) => (
            <Fragment key={gi}>
              {g.name && (
                <tr className="bg-[var(--color-surface-sunken)]">
                  <td
                    colSpan={variants.length + 1}
                    className="px-4 py-2.5 text-[13px] font-semibold text-[var(--color-ink)]"
                  >
                    {g.name}
                  </td>
                </tr>
              )}
              {g.rows.map((row, ri) => (
                <tr
                  key={ri}
                  className="border-b border-[var(--color-rule)] last:border-b-0"
                >
                  <td className="sticky left-0 z-10 bg-[var(--color-surface)] px-4 py-2.5 text-[13px] text-[var(--color-ink-soft)]">
                    {row.label}
                  </td>
                  {row.values.map((val, ci) => {
                    const isCurrent = variants[ci].id === currentId;
                    return (
                      <td
                        key={ci}
                        className={`px-4 py-2.5 text-center font-mono text-[13px] tabular-nums ${
                          isCurrent
                            ? "bg-[var(--color-surface-sunken)] text-[var(--color-ink)]"
                            : "text-[var(--color-ink-soft)]"
                        } ${row.differs ? "font-semibold" : ""}`}
                      >
                        {val ?? (
                          <span className="text-[var(--color-ink-faint)]">—</span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </Fragment>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// 常见问题：原生 <details> 折叠，零 JS、SSR 友好。展开时 + 旋转成 ×。
function FaqList({ items }: { items: FaqItem[] }) {
  return (
    <div className="border-y border-[var(--color-rule)]">
      {items.map((f, i) => (
        <details
          key={i}
          className="group border-b border-[var(--color-rule)] last:border-b-0"
        >
          <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-4 text-[15px] font-medium text-[var(--color-ink)] [&::-webkit-details-marker]:hidden">
            <span className="flex items-baseline gap-3">
              <span className="font-mono text-[11px] tabular-nums text-[var(--color-ink-muted)]">
                {String(i + 1).padStart(2, "0")}
              </span>
              <span>{f.q}</span>
            </span>
            <Plus
              className="h-4 w-4 shrink-0 text-[var(--color-ink-muted)] transition duration-200 group-open:rotate-45"
              strokeWidth={1.5}
            />
          </summary>
          <p className="max-w-[46rem] whitespace-pre-line pb-5 pl-8 text-[14px] leading-[1.8] text-[var(--color-ink-soft)]">
            {f.a}
          </p>
        </details>
      ))}
    </div>
  );
}

// 参数可视化（Apple 式把数字变直观）：bar 走进度条，badge 走数值徽章。数据来自现有 specs。
function SpecVizGrid({ items }: { items: SpecVizItem[] }) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      {items.map((it, i) => {
        const Icon = HL_ICONS[it.icon] ?? Circle;
        return (
          <div
            key={i}
            className="rounded-2xl border border-[var(--color-rule)] bg-[var(--color-surface-sunken)] p-5"
          >
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <Icon
                  className="h-5 w-5 shrink-0 text-[var(--color-accent)]"
                  strokeWidth={1.5}
                />
                <span className="text-[12px] uppercase tracking-[0.12em] text-[var(--color-ink-muted)]">
                  {it.label}
                </span>
              </div>
              <span className="font-mono text-[16px] font-medium tabular-nums text-[var(--color-ink)]">
                {it.display}
              </span>
            </div>
            {it.kind === "bar" && (
              <div className="mt-3">
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-[var(--color-rule)]">
                  <div
                    className="h-full rounded-full bg-[var(--color-accent)]"
                    style={{ width: `${it.pct}%` }}
                  />
                </div>
                {it.note && (
                  <p className="mt-1.5 text-right font-mono text-[9px] uppercase tracking-[0.18em] text-[var(--color-ink-faint)]">
                    {it.note}
                  </p>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// 认证详解：认证码 chip + 通俗解释（字典命中才显示解释，未收录回退纯缩写）。
function CertList({
  certs,
  label,
  locale,
}: {
  certs: string[];
  label: string;
  locale: AppLocale;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--color-ink-muted)]">
        {label}
      </span>
      {certs.map((c) => {
        const info = lookupCert(c);
        // 释义只进 tooltip（避免在非中文页堆一排英文长句），chip 本身只显代码
        const explain = info ? (locale === "zh" ? info.zh : info.en) : null;
        return (
          <span
            key={c}
            title={explain ?? undefined}
            className="inline-flex items-center rounded-full bg-[var(--color-surface-sunken)] px-3 py-1.5 font-mono text-[11px] font-medium uppercase tracking-[0.14em] text-[var(--color-ink)]"
          >
            {c}
          </span>
        );
      })}
    </div>
  );
}

// 尺寸示意：用现有 specs 的数字画正面框 + 宽/高标注线，右侧列全部测量值。
// 形状按宽高比例示意（非精确工程图），标注数字为真实值。
function DimensionDiagram({
  dim,
  labels,
}: {
  dim: Dimensions;
  labels: { width: string; height: string; depth: string; cutout: string };
}) {
  const PAD_L = 40;
  const PAD_T = 40;
  const PAD_R = 66;
  const PAD_B = 46;
  const MAXW = 220;
  const MAXH = 150;
  let ar = dim.w / dim.h;
  if (!Number.isFinite(ar) || ar <= 0) ar = 1;
  ar = Math.min(3.2, Math.max(0.32, ar));
  let rw = MAXW;
  let rh = MAXW / ar;
  if (rh > MAXH) {
    rh = MAXH;
    rw = MAXH * ar;
  }
  const W = rw + PAD_L + PAD_R;
  const H = rh + PAD_T + PAD_B;
  const x0 = PAD_L;
  const y0 = PAD_T;
  const x1 = PAD_L + rw;
  const y1 = PAD_T + rh;
  const u = dim.unit;
  const rule = "var(--color-rule-strong)";
  const ink = "var(--color-ink-muted)";

  return (
    <div className="flex flex-col items-start gap-6 sm:flex-row sm:items-center sm:gap-12">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full max-w-[300px] shrink-0"
        role="img"
        aria-label={`${dim.w}×${dim.h}${dim.d != null ? "×" + dim.d : ""} ${u}`}
      >
        <rect
          x={x0}
          y={y0}
          width={rw}
          height={rh}
          rx="3"
          fill="var(--color-surface-sunken)"
          stroke={rule}
          strokeWidth="1.2"
        />
        {/* width arrow (bottom) */}
        <g stroke={rule} strokeWidth="1">
          <line x1={x0} y1={y1 + 16} x2={x1} y2={y1 + 16} />
          <line x1={x0} y1={y1 + 11} x2={x0} y2={y1 + 21} />
          <line x1={x1} y1={y1 + 11} x2={x1} y2={y1 + 21} />
        </g>
        <text
          x={(x0 + x1) / 2}
          y={y1 + 33}
          textAnchor="middle"
          fontFamily="monospace"
          fontSize="11"
          fill={ink}
        >
          {dim.w} {u}
        </text>
        {/* height arrow (right) */}
        <g stroke={rule} strokeWidth="1">
          <line x1={x1 + 16} y1={y0} x2={x1 + 16} y2={y1} />
          <line x1={x1 + 11} y1={y0} x2={x1 + 21} y2={y0} />
          <line x1={x1 + 11} y1={y1} x2={x1 + 21} y2={y1} />
        </g>
        <text
          x={x1 + 25}
          y={(y0 + y1) / 2}
          textAnchor="start"
          dominantBaseline="middle"
          fontFamily="monospace"
          fontSize="11"
          fill={ink}
        >
          {dim.h} {u}
        </text>
      </svg>

      <dl className="grid grid-cols-2 gap-x-10 gap-y-3.5">
        <Measure label={labels.width} value={`${dim.w} ${u}`} />
        <Measure label={labels.height} value={`${dim.h} ${u}`} />
        {dim.d != null && <Measure label={labels.depth} value={`${dim.d} ${u}`} />}
        {dim.cutout && <Measure label={labels.cutout} value={dim.cutout} />}
      </dl>
    </div>
  );
}

function Measure({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--color-ink-muted)]">
        {label}
      </dt>
      <dd className="mt-0.5 font-mono text-[14px] tabular-nums text-[var(--color-ink)]">
        {value}
      </dd>
    </div>
  );
}

// 安装方式 + 有序步骤。method 一句话定性，steps 编号铺陈。
function InstallContent({ install }: { install: Install }) {
  return (
    <div>
      {install.method && (
        <p className="max-w-[44rem] text-[15px] leading-[1.7] text-[var(--color-ink)]">
          {install.method}
        </p>
      )}
      {install.steps.length > 0 && (
        <ol className="mt-5 space-y-3">
          {install.steps.map((s, i) => (
            <li key={i} className="flex items-start gap-4">
              <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-[var(--color-rule-strong)] font-mono text-[11px] font-medium tabular-nums text-[var(--color-ink)]">
                {i + 1}
              </span>
              <span className="text-[14px] leading-[1.7] text-[var(--color-ink-soft)]">
                {s}
              </span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

// 盒内清单：图标 + 物品列表，底部统一标"以实际包装为准"。
function BoxList({ items, note }: { items: BoxItem[]; note: string }) {
  return (
    <div className="rounded-2xl border border-[var(--color-rule)] bg-[var(--color-surface-sunken)] p-6 sm:p-7">
      <ul className="grid grid-cols-1 gap-x-10 gap-y-0 sm:grid-cols-2">
        {items.map((b, i) => (
          <li
            key={i}
            className="flex items-center justify-between gap-4 border-b border-[var(--color-rule)] py-2.5 last:border-b-0"
          >
            <span className="flex items-center gap-2.5 text-[14px] text-[var(--color-ink-soft)]">
              <Check
                className="h-4 w-4 shrink-0 text-[var(--color-accent)]"
                strokeWidth={2}
              />
              {b.item}
            </span>
            {b.qty && (
              <span className="font-mono text-[13px] tabular-nums text-[var(--color-ink-muted)]">
                {b.qty}
              </span>
            )}
          </li>
        ))}
      </ul>
      <p className="mt-4 text-[11px] text-[var(--color-ink-faint)]">{note}</p>
    </div>
  );
}

// 色温刻度：暖↔冷 2700–6500K 参考渐变，用真实色温在其上标出产品所处区间。
// 单值时收成一个窄括号，区间时画出跨度。端点是参考刻度，括号位置/上方数值才是产品真值。
function CctScale({ cct }: { cct: Cct }) {
  const LO = 2700;
  const HI = 6500;
  const pos = (k: number) =>
    Math.max(0, Math.min(100, ((k - LO) / (HI - LO)) * 100));
  const left = pos(cct.lo);
  const width = Math.max(3, pos(cct.hi) - left);
  return (
    <div className="mt-9 rise-in" data-step="4">
      <div className="mb-2.5 flex items-baseline justify-between gap-4">
        <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--color-ink-muted)]">
          {cct.label}
        </span>
        <span className="font-mono text-[13px] font-medium tabular-nums text-[var(--color-ink)]">
          {cct.display}
        </span>
      </div>
      <div className="spectrum-bar" />
      <div className="relative mt-1 h-2.5">
        <div
          className="absolute top-0 h-2 rounded-[2px] border-x-2 border-[var(--color-ink)]"
          style={{ left: `${left}%`, width: `${width}%` }}
          aria-hidden
        />
      </div>
      <div className="flex justify-between font-mono text-[9px] uppercase tracking-[0.16em] text-[var(--color-ink-faint)]">
        <span>{LO} K</span>
        <span>{HI} K</span>
      </div>
    </div>
  );
}

function FactoryMark({ logoUrl }: { logoUrl: string | null }) {
  if (logoUrl) {
    /* eslint-disable-next-line @next/next/no-img-element */
    return <img src={logoUrl} alt="" className="h-[18px] w-auto" />;
  }
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 18 18"
      aria-hidden
      className="text-[var(--color-ink)]"
    >
      <rect x="0.5" y="0.5" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="1" />
      <rect x="6.5" y="6.5" width="5" height="5" fill="var(--color-accent)" />
    </svg>
  );
}
