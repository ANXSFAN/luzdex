"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Check, Globe } from "lucide-react";
import {
  LOCALE_LABELS,
  LOCALE_FLAGS,
  LOCALE_ORDER,
  type AppLocale,
} from "@/i18n/routing";
import { Link } from "@/i18n/navigation";

/**
 * 语言切换器。下拉面板 portal 到 body 并 fixed 定位，彻底脱离头部的 backdrop-filter /
 * section 层叠上下文，保证浮于所有内容之上、可点外部 / Esc / 滚动关闭。
 */
export function LocaleSwitcher({
  current,
  supported,
  slug,
  basePath = "/p",
}: {
  current: AppLocale;
  supported: readonly AppLocale[];
  slug: string;
  /** 切语言时保持当前页类型：产品页 "/p"（默认），系列页 "/series"。 */
  basePath?: string;
}) {
  const btnRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; right: number } | null>(null);

  function toggle() {
    if (!open && btnRef.current) {
      const r = btnRef.current.getBoundingClientRect();
      setPos({ top: r.bottom + 8, right: window.innerWidth - r.right });
    }
    setOpen((o) => !o);
  }

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (
        btnRef.current &&
        !btnRef.current.contains(t) &&
        panelRef.current &&
        !panelRef.current.contains(t)
      )
        setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    const onScroll = () => setOpen(false);
    document.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKey);
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onScroll);
    return () => {
      document.removeEventListener("mousedown", onDown);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onScroll);
    };
  }, [open]);

  if (supported.length < 2) return null;
  const ordered = LOCALE_ORDER.filter((l) => supported.includes(l));

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        onClick={toggle}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="flex cursor-pointer items-center gap-1.5 px-1 py-2 text-[var(--color-ink-muted)] transition hover:text-[var(--color-ink)]"
      >
        <Globe className="h-3.5 w-3.5" strokeWidth={1.5} />
        <FlagBadge code={LOCALE_FLAGS[current]} />
        <span className="font-mono text-[10px] uppercase tracking-[0.18em]">
          {LOCALE_LABELS[current]}
        </span>
      </button>

      {open &&
        pos &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            ref={panelRef}
            style={{ position: "fixed", top: pos.top, right: pos.right }}
            className="z-[100] w-52 overflow-hidden rounded-xl border border-[var(--color-rule-strong)] bg-[var(--color-surface)] py-1.5 shadow-xl"
          >
            {ordered.map((loc) => {
              const isCurrent = loc === current;
              const inner = (
                <>
                  <FlagBadge code={LOCALE_FLAGS[loc]} />
                  <span className="flex-1 text-[14px] font-medium normal-case tracking-normal">
                    {LOCALE_LABELS[loc]}
                  </span>
                  {isCurrent && (
                    <Check
                      className="h-4 w-4 text-[var(--color-accent)]"
                      strokeWidth={2}
                    />
                  )}
                </>
              );
              return isCurrent ? (
                <span
                  key={loc}
                  aria-current="true"
                  className="flex items-center gap-3 bg-[var(--color-surface-sunken)] px-3.5 py-2.5 text-[var(--color-ink)]"
                >
                  {inner}
                </span>
              ) : (
                <Link
                  key={loc}
                  href={`${basePath}/${slug}`}
                  locale={loc}
                  onClick={() => setOpen(false)}
                  className="flex items-center gap-3 px-3.5 py-2.5 text-[var(--color-ink-soft)] transition hover:bg-[var(--color-surface-sunken)] hover:text-[var(--color-ink)]"
                >
                  {inner}
                </Link>
              );
            })}
          </div>,
          document.body
        )}
    </>
  );
}

function FlagBadge({ code }: { code: string }) {
  return (
    <span className="inline-flex h-[18px] min-w-[22px] items-center justify-center rounded-[3px] bg-[var(--color-ink)] px-1 font-mono text-[9px] font-semibold tracking-wide text-[var(--color-surface)]">
      {code}
    </span>
  );
}
