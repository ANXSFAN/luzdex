/**
 * 用 sharp 把上传的图片转成两份 WebP 变体：display（长边 ~1600）+ thumb（~400）。
 * 故意不加 "server-only"——/api/upload 与 prisma/backfill-images.ts(tsx 脚本) 都要复用。
 *
 * 设计：原图照旧存(PDF 封面、重处理用)；变体用于前台/后台渲染，体积通常能把 1-4MB 的
 * PNG 压到几十 KB 的 WebP。失败(损坏/动图/非栅格)时由调用方决定回退,本函数只管转码。
 */
import sharp from "sharp";

export const DISPLAY_MAX = 1600; // display 长边上限(px)
export const THUMB_MAX = 400; // thumb 长边上限(px)

export type ImageVariants = { lg: Buffer; thumb: Buffer };

/**
 * 生成 display + thumb 两份 WebP。`.rotate()` 先吃掉 EXIF 方向,避免竖图转出来是横的。
 * `withoutEnlargement` 保证小图不会被放大。动图只取首帧(产品图基本是静态)。
 */
export async function makeImageVariants(input: Buffer): Promise<ImageVariants> {
  const base = () => sharp(input, { failOn: "none" }).rotate();

  const [lg, thumb] = await Promise.all([
    base()
      .resize({ width: DISPLAY_MAX, height: DISPLAY_MAX, fit: "inside", withoutEnlargement: true })
      .webp({ quality: 80 })
      .toBuffer(),
    base()
      .resize({ width: THUMB_MAX, height: THUMB_MAX, fit: "inside", withoutEnlargement: true })
      .webp({ quality: 72 })
      .toBuffer(),
  ]);

  return { lg, thumb };
}
