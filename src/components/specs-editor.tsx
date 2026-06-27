"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, ArrowUp, ArrowDown, X, BookMarked } from "lucide-react";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import {
  saveProductSpecs,
  patchTranslation,
  saveProductCerts,
} from "@/app/admin/products/actions";
import { useProductLocale } from "@/components/product-i18n";
import type { AttrDefLite } from "@/lib/attribute-defaults";

type SpecRow = { group: string; label: string; value: string; unit: string; key: string };

const inputCls =
  "w-full rounded-lg border border-[var(--color-rule)] bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-ink)] outline-none transition focus:border-[var(--color-ink)]";
const inputBase = inputCls.replace("w-full ", "");
const labelCls =
  "font-mono text-[10px] font-medium uppercase tracking-[0.22em] text-[var(--color-ink-muted)]";

type SpecsProps = {
  productId: string;
  initialSpecs: SpecRow[];
  initialCerts: string[];
  attrDefs: AttrDefLite[];
  // 各语言规格译文（含 group/label/value/unit，不含字典 key）
  specsTranslations: Record<string, SpecRow[]>;
};

// 切语言 = 换一份内容：用 key 重挂载内层、按当前语言初始化，省去 effect 重置 state。
export function SpecsEditor(props: SpecsProps) {
  const { editingLocale } = useProductLocale();
  return <SpecsEditorInner key={editingLocale} {...props} />;
}

