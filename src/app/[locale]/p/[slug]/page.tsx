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
  Layers,
  ArrowUpRight,
} from "lucide-react";
import { Fragment } from "react";
import type { LucideIcon } from "lucide-react";
import type { Metadata, Viewport } from "next";
import { hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import { normalizeSource } from "@/lib/channel";
import { localizedName } from "@/lib/catalog";
import {
  findPublicProductBySlug,
  findRelatedProducts,
  siteUrl,
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
  parseBeam,
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
  type Beam,
} from "@/lib/products";
import { ProductGallery } from "@/components/product-gallery";
import { RelatedProducts } from "@/components/related-products";
import { PdfDownloadLink } from "@/components/pdf-download-link";
import { displayOf } from "@/lib/images";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { ShareButton } from "@/components/share-button";
import { ScrollReveal } from "@/components/motion/scroll-reveal";
import { routing, normalizeLocale, type AppLocale } from "@/i18n/routing";
import { getPathname } from "@/i18n/navigation";
import { renderMarkdown, stripMarkdown } from "@/lib/md";
import { LuzdexMark } from "@/components/luzdex-mark";

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
  const { locale: rawLocale, slug } = await params;
  const product = await findPublicProductBySlug(slug);
  if (!product) return { title: "Product not found" };
  // 纯展示定位：标题不带任何工厂/品牌信息，只留产品名 + 型号。
  const locale = normalizeLocale(rawLocale) ?? routing.defaultLocale;
  const tr = parseContentI18n(product.contentI18n)[locale];
  const name = tr?.name || product.name;
  const title = `${name} · ${product.modelNumber}`;
  // 分享卡描述：卖点带优先，缺了取描述纯文本截断；两者都无则省略。
  const description =
    tr?.tagline ||
    product.tagline ||
    stripMarkdown(tr?.description || product.description).slice(0, 200) ||
    undefined;
  // 分享卡图片：封面优先，无封面取图库第一张（R2 绝对 URL，直接可用）。
  const image = product.coverImage ?? product.images[0]?.url ?? undefined;
  const localePrefix = locale === routing.defaultLocale ? "" : `/${locale}`;
  const url = `${siteUrl()}${localePrefix}/p/${product.slug}`;
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
  const trSpecs =
    tr?.specs && tr.specs.length === specs.length ? tr.specs : specs;
  // 字典译名 overlay：行挂字典 key（key 永远从源 specs 读）且字典命中 →
  // label 用字典按当前语言的译名，优先级高于 contentI18n 译文；value/unit 不动。
  const keyedRows = specs.some((s) => s.key);
  const attrNameByKey = keyedRows
    ? new Map(
        (
          await prisma.attributeDefinition.findMany({
            where: { factoryId: product.factoryId },
            select: { key: true, name: true, nameI18n: true },
          })
        ).map((d) => [d.key, localizedName(d.name, d.nameI18n, locale)]),
      )
    : new Map<string, string>();
  const displaySpecs = keyedRows
    ? trSpecs.map((row, i) => {
        const key = specs[i]?.key;
        const dictLabel = key ? attrNameByKey.get(key) : undefined;
        return dictLabel ? { ...row, label: dictLabel } : row;
      })
    : trSpecs;
  const specGroups = groupSpecs(displaySpecs);
  // 参数可视化：用源识别、用译文展示（label 与 value 都随语言）。
  const specViz = buildSpecViz(
    specs,
    displaySpecs === specs ? undefined : displaySpecs
  );
  // 色温刻度：用展示用 specs 解析，标题随语言；无色温的产品不渲染。
  const cct = parseCct(displaySpecs);
  // 配光示意：能干净抽出角度才画（对称锥 / 双轴光斑）；画了就把 viz 里的徽章去掉防重复。
  const beam = parseBeam(displaySpecs);
  const specVizItems = beam ? specViz.filter((v) => v.icon !== "ruler") : specViz;
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
    // 封面若也在画廊里（「设为封面」会复用同一 URL），去重避免轮播重复
    ...product.images
      .filter((img) => img.url !== product.coverImage)
      .map((img) => ({ url: img.url, alt: img.alt })),
  ];

  // 切换器只展示「已有内容」的语言：源语言 + 已翻译语言（+ 当前正在看的语言，
  // 保证激活项始终在列）。未翻译的语言不进切换器，避免顾客切过去只看到回退源文。
  const translatedLocales = Object.keys(parseContentI18n(product.contentI18n));
  const productSourceLocale = normalizeLocale(product.sourceLocale) ?? "es";
  const availableLocales = new Set<string>([
    productSourceLocale,
    locale,
    ...translatedLocales,
  ]);
  const supportedLocales = routing.locales.filter((l) =>
    availableLocales.has(l),
  );

  const pdfHref = getPathname({
    href: `/p/${product.slug}/pdf`,
    locale: locale as AppLocale,
  });

  return (
    <>
      <header className="glass-nav fixed inset-x-0 top-0 z-20 border-b border-[var(--color-rule)]">
        <div className="mx-auto flex h-12 max-w-[1240px] items-center justify-between px-5 sm:px-10">
          {/* 纯展示定位：头部不展示工厂 logo / 品牌名，只留中性资料标识。 */}
          <Link
            href="/"
            className="flex items-center gap-2.5 transition hover:opacity-70"
          >
            <FactoryMark logoUrl={null} />
            <span className="text-[14px] font-semibold tracking-tight text-[var(--color-ink)]">
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
              brand=""
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
            {/* 纯展示定位：不显示工厂名；用系列名作小标，无系列时回退中性资料标识。 */}
            <p className="kicker rise-in" data-step="1">
              <span className="dot-filament" aria-hidden />
              <span>{product.series || t("header.datasheetTag")}</span>
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

            {/* 系列入口：扫一条灯带能进「了解更多·XX系列」页看全系列。仅当归属系列时出现。 */}
            {product.seriesRef && (
              <Link
                href={getPathname({
                  href: `/series/${product.seriesRef.slug}`,
                  locale: locale as AppLocale,
                })}
                className="group mt-6 inline-flex items-center gap-2.5 rounded-full border border-[var(--color-rule-strong)] px-4 py-2 text-[13px] font-medium text-[var(--color-ink-soft)] transition hover:border-[var(--color-ink)] hover:text-[var(--color-ink)] rise-in"
                data-step="3"
              >
                <Layers
                  className="h-4 w-4 shrink-0 text-[var(--color-accent)]"
                  strokeWidth={1.5}
                />
                <span>{t("seriesPage.discover", { series: product.series ?? "" })}</span>
                <ArrowUpRight
                  className="h-3.5 w-3.5 shrink-0 transition group-hover:-translate-y-0.5 group-hover:translate-x-0.5"
                  strokeWidth={1.5}
                />
              </Link>
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
                  className="text-[15px] leading-[1.75] text-[var(--color-ink-soft)] rise-in"
                  data-step="3"
                >
                  {renderMarkdown(description)}
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

        {/* ── 02 · Performance (spec viz + 配光示意) ───────── */}
        {(specVizItems.length > 0 || beam) && (
          <SectionBlock
            no="02"
            label={t("performance.label")}
            sub={t("performance.sub")}
            count={specVizItems.length + (beam ? 1 : 0)}
          >
            <div className="space-y-3">
              {beam && <BeamDiagram beam={beam} />}
              {specVizItems.length > 0 && <SpecVizGrid items={specVizItems} />}
            </div>
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

        {/* 纯展示定位：页脚不展示工厂 logo / 名称 / 版权署名，只留中性资料标识与访问时间。 */}
        <footer className="mt-24 border-t border-[var(--color-rule-strong)] pt-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-baseline sm:justify-between">
            <div className="flex items-center gap-2.5">
              <FactoryMark logoUrl={null} />
              <span className="text-[14px] font-semibold tracking-tight text-[var(--color-ink)]">
                {t("header.datasheetTag")}
              </span>
            </div>
            <span className="text-[12px] text-[var(--color-ink-muted)]">
              {t("footer.access", { date: updated })}
            </span>
          </div>
          <p className="mt-4 text-[11px] text-[var(--color-ink-faint)]">© {year}</p>
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
        <div className="flex items-baseline justify-between border-b border-[var(--color-rule)] pb-2.5">
          <div className="flex items-baseline gap-2.5">
            <span className="font-mono text-[17px] font-semibold tracking-tight text-[var(--color-accent)] tabular-nums">
              {no}
            </span>
            <span className="text-[15px] font-semibold text-[var(--color-ink)]">
              {label}
            </span>
          </div>
          {typeof count === "number" && (
            <span className="font-mono text-[11px] tabular-nums text-[var(--color-ink-muted)]">
              {String(count).padStart(2, "0")}
            </span>
          )}
        </div>
        <p className="mt-2 text-[13px] text-[var(--color-ink-muted)]">{sub}</p>
      </div>

      {/* Desktop vertical rail */}
      <div className="hidden lg:block">
        <p className="headline-lg text-[40px] leading-none text-[var(--color-accent)]">
          {no}
        </p>
        <p className="mt-4 text-[17px] font-semibold leading-tight text-[var(--color-ink)]">
          {label}
        </p>
        <p className="mt-1.5 text-[14px] leading-relaxed text-[var(--color-ink-muted)]">
          {sub}
        </p>
        {typeof count === "number" && (
          <p className="mt-5 font-mono text-[11px] tabular-nums text-[var(--color-ink-muted)]">
            {String(count).padStart(2, "0")} {count === 1 ? "item" : "items"}
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
            <div
              key={i}
              className="max-w-[46rem] text-[15px] leading-[1.8] text-[var(--color-ink-soft)]"
            >
              {renderMarkdown(b.text)}
            </div>
          );
        }
        return (
          <figure
            key={i}
            className="overflow-hidden rounded-2xl border border-[var(--color-rule)] bg-[var(--color-surface-sunken)]"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={displayOf(b.url) ?? b.url}
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
                  src={displayOf(a.image) ?? a.image}
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

// 配光示意：对称角画侧视光锥（多挡并排），双轴非对称画俯视光斑椭圆。全部按真实角度现画。
function BeamDiagram({ beam }: { beam: Beam }) {
  const single = beam.mode === "cone" && beam.angles.length === 1;
  return (
    <div className="rounded-2xl border border-[var(--color-rule)] bg-[var(--color-surface-sunken)] p-5 sm:p-6">
      <div className="mb-4 flex items-center gap-3">
        <span
          className="h-2 w-2 shrink-0 rounded-full bg-[var(--color-accent)]"
          aria-hidden
        />
        <span className="text-[15px] font-semibold text-[var(--color-ink)]">
          {beam.label}
        </span>
        <span className="ml-auto font-mono text-[13px] tabular-nums text-[var(--color-ink-soft)]">
          {beam.display}
        </span>
      </div>
      {beam.mode === "cone" ? (
        single ? (
          <BeamHero angle={beam.angles[0]} />
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {beam.angles.map((a) => (
              <BeamCone key={a} angle={a} />
            ))}
          </div>
        )
      ) : (
        <BeamFootprint major={beam.major} minor={beam.minor} />
      )}
    </div>
  );
}

// 单角度的「主视」布局：左侧暖光光锥 + 右侧大角度数字 + 窄↔宽刻度尺，填满整行（不再甩一个孤零小卡片）。
function BeamHero({ angle }: { angle: number }) {
  return (
    <div className="flex flex-col items-stretch gap-5 sm:flex-row sm:items-center sm:gap-8">
      <div className="flex shrink-0 items-center justify-center rounded-2xl border border-[var(--color-rule)] bg-[var(--color-surface)] px-6 py-5 sm:w-[208px]">
        <BeamCone angle={angle} hero />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-1.5">
          <span className="font-display text-[44px] font-semibold leading-none tabular-nums text-[var(--color-ink)]">
            {angle}
          </span>
          <span className="font-display text-[24px] font-medium leading-none text-[var(--color-accent)]">
            °
          </span>
        </div>
        <BeamScale angle={angle} />
      </div>
    </div>
  );
}

// 角度位置尺（窄 10° ↔ 宽 120°）：纯几何示意，标尺只标度数 → 零文案、9 语言通用。
function BeamScale({ angle }: { angle: number }) {
  const MIN = 10;
  const MAX = 120;
  const pct =
    ((Math.min(Math.max(angle, MIN), MAX) - MIN) / (MAX - MIN)) * 100;
  return (
    <div className="mt-5 max-w-[360px]">
      <div className="relative h-1.5 w-full rounded-full bg-[var(--color-rule)]">
        <div
          className="absolute inset-y-0 left-0 rounded-full bg-[var(--color-accent)]"
          style={{ width: `${pct}%` }}
        />
        <div
          className="absolute top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-[var(--color-surface)] bg-[var(--color-accent)] shadow-sm"
          style={{ left: `${pct}%` }}
        />
      </div>
      <div className="mt-2 flex justify-between font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--color-ink-faint)]">
        <span>10°</span>
        <span>120°</span>
      </div>
    </div>
  );
}

// 侧视光锥：暖光渐变光束（accent 色，像真的灯光而非剪贴图标）→ 落地光池晕开 → 透视光斑 → 精致筒灯。窄角细高、宽角矮胖。
function BeamCone({ angle, hero = false }: { angle: number; hero?: boolean }) {
  const VB = 148;
  const VH = 132;
  const cx = VB / 2;
  const apexY = 26;
  const L = 72; // 斜边（投射距离）恒定 → 不同角度真实可比，不再被宽度上限压成一样
  const maxHalfW = 70;
  const clamped = Math.min(Math.max(angle, 5), 170);
  const half = (clamped / 2) * (Math.PI / 180);
  const ex = Math.min(L * Math.sin(half), maxHalfW); // 水平半张开（按真实半角）
  const ey = L * Math.cos(half); // 垂直深度（窄角更深、宽角更浅）
  const endY = apexY + ey;
  const ry = Math.max(4, ex * 0.28); // 落地椭圆透视短半轴
  const lx = cx - ex;
  const rx = cx + ex;
  const accent = "var(--color-accent)";
  const ink = "var(--color-ink)";
  const gid = `bcg${angle}`;
  const pid = `bcp${angle}`;
  const hid = `bch${angle}`;
  return (
    <div
      className={
        hero
          ? "flex w-full flex-col items-center"
          : "flex flex-col items-center gap-2.5 rounded-2xl border border-[var(--color-rule)] bg-[var(--color-surface)] px-3 py-5"
      }
    >
      <svg
        viewBox={`0 0 ${VB} ${VH}`}
        className={hero ? "w-full max-w-[160px]" : "w-full max-w-[128px]"}
        role="img"
        aria-label={`${angle}°`}
      >
        <defs>
          <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={accent} stopOpacity="0.30" />
            <stop offset="60%" stopColor={accent} stopOpacity="0.07" />
            <stop offset="100%" stopColor={accent} stopOpacity="0" />
          </linearGradient>
          <linearGradient id={`bcc${angle}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={accent} stopOpacity="0.55" />
            <stop offset="55%" stopColor={accent} stopOpacity="0.12" />
            <stop offset="100%" stopColor={accent} stopOpacity="0" />
          </linearGradient>
          <radialGradient id={pid} cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor={accent} stopOpacity="0.16" />
            <stop offset="100%" stopColor={accent} stopOpacity="0" />
          </radialGradient>
          <radialGradient id={hid} cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor={accent} stopOpacity="0.6" />
            <stop offset="100%" stopColor={accent} stopOpacity="0" />
          </radialGradient>
          <filter id={`bcf${angle}`} x="-40%" y="-25%" width="180%" height="150%">
            <feGaussianBlur stdDeviation="3" />
          </filter>
          <filter id={`bck${angle}`} x="-40%" y="-25%" width="180%" height="150%">
            <feGaussianBlur stdDeviation="1.4" />
          </filter>
        </defs>
        {/* 柔光晕：模糊外发光，让光束像真的灯光而非几何楔形 */}
        <path
          d={`M ${cx} ${apexY} L ${lx} ${endY} A ${ex} ${ry} 0 0 0 ${rx} ${endY} Z`}
          fill={accent}
          fillOpacity="0.1"
          filter={`url(#bcf${angle})`}
        />
        {/* 光束本体：渐变自然衰减 */}
        <path
          d={`M ${cx} ${apexY} L ${lx} ${endY} A ${ex} ${ry} 0 0 0 ${rx} ${endY} Z`}
          fill={`url(#${gid})`}
        />
        {/* 中央热芯：更亮的窄束，强化"发光"体感 */}
        <path
          d={`M ${cx} ${apexY} L ${cx - ex * 0.4} ${endY} A ${ex * 0.4} ${ry * 0.4} 0 0 0 ${cx + ex * 0.4} ${endY} Z`}
          fill={`url(#bcc${angle})`}
          filter={`url(#bck${angle})`}
        />
        {/* 极淡束缘 */}
        <line x1={cx} y1={apexY} x2={lx} y2={endY} stroke={accent} strokeWidth="0.7" strokeOpacity="0.22" />
        <line x1={cx} y1={apexY} x2={rx} y2={endY} stroke={accent} strokeWidth="0.7" strokeOpacity="0.22" />
        {/* 落地光斑：极淡光池 + 前缘实 / 背缘虚 */}
        <ellipse cx={cx} cy={endY} rx={ex * 0.92} ry={ry * 0.92} fill={`url(#${pid})`} />
        <path d={`M ${lx} ${endY} A ${ex} ${ry} 0 0 0 ${rx} ${endY}`} fill="none" stroke={accent} strokeWidth="1" strokeOpacity="0.5" />
        <path d={`M ${lx} ${endY} A ${ex} ${ry} 0 0 1 ${rx} ${endY}`} fill="none" stroke={accent} strokeWidth="0.85" strokeOpacity="0.2" strokeDasharray="2 2.5" />
        {/* 纯光束：不画灯具，只留极淡天花线 + 发光点（光从这里垂下来） */}
        <line x1={cx - 26} y1={apexY} x2={cx + 26} y2={apexY} stroke={ink} strokeWidth="1" strokeOpacity="0.1" />
        <circle cx={cx} cy={apexY} r="7" fill={`url(#${hid})`} />
        <circle cx={cx} cy={apexY} r="2" fill={accent} />
        <circle cx={cx - 0.6} cy={apexY - 0.6} r="0.85" fill="#fff" fillOpacity="0.9" />
      </svg>
      {!hero && (
        <span className="font-mono text-[14px] font-semibold tabular-nums text-[var(--color-ink)]">
          {angle}°
        </span>
      )}
    </div>
  );
}

// 俯视光斑（双轴非对称 / 路面配光，柔和灰）：径向渐变光池 + 长短轴工程标注（端点刻度），各标真实角度。
function BeamFootprint({ major, minor }: { major: number; minor: number }) {
  const VB = 300;
  const VH = 168;
  const cx = 150;
  const cy = 66;
  const maxRx = 96;
  const maxRy = 42;
  // 线性映射（半径∝角度）：比例直观、椭圆不会被压成细条；真实度数由标注给出
  const k = Math.min(maxRx / Math.max(major, 1), maxRy / Math.max(minor, 1));
  const rx = major * k;
  const ry = minor * k;
  const ink = "var(--color-ink)";
  const accent = "var(--color-accent)";
  const dim = "var(--color-ink-muted)";
  const dimY = cy + maxRy + 26;
  const dimX = cx + rx + 28;
  return (
    <div className="flex justify-center rounded-2xl border border-[var(--color-rule)] bg-[var(--color-surface)] px-3 py-5">
      <svg
        viewBox={`0 0 ${VB} ${VH}`}
        className="w-full max-w-[300px]"
        role="img"
        aria-label={`${major}° × ${minor}°`}
      >
        <defs>
          <radialGradient id="bfg" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor={accent} stopOpacity="0.34" />
            <stop offset="55%" stopColor={accent} stopOpacity="0.10" />
            <stop offset="100%" stopColor={accent} stopOpacity="0" />
          </radialGradient>
          <radialGradient id="bfc" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor={accent} stopOpacity="0.7" />
            <stop offset="100%" stopColor={accent} stopOpacity="0" />
          </radialGradient>
          <filter id="bff" x="-30%" y="-60%" width="160%" height="220%">
            <feGaussianBlur stdDeviation="4" />
          </filter>
        </defs>
        {/* 柔光晕（模糊外发光） */}
        <ellipse cx={cx} cy={cy} rx={rx} ry={ry} fill={accent} fillOpacity="0.12" filter="url(#bff)" />
        {/* 光池：径向暖光渐变 */}
        <ellipse cx={cx} cy={cy} rx={rx} ry={ry} fill="url(#bfg)" />
        {/* 等照度环（isolux）：由外到内逐渐变亮 */}
        <ellipse cx={cx} cy={cy} rx={rx} ry={ry} fill="none" stroke={accent} strokeWidth="1" strokeOpacity="0.32" />
        <ellipse cx={cx} cy={cy} rx={rx * 0.7} ry={ry * 0.7} fill="none" stroke={accent} strokeWidth="0.9" strokeOpacity="0.46" />
        <ellipse cx={cx} cy={cy} rx={rx * 0.42} ry={ry * 0.42} fill="none" stroke={accent} strokeWidth="0.85" strokeOpacity="0.6" strokeDasharray="2.5 2.5" />
        {/* 发光中心 */}
        <circle cx={cx} cy={cy} r="7" fill="url(#bfc)" />
        <circle cx={cx} cy={cy} r="2.2" fill={accent} />
        <circle cx={cx - 0.7} cy={cy - 0.7} r="0.9" fill="#fff" fillOpacity="0.9" />
        {/* 长轴标注（横向 = major，中性灰） */}
        <g stroke={dim} strokeWidth="0.9" strokeOpacity="0.65">
          <line x1={cx - rx} y1={dimY} x2={cx + rx} y2={dimY} />
          <line x1={cx - rx} y1={dimY - 4} x2={cx - rx} y2={dimY + 4} />
          <line x1={cx + rx} y1={dimY - 4} x2={cx + rx} y2={dimY + 4} />
        </g>
        <text x={cx} y={dimY + 17} textAnchor="middle" fontFamily="monospace" fontSize="13" fontWeight="600" fill={ink}>
          {major}°
        </text>
        {/* 短轴标注（纵向 = minor，中性灰） */}
        <g stroke={dim} strokeWidth="0.9" strokeOpacity="0.65">
          <line x1={dimX} y1={cy - ry} x2={dimX} y2={cy + ry} />
          <line x1={dimX - 4} y1={cy - ry} x2={dimX + 4} y2={cy - ry} />
          <line x1={dimX - 4} y1={cy + ry} x2={dimX + 4} y2={cy + ry} />
        </g>
        <text x={dimX + 7} y={cy + 4} textAnchor="start" fontFamily="monospace" fontSize="13" fontWeight="600" fill={ink}>
          {minor}°
        </text>
      </svg>
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
  return <LuzdexMark size={20} />;
}
