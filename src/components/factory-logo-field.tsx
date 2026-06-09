"use client";

import { useState, useRef } from "react";
import { Loader2, Plus, X, ImageOff } from "lucide-react";
import { toast } from "sonner";
import { useFileDrop } from "@/components/use-file-drop";

/**
 * 工厂 Logo 上传：点选文件 → 直传 R2（/api/upload）→ 把返回 URL 写进隐藏
 * input，沿用原有 server action 的 name="logoUrl" 提交，不动表单逻辑。
 */
export function FactoryLogoField({
  name,
  initial,
  uploadLabel,
  clearLabel,
}: {
  name: string;
  initial: string | null;
  uploadLabel: string;
  clearLabel: string;
}) {
  const [url, setUrl] = useState(initial ?? "");
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  async function uploadOne(file: File) {
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("kind", "image");
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      if (!res.ok) {
        const m = await res.json().catch(() => null);
        throw new Error(m?.error ?? "上传失败");
      }
      setUrl((await res.json()).url as string);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "上传失败");
    } finally {
      setUploading(false);
    }
  }

  function pick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // 允许重选同一文件
    if (file) uploadOne(file);
  }

  const { dragging, dropProps } = useFileDrop(
    (files) => uploadOne(files[0]),
    { accept: "image", disabled: uploading },
  );

  return (
    <div className="flex items-start gap-4">
      <input type="hidden" name={name} value={url} />
      <div
        {...dropProps}
        className={`relative flex h-20 w-40 shrink-0 items-center justify-center overflow-hidden rounded-lg border bg-[var(--color-surface-sunken)] transition ${
          dragging
            ? "border-[var(--color-ink)] ring-2 ring-[var(--color-ink)]"
            : "border-[var(--color-rule)]"
        }`}
      >
        {url ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img src={url} alt="" className="h-full w-full object-contain p-2" />
        ) : (
          <ImageOff className="h-6 w-6 text-[var(--color-ink-faint)]" />
        )}
      </div>
      <div className="flex flex-col gap-2 pt-1">
        <label className="inline-flex w-fit cursor-pointer items-center gap-1.5 rounded-full border border-[var(--color-rule)] px-3 py-1.5 text-sm transition hover:bg-[var(--color-surface-sunken)]">
          {uploading ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Plus className="h-3.5 w-3.5" />
          )}
          {uploadLabel}
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            hidden
            onChange={pick}
          />
        </label>
        {url && (
          <button
            type="button"
            onClick={() => setUrl("")}
            className="inline-flex w-fit items-center gap-1 text-xs text-[var(--color-ink-muted)] transition hover:text-red-600"
          >
            <X className="h-3 w-3" /> {clearLabel}
          </button>
        )}
      </div>
    </div>
  );
}
