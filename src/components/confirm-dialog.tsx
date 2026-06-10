"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";

export type ConfirmOptions = {
  /** 弹窗小标题（默认「请确认」） */
  title?: string;
  /** 正文，支持 \n 换行 */
  message: string;
  /** 确认按钮文案（默认「确定」） */
  confirmText?: string;
  /** 取消按钮文案（默认「取消」） */
  cancelText?: string;
  /** 危险操作（删除类）：确认按钮红色 */
  danger?: boolean;
};

type Pending = ConfirmOptions & { resolve: (ok: boolean) => void };

let enqueue: ((p: Pending) => void) | null = null;

/**
 * 项目内置确认弹窗，替代原生 window.confirm（不卡线程、可多语言、跟随设计语言）。
 * 用法：`if (!(await confirmDialog({ message: 提示文案 }))) return;`
 * 需要 <ConfirmHost /> 已挂载（admin layout）。
 */
export function confirmDialog(opts: ConfirmOptions): Promise<boolean> {
  return new Promise((resolve) => {
    if (enqueue) enqueue({ ...opts, resolve });
    else resolve(window.confirm(opts.message)); // Host 未挂载时兜底
  });
}

/** 全局确认弹窗宿主：在 admin layout 挂载一次。 */
export function ConfirmHost() {
  const t = useTranslations("admin.common");
  const [req, setReq] = useState<Pending | null>(null);
  const confirmRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    enqueue = (p) =>
      setReq((cur) => {
        cur?.resolve(false); // 前一个还开着就视为取消
        return p;
      });
    return () => {
      enqueue = null;
    };
  }, []);

  useEffect(() => {
    if (!req) return;
    confirmRef.current?.focus();
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setReq((cur) => {
          cur?.resolve(false);
          return null;
        });
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [req]);

  function close(ok: boolean) {
    req?.resolve(ok);
    setReq(null);
  }

  if (!req) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      role="alertdialog"
      aria-modal="true"
    >
      <div
        className="absolute inset-0 bg-black/25 backdrop-blur-[2px]"
        onClick={() => close(false)}
      />
      <div className="relative w-full max-w-sm rounded-2xl border border-[var(--color-rule)] bg-[var(--color-surface)] p-5 shadow-2xl">
        <p className="font-mono text-[10px] font-medium uppercase tracking-[0.22em] text-[var(--color-ink-muted)]">
          {req.title ?? t("confirmTitle")}
        </p>
        <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-[var(--color-ink)]">
          {req.message}
        </p>
        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={() => close(false)}
            className="rounded-lg border border-[var(--color-rule)] px-3.5 py-1.5 text-sm text-[var(--color-ink-soft)] transition hover:border-[var(--color-ink)] hover:text-[var(--color-ink)]"
          >
            {req.cancelText ?? t("cancel")}
          </button>
          <button
            type="button"
            ref={confirmRef}
            onClick={() => close(true)}
            className={`rounded-lg px-3.5 py-1.5 text-sm font-medium transition ${
              req.danger
                ? "bg-red-600 text-white hover:bg-red-700"
                : "bg-[var(--color-ink)] text-[var(--color-surface)] hover:opacity-85"
            }`}
          >
            {req.confirmText ?? t("ok")}
          </button>
        </div>
      </div>
    </div>
  );
}
