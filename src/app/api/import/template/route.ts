import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { buildTemplateWorkbook } from "@/lib/import";

// 下载四 Sheet 导入模板（产品 / 规格 / 图片 / 配件），带示例行。
export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "未授权" }, { status: 401 });

  const buf = buildTemplateWorkbook();
  return new NextResponse(new Uint8Array(buf), {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="datasheet-import-template.xlsx"',
      "Cache-Control": "no-store",
    },
  });
}
