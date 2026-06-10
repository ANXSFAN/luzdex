import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { getActiveFactory } from "@/lib/active-factory";
import { parseWorkbook, commitPlan } from "@/lib/import";
import { errMsg } from "@/lib/admin-err";

const MAX_BYTES = 5 * 1024 * 1024;

// 确认导入：重新解析上传文件并写库（两 Pass 事务 + 落 ImportJob）。
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session)
    return NextResponse.json({ error: await errMsg("unauthorized") }, { status: 401 });

  const factory = await getActiveFactory();
  if (!factory) {
    return NextResponse.json({ error: await errMsg("noFactory") }, { status: 400 });
  }

  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: await errMsg("fileMissing") }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: await errMsg("fileTooLarge5m") }, { status: 400 });
  }

  let result;
  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const parsed = parseWorkbook(buffer);
    result = await commitPlan(factory.id, file.name, parsed);
  } catch (e) {
    const msg = e instanceof Error ? e.message : await errMsg("unknown");
    return NextResponse.json(
      { error: await errMsg("importFail", { msg }) },
      { status: 500 },
    );
  }

  revalidatePath("/admin/products");
  revalidatePath("/admin");
  return NextResponse.json(result);
}
