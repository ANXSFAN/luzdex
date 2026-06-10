"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { FileText, Film, Trash2, Upload, Loader2, Plus } from "lucide-react";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { useFileDrop } from "@/components/use-file-drop";

interface DocumentItem {
  id: string;
  title: string;
  fileUrl: string;
  fileName: string;
  fileSize: number;
}
interface VideoItem {
  id: string;
  title: string;
  url: string;
}

interface Props {
  productId: string;
  documents: DocumentItem[];
  videos: VideoItem[];
}

async function uploadFile(file: File) {
  const fd = new FormData();
  fd.append("file", file);
  const res = await fetch("/api/upload", { method: "POST", body: fd });
  if (!res.ok) throw new Error(""); // 调用方按场景给本地化提示
  return res.json() as Promise<{
    url: string;
    fileName: string;
    fileSize: number;
    mimeType: string;
  }>;
}

function fmtSize(b: number) {
  return b < 1048576 ? `${Math.round(b / 1024)} KB` : `${(b / 1048576).toFixed(1)} MB`;
}

export function MaterialManager({ productId, documents, videos }: Props) {
  return (
    <div className="mt-10 space-y-10">
      <VideoSection productId={productId} videos={videos} />
      <DocumentSection productId={productId} documents={documents} />
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="mb-3 font-mono text-[11px] font-medium uppercase tracking-[0.22em] text-[var(--color-ink-muted)]">
      {children}
    </h2>
  );
}

