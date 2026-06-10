"use client";

import { useRef, useState } from "react";
import { Bold, Italic, List, ListOrdered, Link2, Heading, Eye, Pencil } from "lucide-react";
import { useTranslations } from "next-intl";
import { renderMarkdown } from "@/lib/md";

/**
 * 带 Markdown 工具栏的多行输入（后台富文本）。存储仍是纯字符串，
 * 翻译 / 前台渲染管线零改动；预览用与前台同一渲染器，所见即所得。
 */
export function MarkdownInput({
  value,
  onChange,
  placeholder,
  rows = 5,
  className = "",
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  rows?: number;
  className?: string;
}) {
  const t = useTranslations("prod");
  const ref = useRef<HTMLTextAreaElement>(null);
  const [preview, setPreview] = useState(false);

  /** 把选区用 before/after 包裹（无选区则插入占位词）；行级语法逐行加前缀。 */
  function wrap(before: string, after = "", linePrefix = false) {
    const el = ref.current;
    if (!el) return;
    const { selectionStart: s, selectionEnd: e } = el;
    const sel = value.slice(s, e) || t("mdText");
    let inserted: string;
    if (linePrefix) {
      inserted = sel
        .split("\n")
        .map((l) => (l.trim() ? before + l : l))
        .join("\n");
    } else {
      inserted = before + sel + after;
    }
    const next = value.slice(0, s) + inserted + value.slice(e);
    onChange(next);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(s, s + inserted.length);
    });
  }

  const btnCls =
    "flex h-7 w-7 items-center justify-center rounded-md text-[var(--color-ink-muted)] transition hover:bg-[var(--color-surface-sunken)] hover:text-[var(--color-ink)]";

  return (
    <div className={className}>
      <div className="flex items-center gap-0.5 rounded-t-lg border border-b-0 border-[var(--color-rule)] bg-[var(--color-surface-sunken)]/60 px-1.5 py-1">
        <button type="button" tabIndex={-1} title={t("mdBold")} onClick={() => wrap("**", "**")} className={btnCls}>
          <Bold className="h-3.5 w-3.5" />
        </button>
        <button type="button" tabIndex={-1} title={t("mdItalic")} onClick={() => wrap("*", "*")} className={btnCls}>
          <Italic className="h-3.5 w-3.5" />
        </button>
        <button type="button" tabIndex={-1} title={t("mdHeading")} onClick={() => wrap("### ", "", true)} className={btnCls}>
          <Heading className="h-3.5 w-3.5" />
        </button>
        <button type="button" tabIndex={-1} title={t("mdList")} onClick={() => wrap("- ", "", true)} className={btnCls}>
          <List className="h-3.5 w-3.5" />
        </button>
        <button type="button" tabIndex={-1} title={t("mdOrdered")} onClick={() => wrap("1. ", "", true)} className={btnCls}>
          <ListOrdered className="h-3.5 w-3.5" />
        </button>
        <button type="button" tabIndex={-1} title={t("mdLink")} onClick={() => wrap("[", "](https://)")} className={btnCls}>
          <Link2 className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          tabIndex={-1}
          onClick={() => setPreview((p) => !p)}
          className="ml-auto flex h-7 items-center gap-1 rounded-md px-2 font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--color-ink-muted)] transition hover:bg-[var(--color-surface-sunken)] hover:text-[var(--color-ink)]"
        >
          {preview ? (
            <>
              <Pencil className="h-3 w-3" /> {t("mdEdit")}
            </>
          ) : (
            <>
              <Eye className="h-3 w-3" /> {t("mdPreview")}
            </>
          )}
        </button>
      </div>
      {preview ? (
        <div
          className="min-h-20 rounded-b-lg border border-[var(--color-rule)] bg-[var(--color-surface)] px-3 py-2 text-sm leading-relaxed text-[var(--color-ink-soft)]"
          style={{ minHeight: rows * 22 + 16 }}
        >
          {renderMarkdown(value) ?? (
            <span className="text-[var(--color-ink-faint)]">{placeholder}</span>
          )}
        </div>
      ) : (
        <textarea
          ref={ref}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          rows={rows}
          className="block w-full rounded-b-lg border border-[var(--color-rule)] bg-[var(--color-surface)] px-3 py-2 text-sm leading-relaxed text-[var(--color-ink)] outline-none transition focus:border-[var(--color-ink)]"
        />
      )}
    </div>
  );
}
