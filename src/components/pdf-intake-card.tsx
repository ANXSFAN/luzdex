"use client";

import { useRef, useState, useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { FileText, Loader2, Sparkles, Upload } from "lucide-react";
import { toast } from "sonner";
import { useFileDrop } from "@/components/use-file-drop";
import {
  extractProductFromPdf,
  applyProductPdfDraft,
  type PdfDraft,
  type PdfDraftField,
} from "@/app/admin/products/pdf-actions";
import { luminaireLabel } from "@/lib/luminaire";
import { LOCALE_LABELS } from "@/i18n/routing";

/**
 * 「从 PDF 自动填充」卡：传技术文档 PDF → AI 抽取 → 字段勾选预览 → 应用入库。
 * 抽取零编造（服务端红线），应用前客户始终过目；应用后整页刷新让各编辑器
 * 重挂载拿到新值（编辑器值在 useState 里，router.refresh 刷不动）。
 */

const FIELD_ORDER: PdfDraftField[] = [
  "basics", "tagline", "description", "luminaireType", "sourceLocale",
  "specs", "certifications", "attributes", "highlights",
  "boxContents", "install", "dimensions",
];

type Phase =
  | { step: "idle" }
  | { step: "uploading" }
  | { step: "extracting" }
  | { step: "preview"; draft: PdfDraft; fileName: string };

export function PdfIntakeCard({
  productId,
  occupied,
}: {
  productId: string;
  occupied: Partial<Record<PdfDraftField, boolean>>;
}) {
  const t = useTranslations("pdf");
  const locale = useLocale();
  const ref = useRef<HTMLInputElement>(null);
  const [phase, setPhase] = useState<Phase>({ step: "idle" });
  const [checked, setChecked] = useState<Set<PdfDraftField>>(new Set());
  const [applying, startApply] = useTransition();
  const busy = phase.step === "uploading" || phase.step === "extracting";

  // 草稿里每个字段组的预览摘要；null 表示该组没抽到内容、不显示
  function summary(d: PdfDraft, f: PdfDraftField): string | null {
    switch (f) {
      case "basics":
        return d.name || d.modelNumber
          ? [d.name, d.modelNumber].filter(Boolean).join(" · ")
          : null;
      case "tagline":
        return d.tagline;
      case "description":
        return d.description
          ? d.description.slice(0, 110) + (d.description.length > 110 ? "…" : "")
          : null;
      case "luminaireType":
        return d.luminaireType
          ? luminaireLabel(d.luminaireType, locale)
          : null;
      case "sourceLocale":
        return d.sourceLocale
          ? (LOCALE_LABELS as Record<string, string>)[d.sourceLocale] ?? d.sourceLocale
          : null;
      case "specs":
        return d.specs.length ? t("nItems", { n: d.specs.length }) : null;
      case "certifications":
        return d.certifications.length ? d.certifications.join(" · ") : null;
      case "attributes": {
        const a = d.attributes;
        const parts = [
          a.pcbWidth ? `PCB ${a.pcbWidth}` : null,
          a.voltage ?? null,
          a.watt != null ? `${a.watt}W` : null,
        ].filter(Boolean);
        return parts.length ? parts.join(" · ") : null;
      }
      case "highlights":
        return d.highlights.length
          ? d.highlights.map((h) => h.label).join(" · ")
          : null;
      case "boxContents":
        return d.boxContents.length
          ? d.boxContents.map((b) => b.item).join(" · ")
          : null;
      case "install":
        return d.install
          ? [d.install.method, t("nSteps", { n: d.install.steps.length })]
              .filter(Boolean)
              .join(" · ")
          : null;
      case "dimensions": {
        const m = d.dimensions;
        if (!m) return null;
        const size = [m.w, m.h, m.d].filter((x) => x != null).join("×");
        return `${size} ${m.unit}${m.cutout ? ` · ${m.cutout}` : ""}`;
      }
    }
  }

  async function handleFile(file: File) {
    const isPdf =
      file.type === "application/pdf" || /\.pdf$/i.test(file.name);
    if (!isPdf) {
      toast.error(t("onlyPdf"));
      return;
    }
    setPhase({ step: "uploading" });
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      if (!res.ok) {
        const msg = await res.json().catch(() => null);
        throw new Error(msg?.error ?? t("extractFail"));
      }
      const { url } = (await res.json()) as { url: string };

      setPhase({ step: "extracting" });
      const draft = await extractProductFromPdf({
        pdfUrl: url,
        fileName: file.name,
      });
      const present = FIELD_ORDER.filter((f) => summary(draft, f) !== null);
      if (!present.length) {
        toast.error(t("nothing"));
        setPhase({ step: "idle" });
        return;
      }
      setChecked(new Set(present));
      setPhase({ step: "preview", draft, fileName: file.name });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("extractFail"));
      setPhase({ step: "idle" });
    }
  }

  function pick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (ref.current) ref.current.value = "";
    if (file) handleFile(file);
  }

  const { dragging, dropProps } = useFileDrop((files) => handleFile(files[0]), {
    disabled: busy || phase.step === "preview",
  });

  function toggle(f: PdfDraftField) {
    setChecked((s) => {
      const next = new Set(s);
      if (next.has(f)) next.delete(f);
      else next.add(f);
      return next;
    });
  }

  function apply() {
    if (phase.step !== "preview" || !checked.size) return;
    const { draft } = phase;
    startApply(async () => {
      try {
        const r = await applyProductPdfDraft({
          productId,
          draft,
          fields: [...checked],
        });
        toast.success(t("appliedOk", { n: r.applied }));
        // 编辑器初值在 useState 里，必须整页重载才能看到新内容
        window.location.reload();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : t("extractFail"));
      }
    });
  }

  return (
    <section
      {...dropProps}
      className={`mt-6 rounded-2xl border bg-[var(--color-surface)] p-6 transition ${
        dragging
          ? "border-[var(--color-ink)] ring-2 ring-[var(--color-ink)] ring-offset-2 ring-offset-[var(--color-surface)]"
          : "border-[var(--color-rule)]"
      }`}
    >
      <div className="flex items-baseline justify-between border-b border-[var(--color-rule)] pb-3">
        <p className="font-mono text-[10px] font-medium uppercase tracking-[0.22em] text-[var(--color-ink)]">
          {t("title")}
        </p>
        <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-[var(--color-ink-muted)]">
          AI · PDF
        </span>
      </div>

      {phase.step !== "preview" && (
        <div className="mt-4 flex items-center justify-between gap-4">
          <p className="min-w-0 text-[12px] leading-relaxed text-[var(--color-ink-muted)]">
            {t("hint")}
            <span className="ml-1 text-[var(--color-ink-faint)]">
              {t("dropHint")}
            </span>
          </p>
          <button
            type="button"
            onClick={() => ref.current?.click()}
            disabled={busy}
            className="flex shrink-0 items-center gap-1.5 rounded-lg border border-[var(--color-ink)] px-3.5 py-2 text-sm font-medium text-[var(--color-ink)] transition hover:bg-[var(--color-ink)] hover:text-[var(--color-surface)] disabled:opacity-50"
          >
            {busy ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Upload className="h-4 w-4" />
            )}
            {phase.step === "uploading"
              ? t("uploading")
              : phase.step === "extracting"
                ? t("extracting")
                : t("upload")}
          </button>
          <input
            ref={ref}
            type="file"
            accept="application/pdf,.pdf"
            hidden
            onChange={pick}
          />
        </div>
      )}

      {phase.step === "preview" && (
        <div className="mt-4">
          <div className="flex items-center gap-2 text-[12px] text-[var(--color-ink-muted)]">
            <FileText className="h-4 w-4 shrink-0" />
            <span className="truncate font-mono">{phase.fileName}</span>
          </div>
          <p className="mt-2 text-[13px] font-medium text-[var(--color-ink)]">
            {t("previewTitle")}
          </p>
          <p className="mt-0.5 text-[11px] text-[var(--color-ink-faint)]">
            {t("previewHint")}
          </p>

          <div className="mt-3 space-y-1.5">
            {FIELD_ORDER.map((f) => {
              const text = summary(phase.draft, f);
              if (text === null) return null;
              const willOverwrite = !!occupied[f];
              return (
                <label
                  key={f}
                  className="flex cursor-pointer items-start gap-2.5 rounded-lg border border-[var(--color-rule)] bg-[var(--color-surface-sunken)] px-3 py-2 transition hover:border-[var(--color-rule-strong)]"
                >
                  <input
                    type="checkbox"
                    checked={checked.has(f)}
                    onChange={() => toggle(f)}
                    className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer accent-[var(--color-ink)]"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2">
                      <span className="text-[13px] font-medium text-[var(--color-ink)]">
                        {t(`fields.${f}`)}
                      </span>
                      {willOverwrite && (
                        <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-700">
                          {t("overwrite")}
                        </span>
                      )}
                    </span>
                    <span className="mt-0.5 block truncate text-[12px] text-[var(--color-ink-muted)]">
                      {text}
                    </span>
                  </span>
                </label>
              );
            })}
          </div>

          <div className="mt-4 flex items-center justify-end gap-3 border-t border-[var(--color-rule)] pt-4">
            <button
              type="button"
              onClick={() => setPhase({ step: "idle" })}
              disabled={applying}
              className="rounded-lg px-3 py-2 text-sm text-[var(--color-ink-muted)] transition hover:text-[var(--color-ink)] disabled:opacity-50"
            >
              {t("cancel")}
            </button>
            <button
              type="button"
              onClick={apply}
              disabled={applying || !checked.size}
              className="flex items-center gap-1.5 rounded-lg bg-[var(--color-ink)] px-4 py-2 text-sm font-medium text-[var(--color-surface)] transition hover:opacity-90 disabled:opacity-50"
            >
              {applying ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="h-4 w-4" />
              )}
              {applying ? t("applying") : t("apply")}
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
