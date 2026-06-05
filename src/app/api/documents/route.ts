import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const schema = z.object({
  productId: z.string().min(1),
  title: z.string().min(1, "标题不能为空"),
  fileUrl: z.string().url(),
  fileName: z.string().min(1),
  fileSize: z.number().int().nonnegative(),
  mimeType: z.string().min(1),
});

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "未授权" }, { status: 401 });

  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "参数错误" }, { status: 400 });
  }

  const count = await prisma.document.count({
    where: { productId: parsed.data.productId },
  });

  const doc = await prisma.document.create({
    data: { ...parsed.data, sortOrder: count },
  });

  return NextResponse.json(doc, { status: 201 });
}
