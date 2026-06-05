"use client";

import { ArrowUpRight } from "lucide-react";
import type { ReactNode } from "react";

export type InquiryChannelKind = "email" | "whatsapp";

export function InquiryChannel({
  href,
  icon,
  label,
  sub,
  kbd,
  productId,
  channel,
}: {
  href: string;
  icon: ReactNode;
  label: string;
  sub: string;
  kbd: string;
  productId: string;
  channel: InquiryChannelKind;
}) {
  function onClick() {
    // Fire-and-forget: queues even if the user immediately leaves the page.
    if (typeof navigator !== "undefined" && navigator.sendBeacon) {
      try {
        const blob = new Blob(
          [JSON.stringify({ productId, channel })],
          { type: "application/json" }
        );
        navigator.sendBeacon("/api/inquiry-click", blob);
      } catch {
        // ignore — link still opens via default behaviour
      }
    }
  }

  return (
    <a
      href={href}
      onClick={onClick}
      target={href.startsWith("mailto:") ? undefined : "_blank"}
      rel="noopener noreferrer"
      className="group relative flex items-start justify-between gap-4 rounded-2xl border border-[var(--color-rule)] bg-[var(--color-surface)] p-5 transition hover:-translate-y-0.5 hover:border-[var(--color-rule-strong)] hover:bg-[var(--color-surface-sunken)] sm:p-6"
    >
      <div className="flex min-w-0 flex-col">
        <div className="flex items-center gap-2 text-[var(--color-ink-soft)] transition group-hover:text-[var(--color-ink)]">
          {icon}
          <span className="font-mono text-[10px] uppercase tracking-[0.22em]">
            {kbd}
          </span>
        </div>
        <p className="headline-lg mt-5 text-[22px] leading-tight text-[var(--color-ink)]">
          {label}
        </p>
        <p className="mt-2 truncate font-mono text-[11px] uppercase tracking-[0.14em] text-[var(--color-ink-soft)]">
          {sub}
        </p>
      </div>
      <ArrowUpRight
        className="mt-1 h-5 w-5 shrink-0 text-[var(--color-ink-muted)] transition group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-[var(--color-ink)]"
        strokeWidth={1.5}
      />
    </a>
  );
}
