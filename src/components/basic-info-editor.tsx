"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { saveProductBasics } from "@/app/admin/products/actions";

const inputCls =
  "w-full rounded-lg border border-[var(--color-rule)] bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-ink)] outline-none transition focus:border-[var(--color-ink)]";
const labelCls =
  "font-mono text-[10px] font-medium uppercase tracking-[0.22em] text-[var(--color-ink-muted)]";

export function BasicInfoEditor({
  productId,
  initialName,
  initialModelNumber,
}: {
  productId: string;
  initialName: string;
  initialModelNumber: string;
}) {
  const router = useRouter();
  const [name, setName] = useState(initialName);
  const [modelNumber, setModelNumber] = useState(initialModelNumber);
  const [pending, start] = useTransition();

  function save() {
    start(async () => {
      try {
        await saveProductBasics({ productId, name, modelNumber });
        toast.success("基本信息已保存");
        router.refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "保存失败");
      }
    });
  }

  return (
    <section className="mt-6 rounded-2xl border border-[var(--color-rule)] bg-[var(--color-surface)] p-6">
      <div className="flex items-baseline justify-between border-b border-[var(--color-rule)] pb-3">
        <p className="font-mono text-[10px] font-medium uppercase tracking-[0.22em] text-[var(--color-ink)]">
          Basics · 基本信息
        </p>
        <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-[var(--color-ink-muted)]">
          名称 · 型号
        </span>
      </div>

      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <div>
          <label className={labelCls}>产品名称</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="产品名称"
            className={`${inputCls} mt-2`}
          />
        </div>
        <div>
          <label className={labelCls}>型号</label>
          <input
            value={modelNumber}
            onChange={(e) => setModelNumber(e.target.value)}
            placeholder="型号，如 CL-DL-12W"
            className={`${inputCls} mt-2 font-mono`}
          />
        </div>
      </div>

      <div className="mt-5 flex justify-end border-t border-[var(--color-rule)] pt-4">
        <button
          type="button"
          onClick={save}
          disabled={pending}
          className="rounded-lg bg-[var(--color-ink)] px-5 py-2 text-sm font-medium text-[var(--color-surface)] transition hover:opacity-90 disabled:opacity-50"
        >
          {pending ? "保存中…" : "保存基本信息"}
        </button>
      </div>
    </section>
  );
}
