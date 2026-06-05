import { getActiveFactory } from "@/lib/active-factory";
import { ImportWizard } from "@/components/import-wizard";

export const dynamic = "force-dynamic";

export default async function AdminImportPage() {
  const factory = await getActiveFactory();

  return (
    <div>
      <div>
        <h1 className="headline-lg text-[26px] text-[var(--color-ink)]">批量导入</h1>
        <p className="mt-1 text-sm text-[var(--color-ink-muted)]">
          多 Sheet 工作簿一次导入产品、规格、图片与配件关系 · 先预览再写库
        </p>
      </div>

      {factory ? (
        <ImportWizard factoryName={factory.name} />
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
