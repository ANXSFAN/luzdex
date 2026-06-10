import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { deleteFromR2 } from "@/lib/r2";
import { errMsg } from "@/lib/admin-err";

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

  // Video may point at R2 (uploaded) or an external URL — deleteFromR2 no-ops
  // for anything outside our bucket.
  await deleteFromR2(video.url);
  await prisma.video.delete({ where: { id } });

  return NextResponse.json({ success: true });
}
