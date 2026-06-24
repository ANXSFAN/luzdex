import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { deleteFromR2 } from "@/lib/r2";
import { errMsg } from "@/lib/admin-err";
import { renameTitleI18n, removeTitleI18n } from "@/lib/title-i18n";

const patchSchema = z.object({ title: z.string().trim().min(1) });

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session)
    return NextResponse.json({ error: await errMsg("unauthorized") }, { status: 401 });

  const { id } = await params;
  const parsed = patchSchema.safeParse(await request.json());
  if (!parsed.success)
    return NextResponse.json({ error: await errMsg("paramError") }, { status: 400 });

  const video = await prisma.video.findUnique({ where: { id } });
  if (!video)
    return NextResponse.json({ error: await errMsg("videoNotFound") }, { status: 404 });

  const updated = await prisma.video.update({
    where: { id },
    data: { title: parsed.data.title },
  });

  // 同步译名:把该视频在各语言里的旧译名换成新源标题(前台先回退源语言，等重跑 AI 翻译补全)。
  const product = await prisma.product.findUnique({
    where: { id: video.productId },
    select: {
      contentI18n: true,
      videos: { select: { id: true }, orderBy: { sortOrder: "asc" } },
    },
  });
  if (product) {
    const index = product.videos.findIndex((v) => v.id === id);
    const contentI18n = renameTitleI18n(
      product.contentI18n,
      "videoTitles",
      index,
      product.videos.length,
      parsed.data.title,
    );
    await prisma.product.update({
      where: { id: video.productId },
      data: { contentI18n },
    });
  }

  return NextResponse.json(updated);
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session)
    return NextResponse.json({ error: await errMsg("unauthorized") }, { status: 401 });

  const { id } = await params;
  const video = await prisma.video.findUnique({ where: { id } });
  if (!video)
    return NextResponse.json({ error: await errMsg("videoNotFound") }, { status: 404 });

  // 删除前先记下该视频在顺序中的位置,用于同步移除各语言译名,避免后续视频译名错位。
  const product = await prisma.product.findUnique({
    where: { id: video.productId },
    select: {
      contentI18n: true,
      videos: { select: { id: true }, orderBy: { sortOrder: "asc" } },
    },
  });

  // Video may point at R2 (uploaded) or an external URL — deleteFromR2 no-ops
  // for anything outside our bucket.
  await deleteFromR2(video.url);
  await prisma.video.delete({ where: { id } });

  if (product) {
    const index = product.videos.findIndex((v) => v.id === id);
    const contentI18n = removeTitleI18n(
      product.contentI18n,
      "videoTitles",
      index,
      product.videos.length,
    );
    await prisma.product.update({
      where: { id: video.productId },
      data: { contentI18n },
    });
  }

  return NextResponse.json({ success: true });
}
