import { Download, FileSpreadsheet } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { getActiveFactory } from "@/lib/active-factory";
import { ImportWizard } from "@/components/import-wizard";
import { AutofillShowcasePanel } from "@/components/autofill-showcase-panel";
import { countMissingShowcase } from "@/app/admin/products/actions";

export const dynamic = "force-dynamic";

function fmtTime(d: Date) {
  return d.toISOString().slice(0, 16).replace("T", " ");
}

export default async function AdminImportPage() {
  const factory = await getActiveFactory();
  const [missingShowcase, jobs] = factory
    ? await Promise.all([
        countMissingShowcase(),
        prisma.importJob.findMany({
          where: { factoryId: factory.id },
          orderBy: { createdAt: "desc" },
          take: 15,
        }),
      ])
    : [0, []];

  return (
    <div>
      <div>
        <h1 className="headline-lg text-[26px] text-[var(--color-ink)]">批量导入</h1>
        <p className="mt-1 text-sm text-[var(--color-ink-muted)]">
          多 Sheet 工作簿一次导入产品、规格、图片与配件关系 · 先预览再写库
        </p>
      </div>

      {factory ? (
        <>
          <ImportWizard factoryName={factory.name} />
          <AutofillShowcasePanel missingCount={missingShowcase} />

          {/* 导入历史 */}
          <section className="mt-10">
            <h2 className="font-mono text-[11px] font-medium uppercase tracking-[0.22em] text-[var(--color-ink-muted)]">
              导入历史
            </h2>
            {jobs.length === 0 ? (
              <p className="mt-3 text-sm text-[var(--color-ink-faint)]">
                还没有导入记录。
              </p>
            ) : (
              <ul className="mt-3 divide-y divide-[var(--color-rule)] overflow-hidden rounded-xl border border-[var(--color-rule)]">
                {jobs.map((j) => (
                  <li
                    key={j.id}
                    className="flex items-center justify-between gap-4 px-4 py-3"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <FileSpreadsheet className="h-4 w-4 shrink-0 text-[var(--color-ink-muted)]" />
                      <div className="min-w-0">
                        <p className="truncate text-sm text-[var(--color-ink)]">
                          {j.fileName}
                        </p>
                        <p className="font-mono text-[11px] text-[var(--color-ink-muted)]">
                          {fmtTime(j.createdAt)} · 新增 {j.createdRows} · 更新{" "}
                          {j.updatedRows}
                          {j.errorRows > 0 && (
                            <span className="text-amber-700"> · 错误 {j.errorRows}</span>
                          )}
                        </p>
                      </div>
                    </div>
                    {j.errorRows > 0 && (
                      <a
                        href={`/api/import/report/${j.id}`}
                        className="flex shrink-0 items-center gap-1 rounded-full border border-[var(--color-rule)] px-3 py-1.5 text-xs text-[var(--color-ink-muted)] transition hover:text-[var(--color-ink)]"
                      >
                        <Download className="h-3.5 w-3.5" />
                        错误报告
                      </a>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      ) : (
        <div className="mt-12 rounded-2xl border border-dashed border-[var(--color-rule)] py-16 text-center">
          <p className="text-sm text-[var(--color-ink-muted)]">
            未选择工厂，请先在顶栏切换「当前工厂」
          </p>
        </div>
      )}
    </div>
  );
}
