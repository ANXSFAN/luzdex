import { getTranslations } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import { getActiveFactory } from "@/lib/active-factory";
import { getAdminLocale } from "@/lib/admin-locale";
import { parseNameI18n } from "@/lib/catalog";
import { SeriesManager } from "@/components/series-manager";

export const dynamic = "force-dynamic";

export default async function AdminSeriesPage() {
  const factory = await getActiveFactory();
  const t = await getTranslations({ locale: await getAdminLocale(), namespace: "admin.page" });

  const [series, categories, counts] = factory
    ? await Promise.all([
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
        prisma.category.findMany({
          where: { factoryId: factory.id },
          orderBy: { sortOrder: "asc" },
          select: { id: true, name: true },
        }),
        prisma.product.groupBy({
          by: ["seriesId"],
          where: { factoryId: factory.id },
          _count: { _all: true },
        }),
      ])
    : [[], [], []];

  const serCounts: Record<string, number> = {};
  for (const g of counts) if (g.seriesId) serCounts[g.seriesId] = g._count._all;

  return (
    <div>
      <div>
        <h1 className="headline-lg text-[26px] text-[var(--color-ink)]">{t("series")}</h1>
        <p className="mt-1 text-sm text-[var(--color-ink-muted)]">
          {factory ? (
            <>
              <span className="font-medium text-[var(--color-ink)]">{factory.name}</span>
              {" · "}
              {t("seriesSub")}
            </>
          ) : (
            "未选择工厂，请先在顶栏切换「当前工厂」"
          )}
        </p>
      </div>

      {factory && (
        <SeriesManager
          series={series.map((s) => ({
            id: s.id,
            name: s.name,
            nameI18n: parseNameI18n(s.nameI18n),
            categoryId: s.categoryId,
            intro: s.intro,
            introI18n: parseNameI18n(s.introI18n),
            coverImage: s.coverImage,
          }))}
          categories={categories}
          serCounts={serCounts}
        />
      )}
    </div>
  );
}
