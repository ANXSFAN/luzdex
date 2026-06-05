import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const schema = z.object({
  productId: z.string().min(1),
  title: z.string().min(1, "标题不能为空"),
  url: z.string().url(),
  coverImage: z.string().url().optional().nullable(),
});

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "未授权" }, { status: 401 });

  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "参数错误" }, { status: 400 });
  }

  const count = await prisma.video.count({
    where: { productId: parsed.data.productId },
  });

  const video = await prisma.video.create({
    data: {
      productId: parsed.data.productId,
      title: parsed.data.title,
      url: parsed.data.url,
      coverImage: parsed.data.coverImage ?? null,
      sortOrder: count,
    },
  });

  return NextResponse.json(video, { status: 201 });
}
