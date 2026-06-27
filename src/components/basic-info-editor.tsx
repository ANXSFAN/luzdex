"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { saveProductBasics, patchTranslation } from "@/app/admin/products/actions";
import { useProductLocale } from "@/components/product-i18n";

const inputCls =
  "w-full rounded-lg border border-[var(--color-rule)] bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-ink)] outline-none transition focus:border-[var(--color-ink)]";
const labelCls =
  "font-mono text-[10px] font-medium uppercase tracking-[0.22em] text-[var(--color-ink-muted)]";

/**
 * 产品型号（语言无关）：放在语言栏上方，任何语言 tab 下都是同一个值、随时可改。
 */
export function ProductModelEditor({
  productId,
  initialModelNumber,
}: {
  productId: string;
  initialModelNumber: string;
}) {
  const router = useRouter();
  const t = useTranslations();
  const [modelNumber, setModelNumber] = useState(initialModelNumber);
  const [pending, start] = useTransition();

  function save() {
    start(async () => {
      try {
        await saveProductBasics({ productId, modelNumber });
        toast.success(t("prod.basicsTitle"));
        router.refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : t("admin.common.saveFail"));
      }
    });
  }

  return (
    <section className="mt-6 rounded-2xl border border-[var(--color-rule)] bg-[var(--color-surface)] p-6">
      <div className="flex items-end gap-4">
        <div className="flex-1">
          <label className={labelCls}>{t("prod.model")}</label>
          <input
            value={modelNumber}
            onChange={(e) => setModelNumber(e.target.value)}
            placeholder={t("prod.model")}
            className={`${inputCls} mt-2 font-mono`}
          />
        </div>
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

type BasicInfoProps = {
  productId: string;
  initialName: string;
  nameTranslations: Record<string, string>;
};

// 切语言 = 换一份内容：用 key 重挂载内层、按当前语言初始化，省去 effect 重置 state。
export function BasicInfoEditor(props: BasicInfoProps) {
  const { editingLocale } = useProductLocale();
  return <BasicInfoEditorInner key={editingLocale} {...props} />;
}

function BasicInfoEditorInner({
  productId,
  initialName,
  nameTranslations,
}: BasicInfoProps) {
  const router = useRouter();
  const t = useTranslations();
  const { editingLocale, isBase } = useProductLocale();
  // 主语言显示主字段名，其余语言显示该语言译名（缺则空，前台回退主字段名）
  const [name, setName] = useState(
    isBase ? initialName : nameTranslations[editingLocale] ?? "",
  );
  const [pending, start] = useTransition();

  function save() {
    start(async () => {
      try {
        if (isBase) {
          await saveProductBasics({ productId, name });
        } else {
          await patchTranslation({ productId, locale: editingLocale, name });
        }
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

      <div className="mt-5">
        <label className={labelCls}>
          {isBase ? t("prod.name") : t("show.transName")}
        </label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={t("prod.name")}
          className={`${inputCls} mt-2`}
        />
        {!isBase && (
          <p className="mt-1.5 text-[11px] text-[var(--color-ink-faint)]">
            {t("show.transNameHint")}
          </p>
        )}
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
