"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  LayoutDashboard,
  Package,
  FolderTree,
  Tag,
  Workflow,
  BarChart3,
  Upload,
  Building2,
} from "lucide-react";

const ITEMS = [
  { href: "/admin", key: "overview", icon: LayoutDashboard, exact: true },
  { href: "/admin/products", key: "products", icon: Package },
  { href: "/admin/categories", key: "categories", icon: FolderTree },
  { href: "/admin/series", key: "series", icon: Tag },
  { href: "/admin/rules", key: "rules", icon: Workflow },
  { href: "/admin/analytics", key: "analytics", icon: BarChart3 },
  { href: "/admin/import", key: "import", icon: Upload },
  { href: "/admin/factory", key: "factories", icon: Building2 },
];

export function AdminNav() {
  const pathname = usePathname();
  const t = useTranslations("admin.nav");
  return (
    <nav className="flex gap-1 lg:flex-col">
      {ITEMS.map((it) => {
        const active = it.exact
          ? pathname === it.href
          : pathname.startsWith(it.href);
        const Icon = it.icon;
        return (
          <Link
            key={it.href}
            href={it.href}
            className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition ${
              active
                ? "bg-[var(--color-ink)] text-[var(--color-surface)]"
                : "text-[var(--color-ink-soft)] hover:bg-[var(--color-surface-sunken)] hover:text-[var(--color-ink)]"
            }`}
          >
            <Icon className="h-4 w-4 shrink-0" strokeWidth={1.75} />
            <span className="font-medium">{t(it.key)}</span>
          </Link>
        );
      })}
    </nav>
  );
}
