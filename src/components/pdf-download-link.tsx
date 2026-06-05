"use client";

import type { ReactNode } from "react";

/**
 * 公开页 PDF 下载链接，点击时用 sendBeacon 打点（/api/pdf-download）。
 * 服务端把翻译好的内容作为 children 透传，本组件只负责 <a> + 打点。
 */
export function PdfDownloadLink({
  href,
  productId,
  source,
  className,
  children,
}: {
  href: string;
  productId: string;
  source: string | null;
  className?: string;
  children: ReactNode;
}) {
  function onClick() {
    // Fire-and-forget: queues even if the user immediately leaves the page.
    if (typeof navigator !== "undefined" && navigator.sendBeacon) {
      try {
        const blob = new Blob([JSON.stringify({ productId, source })], {
          type: "application/json",
        });
        navigator.sendBeacon("/api/pdf-download", blob);
      } catch {
        // ignore — link still opens via default behaviour
      }
    }
  }

  return (
    <a
      href={href}
      onClick={onClick}
      target="_blank"
      rel="noopener noreferrer"
      className={className}
    >
      {children}
    </a>
  );
}
