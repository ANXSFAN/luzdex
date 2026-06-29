"use client";

import { QRCodeCanvas } from "qrcode.react";
import QRCode from "qrcode";
import { Copy, Download } from "lucide-react";
import { toast } from "sonner";
import { useTranslations } from "next-intl";

export function QrCard({ url, fileBase }: { url: string; fileBase: string }) {
  const t = useTranslations("more");

  async function handleCopy() {
    await navigator.clipboard.writeText(url);
    toast.success(t("copied"));
  }

  // 不导出屏幕上那张 120px canvas（分辨率随屏幕 DPR 浮动、打印放大必糊），
  // 而是现生成一张固定 1024px 的高清 PNG（约 7KB），谁下都清晰。
  // 透明底（isolated）：只保留黑色码点，light 设为全透明，方便叠在任意背景上。
  async function handleDownload() {
    const dataUrl = await QRCode.toDataURL(url, {
      width: 1024,
      margin: 1,
      errorCorrectionLevel: "M",
      color: { dark: "#000000ff", light: "#00000000" },
    });
    const link = document.createElement("a");
    link.download = `${fileBase}-qr.png`;
    link.href = dataUrl;
    link.click();
  }

  return (
    <div className="flex items-center gap-5 rounded-2xl border border-[var(--color-rule)] p-4">
      <div className="shrink-0 rounded-xl border border-[var(--color-rule)] p-2">
        <QRCodeCanvas
          value={url}
          size={120}
          level="M"
          marginSize={1}
          bgColor="transparent"
        />
      </div>
      <div className="min-w-0 flex-1">
        <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-[var(--color-ink-muted)]">
          {t("qrTitle")}
        </p>
        <code className="mt-1.5 block truncate rounded-lg bg-[var(--color-surface-sunken)] px-2.5 py-1.5 font-mono text-xs text-[var(--color-ink-soft)]">
          {url}
        </code>
        <div className="mt-2.5 flex gap-2">
          <button
            onClick={handleCopy}
            className="flex items-center gap-1.5 rounded-full border border-[var(--color-rule)] px-3 py-1 text-xs transition hover:bg-[var(--color-surface-sunken)]"
          >
            <Copy className="h-3.5 w-3.5" />
            {t("copyLink")}
          </button>
          <button
            onClick={handleDownload}
            className="flex items-center gap-1.5 rounded-full bg-[var(--color-ink)] px-3 py-1 text-xs text-white transition hover:bg-[#424245]"
          >
            <Download className="h-3.5 w-3.5" />
            {t("downloadQr")}
          </button>
        </div>
      </div>
    </div>
  );
}
