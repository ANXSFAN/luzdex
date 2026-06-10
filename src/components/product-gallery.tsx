"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { Expand, X, ChevronLeft, ChevronRight } from "lucide-react";

type GalleryImage = { url: string; alt?: string | null };

export function ProductGallery({
  images,
  modelNumber,
  fallbackAlt,
}: {
  images: GalleryImage[];
  modelNumber: string;
  fallbackAlt: string;
}) {
  const t = useTranslations("gallery");
  const [active, setActive] = useState(0);
  const [zoomOpen, setZoomOpen] = useState(false);
  const total = images.length;
  const touchStartX = useRef<number | null>(null);

  const go = useCallback(
    (dir: 1 | -1) =>
      setActive((a) => Math.min(Math.max(a + dir, 0), total - 1)),
    [total]
  );

  if (total === 0) return null;

  const current = images[Math.min(active, total - 1)];

  function onTouchStart(e: React.TouchEvent) {
    touchStartX.current = e.touches[0]?.clientX ?? null;
  }
  function onTouchEnd(e: React.TouchEvent) {
    if (touchStartX.current === null) return;
    const dx = (e.changedTouches[0]?.clientX ?? 0) - touchStartX.current;
    touchStartX.current = null;
    if (Math.abs(dx) < 40) return; // 忽略轻微滑动 / 误触
    go(dx < 0 ? 1 : -1);
  }

  return (
    <figure>
      {/* Main — 手机可左右滑动切图；点击放大进入全屏查看 */}
      <button
        type="button"
        onClick={() => setZoomOpen(true)}
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
        aria-label={t("zoom")}
        className="apple-tile group relative block aspect-[16/10] w-full cursor-zoom-in touch-pan-y select-none overflow-hidden border border-[var(--color-rule)] bg-[var(--color-surface-sunken)]"
      >
        <Image
          key={current.url}
          src={current.url}
          alt={current.alt ?? fallbackAlt}
          fill
          sizes="(max-width: 1024px) 100vw, 720px"
          className="apple-tile-img object-cover"
          priority
        />
        <span className="absolute bottom-2 right-2 flex h-7 w-7 items-center justify-center rounded-full border border-white/30 bg-black/35 text-white opacity-0 backdrop-blur transition group-hover:opacity-100 [@media(hover:none)]:opacity-100">
          <Expand className="h-3.5 w-3.5" strokeWidth={1.5} />
        </span>
      </button>

      <figcaption className="mt-3 flex items-baseline justify-between font-mono text-[10px] uppercase tracking-[0.22em] text-[var(--color-ink-muted)]">
        <span>{modelNumber} · Fig. {String(active + 1).padStart(2, "0")}</span>
        <span>
          {String(active + 1).padStart(2, "0")} /{" "}
          {String(total).padStart(2, "0")}
        </span>
      </figcaption>

      {/* Dot indicators — 手机滑动位置反馈（缩略图在手机隐藏）。
          按钮含透明 padding，命中区 ~36px；圆点本身仍是小视觉元素。 */}
      {total > 1 && (
        <div className="mt-1 flex justify-center sm:hidden">
          {images.map((_, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setActive(i)}
              aria-label={t("show", { n: i + 1 })}
              aria-current={i === active}
              className="flex h-9 items-center px-1.5"
            >
              <span
                className={`h-1.5 rounded-full transition-all ${
                  i === active
                    ? "w-5 bg-[var(--color-ink)]"
                    : "w-1.5 bg-[var(--color-rule-strong)]"
                }`}
              />
            </button>
          ))}
        </div>
      )}

      {/* Thumbnails — 桌面专属（手机用上方圆点 + 滑动） */}
      {total > 1 && (
        <div className="mt-4 hidden grid-cols-3 gap-2 sm:grid sm:grid-cols-5 lg:grid-cols-6">
          {images.map((img, i) => {
            const isActive = i === active;
            return (
              <button
                key={`${img.url}-${i}`}
                type="button"
                onClick={() => setActive(i)}
                aria-label={`Show image ${i + 1}`}
                aria-current={isActive}
                className={`group relative aspect-square overflow-hidden rounded-xl border bg-[var(--color-surface-sunken)] transition ${
                  isActive
                    ? "border-[var(--color-ink)] ring-1 ring-[var(--color-ink)]"
                    : "border-[var(--color-rule)] hover:border-[var(--color-rule-strong)]"
                }`}
              >
                <Image
                  src={img.url}
                  alt={img.alt ?? `${fallbackAlt} ${i + 1}`}
                  fill
                  sizes="120px"
                  className={`object-cover transition ${
                    isActive ? "opacity-100" : "opacity-80 group-hover:opacity-100"
                  }`}
                />
                <span
                  className="absolute left-1 top-1 font-mono text-[9px] font-medium uppercase tracking-[0.18em] text-white/85 mix-blend-difference"
                >
                  {String(i + 1).padStart(2, "0")}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {zoomOpen && (
        <Lightbox
          images={images}
          index={active}
          modelNumber={modelNumber}
          fallbackAlt={fallbackAlt}
          onIndex={setActive}
          onClose={() => setZoomOpen(false)}
        />
      )}
    </figure>
  );
}

/**
 * 全屏图片查看：黑底、object-contain 完整呈现、点击切换 1×/2.5× 缩放并可拖动平移。
 * 键盘 ←/→ 切换、Esc 关闭；多图时左右浮动按钮。打开期间锁 body 滚动。
 */
function Lightbox({
  images,
  index,
  modelNumber,
  fallbackAlt,
  onIndex,
  onClose,
}: {
  images: GalleryImage[];
  index: number;
  modelNumber: string;
  fallbackAlt: string;
  onIndex: (i: number) => void;
  onClose: () => void;
}) {
  const t = useTranslations("gallery");
  const total = images.length;
  const [zoomed, setZoomed] = useState(false);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragging = useRef(false);
  const last = useRef({ x: 0, y: 0 });
  const touchStartX = useRef<number | null>(null);

  const step = useCallback(
    (dir: 1 | -1) => {
      setZoomed(false);
      setOffset({ x: 0, y: 0 });
      onIndex(Math.min(Math.max(index + dir, 0), total - 1));
    },
    [index, total, onIndex]
  );

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowRight") step(1);
      else if (e.key === "ArrowLeft") step(-1);
    }
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [step, onClose]);

  const current = images[Math.min(index, total - 1)];

  function toggleZoom() {
    setZoomed((z) => {
      if (z) setOffset({ x: 0, y: 0 });
      return !z;
    });
  }

  function onPointerDown(e: React.PointerEvent) {
    if (!zoomed) return;
    dragging.current = true;
    setIsDragging(true);
    last.current = { x: e.clientX, y: e.clientY };
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
  }
  function onPointerMove(e: React.PointerEvent) {
    if (!dragging.current) return;
    const dx = e.clientX - last.current.x;
    const dy = e.clientY - last.current.y;
    last.current = { x: e.clientX, y: e.clientY };
    setOffset((o) => ({ x: o.x + dx, y: o.y + dy }));
  }
  function onPointerUp() {
    dragging.current = false;
    setIsDragging(false);
  }

  // 未缩放时支持左右滑动切图
  function onTouchStart(e: React.TouchEvent) {
    if (zoomed) return;
    touchStartX.current = e.touches[0]?.clientX ?? null;
  }
  function onTouchEnd(e: React.TouchEvent) {
    if (zoomed || touchStartX.current === null) return;
    const dx = (e.changedTouches[0]?.clientX ?? 0) - touchStartX.current;
    touchStartX.current = null;
    if (Math.abs(dx) < 40) return;
    step(dx < 0 ? 1 : -1);
  }

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col bg-black/95 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label={t("viewer")}
    >
      {/* Top bar */}
      <div className="flex shrink-0 items-center justify-between px-5 py-4 font-mono text-[10px] uppercase tracking-[0.22em] text-white/70">
        <span>
          {modelNumber} · {String(index + 1).padStart(2, "0")} /{" "}
          {String(total).padStart(2, "0")}
        </span>
        <button
          type="button"
          onClick={onClose}
          aria-label={t("close")}
          className="flex h-9 w-9 items-center justify-center rounded-full border border-white/25 text-white/80 transition hover:bg-white/10"
        >
          <X className="h-4 w-4" strokeWidth={1.5} />
        </button>
      </div>

      {/* Stage */}
      <div
        className="relative flex flex-1 items-center justify-center overflow-hidden"
        onClick={(e) => {
          if (e.target === e.currentTarget) onClose();
        }}
      >
        {total > 1 && (
          <button
            type="button"
            onClick={() => step(-1)}
            disabled={index === 0}
            aria-label={t("prev")}
            className="absolute left-3 z-10 flex h-11 w-11 items-center justify-center rounded-full border border-white/25 text-white/80 transition hover:bg-white/10 disabled:opacity-25 sm:left-6"
          >
            <ChevronLeft className="h-5 w-5" strokeWidth={1.5} />
          </button>
        )}

        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={current.url}
          alt={current.alt ?? fallbackAlt}
          draggable={false}
          onClick={toggleZoom}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onTouchStart={onTouchStart}
          onTouchEnd={onTouchEnd}
          style={{
            transform: `translate(${offset.x}px, ${offset.y}px) scale(${zoomed ? 2.5 : 1})`,
            transition: isDragging ? "none" : "transform 0.25s ease",
          }}
          className={`max-h-full max-w-full touch-pan-y select-none object-contain ${
            zoomed ? "cursor-grab" : "cursor-zoom-in"
          }`}
        />

        {total > 1 && (
          <button
            type="button"
            onClick={() => step(1)}
            disabled={index === total - 1}
            aria-label={t("next")}
            className="absolute right-3 z-10 flex h-11 w-11 items-center justify-center rounded-full border border-white/25 text-white/80 transition hover:bg-white/10 disabled:opacity-25 sm:right-6"
          >
            <ChevronRight className="h-5 w-5" strokeWidth={1.5} />
          </button>
        )}
      </div>

      {/* Thumbnail strip */}
      {total > 1 && (
        <div className="flex shrink-0 justify-center gap-2 overflow-x-auto px-5 py-4">
          {images.map((img, i) => (
            <button
              key={`${img.url}-${i}`}
              type="button"
              onClick={() => {
                setZoomed(false);
                setOffset({ x: 0, y: 0 });
                onIndex(i);
              }}
              aria-label={t("goto", { n: i + 1 })}
              aria-current={i === index}
              className={`relative aspect-square h-12 w-12 shrink-0 overflow-hidden rounded-md border transition ${
                i === index
                  ? "border-white"
                  : "border-white/20 opacity-60 hover:opacity-100"
              }`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={img.url}
                alt={img.alt ?? `${fallbackAlt} ${i + 1}`}
                className="h-full w-full object-cover"
              />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
