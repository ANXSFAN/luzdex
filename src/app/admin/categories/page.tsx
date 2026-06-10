import { getTranslations } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import { getActiveFactory } from "@/lib/active-factory";
import { getAdminLocale } from "@/lib/admin-locale";
import { parseNameI18n } from "@/lib/catalog";
import { CategoryManager } from "@/components/category-manager";

export const dynamic = "force-dynamic";

export default async function AdminCategoriesPage() {
  const factory = await getActiveFactory();
  const adminLocale = await getAdminLocale();
  const t = await getTranslations({ locale: adminLocale, namespace: "admin.page" });
  const tc = await getTranslations({ locale: adminLocale, namespace: "admin.common" });

  const [categories, counts] = factory
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
        prisma.product.groupBy({
          by: ["categoryId"],
          where: { factoryId: factory.id },
          _count: { _all: true },
        }),
      ])
    : [[], []];

  const catCounts: Record<string, number> = {};
  for (const g of counts) if (g.categoryId) catCounts[g.categoryId] = g._count._all;

  return (
    <div>
      <div>
        <h1 className="headline-lg text-[26px] text-[var(--color-ink)]">{t("categories")}</h1>
        <p className="mt-1 text-sm text-[var(--color-ink-muted)]">
          {factory ? (
            <>
              <span className="font-medium text-[var(--color-ink)]">{factory.name}</span>
              {" · "}
              {t("categoriesSub")}
            </>
          ) : (
            tc("noFactory")
          )}
        </p>
      </div>

      {factory && (
        <CategoryManager
          categories={categories.map((c) => ({
            id: c.id,
            name: c.name,
            nameI18n: parseNameI18n(c.nameI18n),
            image: c.image,
            icon: c.icon,
            kind: c.kind,
            parentId: c.parentId,
          }))}
          catCounts={catCounts}
        />
      )}
    </div>
  );
}
