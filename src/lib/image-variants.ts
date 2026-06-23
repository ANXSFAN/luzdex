/**
 * 用 sharp 把上传的图片转成变体：display（长边 ~1600，WebP）+ thumb（~400，WebP）
 * + pdf（长边 ~1400，JPEG，白底拍平）。前两份给前台/后台渲染；pdf 份专供
 * @react-pdf/renderer 嵌封面——它只解码 PNG/JPEG，吃不了 WebP，也处理不好透明，
 * 故单独转一份白底 JPEG，避免把 1-4MB 原图直塞进 PDF 拖慢打开。
 * 故意不加 "server-only"——/api/upload 与 prisma/backfill-images.ts(tsx 脚本) 都要复用。
 *
 * 设计：原图照旧存(下载 / 重处理用)；变体用于渲染，体积通常能把 1-4MB 的
 * PNG 压到几十～一两百 KB。失败(损坏/动图/非栅格)时由调用方决定回退,本函数只管转码。
 */
import sharp from "sharp";

export const DISPLAY_MAX = 1600; // display 长边上限(px)
export const THUMB_MAX = 400; // thumb 长边上限(px)
export const PDF_MAX = 1400; // pdf 嵌图长边上限(px)，够 A4 打印清晰

export type ImageVariants = { lg: Buffer; thumb: Buffer; pdf: Buffer };

/**
 * 生成 display + thumb + pdf 三份变体。`.rotate()` 先吃掉 EXIF 方向,避免竖图转出来是横的。
 * `withoutEnlargement` 保证小图不会被放大。动图只取首帧(产品图基本是静态)。
 * pdf 份用 `.flatten()` 把透明区拍成白底(JPEG 无 alpha，否则透明会变黑)。
 */
export async function makeImageVariants(input: Buffer): Promise<ImageVariants> {
  const base = () => sharp(input, { failOn: "none" }).rotate();

  const [lg, thumb, pdf] = await Promise.all([
    base()
      .resize({ width: DISPLAY_MAX, height: DISPLAY_MAX, fit: "inside", withoutEnlargement: true })
      .webp({ quality: 80 })
      .toBuffer(),
    base()
      .resize({ width: THUMB_MAX, height: THUMB_MAX, fit: "inside", withoutEnlargement: true })
      .webp({ quality: 72 })
      .toBuffer(),
    base()
      .resize({ width: PDF_MAX, height: PDF_MAX, fit: "inside", withoutEnlargement: true })
      .flatten({ background: "#ffffff" })
      .jpeg({ quality: 82 })
      .toBuffer(),
  ]);

  return { lg, thumb, pdf };
}
