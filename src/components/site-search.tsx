"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Search, X, ArrowUpRight } from "lucide-react";

type Hit = {
  slug: string;
  modelNumber: string;
  name: string;
  brand: string;
};

export function SiteSearch() {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  // Single source of truth for fetched results — pair (term, hits) so loading
  // / queried / visible-hits are derived during render, never set inside an
  // effect body. Avoids cascading renders flagged by react-hooks/set-state-in-effect.
  const [submitted, setSubmitted] = useState<{ term: string; hits: Hit[] } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const reqId = useRef(0);

  const term = q.trim();
  const valid = term.length >= 2;
  const matched = valid && submitted?.term === term;
  const hits = matched ? (submitted?.hits ?? []) : [];
  const queried = matched;
  const loading = valid && !matched;

  const close = useCallback(() => {
    setOpen(false);
    setQ("");
    setSubmitted(null);
  }, []);

  // Focus input when panel opens, listen for ESC/⌘K.
  useEffect(() => {
    if (open) {
      const t = setTimeout(() => inputRef.current?.focus(), 20);
      return () => clearTimeout(t);
    }
  }, [open]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.key === "k" || e.key === "K") && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((v) => !v);
        return;
      }
      if (e.key === "Escape" && open) close();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, close]);

  // Debounced fetch — setState only runs inside the timer callback, which the
  // react-hooks rules treat as an async subscription rather than a sync cascade.
  useEffect(() => {
    if (!open || !valid) return;
    const id = ++reqId.current;
    const t = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/search?q=${encodeURIComponent(term)}`,
          { cache: "no-store" }
        );
        const json = (await res.json()) as { results: Hit[] };
        if (id === reqId.current) {
          setSubmitted({ term, hits: json.results ?? [] });
        }
      } catch {
        if (id === reqId.current) {
          setSubmitted({ term, hits: [] });
        }
      }
    }, 200);
    return () => clearTimeout(t);
  }, [term, valid, open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Search by model number"
        className="flex items-center gap-1.5 rounded-full border border-[var(--color-rule)] px-3 py-1 font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--color-ink-muted)] transition hover:border-[var(--color-rule-strong)] hover:text-[var(--color-ink)]"
      >
        <Search className="h-3 w-3" strokeWidth={1.75} />
        <span className="hidden sm:inline">Search</span>
        <kbd className="hidden font-mono text-[9px] tracking-tight text-[var(--color-ink-faint)] sm:inline">
          ⌘K
        </kbd>
      </button>

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Search by model number"
          className="fixed inset-0 z-40 flex items-start justify-center bg-[var(--color-ink)]/15 px-4 pt-[10vh] backdrop-blur-sm sm:pt-[14vh]"
          onClick={(e) => {
            if (e.target === e.currentTarget) close();
          }}
        >
          <div className="w-full max-w-[640px] overflow-hidden rounded-2xl border border-[var(--color-rule)] bg-[var(--color-surface)] shadow-[0_24px_80px_-20px_rgba(0,0,0,0.25)]">
            {/* Search input */}
            <div className="flex items-center gap-3 border-b border-[var(--color-rule)] px-5 py-4">
              <Search
                className="h-4 w-4 shrink-0 text-[var(--color-ink-muted)]"
                strokeWidth={1.75}
              />
              <input
                ref={inputRef}
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search by model number…"
                spellCheck={false}
                autoComplete="off"
                className="flex-1 bg-transparent text-[15px] font-medium text-[var(--color-ink)] outline-none placeholder:font-mono placeholder:text-[13px] placeholder:font-normal placeholder:tracking-[0.04em] placeholder:text-[var(--color-ink-faint)]"
              />
              <button
                type="button"
                onClick={close}
                aria-label="Close search"
                className="flex h-6 w-6 shrink-0 items-center justify-center text-[var(--color-ink-muted)] transition hover:text-[var(--color-ink)]"
              >
                <X className="h-4 w-4" strokeWidth={1.75} />
              </button>
            </div>

            {/* Status / Results */}
            <SearchBody
              q={q.trim()}
              loading={loading}
              queried={queried}
              hits={hits}
              onPick={close}
            />

            {/* Hint footer */}
            <div className="flex items-center justify-between border-t border-[var(--color-rule)] px-5 py-2.5 font-mono text-[10px] uppercase tracking-[0.22em] text-[var(--color-ink-muted)]">
              <span>Esc · 关闭</span>
              <span className="hidden sm:inline">
                Fallback for damaged QR
              </span>
              <span>⏎ · 打开</span>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function SearchBody({
  q,
  loading,
  queried,
  hits,
  onPick,
}: {
  q: string;
  loading: boolean;
  queried: boolean;
  hits: Hit[];
  onPick: () => void;
}) {
  if (q.length < 2) {
    return (
      <div className="px-5 py-10 text-center">
        <p className="kicker justify-center">
          <span className="kicker-mark">/</span>
          <span>Type a model number</span>
        </p>
        <p className="mt-3 text-[13px] text-[var(--color-ink-muted)]">
          至少输入 2 个字符 · e.g. <span className="font-mono">LS-2835</span>
        </p>
      </div>
    );
  }

  if (loading && hits.length === 0) {
    return (
      <div className="px-5 py-8 text-center font-mono text-[11px] uppercase tracking-[0.22em] text-[var(--color-ink-muted)]">
        Searching…
      </div>
    );
  }

  if (queried && hits.length === 0) {
    return (
      <div className="px-5 py-10 text-center">
        <p className="kicker justify-center">
          <span className="kicker-mark">/</span>
          <span>No match</span>
        </p>
        <p className="mt-3 text-[13px] text-[var(--color-ink-muted)]">
          没有找到型号包含 「<span className="font-mono text-[var(--color-ink)]">{q}</span>」 的产品。
        </p>
      </div>
    );
  }

  return (
    <ul className="max-h-[60vh] divide-y divide-[var(--color-rule)] overflow-y-auto">
      {hits.map((h) => (
        <li key={h.slug}>
          <Link
            href={`/p/${h.slug}`}
            onClick={onPick}
            className="group flex items-center gap-4 px-5 py-3.5 transition hover:bg-[var(--color-surface-sunken)]"
          >
            <span className="min-w-0 flex-1">
              <span className="block truncate font-mono text-[13px] font-medium tracking-tight text-[var(--color-ink)]">
                {h.modelNumber}
              </span>
              <span className="mt-1 block truncate text-[13px] text-[var(--color-ink-soft)]">
                {h.name}
              </span>
            </span>
            <span className="hidden shrink-0 rounded-full border border-[var(--color-rule)] px-2.5 py-0.5 font-mono text-[9px] uppercase tracking-[0.18em] text-[var(--color-ink-muted)] sm:inline-block">
              {h.brand}
            </span>
            <ArrowUpRight
              className="h-4 w-4 shrink-0 text-[var(--color-ink-muted)] transition group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-[var(--color-ink)]"
              strokeWidth={1.5}
            />
          </Link>
        </li>
      ))}
    </ul>
  );
}
