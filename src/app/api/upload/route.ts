import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { auth } from "@/lib/auth";
import { uploadToR2 } from "@/lib/r2";

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "未授权" }, { status: 401 });

  const formData = await request.formData();
  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "缺少文件" }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const ext = file.name.includes(".") ? file.name.split(".").pop() : "bin";
  const key = `${randomUUID()}.${ext}`;

  const url = await uploadToR2(key, buffer, file.type || "application/octet-stream");

  return NextResponse.json({
    url,
    fileName: file.name,
    fileSize: file.size,
    mimeType: file.type || "application/octet-stream",
  });
}
