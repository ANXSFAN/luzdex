"use client";

import { useState } from "react";
import { QrCode, Download, X } from "lucide-react";
import { normalizeSource } from "@/lib/channel";

/**
 * 导出「当前工厂」全部产品二维码（可打印 PDF 网格）。
 * 选填一个渠道标签（如 expo2026 / pack / card）；该批 QR 会带 ?s=<标签>，
 * 扫码后产品页按来源归因统计。留空则导出不带渠道码的通用 QR。
 */
export function QrExportButton() {
  const [open, setOpen] = useState(false);
  const [raw, setRaw] = useState("");

  const normalized = normalizeSource(raw);

  function handleExport() {
    const q = normalized ? `?source=${encodeURIComponent(normalized)}` : "";
    window.location.href = `/admin/qr-export${q}`;
    setOpen(false);
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 rounded-full border border-[var(--color-rule)] px-4 py-2 text-xs text-[var(--color-ink)] transition hover:bg-[var(--color-surface-sunken)]"
      >
        <QrCode className="h-3.5 w-3.5" />
        导出二维码
      </button>
    );
  }

  return (
    <div className="flex items-center gap-2 rounded-full border border-[var(--color-rule-strong)] bg-[var(--color-surface)] py-1 pl-3 pr-1">
      <input
        autoFocus
        value={raw}
        onChange={(e) => setRaw(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && handleExport()}
        placeholder="渠道标签（选填，如 expo2026）"
        className="w-44 bg-transparent text-xs text-[var(--color-ink)] outline-none placeholder:text-[var(--color-ink-faint)]"
      />
      <span className="hidden font-mono text-[10px] text-[var(--color-ink-muted)] sm:inline">
        {normalized ? `?s=${normalized}` : "通用"}
      </span>
      <button
        onClick={handleExport}
        className="flex items-center gap-1 rounded-full bg-[var(--color-ink)] px-3 py-1.5 text-xs text-white transition hover:bg-[#424245]"
      >
        <Download className="h-3.5 w-3.5" />
        下载 PDF
      </button>
      <button
        onClick={() => setOpen(false)}
        className="rounded-full p-1.5 text-[var(--color-ink-muted)] transition hover:bg-[var(--color-surface-sunken)]"
        aria-label="取消"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
