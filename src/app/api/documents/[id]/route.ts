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
  const doc = await prisma.document.findUnique({ where: { id } });
  if (!doc)
    return NextResponse.json({ error: await errMsg("docNotFound") }, { status: 404 });

  await deleteFromR2(doc.fileUrl);
  await prisma.document.delete({ where: { id } });

  return NextResponse.json({ success: true });
}
