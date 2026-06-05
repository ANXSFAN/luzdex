import Link from "next/link";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getActiveFactory } from "@/lib/active-factory";
import { SignOutButton } from "@/components/sign-out-button";
import { FactorySwitcher } from "@/components/factory-switcher";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  const [factories, activeFactory] = await Promise.all([
    prisma.factory.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true, brandShort: true },
    }),
    getActiveFactory(),
  ]);

  return (
    <div className="min-h-screen">
      <header className="glass-nav sticky top-0 z-20 border-b border-[var(--color-rule)]">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-5 py-3 sm:px-8">
          <div className="flex items-center gap-6">
            <Link
              href="/admin"
              className="font-mono text-[11px] uppercase tracking-[0.22em] text-[var(--color-ink)] transition hover:opacity-70"
            >
              Datasheet Admin
            </Link>
            <nav className="flex items-center gap-4">
              <Link
                href="/admin"
                className="font-mono text-[11px] uppercase tracking-[0.18em] text-[var(--color-ink-muted)] transition hover:text-[var(--color-ink)]"
              >
                Products
              </Link>
              <Link
                href="/admin/analytics"
                className="font-mono text-[11px] uppercase tracking-[0.18em] text-[var(--color-ink-muted)] transition hover:text-[var(--color-ink)]"
              >
                Analytics
              </Link>
              <Link
                href="/admin/import"
                className="font-mono text-[11px] uppercase tracking-[0.18em] text-[var(--color-ink-muted)] transition hover:text-[var(--color-ink)]"
              >
                Import
              </Link>
              <Link
                href="/admin/factory"
                className="font-mono text-[11px] uppercase tracking-[0.18em] text-[var(--color-ink-muted)] transition hover:text-[var(--color-ink)]"
              >
                Factories
              </Link>
            </nav>
          </div>
          <div className="flex items-center gap-4">
            <FactorySwitcher
              factories={factories}
              activeId={activeFactory?.id ?? null}
            />
            <span className="hidden text-xs text-[var(--color-ink-muted)] sm:inline">
              {session?.user?.name}
            </span>
            <SignOutButton />
          </div>
        </div>
      </header>
      <div className="mx-auto max-w-4xl px-5 py-8 sm:px-8">{children}</div>
    </div>
  );
}
