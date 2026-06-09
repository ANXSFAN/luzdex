import { prisma } from "@/lib/prisma";
import { getActiveFactory } from "@/lib/active-factory";
import { getTranslations } from "next-intl/server";
import { productReadiness } from "@/lib/products";
import { parseNameI18n } from "@/lib/catalog";
import { getAdminLocale } from "@/lib/admin-locale";
import { QrExportButton } from "@/components/qr-export-button";
import { Catalog } from "@/components/catalog";

export const dynamic = "force-dynamic";

export default async function AdminCatalogPage({
  searchParams,
}: {
  searchParams: Promise<{ need?: string }>;
}) {
  const { need } = await searchParams;
  const factory = await getActiveFactory();
  const locale = await getAdminLocale();
  const t = await getTranslations({ locale, namespace: "admin.page" });
  const tc = await getTranslations({ locale, namespace: "admin.common" });
  const tm = await getTranslations({ locale, namespace: "more" });

  // Intentional: force-dynamic page, current time each render.
  // eslint-disable-next-line react-hooks/purity
  const since = new Date(Date.now() - 30 * 86400 * 1000);

  const [categories, series, products, scanGroups] = factory
    ? await Promise.all([
        prisma.category.findMany({
          where: { factoryId: factory.id },
          orderBy: { sortOrder: "asc" },
          select: {
            id: true,
            name: true,
            nameI18n: true,
            image: true,
            icon: true,
            kind: true,
            parentId: true,
          },
        }),
        prisma.series.findMany({
          where: { factoryId: factory.id },
          orderBy: { sortOrder: "asc" },
          select: {
            id: true,
            name: true,
            nameI18n: true,
            categoryId: true,
            intro: true,
            introI18n: true,
            coverImage: true,
          },
        }),
        prisma.product.findMany({
          where: { factoryId: factory.id },
          orderBy: { name: "asc" },
          select: {
            id: true,
            name: true,
            modelNumber: true,
            coverImage: true,
            categoryId: true,
            seriesId: true,
            updatedAt: true,
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
            _count: { select: { documents: true, videos: true, images: true } },
          },
        }),
        prisma.scanLog.groupBy({
          by: ["productId"],
          where: { product: { factoryId: factory.id }, scannedAt: { gte: since } },
          _count: { _all: true },
        }),
      ])
    : [[], [], [], []];

  const scanByProduct = new Map(scanGroups.map((g) => [g.productId, g._count._all]));

  const rows = products.map((p) => {
    const r = productReadiness({ ...p, imageCount: p._count.images });
    return {
      id: p.id,
      name: p.name,
      modelNumber: p.modelNumber,
      coverImage: p.coverImage,
      categoryId: p.categoryId,
      seriesId: p.seriesId,
      videos: p._count.videos,
      documents: p._count.documents,
      scans30d: scanByProduct.get(p.id) ?? 0,
      updatedAt: p.updatedAt.toISOString(),
      noImage: r.noImage,
      lacksShowcase: r.lacksShowcase,
      translatedCount: r.translatedCount,
      stale: r.stale,
    };
  });

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="headline-lg text-[26px] text-[var(--color-ink)]">{t("products")}</h1>
          <p className="mt-1 text-sm text-[var(--color-ink-muted)]">
            {factory ? (
              <>
                <span className="font-medium text-[var(--color-ink)]">
                  {factory.name}
                </span>
                {" · "}
                {products.length} {tm("subProducts")} · {categories.length} {tm("subCats")} ·{" "}
                {series.length} {tm("subSeries")}
              </>
            ) : (
              tc("noFactory")
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {products.length > 0 && <QrExportButton />}
        </div>
      </div>

      {!factory ? null : products.length === 0 && categories.length === 0 ? (
        <div className="mt-12 rounded-2xl border border-dashed border-[var(--color-rule)] py-16 text-center">
          <p className="text-sm text-[var(--color-ink-muted)]">
            {tm("emptyProducts")}
          </p>
        </div>
      ) : (
        <Catalog
          categories={categories.map((c) => ({
            id: c.id,
            name: c.name,
            nameI18n: parseNameI18n(c.nameI18n),
            image: c.image,
            icon: c.icon,
            kind: c.kind,
            parentId: c.parentId,
          }))}
          series={series.map((s) => ({
            id: s.id,
            name: s.name,
            nameI18n: parseNameI18n(s.nameI18n),
            categoryId: s.categoryId,
            intro: s.intro,
            introI18n: parseNameI18n(s.introI18n),
            coverImage: s.coverImage,
          }))}
          products={rows}
          initialNeed={need}
        />
      )}
    </div>
  );
}
