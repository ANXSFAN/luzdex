"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Globe } from "lucide-react";
import { toast } from "sonner";
import { LOCALE_LABELS, LOCALE_ORDER, type AppLocale } from "@/i18n/routing";
import { setAdminLocale } from "@/app/admin/actions";

export function AdminLanguageSwitcher({ current }: { current: AppLocale }) {
  const router = useRouter();
  const [pending, start] = useTransition();

  function onChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const locale = e.target.value;
    start(async () => {
      try {
        await setAdminLocale(locale);
        router.refresh();
      } catch {
        toast.error("切换语言失败");
      }
    });
  }

  return (
    <div className="relative flex w-full min-w-0 items-center">
      <Globe className="pointer-events-none absolute left-3 h-4 w-4 text-[var(--color-ink-faint)]" />
      <select
        value={current}
        onChange={onChange}
        disabled={pending}
        aria-label="后台界面语言"
        className="w-full min-w-0 appearance-none truncate rounded-lg border border-[var(--color-rule)] bg-transparent py-2 pl-9 pr-3 text-sm text-[var(--color-ink)] transition hover:bg-[var(--color-surface-sunken)] focus:outline-none focus:ring-1 focus:ring-[var(--color-accent)] disabled:opacity-50"
      >
        {LOCALE_ORDER.map((l) => (
          <option key={l} value={l}>
            {LOCALE_LABELS[l]}
          </option>
        ))}
      </select>
    </div>
  );
}
