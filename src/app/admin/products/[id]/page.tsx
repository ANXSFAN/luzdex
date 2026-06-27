import { notFound } from "next/navigation";
import Link from "next/link";
import { ChevronLeft, ExternalLink } from "lucide-react";
import { prisma } from "@/lib/prisma";
import {
  siteUrl,
  parseAttributes,
  parseHighlights,
  parseDetailBlocks,
  parseApplications,
  parseFaq,
  parseBoxContents,
  parseInstall,
  parseDimensionsJson,
  parseContentI18n,
  contentSourceHash,
  parseSpecs,
  localizedProductName,
} from "@/lib/products";
import { getAdminLocale } from "@/lib/admin-locale";
import { getTranslations } from "next-intl/server";
import { suggestByRules, parseConditions, type CompatRuleData } from "@/lib/compat";
import { listAttributes } from "@/lib/attributes";
import { attrLabel, type AttrDefLite } from "@/lib/attribute-defaults";
import { QrCard } from "@/components/qr-card";
import { MaterialManager } from "@/components/material-manager";
import { ProductRelations } from "@/components/product-relations";
import { ShowcaseEditor } from "@/components/showcase-editor";
import { ProductI18nProvider, ProductLocaleBar } from "@/components/product-i18n";
import { GalleryManager } from "@/components/gallery-manager";
import { SpecsEditor } from "@/components/specs-editor";
import { DeleteProductButton } from "@/components/delete-product-button";
import { BasicInfoEditor, ProductModelEditor } from "@/components/basic-info-editor";
import { VariantManager } from "@/components/variant-manager";
import { DuplicateProductButton } from "@/components/duplicate-product-button";
import { PdfIntakeCard } from "@/components/pdf-intake-card";

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
        images: { orderBy: { sortOrder: "asc" } },
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

  const adminLocale = await getAdminLocale();
  const tp = await getTranslations({ locale: adminLocale, namespace: "prod" });

  // 配件关系 + 规则引擎建议（同工厂候选池）。候选名按后台语言取译名展示。
  const [rawCandidates, ruleCats, rawRules, rawAttrDefs] = await Promise.all([
    prisma.product.findMany({
      where: { factoryId: product.factoryId, id: { not: product.id } },
      select: {
        id: true,
        modelNumber: true,
        name: true,
        category: true,
        categoryId: true,
        attributes: true,
        variantLabel: true,
        variantGroupId: true,
        contentI18n: true,
      },
      orderBy: { name: "asc" },
    }),
    prisma.category.findMany({
      where: { factoryId: product.factoryId },
      select: { id: true, parentId: true },
    }),
    prisma.compatRule.findMany({
      where: { factoryId: product.factoryId, enabled: true },
      orderBy: { priority: "desc" },
    }),
    listAttributes(product.factoryId),
  ]);
  // 字典 → 客户端轻量形状（label 按后台语言本地化）
  const attrDefs: AttrDefLite[] = rawAttrDefs.map((d) => ({
    key: d.key,
    label: attrLabel(d, adminLocale),
    srcName: d.name,
    unit: d.unit ?? "",
    type: d.type,
    options: d.options,
  }));
  const candidates = rawCandidates.map((c) => ({
    ...c,
    name: localizedProductName(c.name, c.contentI18n, adminLocale),
  }));
  const candI18nById = new Map(rawCandidates.map((c) => [c.id, c.contentI18n]));

  const attrs = parseAttributes(product.attributes);
  const links = product.linksOut.map((l) => ({
    linkId: l.id,
    toId: l.toId,
    relation: l.relation,
    modelNumber: l.to.modelNumber,
    name: localizedProductName(
      l.to.name,
      candI18nById.get(l.toId) ?? null,
      adminLocale
    ),
    category: l.to.category,
  }));
  const excludeIds = new Set<string>([product.id, ...links.map((l) => l.toId)]);

  const rules: CompatRuleData[] = rawRules.map((r) => ({
    id: r.id,
    label: r.label,
    fromCategoryId: r.fromCategoryId,
    toCategoryId: r.toCategoryId,
    relation: r.relation,
    bidirectional: r.bidirectional,
    conditions: parseConditions(r.conditions),
    enabled: r.enabled,
    priority: r.priority,
  }));
  const catById = new Map(candidates.map((c) => [c.id, c.category]));
  const ruleSuggestions = suggestByRules({
    product: {
      id: product.id,
      modelNumber: product.modelNumber,
      name: product.name,
      categoryId: product.categoryId,
      attributes: attrs as Record<string, unknown>,
    },
    candidates: candidates.map((c) => ({
      id: c.id,
      modelNumber: c.modelNumber,
      name: c.name,
      categoryId: c.categoryId,
      attributes: parseAttributes(c.attributes) as Record<string, unknown>,
    })),
    rules,
    categories: ruleCats,
    excludeIds,
  });
  const suggestions = ruleSuggestions.map((s) => ({
    toId: s.toId,
    modelNumber: s.modelNumber,
    name: s.name,
    category: catById.get(s.toId) ?? null,
    relation: s.relation === "alternative" ? "alternative" : "accessory",
    reason: `${s.ruleLabel}：${s.reasons.join(" · ")}`,
  }));

  const datasheetUrl = `${siteUrl()}/p/${product.slug}`;

  // 变体组：当前产品 + 同组候选；其余产品进下拉（标注已在别组的）。
  const variantMembers = [
    {
      id: product.id,
      modelNumber: product.modelNumber,
      name: localizedProductName(product.name, product.contentI18n, adminLocale),
      variantLabel: product.variantLabel,
    },
    ...candidates
      .filter(
        (c) =>
          product.variantGroupId != null &&
          c.variantGroupId === product.variantGroupId
      )
      .map((c) => ({
        id: c.id,
        modelNumber: c.modelNumber,
        name: c.name,
        variantLabel: c.variantLabel,
      })),
  ].sort((a, b) =>
    (a.variantLabel ?? a.modelNumber).localeCompare(
      b.variantLabel ?? b.modelNumber,
      undefined,
      { numeric: true }
    )
  );
  const memberIds = new Set(variantMembers.map((m) => m.id));
  const variantCandidates = candidates
    .filter((c) => !memberIds.has(c.id))
    .map((c) => ({
      id: c.id,
      modelNumber: c.modelNumber,
      name: c.name,
      grouped: c.variantGroupId != null,
    }));

  const initialHighlights = parseHighlights(product.highlights).map((h) => ({
    icon: h.icon,
    label: h.label,
    value: h.value ?? "",
  }));
  const initialBlocks = parseDetailBlocks(product.detailBlocks).map((b) =>
    b.kind === "image"
      ? { kind: "image" as const, url: b.url, caption: b.caption ?? "" }
      : b
  );
  const initialApplications = parseApplications(product.applications).map(
    (a) => ({
      icon: a.icon,
      title: a.title,
      desc: a.desc ?? "",
      image: a.image ?? "",
    })
  );
  const initialFaq = parseFaq(product.faq);
  const initialBoxContents = parseBoxContents(product.boxContents).map((b) => ({
    item: b.item,
    qty: b.qty ?? "",
  }));
  const initialInstall = parseInstall(product.install);
  const d = parseDimensionsJson(product.dimensions);
  const initialDim = {
    w: d ? String(d.w) : "",
    h: d ? String(d.h) : "",
    d: d?.d != null ? String(d.d) : "",
    unit: d?.unit ?? "",
    cutout: d?.cutout ?? "",
  };
  const initialSpecs = parseSpecs(product.specs).map((s) => ({
    group: s.group ?? "",
    label: s.label,
    value: s.value,
    unit: s.unit ?? "",
    key: s.key ?? "",
  }));
  const ci = parseContentI18n(product.contentI18n);
  const translatedLocales = Object.keys(ci);
  // 各语言译文 → 编辑器形状，供语言模式编辑器加载
  const initialTranslations = Object.fromEntries(
    Object.entries(ci).map(([loc, c]) => [
      loc,
      {
        name: c.name ?? "",
        tagline: c.tagline ?? "",
        description: c.description ?? "",
        highlights: (c.highlights ?? []).map((h) => ({
          icon: h.icon,
          label: h.label,
          value: h.value ?? "",
        })),
        blocks: (c.detailBlocks ?? []).map((b) =>
          b.kind === "image"
            ? { kind: "image" as const, url: b.url, caption: b.caption ?? "" }
            : b
        ),
        applications: (c.applications ?? []).map((a) => ({
          icon: a.icon,
          title: a.title,
          desc: a.desc ?? "",
          image: a.image ?? "",
        })),
        faq: c.faq ?? [],
        boxContents: (c.boxContents ?? []).map((b) => ({
          item: b.item,
          qty: b.qty ?? "",
        })),
        installMethod: c.install?.method ?? "",
        installSteps: c.install?.steps ?? [],
        dimCutout: c.dimensions?.cutout ?? "",
      },
    ])
  );
  // 译文是否已过期：有译文 + 有指纹 + 当前源内容指纹与之不符
  const translationStale =
    translatedLocales.length > 0 &&
    !!product.translationStamp &&
    contentSourceHash(product) !== product.translationStamp;

  // 当前基准语言（主字段语言）；各卡片在「非基准语言」tab 下读写下列各语言译文包。
  const sourceLocale = product.sourceLocale ?? "es";
  const nameTranslations: Record<string, string> = {};
  const specsTranslations: Record<
    string,
    { group: string; label: string; value: string; unit: string; key: string }[]
  > = {};
  const docTitleTrans: Record<string, string[]> = {};
  const videoTitleTrans: Record<string, string[]> = {};
  for (const [loc, c] of Object.entries(ci)) {
    if (c.name) nameTranslations[loc] = c.name;
    if (c.specs?.length)
      specsTranslations[loc] = c.specs.map((sp) => ({
        group: sp.group ?? "",
        label: sp.label,
        value: sp.value,
        unit: sp.unit ?? "",
        key: "",
      }));
    if (c.docTitles?.length) docTitleTrans[loc] = c.docTitles;
    if (c.videoTitles?.length) videoTitleTrans[loc] = c.videoTitles;
  }

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
        href="/admin/products"
        className="flex w-fit items-center gap-1 text-xs text-[var(--color-ink-muted)] transition hover:text-[var(--color-ink)]"
      >
        <ChevronLeft className="h-3.5 w-3.5" />
        {tp("backToList")}
      </Link>

      <div className="mt-4 flex items-start justify-between gap-4">
        <div>
          <h1 className="headline-lg text-[26px] text-[var(--color-ink)]">
            {localizedProductName(product.name, product.contentI18n, adminLocale)}
          </h1>
          <p className="mt-1 font-mono text-sm text-[var(--color-ink-muted)]">
            {product.modelNumber}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-4">
          <DuplicateProductButton productId={product.id} />
          <a
            href={datasheetUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex shrink-0 items-center gap-1.5 text-xs text-[var(--color-ink-muted)] transition hover:text-[var(--color-ink)]"
          >
            {tp("previewPublic")}
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        </div>
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
          <Stat label={tp("statScans")} value={totalScans} />
          <Stat label={tp("statPdf")} value={pdfDownloads} />
          <Stat label={tp("statConv")} value={pdfConv} suffix="%" />
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
              {tp("bySource")}
            </p>
            <div className="mt-3 space-y-2">
              {sourceRows.map(([key, n]) => {
                const label =
                  key === "__direct" ? tp("directSource") : key;
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

      <PdfIntakeCard
        productId={product.id}
        occupied={{
          basics: true,
          tagline: !!product.tagline,
          description: !!product.description,
          luminaireType: !!product.luminaireType,
          specs: initialSpecs.length > 0,
          certifications: product.certifications.length > 0,
          attributes: Object.keys(attrs).length > 0,
          highlights: initialHighlights.length > 0,
          boxContents: initialBoxContents.length > 0,
          install: !!initialInstall,
          dimensions: !!d,
        }}
      />

      <ProductModelEditor
        productId={product.id}
        initialModelNumber={product.modelNumber}
      />

      <ProductI18nProvider baseLocale={sourceLocale}>
      <ProductLocaleBar
        productId={product.id}
        translatedLocales={translatedLocales}
        translationStale={translationStale}
      />

      <BasicInfoEditor
        productId={product.id}
        initialName={product.name}
        nameTranslations={nameTranslations}
      />

      <GalleryManager
        productId={product.id}
        coverImage={product.coverImage}
        images={product.images.map((img) => ({
          id: img.id,
          url: img.url,
          alt: img.alt,
        }))}
      />

      <SpecsEditor
        productId={product.id}
        initialSpecs={initialSpecs}
        initialCerts={product.certifications}
        attrDefs={attrDefs}
        specsTranslations={specsTranslations}
      />

      <ShowcaseEditor
        productId={product.id}
        initialTagline={product.tagline ?? ""}
        initialVariantLabel={product.variantLabel ?? ""}
        initialDescription={product.description ?? ""}
        initialLuminaireType={product.luminaireType ?? ""}
        initialHighlights={initialHighlights}
        initialBlocks={initialBlocks}
        initialApplications={initialApplications}
        initialFaq={initialFaq}
        initialBoxContents={initialBoxContents}
        initialInstallMethod={initialInstall?.method ?? ""}
        initialInstallSteps={initialInstall?.steps ?? []}
        initialDim={initialDim}
        initialTranslations={initialTranslations}
      />

      <VariantManager
        productId={product.id}
        members={variantMembers}
        candidates={variantCandidates}
      />

      <ProductRelations
        productId={product.id}
        category={product.category}
        series={product.series}
        attributes={attrs}
        attrDefs={attrDefs}
        links={links}
        suggestions={suggestions}
        candidateModels={candidates.map((c) => c.modelNumber)}
      />

      <MaterialManager
        productId={product.id}
        documents={product.documents}
        videos={product.videos}
        docTitleTrans={docTitleTrans}
        videoTitleTrans={videoTitleTrans}
      />

      <DeleteProductButton
        productId={product.id}
        productName={localizedProductName(product.name, product.contentI18n, adminLocale)}
      />
      </ProductI18nProvider>
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
