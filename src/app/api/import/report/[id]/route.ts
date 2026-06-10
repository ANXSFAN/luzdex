import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getActiveFactory } from "@/lib/active-factory";
import { errMsg } from "@/lib/admin-err";
import { getAdminLocale } from "@/lib/admin-locale";
import { getTranslations } from "next-intl/server";

type RowError = { sheet?: string; row?: number; model?: string; message?: string };

function csvCell(v: unknown): string {
  const s = String(v ?? "");
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** 下载某次导入的错误报告 CSV。仅限当前工厂的任务。 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session)
    return NextResponse.json({ error: await errMsg("unauthorized") }, { status: 401 });
  const factory = await getActiveFactory();
  if (!factory)
    return NextResponse.json({ error: await errMsg("noFactory") }, { status: 400 });

  const { id } = await params;
  const job = await prisma.importJob.findUnique({ where: { id } });
  if (!job || job.factoryId !== factory.id) {
    return NextResponse.json({ error: await errMsg("jobNotFound") }, { status: 404 });
  }

  const report = (job.report ?? {}) as { errors?: RowError[] };
  const errors = Array.isArray(report.errors) ? report.errors : [];

  const tp = await getTranslations({
    locale: await getAdminLocale(),
    namespace: "admin.page",
  });
  const lines = [
    ["Sheet", tp("repRow"), tp("repModel"), tp("repError")].join(","),
    ...errors.map((e) =>
      [csvCell(e.sheet), csvCell(e.row), csvCell(e.model), csvCell(e.message)].join(","),
    ),
  ];
  // 加 BOM，Excel 直接识别 UTF-8
  const body = "﻿" + lines.join("\r\n");

  return new NextResponse(body, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="import-errors-${id}.csv"`,
    },
  });
}
