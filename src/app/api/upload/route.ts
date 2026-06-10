import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { auth } from "@/lib/auth";
import { uploadToR2 } from "@/lib/r2";
import { errMsg } from "@/lib/admin-err";

const MAX_BYTES = 25 * 1024 * 1024; // 25MB 上限，挡住误传超大文件刷爆存储

// 公开 R2 桶上的存储型 XSS / 可执行内容向量：一律拒绝。
// SVG/HTML 可内嵌脚本，挂在我们域名下会变成 XSS；脚本/可执行文件则是免费恶意托管。
const BLOCKED_TYPES = new Set([
  "image/svg+xml",
  "text/html",
  "application/xhtml+xml",
  "application/x-msdownload",
  "application/x-httpd-php",
]);
const BLOCKED_EXT = new Set([
  "svg", "html", "htm", "xhtml", "js", "mjs", "php", "exe", "sh", "bat", "cmd",
]);

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
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: await errMsg("fileTooLarge25m") }, { status: 413 });
  }

  const type = file.type || "application/octet-stream";
  const rawExt = file.name.includes(".") ? file.name.split(".").pop() ?? "" : "";
  const ext = /^[a-z0-9]+$/i.test(rawExt) ? rawExt.toLowerCase() : "bin";

  if (BLOCKED_TYPES.has(type) || BLOCKED_EXT.has(ext)) {
    return NextResponse.json({ error: await errMsg("unsupportedFileType") }, { status: 415 });
  }
  if (kind === "image" && !type.startsWith("image/")) {
    return NextResponse.json({ error: await errMsg("imageOnly") }, { status: 415 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const key = `${randomUUID()}.${ext}`;

  const url = await uploadToR2(key, buffer, type);

  return NextResponse.json({
    url,
    fileName: file.name,
    fileSize: file.size,
    mimeType: type,
  });
}
