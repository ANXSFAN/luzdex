import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { deleteFromR2 } from "@/lib/r2";
import { errMsg } from "@/lib/admin-err";

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

  const doc = await prisma.document.findUnique({ where: { id } });
  if (!doc)
    return NextResponse.json({ error: await errMsg("docNotFound") }, { status: 404 });

  const updated = await prisma.document.update({
    where: { id },
    data: { title: parsed.data.title },
  });

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
  const doc = await prisma.document.findUnique({ where: { id } });
  if (!doc)
    return NextResponse.json({ error: await errMsg("docNotFound") }, { status: 404 });

  await deleteFromR2(doc.fileUrl);
  await prisma.document.delete({ where: { id } });

  return NextResponse.json({ success: true });
}
