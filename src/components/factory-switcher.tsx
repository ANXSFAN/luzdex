"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { ChevronsUpDown } from "lucide-react";
import { toast } from "sonner";
import { setActiveFactory } from "@/app/admin/actions";

type Option = { id: string; name: string; brandShort: string | null };

/**
 * 平台代运营：顶栏切换「当前工厂」。同步 / 产品 / 导入均跟随此选择。
 */
export function FactorySwitcher({
  factories,
  activeId,
}: {
  factories: Option[];
  activeId: string | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  if (factories.length === 0) return null;

  function onChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const id = e.target.value;
    startTransition(async () => {
      try {
        await setActiveFactory(id);
        router.refresh();
      } catch {
        toast.error("切换工厂失败");
      }
    });
  }

  return (
    <div className="relative flex items-center">
      <span className="pointer-events-none absolute left-3 font-mono text-[9px] uppercase tracking-[0.22em] text-[var(--color-ink-faint)]">
        厂
      </span>
      <select
        value={activeId ?? ""}
        onChange={onChange}
        disabled={pending}
        aria-label="当前工厂"
        className="appearance-none rounded-full border border-[var(--color-rule)] bg-transparent py-1.5 pl-9 pr-8 font-mono text-[11px] tracking-[0.04em] text-[var(--color-ink)] transition hover:bg-[var(--color-surface-sunken)] focus:outline-none focus:ring-1 focus:ring-[var(--color-accent)] disabled:opacity-50"
      >
        {factories.map((f) => (
          <option key={f.id} value={f.id}>
            {f.name}
            {f.brandShort ? ` · ${f.brandShort}` : ""}
          </option>
        ))}
      </select>
      <ChevronsUpDown className="pointer-events-none absolute right-3 h-3 w-3 text-[var(--color-ink-muted)]" />
    </div>
  );
}
