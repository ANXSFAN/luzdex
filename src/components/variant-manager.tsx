"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { X, CopyPlus } from "lucide-react";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import {
  addVariantMember,
  removeVariantMember,
  saveVariantLabel,
  duplicateProduct,
} from "@/app/admin/products/actions";

const inputCls =
  "w-full rounded-lg border border-[var(--color-rule)] bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-ink)] outline-none transition focus:border-[var(--color-ink)]";

export type VariantMember = {
  id: string;
  modelNumber: string;
  name: string;
  variantLabel: string | null;
};

export type VariantCandidate = {
  id: string;
  modelNumber: string;
  name: string;
  /** 已在别的变体组——加入即从旧组移过来。 */
  grouped: boolean;
};

/**
 * 变体组管理卡：维护「同款不同规格」的产品组（驱动前台规格选择 + 变体对比）。
 * 组成员逐行编辑规格标签、可移出；下拉从同工厂其余产品里挑人入组。
 */
export function VariantManager({
  productId,
  members,
  candidates,
}: {
  productId: string;
  members: VariantMember[];
  candidates: VariantCandidate[];
}) {
  const router = useRouter();
  const t = useTranslations();
  const [labels, setLabels] = useState<Record<string, string>>(() =>
    Object.fromEntries(members.map((m) => [m.id, m.variantLabel ?? ""]))
  );
  const [pickId, setPickId] = useState("");
  const [pending, start] = useTransition();

  const hasGroup = members.length > 1;
  const dirty = members.some(
    (m) => (labels[m.id] ?? "") !== (m.variantLabel ?? "")
  );

  function add() {
    if (!pickId) return;
    start(async () => {
      try {
        await addVariantMember({ productId, otherId: pickId });
        setPickId("");
        toast.success(t("prod.variantTitle"));
        router.refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Error");
      }
    });
  }

  function remove(memberId: string) {
    start(async () => {
      try {
        await removeVariantMember({ productId, memberId });
        toast.success(t("prod.variantTitle"));
        router.refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Error");
      }
    });
  }

  function duplicateAsVariant() {
    start(async () => {
      try {
        const id = await duplicateProduct({ productId, asVariant: true });
        toast.success(t("prod.duplicatedOk"));
        router.push(`/admin/products/${id}`);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Error");
      }
    });
  }

  function saveLabels() {
    start(async () => {
      try {
        for (const m of members) {
          const next = labels[m.id] ?? "";
          if (next !== (m.variantLabel ?? "")) {
            await saveVariantLabel({ productId, memberId: m.id, label: next });
          }
        }
        toast.success(t("prod.variantTitle"));
        router.refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Error");
      }
    });
  }

  return (
    <section className="mt-6 rounded-2xl border border-[var(--color-rule)] bg-[var(--color-surface)] p-6">
      <div className="flex items-baseline justify-between border-b border-[var(--color-rule)] pb-3">
        <p className="font-mono text-[10px] font-medium uppercase tracking-[0.22em] text-[var(--color-ink)]">
          {t("prod.variantTitle")}
        </p>
        <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-[var(--color-ink-muted)]">
          {t("prod.variantSub")}
        </span>
      </div>

      {hasGroup ? (
        <>
          <ul className="mt-4 divide-y divide-[var(--color-rule)]">
            {members.map((m) => {
              const isCurrent = m.id === productId;
              return (
                <li
                  key={m.id}
                  className="flex flex-wrap items-center gap-x-4 gap-y-2 py-3"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      {isCurrent ? (
                        <span className="font-mono text-xs font-semibold text-[var(--color-ink)]">
                          {m.modelNumber}
                        </span>
                      ) : (
                        <Link
                          href={`/admin/products/${m.id}`}
                          className="font-mono text-xs text-[var(--color-ink)] underline-offset-2 hover:underline"
                        >
                          {m.modelNumber}
                        </Link>
                      )}
                      {isCurrent && (
                        <span className="rounded-full bg-[var(--color-ink)] px-2 py-0.5 font-mono text-[9px] font-semibold uppercase tracking-[0.14em] text-[var(--color-surface)]">
                          {t("prod.variantCurrent")}
                        </span>
                      )}
                    </div>
                    <p className="mt-0.5 truncate text-xs text-[var(--color-ink-muted)]">
                      {m.name}
                    </p>
                  </div>
                  <input
                    value={labels[m.id] ?? ""}
                    onChange={(e) =>
                      setLabels((s) => ({ ...s, [m.id]: e.target.value }))
                    }
                    placeholder={t("prod.variantLabelPh")}
                    className={`${inputCls} w-48 font-mono`}
                  />
                  <button
                    type="button"
                    onClick={() => remove(m.id)}
                    disabled={pending}
                    title={t("prod.variantRemove")}
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-[var(--color-rule)] text-[var(--color-ink-muted)] transition hover:border-[var(--color-ink)] hover:text-[var(--color-ink)] disabled:opacity-50"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </li>
              );
            })}
          </ul>
          <p className="mt-2 text-xs text-[var(--color-ink-faint)]">
            {t("prod.variantLabelHint")}
          </p>
        </>
      ) : (
        <p className="mt-4 text-sm text-[var(--color-ink-muted)]">
          {t("prod.variantEmpty")}
        </p>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-[var(--color-rule)] pt-4">
        <select
          value={pickId}
          onChange={(e) => setPickId(e.target.value)}
          className={`${inputCls} max-w-md flex-1`}
        >
          <option value="">{t("prod.variantPickPh")}</option>
          {candidates.map((c) => (
            <option key={c.id} value={c.id}>
              {c.modelNumber} · {c.name}
              {c.grouped ? ` (${t("prod.variantInOtherGroup")})` : ""}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={add}
          disabled={pending || !pickId}
          className="rounded-lg bg-[var(--color-ink)] px-5 py-2 text-sm font-medium text-[var(--color-surface)] transition hover:opacity-90 disabled:opacity-50"
        >
          {t("prod.variantAdd")}
        </button>
        <button
          type="button"
          onClick={duplicateAsVariant}
          disabled={pending}
          className="flex items-center gap-1.5 rounded-lg border border-[var(--color-rule)] px-4 py-2 text-sm font-medium text-[var(--color-ink-soft)] transition hover:border-[var(--color-ink)] hover:text-[var(--color-ink)] disabled:opacity-50"
        >
          <CopyPlus className="h-3.5 w-3.5" />
          {t("prod.variantDuplicate")}
        </button>
        {dirty && (
          <button
            type="button"
            onClick={saveLabels}
            disabled={pending}
            className="rounded-lg border border-[var(--color-ink)] px-5 py-2 text-sm font-medium text-[var(--color-ink)] transition hover:bg-[var(--color-surface-sunken)] disabled:opacity-50"
          >
            {t("prod.variantSaveLabels")}
          </button>
        )}
      </div>
    </section>
  );
}
