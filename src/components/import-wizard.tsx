"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Download,
  Upload,
  Loader2,
  FileSpreadsheet,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
} from "lucide-react";
import { toast } from "sonner";

interface PreviewSummary {
  totalProducts: number;
  create: number;
  update: number;
  errorRows: number;
  specRows: number;
  imageRows: number;
  linkRows: number;
}
interface PreviewProduct {
  model: string;
  name: string;
  action: "create" | "update";
  specCount: number;
  imageCount: number;
}
interface RowError {
  sheet: string;
  row: number;
  model: string;
  message: string;
}
interface PreviewResponse {
  factory: { id: string; name: string };
  summary: PreviewSummary;
  products: PreviewProduct[];
  errors: RowError[];
}

type Phase = "idle" | "previewing" | "preview" | "committing";

export function ImportWizard({ factoryName }: { factoryName: string | null }) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [phase, setPhase] = useState<Phase>("idle");
  const [file, setFile] = useState<File | null>(null);
  const [plan, setPlan] = useState<PreviewResponse | null>(null);

  function reset() {
    setPhase("idle");
    setFile(null);
    setPlan(null);
    if (fileRef.current) fileRef.current.value = "";
  }

  async function handlePick(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);
    setPlan(null);
    setPhase("previewing");
    try {
      const fd = new FormData();
      fd.append("file", f);
      const res = await fetch("/api/import/preview", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "预览失败");
        reset();
        return;
      }
      setPlan(data as PreviewResponse);
      setPhase("preview");
    } catch {
      toast.error("预览失败");
      reset();
    }
  }

  async function handleCommit() {
    if (!file) return;
    setPhase("committing");
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/import/commit", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "导入失败");
        setPhase("preview");
        return;
      }
      toast.success(
        `导入完成：新增 ${data.created}，更新 ${data.updated}，配件关系 ${data.linkRows}` +
          (data.errorRows ? `，跳过错误 ${data.errorRows} 行` : ""),
      );
      router.refresh();
      reset();
    } catch {
      toast.error("导入失败");
      setPhase("preview");
    }
  }

  function downloadErrors() {
    if (!plan?.errors.length) return;
    const esc = (s: string) => `"${s.replace(/"/g, '""')}"`;
    const rows = plan.errors.map((e) =>
      [e.sheet, String(e.row), e.model, e.message].map(esc).join(","),
    );
    const csv = "﻿" + ["工作表,行号,型号,错误原因", ...rows].join("\r\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "import-errors.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  const busy = phase === "previewing" || phase === "committing";
  const s = plan?.summary;

  return (
    <div className="mt-8 space-y-6">
      {/* Step 1 — 模板 + 上传 */}
      <section className="rounded-2xl border border-[var(--color-rule)] bg-[var(--color-surface)] p-6">
        <p className="font-mono text-[10px] font-medium uppercase tracking-[0.22em] text-[var(--color-ink)]">
          Step 1 · 模板与上传
        </p>
        <p className="mt-2 text-sm text-[var(--color-ink-muted)]">
          下载模板，按四张表（产品 / 规格 / 图片 / 配件）靠「型号」填好，再上传预览。
          导入将写入工厂{" "}
          <span className="font-medium text-[var(--color-ink)]">
            {factoryName ?? "（未选择）"}
          </span>
          。
        </p>

        <div className="mt-5 flex flex-wrap items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- API 下载端点，非页面路由 */}
          <a
            href="/api/import/template"
            className="flex items-center gap-1.5 rounded-full border border-[var(--color-rule)] px-4 py-2 text-xs text-[var(--color-ink)] transition hover:bg-[var(--color-surface-sunken)]"
          >
            <Download className="h-3.5 w-3.5" />
            下载模板
          </a>
          <button
            onClick={() => fileRef.current?.click()}
            disabled={busy}
            className="flex items-center gap-1.5 rounded-full bg-[var(--color-ink)] px-4 py-2 text-xs text-white transition hover:bg-[#424245] disabled:opacity-50"
          >
            {phase === "previewing" ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Upload className="h-3.5 w-3.5" />
            )}
            {phase === "previewing" ? "解析中…" : "选择 .xlsx / .csv"}
          </button>
          {file && (
            <span className="flex items-center gap-1.5 text-xs text-[var(--color-ink-muted)]">
              <FileSpreadsheet className="h-3.5 w-3.5" />
              {file.name}
            </span>
          )}
          <input
            ref={fileRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            hidden
            onChange={handlePick}
          />
        </div>
      </section>

      {/* Step 2 — 预览 diff */}
      {plan && s && (
        <section className="rounded-2xl border border-[var(--color-rule)] bg-[var(--color-surface)] p-6">
          <div className="flex items-baseline justify-between border-b border-[var(--color-rule)] pb-3">
            <p className="font-mono text-[10px] font-medium uppercase tracking-[0.22em] text-[var(--color-ink)]">
              Step 2 · 预览（尚未写库）
            </p>
            <button
              onClick={reset}
              className="flex items-center gap-1 font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--color-ink-muted)] transition hover:text-[var(--color-ink)]"
            >
              <RotateCcw className="h-3 w-3" />
              重选文件
            </button>
          </div>

          <div className="mt-5 grid grid-cols-2 gap-5 sm:grid-cols-4">
            <Stat label="新增" value={s.create} tone="good" />
            <Stat label="更新" value={s.update} tone="info" />
            <Stat label="错误行" value={s.errorRows} tone={s.errorRows ? "bad" : "muted"} />
            <Stat label="配件关系" value={s.linkRows} tone="muted" />
          </div>
          <p className="mt-3 font-mono text-[11px] text-[var(--color-ink-muted)]">
            规格 {s.specRows} 行 · 图片 {s.imageRows} 行 · 共 {s.totalProducts} 个产品
          </p>

          {/* 产品明细 */}
          {plan.products.length > 0 && (
            <div className="mt-5 overflow-hidden rounded-xl border border-[var(--color-rule)]">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[var(--color-rule)] bg-[var(--color-surface-sunken)] text-left font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--color-ink-muted)]">
                    <th className="px-3 py-2 font-medium">动作</th>
                    <th className="px-3 py-2 font-medium">型号</th>
                    <th className="px-3 py-2 font-medium">名称</th>
                    <th className="px-3 py-2 text-right font-medium">规格/图</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--color-rule)]">
                  {plan.products.map((p) => (
                    <tr key={p.model}>
                      <td className="px-3 py-2">
                        <ActionChip action={p.action} />
                      </td>
                      <td className="px-3 py-2 font-mono text-xs text-[var(--color-ink)]">
                        {p.model}
                      </td>
                      <td className="px-3 py-2 text-[var(--color-ink)]">{p.name}</td>
                      <td className="px-3 py-2 text-right font-mono text-xs text-[var(--color-ink-muted)]">
                        {p.specCount} / {p.imageCount}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* 错误明细 */}
          {plan.errors.length > 0 && (
            <div className="mt-5">
              <div className="mb-2 flex items-center justify-between">
                <p className="flex items-center gap-1.5 text-xs font-medium text-[#b4232a]">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  {plan.errors.length} 行有问题，将被跳过
                </p>
                <button
                  onClick={downloadErrors}
                  className="flex items-center gap-1 font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--color-ink-muted)] transition hover:text-[var(--color-ink)]"
                >
                  <Download className="h-3 w-3" />
                  错误报告 CSV
                </button>
              </div>
              <ul className="space-y-1 rounded-xl border border-dashed border-[var(--color-rule)] p-3">
                {plan.errors.slice(0, 50).map((e, i) => (
                  <li key={i} className="font-mono text-[11px] text-[var(--color-ink-muted)]">
                    <span className="text-[var(--color-ink)]">
                      [{e.sheet} 第 {e.row} 行]
                    </span>{" "}
                    {e.model && <span className="text-[var(--color-ink)]">{e.model} · </span>}
                    {e.message}
                  </li>
                ))}
                {plan.errors.length > 50 && (
                  <li className="font-mono text-[11px] text-[var(--color-ink-muted)]">
                    … 还有 {plan.errors.length - 50} 行，请下载完整报告
                  </li>
                )}
              </ul>
            </div>
          )}

          {/* 确认 */}
          <div className="mt-6 flex items-center gap-3 border-t border-[var(--color-rule)] pt-5">
            <button
              onClick={handleCommit}
              disabled={phase === "committing" || s.create + s.update === 0}
              className="flex items-center gap-1.5 rounded-full bg-[var(--color-ink)] px-5 py-2.5 text-xs text-white transition hover:bg-[#424245] disabled:opacity-50"
            >
              {phase === "committing" ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <CheckCircle2 className="h-3.5 w-3.5" />
              )}
              {phase === "committing"
                ? "导入中…"
                : `确认导入 ${s.create + s.update} 个产品`}
            </button>
            {s.create + s.update === 0 && (
              <span className="text-xs text-[var(--color-ink-muted)]">
                没有可导入的有效产品行
              </span>
            )}
          </div>
        </section>
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "good" | "info" | "bad" | "muted";
}) {
  const color =
    tone === "good"
      ? "text-[#1f7a3d]"
      : tone === "bad"
        ? "text-[#b4232a]"
        : tone === "info"
          ? "text-[var(--color-ink)]"
          : "text-[var(--color-ink-muted)]";
  return (
    <div>
      <p className="font-mono text-[10px] font-medium uppercase tracking-[0.22em] text-[var(--color-ink-muted)]">
        {label}
      </p>
      <p className={`mt-1 font-mono text-[28px] font-medium tabular-nums leading-none ${color}`}>
        {value}
      </p>
    </div>
  );
}

function ActionChip({ action }: { action: "create" | "update" }) {
  return action === "create" ? (
    <span className="rounded-full bg-[#e7f4ec] px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.12em] text-[#1f7a3d]">
      新增
    </span>
  ) : (
    <span className="rounded-full bg-[var(--color-surface-sunken)] px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.12em] text-[var(--color-ink-muted)]">
      更新
    </span>
  );
}
