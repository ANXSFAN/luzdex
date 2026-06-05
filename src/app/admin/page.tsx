import Link from "next/link";
import { ChevronRight, FileText, Film } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { getActiveFactory } from "@/lib/active-factory";
import { SyncButton } from "@/components/sync-button";
import { QrExportButton } from "@/components/qr-export-button";

export const dynamic = "force-dynamic";

export default async function AdminProductsPage() {
  const factory = await getActiveFactory();
  const products = factory
    ? await prisma.product.findMany({
        where: { factoryId: factory.id },
        orderBy: { name: "asc" },
        include: { _count: { select: { documents: true, videos: true } } },
      })
    : [];

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="headline-lg text-[26px] text-[var(--color-ink)]">产品资料</h1>
          <p className="mt-1 text-sm text-[var(--color-ink-muted)]">
            {factory ? (
              <>
                <span className="font-medium text-[var(--color-ink)]">
                  {factory.name}
                </span>
                {" · "}共 {products.length} 个产品
              </>
            ) : (
              "未找到工厂记录，请先运行 db:seed"
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {products.length > 0 && <QrExportButton />}
          <SyncButton />
        </div>
      </div>

      {products.length === 0 ? (
        <div className="mt-12 rounded-2xl border border-dashed border-[var(--color-rule)] py-16 text-center">
          <p className="text-sm text-[var(--color-ink-muted)]">
            当前工厂还没有产品，点击右上角「从主站同步产品」
          </p>
        </div>
      ) : (
        <ul className="mt-6 space-y-1">
          {products.map((p) => (
            <li key={p.id}>
              <Link
                href={`/admin/products/${p.id}`}
                className="doc-row flex items-center justify-between gap-4 px-4 py-3.5"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-[var(--color-ink)]">
                    {p.name}
                  </p>
                  <p className="font-mono text-xs text-[var(--color-ink-muted)]">
                    {p.modelNumber}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-4 text-xs text-[var(--color-ink-muted)]">
                  <span className="flex items-center gap-1">
                    <Film className="h-3.5 w-3.5" />
                    {p._count.videos}
                  </span>
                  <span className="flex items-center gap-1">
                    <FileText className="h-3.5 w-3.5" />
                    {p._count.documents}
                  </span>
                  <ChevronRight className="h-4 w-4" />
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
