/**
 * 图片变体的「文件名约定」纯函数——客户端 / 服务端 / 脚本通用（无 server-only、无依赖）。
 *
 * 上传管线（/api/upload kind=image）对每张图存原图 `{uuid}.{ext}` 之外，旁路生成两份
 * WebP 变体：`{uuid}_lg.webp`（display，长边 ~1600）与 `{uuid}_thumb.webp`（缩略 ~400）。
 * 库里存的 URL **始终是原图不变**（PDF 封面、detailBlocks/contentI18n 里的图都不用改写）；
 * 前台/后台按需用 displayOf / thumbOf 在渲染时派生变体 URL。
 *
 * 只对「我们自己上传的、UUID 文件名的栅格图」派生（外链如 unsplash、已是变体的图原样返回），
 * 这样无需知道 R2 域名也能安全门控。变体不存在的极端情况（回填未跑）才会 404，
 * 故上线务必先跑 db:backfill-images 把存量图补齐。
 */

// /api/upload 用 `${randomUUID()}.${ext}` 命名；只认这种 UUID 原图,变体(_lg/_thumb)不再匹配。
const UPLOAD_IMG_RE =
  /\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\.(?:png|jpe?g|webp|gif|avif)$/i;

function deriveVariant(
  url: string | null | undefined,
  suffix: string,
  ext = "webp",
): string | null {
  if (!url) return url ?? null;
  const m = UPLOAD_IMG_RE.exec(url);
  if (!m) return url; // 外链 / 已是变体 / 非我方上传 → 原样
  return url.slice(0, m.index) + `/${m[1]}${suffix}.${ext}`;
}

/** display 变体（长边 ~1600 的 WebP）：前台主图 / 详情大图用。 */
export function displayOf(url: string | null | undefined): string | null {
  return deriveVariant(url, "_lg");
}

/** thumb 变体（~400 的 WebP）：后台列表 / 相关产品 / 画廊缩略图用。 */
export function thumbOf(url: string | null | undefined): string | null {
  return deriveVariant(url, "_thumb");
}

/** pdf 变体（长边 ~1400 的白底 JPEG）：PDF 嵌封面用（react-pdf 不吃 WebP）。 */
export function pdfOf(url: string | null | undefined): string | null {
  return deriveVariant(url, "_pdf", "jpg");
}

/** 给定原图的 R2 key（如 `xxxx.png`），返回各变体的 key。供上传 / 回填生成时用。 */
export function variantKeys(
  originalKey: string,
): { lg: string; thumb: string; pdf: string } | null {
  const m = /^([0-9a-f-]{36})\.(?:png|jpe?g|webp|gif|avif)$/i.exec(originalKey);
  if (!m) return null;
  return { lg: `${m[1]}_lg.webp`, thumb: `${m[1]}_thumb.webp`, pdf: `${m[1]}_pdf.jpg` };
}
