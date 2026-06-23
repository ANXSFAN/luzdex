import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { auth } from "@/lib/auth";
import { uploadToR2 } from "@/lib/r2";
import { errMsg } from "@/lib/admin-err";
import { makeImageVariants } from "@/lib/image-variants";
import { variantKeys } from "@/lib/images";
import {
  MAX_UPLOAD_BYTES,
  MAX_IMAGE_BYTES,
  BLOCKED_TYPES,
  BLOCKED_EXT,
  safeExt,
} from "@/lib/upload-rules";

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session)
    return NextResponse.json({ error: await errMsg("unauthorized") }, { status: 401 });

  const formData = await request.formData();
  const file = formData.get("file");
  const kind = formData.get("kind"); // "image" 时强制要求图片类型
  if (!(file instanceof File)) {
    return NextResponse.json({ error: await errMsg("fileMissing") }, { status: 400 });
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return NextResponse.json({ error: await errMsg("fileTooLarge25m") }, { status: 413 });
  }

  const type = file.type || "application/octet-stream";
  const ext = safeExt(file.name);

  if (BLOCKED_TYPES.has(type) || BLOCKED_EXT.has(ext)) {
    return NextResponse.json({ error: await errMsg("unsupportedFileType") }, { status: 415 });
  }
  if (kind === "image" && !type.startsWith("image/")) {
    return NextResponse.json({ error: await errMsg("imageOnly") }, { status: 415 });
  }
  if (kind === "image" && file.size > MAX_IMAGE_BYTES) {
    return NextResponse.json({ error: await errMsg("imageTooLarge") }, { status: 413 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const key = `${randomUUID()}.${ext}`;

  const url = await uploadToR2(key, buffer, type);

  // 图片:旁路生成 display(_lg)/thumb(_thumb) WebP + pdf(_pdf.jpg) 三份变体,渲染时按需取(见 lib/images.ts)。
  // 原图保持不变(下载 / 重处理用)。失败不阻断上传——消费端有 onError / 回退原图兜底。
  if (kind === "image") {
    const vk = variantKeys(key);
    if (vk) {
      try {
        const { lg, thumb, pdf } = await makeImageVariants(buffer);
        await Promise.all([
          uploadToR2(vk.lg, lg, "image/webp"),
          uploadToR2(vk.thumb, thumb, "image/webp"),
          uploadToR2(vk.pdf, pdf, "image/jpeg"),
        ]);
      } catch (e) {
        console.warn("image variant generation failed:", (e as Error)?.message);
      }
    }
  }

  return NextResponse.json({
    url,
    fileName: file.name,
    fileSize: file.size,
    mimeType: type,
  });
}
