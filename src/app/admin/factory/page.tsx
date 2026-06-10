import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import { getAdminLocale } from "@/lib/admin-locale";

export const dynamic = "force-dynamic";

export default async function AdminFactoryListPage() {
  const t = await getTranslations({ locale: await getAdminLocale(), namespace: "admin.page" });
  const factories = await prisma.factory.findMany({
    orderBy: { name: "asc" },
    include: { _count: { select: { products: true } } },
  });

  return (
    <div>
      <div>
        <h1 className="headline-lg text-[26px] text-[var(--color-ink)]">{t("factories")}</h1>
        <p className="mt-1 text-sm text-[var(--color-ink-muted)]">
          {t("factoryCount", { n: factories.length })}
        </p>
      </div>

      {factories.length === 0 ? (
        <div className="mt-12 rounded-2xl border border-dashed border-[var(--color-rule)] py-16 text-center">
          <p className="text-sm text-[var(--color-ink-muted)]">
            {t("factoryEmpty")}
          </p>
        </div>
      ) : (
        <ul className="mt-6 space-y-1">
          {factories.map((f) => (
            <li key={f.id}>
              <Link
                href={`/admin/factory/${f.id}`}
                className="doc-row flex items-center justify-between gap-4 px-4 py-4"
              >
                <div className="flex min-w-0 items-center gap-3">
                  {f.accentColor && (
                    <span
                      aria-hidden
                      className="h-8 w-8 shrink-0 rounded-lg border border-[var(--color-rule)]"
                      style={{ backgroundColor: f.accentColor }}
                    />
                  )}
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-[var(--color-ink)]">
                      {f.name}
                      {f.brandShort && (
                        <span className="ml-2 font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--color-ink-muted)]">
                          · {f.brandShort}
                        </span>
                      )}
                    </p>
                    <p className="mt-0.5 truncate font-mono text-[11px] text-[var(--color-ink-muted)]">
                      {f.contactEmail ?? "—"}
                      {f.contactWhatsapp ? `  ·  ${f.contactWhatsapp}` : ""}
                    </p>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-4 text-xs text-[var(--color-ink-muted)]">
                  <span className="font-mono">
                    {f._count.products} products
                  </span>
                  <ChevronRight className="h-4 w-4" />
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
