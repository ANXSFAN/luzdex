"use client";

import { signOut } from "next-auth/react";
import { LogOut } from "lucide-react";
import { useTranslations } from "next-intl";

export function SignOutButton() {
  const t = useTranslations("admin.common");
  return (
    <button
      onClick={() => signOut({ callbackUrl: "/login" })}
      className="flex items-center gap-1.5 text-sm text-[var(--color-ink-muted)] transition hover:text-[var(--color-ink)]"
    >
      <LogOut className="h-3.5 w-3.5" />
      {t("signOut")}
    </button>
  );
}
