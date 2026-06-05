import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getActiveFactory } from "@/lib/active-factory";
import { parseWorkbook, buildPlan } from "@/lib/import";

const MAX_BYTES = 5 * 1024 * 1024; // 5MB

// 解析 + 校验 + 生成 diff 预览，绝不写库。
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "未授权" }, { status: 401 });

  const factory = await getActiveFactory();
  if (!factory) {
    return NextResponse.json({ error: "未选择工厂" }, { status: 400 });
  }

  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "缺少文件" }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "文件超过 5MB" }, { status: 400 });
  }

  let plan;
  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const parsed = parseWorkbook(buffer);
    plan = await buildPlan(factory.id, parsed);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "解析失败";
    return NextResponse.json({ error: `文件解析失败：${msg}` }, { status: 422 });
  }

  return NextResponse.json({
    factory: { id: factory.id, name: factory.name },
    summary: plan.summary,
    products: plan.products,
    errors: plan.errors,
  });
}
