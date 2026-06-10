"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { saveProductBasics } from "@/app/admin/products/actions";

const inputCls =
  "w-full rounded-lg border border-[var(--color-rule)] bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-ink)] outline-none transition focus:border-[var(--color-ink)]";
const labelCls =
  "font-mono text-[10px] font-medium uppercase tracking-[0.22em] text-[var(--color-ink-muted)]";

export function BasicInfoEditor({
  productId,
  initialName,
  initialModelNumber,
}: {
  productId: string;
  initialName: string;
  initialModelNumber: string;
}) {
  const router = useRouter();
  const t = useTranslations();
  const [name, setName] = useState(initialName);
  const [modelNumber, setModelNumber] = useState(initialModelNumber);
  const [pending, start] = useTransition();

  function save() {
    start(async () => {
      try {
        await saveProductBasics({ productId, name, modelNumber });
        toast.success(t("prod.basicsTitle"));
        router.refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : t("admin.common.saveFail"));
      }
    });
  }

  return (
    <section className="mt-6 rounded-2xl border border-[var(--color-rule)] bg-[var(--color-surface)] p-6">
      <div className="flex items-baseline justify-between border-b border-[var(--color-rule)] pb-3">
        <p className="font-mono text-[10px] font-medium uppercase tracking-[0.22em] text-[var(--color-ink)]">
          {t("prod.basicsTitle")}
        </p>
        <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-[var(--color-ink-muted)]">
          {t("prod.basicsSub")}
        </span>
      </div>

      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <div>
          <label className={labelCls}>{t("prod.name")}</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t("prod.name")}
            className={`${inputCls} mt-2`}
          />
        </div>
        <div>
          <label className={labelCls}>{t("prod.model")}</label>
          <input
            value={modelNumber}
            onChange={(e) => setModelNumber(e.target.value)}
            placeholder={t("prod.model")}
            className={`${inputCls} mt-2 font-mono`}
          />
        </div>
      </div>

      <div className="mt-5 flex justify-end border-t border-[var(--color-rule)] pt-4">
        <button
          type="button"
          onClick={save}
          disabled={pending}
          className="rounded-lg bg-[var(--color-ink)] px-5 py-2 text-sm font-medium text-[var(--color-surface)] transition hover:opacity-90 disabled:opacity-50"
        >
          {pending ? t("admin.common.saving") : t("admin.common.save")}
        </button>
      </div>
    </section>
  );
}
