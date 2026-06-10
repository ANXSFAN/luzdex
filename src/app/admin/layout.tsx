import Link from "next/link";
import { NextIntlClientProvider } from "next-intl";
import { getTranslations } from "next-intl/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getActiveFactory } from "@/lib/active-factory";
import { getAdminLocale } from "@/lib/admin-locale";
import { SignOutButton } from "@/components/sign-out-button";
import { FactorySwitcher } from "@/components/factory-switcher";
import { AdminNav } from "@/components/admin-nav";
import { AdminLanguageSwitcher } from "@/components/admin-language-switcher";
import { LuzHubMark } from "@/components/luzhub-mark";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const locale = await getAdminLocale();
  const [session, factories, activeFactory, messages, t] = await Promise.all([
    auth(),
    prisma.factory.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true, brandShort: true },
    }),
    getActiveFactory(),
    import(`../../../messages/${locale}.json`).then((m) => m.default),
    getTranslations({ locale, namespace: "admin" }),
  ]);

  return (
    <NextIntlClientProvider locale={locale} messages={messages}>
      <div className="flex min-h-screen flex-col lg:flex-row">
        {/* 侧边栏 */}
        <aside className="border-b border-[var(--color-rule)] bg-[var(--color-surface)] lg:sticky lg:top-0 lg:h-screen lg:w-56 lg:shrink-0 lg:border-b-0 lg:border-r">
          <div className="flex h-full flex-col gap-4 px-4 py-4 lg:px-5 lg:py-6">
            <Link
              href="/admin"
              className="flex items-center gap-2 font-mono text-sm uppercase tracking-[0.22em] text-[var(--color-ink)] transition hover:opacity-70"
            >
              <LuzHubMark size={18} />
              {t("brand")}
            </Link>

            <AdminNav />

            {/* 底部：语言 + 当前工厂 + 账号 + 退出 */}
            <div className="mt-auto space-y-3 border-t border-[var(--color-rule)] pt-4">
              <AdminLanguageSwitcher current={locale} />
              <FactorySwitcher
                factories={factories}
                activeId={activeFactory?.id ?? null}
              />
              <div className="flex items-center justify-between gap-2">
                <span className="truncate text-sm text-[var(--color-ink-muted)]">
                  {session?.user?.name}
                </span>
                <SignOutButton />
              </div>
            </div>
          </div>
        </aside>

        {/* 主内容：流式铺满主区域，不固定宽度 */}
        <main className="min-w-0 flex-1">
          <div className="px-5 py-8 sm:px-8 lg:px-10">{children}</div>
        </main>
      </div>
    </NextIntlClientProvider>
  );
}
