"use client";

/**
 * 客户端图片：优先渲染变体（如 thumb/display），加载失败时一次性回退到原图。
 * 抽成 Client Component 是因为 onError 是事件处理器，不能在 Server Component 里直接挂到 <img>。
 */
export function FallbackImage({
  src,
  fallbackSrc,
  alt,
  className,
  loading = "lazy",
}: {
  /** 优先尝试的 URL（变体）。 */
  src: string;
  /** 失败时回退的 URL（原图）；与 src 相同或缺失则不回退。 */
  fallbackSrc?: string | null;
  alt: string;
  className?: string;
  loading?: "lazy" | "eager";
}) {
  return (
    /* eslint-disable-next-line @next/next/no-img-element */
    <img
      src={src}
      onError={(e) => {
        if (fallbackSrc && e.currentTarget.src !== fallbackSrc)
          e.currentTarget.src = fallbackSrc;
      }}
      alt={alt}
      loading={loading}
      className={className}
    />
  );
}
