import { notFound } from "next/navigation";
import { after } from "next/server";
import { headers } from "next/headers";
import Link from "next/link";
import { ArrowUpRight, Download, ScanLine } from "lucide-react";
import type { Metadata, Viewport } from "next";
import { hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import { normalizeSource } from "@/lib/channel";
import {
  findPublicProductBySlug,
  findRelatedProducts,
  parseSpecs,
  groupSpecs,
  type ProductSpec,
} from "@/lib/products";
import { ProductGallery } from "@/components/product-gallery";
import { RelatedProducts } from "@/components/related-products";
import { PdfDownloadLink } from "@/components/pdf-download-link";
import { LocaleSwitcher } from "@/components/locale-switcher";
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

  const specs = parseSpecs(product.specs);
  const specGroups = groupSpecs(specs);

  const related = await findRelatedProducts(product);
  const hasRelated =
    related.siblings.length > 0 || related.accessories.length > 0;

  const galleryImages = [
    ...(product.coverImage
      ? [{ url: product.coverImage, alt: product.name }]
      : []),
    ...product.images.map((img) => ({ url: img.url, alt: img.alt })),
  ];

  const supportedLocales = (factory?.supportedLocales ?? [...routing.locales])
    .filter((l): l is AppLocale =>
      (routing.locales as readonly string[]).includes(l)
    );

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
            <span className="font-mono text-[11px] font-medium uppercase tracking-[0.22em] text-[var(--color-ink)]">
              {brandShort}
            </span>
            <span className="hidden font-mono text-[10px] uppercase tracking-[0.22em] text-[var(--color-ink-faint)] sm:inline">
              {t("header.datasheetTag")}
            </span>
          </Link>
          <div className="flex items-center gap-3 font-mono text-[10px] uppercase tracking-[0.22em] text-[var(--color-ink-muted)]">
            <span>{t("header.ref", { ref })}</span>
            <span className="hidden text-[var(--color-ink-faint)] sm:inline">/</span>
            <span className="hidden sm:inline">{t("header.rev", { date: updated })}</span>
            <LocaleSwitcher
              current={locale as AppLocale}
              supported={supportedLocales}
              slug={product.slug}
            />
          </div>
        </div>
      </header>

      <main
        className="relative mx-auto max-w-[1240px] px-5 pb-20 pt-16 sm:px-10 sm:pt-20 lg:pb-24 lg:pt-28"
        style={tenantStyle}
      >
        {/* ── 01 · Identification ───────────────────────────── */}
        <section className="grid grid-cols-1 gap-y-5 lg:grid-cols-12 lg:gap-x-10 lg:gap-y-10">
          <div className="lg:col-span-3">
            <SectionRail
              no="01"
              label={t("identification.label")}
              sub={t("identification.sub")}
            />
          </div>

          <div className="lg:col-span-9">
            <p className="kicker rise-in" data-step="1">
              <span className="dot-filament" aria-hidden />
              <span>{factory?.name ?? "Manufacturer"}</span>
            </p>

            <h1
              className="headline-xl mt-4 text-[40px] leading-[1.03] text-[var(--color-ink)] sm:mt-5 sm:text-[64px] lg:text-[88px] rise-in"
              data-step="2"
            >
              {product.name}
            </h1>

            <p
              className="mt-5 font-mono text-[14px] font-medium uppercase tracking-[0.18em] text-[var(--color-ink)] rise-in"
              data-step="3"
            >
              {product.modelNumber}
            </p>

            {product.description && (
              <div
                className="mt-7 max-w-[44rem] space-y-3 text-[15px] leading-[1.75] text-[var(--color-ink-soft)] rise-in"
                data-step="3"
              >
                {product.description
                  .split(/\n\s*\n/)
                  .filter((s) => s.trim().length > 0)
                  .map((para, i) => (
                    <p key={i}>{para.trim()}</p>
                  ))}
              </div>
            )}

            {/* Spectrum bar — LED nod */}
            <div className="mt-9 flex items-center gap-3 rise-in" data-step="4">
              <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-[var(--color-ink-muted)]">
                2700 K
              </span>
              <div className="spectrum-bar flex-1" />
              <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-[var(--color-ink-muted)]">
                6500 K
              </span>
            </div>

            <dl
              className="mt-8 grid grid-cols-2 gap-y-5 border-t border-[var(--color-rule-strong)] pt-5 sm:grid-cols-4 rise-in"
              data-step="4"
            >
              <SpecCell
                label={t("identification.model")}
                value={product.modelNumber}
                mono
              />
              <SpecCell
                label={t("identification.manufacturer")}
                value={brandShort}
              />
              <SpecCell
                label={t("identification.documents")}
                value={String(product.documents.length).padStart(2, "0")}
                mono
              />
              <SpecCell
                label={t("identification.media")}
                value={String(product.videos.length).padStart(2, "0")}
                mono
              />
            </dl>

            {product.certifications.length > 0 && (
              <div
                className="mt-6 flex flex-wrap items-center gap-2 rise-in"
                data-step="5"
              >
                <span className="font-mono text-[10px] font-medium uppercase tracking-[0.22em] text-[var(--color-ink-muted)]">
                  {t("identification.certs")}
                </span>
                {product.certifications.map((c) => (
                  <span
                    key={c}
                    className="inline-flex items-center rounded-full border border-[var(--color-rule-strong)] px-3 py-1 font-mono text-[10px] font-medium uppercase tracking-[0.18em] text-[var(--color-ink)]"
                  >
                    {c}
                  </span>
                ))}
              </div>
            )}
          </div>
        </section>

        {/* ── Hero gallery ─────────────────────────────────── */}
        {galleryImages.length > 0 && (
          <section className="mt-12 grid grid-cols-1 gap-y-3 lg:mt-16 lg:grid-cols-12 lg:gap-x-10 lg:gap-y-4">
            <div className="lg:col-span-3">
              <div className="flex items-baseline justify-between border-b border-[var(--color-rule)] pb-2 lg:block lg:border-b-0 lg:pb-0">
                <p className="kicker">
                  <span className="kicker-mark">/</span>
                  <span>{t("figures.label")}</span>
                </p>
                <p className="text-[12px] text-[var(--color-ink-muted)] lg:hidden">
                  {t("figures.sub")}
                </p>
              </div>
              <p className="mt-1 hidden text-[13px] text-[var(--color-ink-muted)] lg:block">
                {t("figures.sub")}
              </p>
              <p className="mt-3 hidden max-w-[16rem] text-[12px] leading-relaxed text-[var(--color-ink-muted)] lg:block">
                {galleryImages.length === 1
                  ? t("figures.captionSingle")
                  : t("figures.captionMulti")}
              </p>
            </div>
            <div className="lg:col-span-9">
              <ProductGallery
                images={galleryImages}
                modelNumber={product.modelNumber}
                fallbackAlt={product.name}
              />
            </div>
          </section>
        )}

        {/* ── 02 · Specifications ──────────────────────────── */}
        {specs.length > 0 && (
          <SectionBlock
            no="02"
            label={t("specifications.label")}
            sub={t("specifications.sub")}
            count={specs.length}
          >
            <SpecTable groups={specGroups} />
          </SectionBlock>
        )}

        {/* ── 03 · Documents ───────────────────────────────── */}
        {product.documents.length > 0 && (
          <SectionBlock
            no="03"
            label={t("documents.label")}
            sub={t("documents.sub")}
            count={product.documents.length}
          >
            <ul className="space-y-1">
              {product.documents.map((doc, i) => (
                <li key={doc.id}>
                  <a
                    href={doc.fileUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="doc-row group flex items-center gap-4 py-4 pr-4 pl-4 sm:gap-6 sm:pl-5"
                  >
                    <span className="font-mono text-[11px] font-medium uppercase tracking-[0.14em] text-[var(--color-ink-muted)]">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="font-sans text-[15px] font-medium text-[var(--color-ink)] sm:text-[16px]">
                        {doc.title}
                      </p>
                      <p className="mt-1 truncate font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--color-ink-muted)]">
                        {doc.fileName}
                      </p>
                    </div>
                    <span className="hidden shrink-0 border border-[var(--color-rule)] px-2 py-1 font-mono text-[10px] font-medium uppercase tracking-[0.16em] text-[var(--color-ink-soft)] sm:inline-block">
                      {mimeShort(doc.mimeType)}
                    </span>
                    <span className="hidden w-20 shrink-0 text-right font-mono text-[11px] tabular-nums text-[var(--color-ink-soft)] sm:inline">
                      {fmtSize(doc.fileSize)}
                    </span>
                    <span className="doc-action flex shrink-0 items-center gap-1 font-mono text-[10px] uppercase tracking-[0.18em]">
                      {t("documents.open")}
                      <ArrowUpRight className="h-3.5 w-3.5" strokeWidth={1.5} />
                    </span>
                  </a>
                </li>
              ))}
            </ul>
          </SectionBlock>
        )}

        {/* ── 04 · Media ───────────────────────────────────── */}
        {product.videos.length > 0 && (
          <SectionBlock
            no="04"
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
                      {v.title}
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

        {/* ── 05 · Related ─────────────────────────────────── */}
        {hasRelated && (
          <section className="mt-12 grid grid-cols-1 gap-y-5 lg:mt-20 lg:grid-cols-12 lg:gap-x-10 lg:gap-y-8">
            <div className="lg:col-span-3">
              <SectionRail
                no="05"
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

        {/* Bottom marginalia */}
        <footer className="mt-24 border-t border-[var(--color-ink)] pt-5">
          <div className="grid grid-cols-1 gap-4 font-mono text-[10px] uppercase tracking-[0.22em] text-[var(--color-ink-muted)] sm:grid-cols-3">
            <div className="flex items-center gap-2">
              <ScanLine className="h-3.5 w-3.5" strokeWidth={1.5} />
              <span>{t("footer.access", { date: updated })}</span>
            </div>
            <div className="text-center text-[var(--color-ink-soft)]">
              {t("footer.doc", { ref, model: product.modelNumber })}
            </div>
            <div className="text-right">{t("footer.page")}</div>
          </div>

          <div className="mt-3 flex items-center justify-between">
            <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-[var(--color-ink-faint)]">
              © {year} {factory?.name ?? brandShort}
            </span>
            <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-[var(--color-ink-faint)]">
              {t("footer.end")}
            </span>
          </div>
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

function SpecCell({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div>
      <dt className="font-mono text-[10px] font-medium uppercase tracking-[0.22em] text-[var(--color-ink-muted)]">
        {label}
      </dt>
      <dd
        className={`mt-1.5 text-[15px] text-[var(--color-ink)] ${mono ? "font-mono font-medium tracking-tight" : "font-sans font-medium"}`}
      >
        {value}
      </dd>
    </div>
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
            <div className="mb-3 flex items-baseline gap-3">
              <span className="dot-filament" aria-hidden />
              <span className="font-mono text-[10px] font-medium uppercase tracking-[0.22em] text-[var(--color-ink)]">
                {g.name}
              </span>
              <span className="h-px flex-1 bg-[var(--color-rule)]" />
              <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-[var(--color-ink-muted)]">
                {String(g.items.length).padStart(2, "0")}
              </span>
            </div>
          )}
          <dl className="grid grid-cols-1 gap-x-10 gap-y-0 sm:grid-cols-2">
            {g.items.map((s, i) => (
              <div
                key={`${g.name}-${s.label}-${i}`}
                className="flex items-baseline justify-between gap-4 border-b border-[var(--color-rule)] py-2.5 last:border-b-0 sm:last:border-b"
              >
                <dt className="text-[13px] text-[var(--color-ink-soft)]">
                  {s.label}
                </dt>
                <dd className="text-right font-mono text-[13px] font-medium tabular-nums text-[var(--color-ink)]">
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
