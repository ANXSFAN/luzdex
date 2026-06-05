"use client";

import { useState } from "react";
import { Check, X } from "lucide-react";
import { ACCENT_SWATCHES } from "./accent-swatches";

export function AccentSwatchPicker({
  name,
  initial,
}: {
  name: string;
  initial: string | null;
}) {
  const [value, setValue] = useState<string>(initial ?? "");
  const activeLabel = ACCENT_SWATCHES.find((s) => s.value === value)?.label;

  return (
    <div>
      <input type="hidden" name={name} value={value} />
      <div className="flex flex-wrap items-center gap-2">
        {ACCENT_SWATCHES.map((sw) => {
          const isActive = sw.value === value;
          return (
            <button
              type="button"
              key={sw.value}
              onClick={() => setValue(sw.value)}
              aria-label={sw.label}
              aria-pressed={isActive}
              className={`relative h-11 w-11 rounded-lg border transition ${
                isActive
                  ? "border-[var(--color-ink)] ring-1 ring-[var(--color-ink)]"
                  : "border-[var(--color-rule)] hover:border-[var(--color-rule-strong)]"
              }`}
              style={{ backgroundColor: sw.value }}
              title={sw.label}
            >
              {isActive && (
                <Check
                  className="absolute inset-0 m-auto h-4 w-4 text-black mix-blend-difference"
                  strokeWidth={2.5}
                />
              )}
            </button>
          );
        })}
        {value && (
          <button
            type="button"
            onClick={() => setValue("")}
            className="flex items-center gap-1 px-2 py-1 font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--color-ink-muted)] transition hover:text-[var(--color-ink)]"
          >
            <X className="h-3 w-3" />
            Reset
          </button>
        )}
      </div>
      <p className="mt-2 font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--color-ink-muted)]">
        {activeLabel ?? "Default · Filament"}
      </p>
    </div>
  );
}