function VideoSection({ productId, videos }: { productId: string; videos: VideoItem[] }) {
  const router = useRouter();
  const t = useTranslations("misc");
  const tc = useTranslations("admin.common");
  const fileRef = useRef<HTMLInputElement>(null);
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  async function uploadVideoFile(file: File) {
    setUploading(true);
    try {
      const result = await uploadFile(file);
      setUrl(result.url);
      if (!title) setTitle(file.name.replace(/\.[^.]+$/, ""));
      toast.success(t("videoUploaded"));
    } catch {
      toast.error(t("videoUploadFail"));
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  function handlePickVideo(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) uploadVideoFile(file);
  }

  const { dragging, dropProps } = useFileDrop(
    (files) => uploadVideoFile(files[0]),
    { disabled: uploading },
  );

  async function handleAdd() {
    if (!title.trim() || !url.trim()) {
      toast.error(t("videoNeedFields"));
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/videos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId, title: title.trim(), url: url.trim() }),
      });
      if (!res.ok) {
        toast.error(t("addFail"));
      } else {
        toast.success(t("videoAdded"));
        setTitle("");
        setUrl("");
        router.refresh();
      }
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    const res = await fetch(`/api/videos/${id}`, { method: "DELETE" });
    if (res.ok) {
      toast.success(tc("deleted"));
      router.refresh();
    } else {
      toast.error(tc("delFail"));
    }
  }

  return (
    <section>
      <SectionTitle>{t("videos")}</SectionTitle>

      {videos.length > 0 && (
        <ul className="mb-4 divide-y divide-[var(--color-rule)] overflow-hidden rounded-xl border border-[var(--color-rule)]">
          {videos.map((v) => (
            <li key={v.id} className="flex items-center justify-between gap-3 px-3 py-2.5">
              <div className="flex min-w-0 items-center gap-2">
                <Film className="h-4 w-4 shrink-0 text-[var(--color-ink-muted)]" />
                <span className="truncate text-sm text-[var(--color-ink)]">{v.title}</span>
              </div>
              <button
                onClick={() => handleDelete(v.id)}
                className="shrink-0 text-[var(--color-ink-muted)] transition hover:text-red-600"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
      )}

      <div
        {...dropProps}
        className={`space-y-2 rounded-xl border border-dashed p-4 transition ${
          dragging
            ? "border-[var(--color-ink)] bg-[var(--color-surface-sunken)]"
            : "border-[var(--color-rule)]"
        }`}
      >
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={t("videoTitle")}
          className="form-input"
        />
        <div className="flex gap-2">
          <input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder={t("videoUrl")}
            className="form-input min-w-0 flex-1"
          />
          <button
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            className="flex shrink-0 items-center gap-1.5 rounded-full border border-[var(--color-rule)] px-4 text-xs transition hover:bg-[var(--color-surface-sunken)] disabled:opacity-50"
          >
            {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
            {t("upload")}
          </button>
          <input ref={fileRef} type="file" accept="video/*" hidden onChange={handlePickVideo} />
        </div>
        <button
          onClick={handleAdd}
          disabled={saving}
          className="flex items-center gap-1.5 rounded-full bg-[var(--color-ink)] px-4 py-2 text-xs text-white transition hover:bg-[#424245] disabled:opacity-50"
        >
          {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
          {t("addVideo")}
        </button>
      </div>
    </section>
  );
}

function DocumentSection({
  productId,
  documents,
}: {
  productId: string;
  documents: DocumentItem[];
}) {
  const router = useRouter();
  const t = useTranslations("misc");
  const tc = useTranslations("admin.common");
  const fileRef = useRef<HTMLInputElement>(null);
  const [title, setTitle] = useState("");
  const [busy, setBusy] = useState(false);

  async function uploadDocFile(file: File) {
    const docTitle = title.trim() || file.name.replace(/\.[^.]+$/, "");
    setBusy(true);
    try {
      const uploaded = await uploadFile(file);
      const res = await fetch("/api/documents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productId,
          title: docTitle,
          fileUrl: uploaded.url,
          fileName: uploaded.fileName,
          fileSize: uploaded.fileSize,
          mimeType: uploaded.mimeType,
        }),
      });
      if (!res.ok) {
        toast.error(t("addFail"));
      } else {
        toast.success(t("docAdded"));
        setTitle("");
        router.refresh();
      }
    } catch {
      toast.error(tc("uploadFail"));
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  function handlePickDoc(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) uploadDocFile(file);
  }

  const { dragging, dropProps } = useFileDrop(
    (files) => uploadDocFile(files[0]),
    { disabled: busy },
  );

  async function handleDelete(id: string) {
    const res = await fetch(`/api/documents/${id}`, { method: "DELETE" });
    if (res.ok) {
      toast.success(tc("deleted"));
      router.refresh();
    } else {
      toast.error(tc("delFail"));
    }
  }

  return (
    <section>
      <SectionTitle>{t("documents")}</SectionTitle>

      {documents.length > 0 && (
        <ul className="mb-4 divide-y divide-[var(--color-rule)] overflow-hidden rounded-xl border border-[var(--color-rule)]">
          {documents.map((d) => (
            <li key={d.id} className="flex items-center justify-between gap-3 px-3 py-2.5">
              <div className="flex min-w-0 items-center gap-2">
                <FileText className="h-4 w-4 shrink-0 text-[var(--color-ink-muted)]" />
                <span className="truncate text-sm text-[var(--color-ink)]">{d.title}</span>
                <span className="shrink-0 font-mono text-xs text-[var(--color-ink-muted)]">
                  {fmtSize(d.fileSize)}
                </span>
              </div>
              <button
                onClick={() => handleDelete(d.id)}
                className="shrink-0 text-[var(--color-ink-muted)] transition hover:text-red-600"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
      )}

      <div
        {...dropProps}
        className={`space-y-2 rounded-xl border border-dashed p-4 transition ${
          dragging
            ? "border-[var(--color-ink)] bg-[var(--color-surface-sunken)]"
            : "border-[var(--color-rule)]"
        }`}
      >
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={t("docTitle")}
          className="form-input"
        />
        <button
          onClick={() => fileRef.current?.click()}
          disabled={busy}
          className="flex items-center gap-1.5 rounded-full bg-[var(--color-ink)] px-4 py-2 text-xs text-white transition hover:bg-[#424245] disabled:opacity-50"
        >
          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
          {t("pickUpload")}
        </button>
        <input ref={fileRef} type="file" hidden onChange={handlePickDoc} />
      </div>
    </section>
  );
}
