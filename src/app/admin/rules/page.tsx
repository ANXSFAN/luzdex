import { getTranslations } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import { getActiveFactory } from "@/lib/active-factory";
import { getAdminLocale } from "@/lib/admin-locale";
import { parseConditions } from "@/lib/compat";
import { RuleManager } from "@/components/rule-manager";

export const dynamic = "force-dynamic";

export default async function AdminRulesPage() {
  const factory = await getActiveFactory();
  const t = await getTranslations({ locale: await getAdminLocale(), namespace: "admin.page" });

  const [categories, rules] = factory
    ? await Promise.all([
        prisma.category.findMany({
          where: { factoryId: factory.id },
          orderBy: { sortOrder: "asc" },
          select: { id: true, name: true, parentId: true },
        }),
        prisma.compatRule.findMany({
          where: { factoryId: factory.id },
          orderBy: [{ priority: "desc" }, { createdAt: "asc" }],
        }),
      ])
    : [[], []];

  const catNames: Record<string, string> = {};
  for (const c of categories) catNames[c.id] = c.name;

  return (
    <div>
      <div>
        <h1 className="headline-lg text-[26px] text-[var(--color-ink)]">{t("rules")}</h1>
        <p className="mt-1 text-sm text-[var(--color-ink-muted)]">
          {factory ? (
            <>
              <span className="font-medium text-[var(--color-ink)]">{factory.name}</span>
              {" · "}
              {t("rulesSub")}
            </>
          ) : (
            "未选择工厂，请先在顶栏切换「当前工厂」"
          )}
        </p>
      </div>

      {factory &&
        (categories.length < 2 ? (
          <div className="mt-12 rounded-2xl border border-dashed border-[var(--color-rule)] py-14 text-center text-sm text-[var(--color-ink-muted)]">
            规则需要至少两个分类（主品分类 + 配件分类）。请先到「分类」建好分类树。
          </div>
        ) : (
          <RuleManager
            categories={categories}
            catNames={catNames}
            rules={rules.map((r) => ({
              id: r.id,
              label: r.label,
              description: r.description,
              fromCategoryId: r.fromCategoryId,
              toCategoryId: r.toCategoryId,
              relation: r.relation,
              bidirectional: r.bidirectional,
              conditions: parseConditions(r.conditions),
              autoLink: r.autoLink,
              enabled: r.enabled,
              priority: r.priority,
            }))}
          />
        ))}
    </div>
  );
}