function SpecsEditorInner({
  productId,
  initialSpecs,
  initialCerts,
  attrDefs,
  specsTranslations,
}: SpecsProps) {
  const t = useTranslations();
  const router = useRouter();
  const { editingLocale, isBase } = useProductLocale();
  // 主语言用主字段规格（带字典 key）；其余语言用该语言译文，缺则以源规格为起点（剥 key）
  const [rows, setRows] = useState<SpecRow[]>(
    isBase
      ? initialSpecs
      : (specsTranslations[editingLocale] ?? initialSpecs).map((r) => ({
          ...r,
          key: "",
        })),
  );
  const [certs, setCerts] = useState<string[]>(initialCerts);
  const [certDraft, setCertDraft] = useState("");
  const [pending, start] = useTransition();
  const defByKey = new Map(attrDefs.map((d) => [d.key, d]));

  function addRow() {
    setRows((r) => [
      ...r,
      { group: r.length ? r[r.length - 1].group : "", label: "", value: "", unit: "", key: "" },
    ]);
  }

  /** 从字典追加一行（仅主语言）：label 统一写源语言名，unit 带默认。 */
  function addFromDict(key: string) {
    const def = defByKey.get(key);
    if (!def) return;
    setRows((r) => [
      ...r,
      {
        group: r.length ? r[r.length - 1].group : "",
        label: def.srcName,
        value: "",
        unit: def.unit,
        key: def.key,
      },
    ]);
  }

  /** 行级认领 / 解除（仅主语言）：选字典项用字典源名覆盖参数名、补默认单位；清空则解除。 */
  function linkRow(i: number, key: string) {
    const def = key ? defByKey.get(key) : undefined;
    setRows((r) =>
      r.map((x, j) =>
        j === i
          ? def
            ? { ...x, key: def.key, label: def.srcName, unit: x.unit || def.unit }
            : { ...x, key: "" }
          : x,
      ),
    );
  }
  function updateRow(i: number, patch: Partial<SpecRow>) {
    setRows((r) => r.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  }
  function removeRow(i: number) {
    setRows((r) => r.filter((_, j) => j !== i));
  }
  function moveRow(i: number, dir: -1 | 1) {
    setRows((r) => {
      const j = i + dir;
      if (j < 0 || j >= r.length) return r;
      const next = [...r];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  }

  function addCert(raw: string) {
    const v = raw.trim();
    if (!v) return;
    setCerts((c) => (c.includes(v) ? c : [...c, v]));
    setCertDraft("");
  }
  function removeCert(i: number) {
    setCerts((c) => c.filter((_, j) => j !== i));
  }

  function save() {
    const cleanSpecs = rows
      .map((r) => ({
        group: r.group.trim() || undefined,
        label: r.label.trim(),
        value: r.value.trim(),
        unit: r.unit.trim() || undefined,
        key: r.key || undefined,
      }))
      .filter((r) => r.label && r.value);
    start(async () => {
      try {
        if (isBase) {
          await saveProductSpecs({ productId, specs: cleanSpecs, certifications: certs });
        } else {
          // specs 存该语言译文；认证语言无关，统一存主字段
          await patchTranslation({ productId, locale: editingLocale, specs: cleanSpecs });
          await saveProductCerts({ productId, certifications: certs });
        }
        toast.success(t("prod.specsSaved"));
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
          {t("prod.specsTitle")}
        </p>
        <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-[var(--color-ink-muted)]">
          {t("prod.specsSub")}
        </span>
      </div>

      {/* 规格参数 */}
      <div className="mt-5">
        <div className="flex items-center justify-between gap-3">
          <label className={labelCls}>{t("prod.params")}</label>
          <div className="flex items-center gap-3">
            {isBase && attrDefs.length > 0 && (
              <div className="flex items-center gap-1 text-[var(--color-ink-muted)]">
                <BookMarked className="h-3.5 w-3.5" />
                <select
                  value=""
                  onChange={(e) => {
                    if (e.target.value) addFromDict(e.target.value);
                  }}
                  className="max-w-44 cursor-pointer bg-transparent font-mono text-[11px] text-[var(--color-ink-muted)] outline-none transition hover:text-[var(--color-ink)]"
                >
                  <option value="">{t("prod.fromDict")}</option>
                  {attrDefs.map((d) => (
                    <option key={d.key} value={d.key}>
                      {d.label} · {d.key}
                    </option>
                  ))}
                </select>
              </div>
            )}
            <button
              type="button"
              onClick={addRow}
              className="flex items-center gap-1 font-mono text-[11px] text-[var(--color-ink-muted)] transition hover:text-[var(--color-ink)]"
            >
              <Plus className="h-3.5 w-3.5" /> {t("prod.addParam")}
            </button>
          </div>
        </div>

        {rows.length === 0 ? (
          <p className="mt-3 text-[12px] text-[var(--color-ink-faint)]">
            {t("prod.params")}
          </p>
        ) : (
          <div className="mt-3 space-y-2">
            {/* 列头 */}
            <div className="hidden gap-2 px-1 sm:flex">
              <span className={`${labelCls} w-28 shrink-0`}>{t("prod.group")}</span>
              <span className={`${labelCls} w-40 shrink-0`}>{t("prod.paramName")}</span>
              <span className={`${labelCls} flex-1`}>{t("prod.paramValue")}</span>
              <span className={`${labelCls} w-20 shrink-0`}>{t("prod.unit")}</span>
              {isBase && (
                <span className={`${labelCls} w-28 shrink-0`} title={t("prod.dictHint")}>
                  {t("prod.dict")}
                </span>
              )}
              <span className="w-16 shrink-0" />
            </div>
            {rows.map((r, i) => {
              const def = isBase && r.key ? defByKey.get(r.key) : undefined;
              return (
              <div key={i} className="flex flex-wrap items-center gap-2 sm:flex-nowrap">
                <input
                  value={r.group}
                  onChange={(e) => updateRow(i, { group: e.target.value })}
                  placeholder={t("prod.group")}
                  className={`${inputBase} w-28 shrink-0`}
                />
                <input
                  value={r.label}
                  onChange={(e) => updateRow(i, { label: e.target.value })}
                  placeholder={t("prod.paramName")}
                  disabled={!!def}
                  title={def ? t("prod.dictHint") : undefined}
                  className={`${inputBase} w-40 shrink-0 ${def ? "bg-[var(--color-surface-sunken)] text-[var(--color-ink-soft)]" : ""}`}
                />
                <input
                  value={r.value}
                  onChange={(e) => updateRow(i, { value: e.target.value })}
                  placeholder={t("prod.paramValue")}
                  inputMode={def?.type === "number" ? "decimal" : undefined}
                  list={
                    def?.type === "select" && def.options.length
                      ? `spec-opt-${def.key}`
                      : undefined
                  }
                  className={inputCls}
                />
                {def?.type === "select" && def.options.length > 0 && (
                  <datalist id={`spec-opt-${def.key}`}>
                    {def.options.map((o) => (
                      <option key={o} value={o} />
                    ))}
                  </datalist>
                )}
                <input
                  value={r.unit}
                  onChange={(e) => updateRow(i, { unit: e.target.value })}
                  placeholder={t("prod.unit")}
                  className={`${inputBase} w-20 shrink-0`}
                />
                {isBase && (
                  <select
                    value={r.key}
                    onChange={(e) => linkRow(i, e.target.value)}
                    title={def ? `${def.label} · ${def.key}` : t("prod.dictHint")}
                    className={`${inputBase} w-28 shrink-0 font-mono text-[11px] ${r.key ? "" : "text-[var(--color-ink-faint)]"}`}
                  >
                    <option value="">—</option>
                    {attrDefs.map((d) => (
                      <option key={d.key} value={d.key}>
                        {d.key}
                      </option>
                    ))}
                    {/* 字典已删但行还挂着的 key：保留可见，可手动解除 */}
                    {r.key && !defByKey.has(r.key) && (
                      <option value={r.key}>{r.key}</option>
                    )}
                  </select>
                )}
                <div className="flex shrink-0 items-center">
                  <button
                    type="button"
                    onClick={() => moveRow(i, -1)}
                    disabled={i === 0}
                    aria-label={t("show.moveUp")}
                    className="p-1.5 text-[var(--color-ink-faint)] transition hover:text-[var(--color-ink)] disabled:opacity-30"
                  >
                    <ArrowUp className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => moveRow(i, 1)}
                    disabled={i === rows.length - 1}
                    aria-label={t("show.moveDown")}
                    className="p-1.5 text-[var(--color-ink-faint)] transition hover:text-[var(--color-ink)] disabled:opacity-30"
                  >
                    <ArrowDown className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => removeRow(i)}
                    aria-label={t("admin.common.delete")}
                    className="p-1.5 text-[var(--color-ink-faint)] transition hover:text-red-500"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 认证徽章：语言无关，所有语言统一展示、任意 tab 可增删（存主字段） */}
      <div className="mt-6">
        <label className={labelCls}>{t("prod.certs")}</label>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          {certs.map((c, i) => (
            <span
              key={`${c}-${i}`}
              className="flex items-center gap-1.5 rounded-full border border-[var(--color-rule)] bg-[var(--color-surface-sunken)] py-1 pl-3 pr-1.5 font-mono text-xs text-[var(--color-ink)]"
            >
              {c}
              <button
                type="button"
                onClick={() => removeCert(i)}
                aria-label={`${t("admin.common.delete")} ${c}`}
                className="text-[var(--color-ink-faint)] transition hover:text-red-500"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </span>
          ))}
          <input
            value={certDraft}
            onChange={(e) => setCertDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === ",") {
                e.preventDefault();
                addCert(certDraft);
              }
            }}
            onBlur={() => addCert(certDraft)}
            placeholder={t("prod.certPh")}
            className={`${inputBase} w-56`}
          />
        </div>
        <p className="mt-1.5 text-[11px] text-[var(--color-ink-faint)]">
          {t("prod.certsHint")}
        </p>
      </div>

      <div className="mt-6 flex justify-end border-t border-[var(--color-rule)] pt-4">
        <button
          type="button"
          onClick={save}
          disabled={pending}
          className="rounded-lg bg-[var(--color-ink)] px-5 py-2 text-sm font-medium text-[var(--color-surface)] transition hover:opacity-90 disabled:opacity-50"
        >
          {pending ? t("admin.common.saving") : t("prod.saveSpecs")}
        </button>
      </div>
    </section>
  );
}
