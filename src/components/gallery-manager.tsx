"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  ImageIcon,
  Upload,
  Trash2,
  ArrowUp,
  ArrowDown,
  Star,
  Loader2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import {
  addProductImage,
  removeProductImage,
  reorderProductImages,
  setProductCover,
} from "@/app/admin/products/actions";
import { useFileDrop } from "@/components/use-file-drop";
import { MAX_IMAGE_BYTES } from "@/lib/upload-rules";

type GalleryImage = { id: string; url: string; alt: string | null };

/** 上传图片文件到 R2，返回公开 URL。强制 kind=image，后端会拒绝非图片。 */
async function uploadImage(file: File) {
  const fd = new FormData();
  fd.append("file", file);
  fd.append("kind", "image");
  const res = await fetch("/api/upload", { method: "POST", body: fd });
  if (!res.ok) {
    const msg = await res.json().catch(() => null);
    throw new Error(msg?.error ?? ""); // 空消息时调用方回退本地化文案
  }
  return res.json() as Promise<{ url: string }>;
}

export function GalleryManager({
  productId,
  coverImage,
  images,
}: {
  productId: string;
  coverImage: string | null;
  images: GalleryImage[];
}) {
  const router = useRouter();
  const t = useTranslations();
  const [pending, start] = useTransition();
  const coverRef = useRef<HTMLInputElement>(null);
  const addRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  // 本地顺序快照，让上下移动即时反馈；持久化由 server action 完成
  const [order, setOrder] = useState<GalleryImage[]>(images);

  // props 变化（router.refresh 后）时同步本地顺序
  if (
    images.map((i) => i.id).join() !== order.map((i) => i.id).join() &&
    !pending
  ) {
    setOrder(images);
  }

  function run(fn: () => Promise<unknown>, okMsg?: string) {
    start(async () => {
      try {
        await fn();
        if (okMsg) toast.success(okMsg);
        router.refresh();
      } catch (e) {
        toast.error(e instanceof Error && e.message ? e.message : t("admin.common.opFail"));
      }
    });
  }

  async function uploadCoverFile(file: File) {
    if (file.size > MAX_IMAGE_BYTES) {
      toast.error(t("err.imageTooLarge"));
      return;
    }
    setUploading(true);
    try {
      const { url } = await uploadImage(file);
      await setProductCover(productId, url);
      toast.success(t("prod.coverUpdated"));
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error && err.message ? err.message : t("admin.common.uploadFail"));
    } finally {
      setUploading(false);
    }
  }

  async function addFiles(files: File[]) {
    if (files.length === 0) return;
    const ok = files.filter((f) => f.size <= MAX_IMAGE_BYTES);
    if (ok.length < files.length) toast.error(t("err.imageTooLarge"));
    if (ok.length === 0) return;
    setUploading(true);
    try {
      for (const file of ok) {
        const { url } = await uploadImage(file);
        await addProductImage({ productId, url });
      }
      toast.success(t("prod.imagesAdded", { n: ok.length }));
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error && err.message ? err.message : t("admin.common.uploadFail"));
    } finally {
      setUploading(false);
    }
  }

  function handleCoverPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (coverRef.current) coverRef.current.value = "";
    if (file) uploadCoverFile(file);
  }

  function handleAddPick(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (addRef.current) addRef.current.value = "";
    addFiles(files);
  }

  const coverDrop = useFileDrop((files) => uploadCoverFile(files[0]), {
    accept: "image",
    disabled: uploading || pending,
  });
  const galleryDrop = useFileDrop(addFiles, {
    accept: "image",
    disabled: uploading || pending,
  });

  function move(i: number, dir: -1 | 1) {
    const j = i + dir;
    if (j < 0 || j >= order.length) return;
    const next = [...order];
    [next[i], next[j]] = [next[j], next[i]];
    setOrder(next);
    run(() => reorderProductImages(productId, next.map((x) => x.id)));
  }

  return (
    <section className="mt-6 rounded-2xl border border-[var(--color-rule)] bg-[var(--color-surface)] p-6">
      <div className="flex items-baseline justify-between border-b border-[var(--color-rule)] pb-3">
        <p className="font-mono text-[10px] font-medium uppercase tracking-[0.22em] text-[var(--color-ink)]">
          {t("prod.galleryTitle")}
        </p>
        <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-[var(--color-ink-muted)]">
          {t("prod.gallerySub")}
        </span>
      </div>

      {/* 封面图 */}
      <div className="mt-5">
        <label className="font-mono text-[10px] font-medium uppercase tracking-[0.22em] text-[var(--color-ink-muted)]">
          {t("prod.cover")}
        </label>
        <div className="mt-2 flex items-center gap-4">
          <div
            {...coverDrop.dropProps}
            className={`relative h-24 w-32 shrink-0 overflow-hidden rounded-lg border bg-[var(--color-surface-sunken)] transition ${
              coverDrop.dragging
                ? "border-[var(--color-ink)] ring-2 ring-[var(--color-ink)]"
                : "border-[var(--color-rule)]"
            }`}
          >
            {coverImage ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img src={coverImage} alt="" className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-[var(--color-ink-faint)]">
                <ImageIcon className="h-6 w-6" />
              </div>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => coverRef.current?.click()}
              disabled={uploading || pending}
              className="flex items-center gap-1.5 rounded-full border border-[var(--color-rule)] px-4 py-2 text-xs transition hover:bg-[var(--color-surface-sunken)] disabled:opacity-50"
            >
              {uploading ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Upload className="h-3.5 w-3.5" />
              )}
              {coverImage ? t("prod.replaceCover") : t("prod.uploadCover")}
            </button>
            {coverImage && (
              <button
                type="button"
                onClick={() => run(() => setProductCover(productId, ""), t("prod.clearCover"))}
                disabled={pending}
                className="flex items-center gap-1.5 rounded-full border border-[var(--color-rule)] px-4 py-2 text-xs text-[var(--color-ink-muted)] transition hover:text-red-600 disabled:opacity-50"
              >
                <X className="h-3.5 w-3.5" />
                {t("prod.clearCover")}
              </button>
            )}
          </div>
          <input
            ref={coverRef}
            type="file"
            accept="image/*"
            hidden
            onChange={handleCoverPick}
          />
        </div>
      </div>

      {/* 画廊图 */}
      <div
        {...galleryDrop.dropProps}
        className={`mt-6 rounded-lg transition ${
          galleryDrop.dragging
            ? "ring-2 ring-[var(--color-ink)] ring-offset-4 ring-offset-[var(--color-surface)]"
            : ""
        }`}
      >
        <div className="flex items-center justify-between">
          <label className="font-mono text-[10px] font-medium uppercase tracking-[0.22em] text-[var(--color-ink-muted)]">
            {t("prod.galleryImgs")}
          </label>
          <button
            type="button"
            onClick={() => addRef.current?.click()}
            disabled={uploading || pending}
            className="flex items-center gap-1.5 rounded-full bg-[var(--color-ink)] px-4 py-1.5 text-xs text-white transition hover:bg-[#424245] disabled:opacity-50"
          >
            {uploading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Upload className="h-3.5 w-3.5" />
            )}
            {t("prod.uploadImgs")}
          </button>
          <input
            ref={addRef}
            type="file"
            accept="image/*"
            multiple
            hidden
            onChange={handleAddPick}
          />
        </div>

        {order.length === 0 ? (
          <p className="mt-3 text-[12px] text-[var(--color-ink-faint)]">
            {t("prod.galleryEmpty")}
          </p>
        ) : (
          <ul className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
            {order.map((img, i) => (
              <li
                key={img.id}
                className="group relative overflow-hidden rounded-lg border border-[var(--color-rule)] bg-[var(--color-surface-sunken)]"
              >
                <div className="relative aspect-[4/3]">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={img.url}
                    alt={img.alt ?? ""}
                    className="h-full w-full object-cover"
                  />
                  {coverImage === img.url && (
                    <span className="absolute left-1.5 top-1.5 flex items-center gap-1 rounded-full bg-[var(--color-ink)] px-2 py-0.5 text-[10px] font-medium text-white">
                      <Star className="h-3 w-3" /> {t("prod.coverBadge")}
                    </span>
                  )}
                </div>
                <div className="flex items-center justify-between gap-1 px-1.5 py-1.5">
                  <div className="flex gap-0.5">
                    <button
                      type="button"
                      onClick={() => move(i, -1)}
                      disabled={i === 0 || pending}
                      aria-label={t("show.moveUp")}
                      className="p-1 text-[var(--color-ink-faint)] transition hover:text-[var(--color-ink)] disabled:opacity-30"
                    >
                      <ArrowUp className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => move(i, 1)}
                      disabled={i === order.length - 1 || pending}
                      aria-label={t("show.moveDown")}
                      className="p-1 text-[var(--color-ink-faint)] transition hover:text-[var(--color-ink)] disabled:opacity-30"
                    >
                      <ArrowDown className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <div className="flex gap-0.5">
                    <button
                      type="button"
                      onClick={() =>
                        run(
                          () => setProductCover(productId, img.url),
                          t("prod.setCover"),
                        )
                      }
                      disabled={pending || coverImage === img.url}
                      aria-label={t("prod.setCover")}
                      title={t("prod.setCover")}
                      className="p-1 text-[var(--color-ink-faint)] transition hover:text-[var(--color-ink)] disabled:opacity-30"
                    >
                      <Star className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        run(
                          () => removeProductImage(img.id, productId),
                          t("admin.common.deleted"),
                        )
                      }
                      disabled={pending}
                      aria-label={t("admin.common.delete")}
                      className="p-1 text-[var(--color-ink-faint)] transition hover:text-red-500 disabled:opacity-30"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
