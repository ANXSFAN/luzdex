"use client";

import { useState, useTransition } from "react";
import { Plus, Trash2, ArrowUp, ArrowDown, X } from "lucide-react";
import { toast } from "sonner";
import { saveProductSpecs } from "@/app/admin/products/actions";

type SpecRow = { group: string; label: string; value: string; unit: string };

const inputCls =
  "w-full rounded-lg border border-[var(--color-rule)] bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-ink)] outline-none transition focus:border-[var(--color-ink)]";
const inputBase = inputCls.replace("w-full ", "");
const labelCls =
  "font-mono text-[10px] font-medium uppercase tracking-[0.22em] text-[var(--color-ink-muted)]";

export function SpecsEditor({
  productId,
  initialSpecs,
  initialCerts,
}: {
  productId: string;
  initialSpecs: SpecRow[];
  initialCerts: string[];
}) {
  const [rows, setRows] = useState<SpecRow[]>(initialSpecs);
  const [certs, setCerts] = useState<string[]>(initialCerts);
  const [certDraft, setCertDraft] = useState("");
  const [pending, start] = useTransition();

  function addRow() {
    setRows((r) => [
      ...r,
      { group: r.length ? r[r.length - 1].group : "", label: "", value: "", unit: "" },
    ]);
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
      }))
      .filter((r) => r.label && r.value);
    start(async () => {
      try {
        await saveProductSpecs({
          productId,
          specs: cleanSpecs,
          certifications: certs,
        });
        toast.success("规格 / 认证已保存");
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "保存失败");
      }
    });
  }

  return (
    <section className="mt-6 rounded-2xl border border-[var(--color-rule)] bg-[var(--color-surface)] p-6">
      <div className="flex items-baseline justify-between border-b border-[var(--color-rule)] pb-3">
        <p className="font-mono text-[10px] font-medium uppercase tracking-[0.22em] text-[var(--color-ink)]">
          Specs · 规格 / 认证
        </p>
        <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-[var(--color-ink-muted)]">
          参数表 + 认证徽章
        </span>
      </div>

      {/* 规格参数 */}
      <div className="mt-5">
        <div className="flex items-center justify-between">
          <label className={labelCls}>规格参数（分组可留空 · 顺序即展示顺序）</label>
          <button
            type="button"
            onClick={addRow}
            className="flex items-center gap-1 font-mono text-[11px] text-[var(--color-ink-muted)] transition hover:text-[var(--color-ink)]"
          >
            <Plus className="h-3.5 w-3.5" /> 添加参数
          </button>
        </div>

        {rows.length === 0 ? (
          <p className="mt-3 text-[12px] text-[var(--color-ink-faint)]">
            暂无参数。如：分组「光参数」、参数名「光通量」、值「1200」、单位「lm」。
          </p>
        ) : (
          <div className="mt-3 space-y-2">
            {/* 列头 */}
            <div className="hidden gap-2 px-1 sm:flex">
              <span className={`${labelCls} w-28 shrink-0`}>分组</span>
              <span className={`${labelCls} w-40 shrink-0`}>参数名</span>
              <span className={`${labelCls} flex-1`}>参数值</span>
              <span className={`${labelCls} w-20 shrink-0`}>单位</span>
              <span className="w-16 shrink-0" />
            </div>
            {rows.map((r, i) => (
              <div key={i} className="flex flex-wrap items-center gap-2 sm:flex-nowrap">
                <input
                  value={r.group}
                  onChange={(e) => updateRow(i, { group: e.target.value })}
                  placeholder="分组(可选)"
                  className={`${inputBase} w-28 shrink-0`}
                />
                <input
                  value={r.label}
                  onChange={(e) => updateRow(i, { label: e.target.value })}
                  placeholder="参数名"
                  className={`${inputBase} w-40 shrink-0`}
                />
                <input
                  value={r.value}
                  onChange={(e) => updateRow(i, { value: e.target.value })}
                  placeholder="参数值"
                  className={inputCls}
                />
                <input
                  value={r.unit}
                  onChange={(e) => updateRow(i, { unit: e.target.value })}
                  placeholder="单位"
                  className={`${inputBase} w-20 shrink-0`}
                />
                <div className="flex shrink-0 items-center">
                  <button
                    type="button"
                    onClick={() => moveRow(i, -1)}
                    disabled={i === 0}
                    aria-label="上移"
                    className="p-1.5 text-[var(--color-ink-faint)] transition hover:text-[var(--color-ink)] disabled:opacity-30"
                  >
                    <ArrowUp className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => moveRow(i, 1)}
                    disabled={i === rows.length - 1}
                    aria-label="下移"
                    className="p-1.5 text-[var(--color-ink-faint)] transition hover:text-[var(--color-ink)] disabled:opacity-30"
                  >
                    <ArrowDown className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => removeRow(i)}
                    aria-label="删除"
                    className="p-1.5 text-[var(--color-ink-faint)] transition hover:text-red-500"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 认证 */}
      <div className="mt-6">
        <label className={labelCls}>认证徽章</label>
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
                aria-label={`移除 ${c}`}
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
            placeholder="输入后回车，如 CE / RoHS / IP65"
            className={`${inputBase} w-56`}
          />
        </div>
        <p className="mt-1.5 text-[11px] text-[var(--color-ink-faint)]">
          只填包装 / 证书上确有的认证。公开页会按已知认证给出中英释义。
        </p>
      </div>

      <div className="mt-6 flex justify-end border-t border-[var(--color-rule)] pt-4">
        <button
          type="button"
          onClick={save}
          disabled={pending}
          className="rounded-lg bg-[var(--color-ink)] px-5 py-2 text-sm font-medium text-[var(--color-surface)] transition hover:opacity-90 disabled:opacity-50"
        >
          {pending ? "保存中…" : "保存规格 / 认证"}
        </button>
      </div>
    </section>
  );
}
