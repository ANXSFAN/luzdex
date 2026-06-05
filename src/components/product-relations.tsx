"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2, Plus, Save, Sparkles, Check, Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  saveProductMeta,
  adoptSuggestion,
  addAccessoryByModel,
  removeLink,
} from "@/app/admin/products/actions";

const CATEGORY_OPTIONS: { value: string; label: string }[] = [
  { value: "", label: "— 未分类 —" },
  { value: "strip", label: "灯带 strip" },
  { value: "channel", label: "铝槽 channel" },
  { value: "power", label: "电源 power" },
  { value: "connector", label: "连接件 connector" },
  { value: "accessory", label: "配件 accessory" },
];

const CAT_ZH: Record<string, string> = {
  strip: "灯带",
  channel: "铝槽",
  power: "电源",
  connector: "连接件",
  accessory: "配件",
};

const REL_ZH: Record<string, string> = {
  accessory: "配件",
  alternative: "替代",
};

interface LinkItem {
  linkId: string;
  toId: string;
  relation: string;
  modelNumber: string;
  name: string;
  category: string | null;
}
interface SuggestionItem {
  toId: string;
  modelNumber: string;
  name: string;
  category: string | null;
  relation: string;
  reason: string;
}

interface Props {
  productId: string;
  category: string | null;
  series: string | null;
  attributes: { pcbWidth?: string; voltage?: string; watt?: number };
  links: LinkItem[];
  suggestions: SuggestionItem[];
  candidateModels: string[];
}

function CatChip({ category }: { category: string | null }) {
  if (!category || !CAT_ZH[category]) return null;
  return (
    <span className="rounded-full border border-[var(--color-rule)] px-2 py-0.5 font-mono text-[9px] font-medium uppercase tracking-[0.14em] text-[var(--color-ink-muted)]">
      {CAT_ZH[category]}
    </span>
  );
}

export function ProductRelations({
  productId,
  category,
  series,
  attributes,
  links,
  suggestions,
  candidateModels,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  // 属性表单
  const [cat, setCat] = useState(category ?? "");
  const [ser, setSer] = useState(series ?? "");
  const [pcb, setPcb] = useState(attributes.pcbWidth ?? "");
  const [volt, setVolt] = useState(attributes.voltage ?? "");
  const [watt, setWatt] = useState(attributes.watt != null ? String(attributes.watt) : "");

  // 手动关联表单
  const [addModel, setAddModel] = useState("");
  const [addRel, setAddRel] = useState("accessory");

  function run(fn: () => Promise<void>, okMsg: string, onOk?: () => void) {
    startTransition(async () => {
      try {
        await fn();
        toast.success(okMsg);
        onOk?.();
        router.refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "操作失败");
      }
    });
  }

  return (
    <div className="mt-10 space-y-10">
      {/* 属性 & 分类 */}
      <section>
        <h2 className="mb-3 font-mono text-[11px] font-medium uppercase tracking-[0.22em] text-[var(--color-ink-muted)]">
          分类与属性 Attributes
        </h2>
        <div className="space-y-4 rounded-xl border border-[var(--color-rule)] p-5">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="类目 Category">
              <select
                value={cat}
                onChange={(e) => setCat(e.target.value)}
                className="form-input"
              >
                {CATEGORY_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="系列 Series · 同系列聚合键">
              <input
                value={ser}
                onChange={(e) => setSer(e.target.value)}
                placeholder="如 星光系列"
                className="form-input"
              />
            </Field>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Field label="PCB 宽度 · 匹配铝槽">
              <input
                value={pcb}
                onChange={(e) => setPcb(e.target.value)}
                placeholder="如 10mm"
                className="form-input font-mono"
              />
            </Field>
            <Field label="电压 · 匹配电源">
              <input
                value={volt}
                onChange={(e) => setVolt(e.target.value)}
                placeholder="如 24V"
                className="form-input font-mono"
              />
            </Field>
            <Field label="功率 W · 提示用">
              <input
                value={watt}
                onChange={(e) => setWatt(e.target.value)}
                placeholder="如 14.4"
                inputMode="decimal"
                className="form-input font-mono"
              />
            </Field>
          </div>
          <button
            onClick={() =>
              run(
                () =>
                  saveProductMeta({
                    productId,
                    category: cat,
                    series: ser,
                    pcbWidth: pcb,
                    voltage: volt,
                    watt,
                  }),
                "已保存",
              )
            }
            disabled={pending}
            className="flex items-center gap-1.5 rounded-full bg-[var(--color-ink)] px-4 py-2 text-xs text-white transition hover:bg-[#424245] disabled:opacity-50"
          >
            {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
            保存分类与属性
          </button>
        </div>
      </section>

      {/* 自动匹配建议 */}
      <section>
        <h2 className="mb-3 flex items-center gap-1.5 font-mono text-[11px] font-medium uppercase tracking-[0.22em] text-[var(--color-ink-muted)]">
          <Sparkles className="h-3.5 w-3.5" />
          自动匹配建议 Suggestions
        </h2>
        {suggestions.length === 0 ? (
          <p className="rounded-xl border border-dashed border-[var(--color-rule)] p-5 text-xs leading-relaxed text-[var(--color-ink-muted)]">
            暂无建议。需当前产品为「灯带」且填好 PCB 宽度 / 电压，且同工厂存在属性匹配的铝槽 / 电源。建议不会自动写库，确认后才生效。
          </p>
        ) : (
          <ul className="divide-y divide-[var(--color-rule)] overflow-hidden rounded-xl border border-[var(--color-rule)]">
            {suggestions.map((s) => (
              <li key={s.toId} className="flex items-center justify-between gap-3 px-4 py-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <CatChip category={s.category} />
                    <span className="font-mono text-xs text-[var(--color-ink)]">{s.modelNumber}</span>
                    <span className="truncate text-sm text-[var(--color-ink-soft)]">{s.name}</span>
                  </div>
                  <p className="mt-0.5 text-[11px] text-[var(--color-ink-muted)]">{s.reason}</p>
                </div>
                <button
                  onClick={() =>
                    run(() => adoptSuggestion(productId, s.toId, s.relation), "已采纳，写入配件关系")
                  }
                  disabled={pending}
                  className="flex shrink-0 items-center gap-1 rounded-full border border-[var(--color-rule)] px-3 py-1.5 text-xs text-[var(--color-ink)] transition hover:bg-[var(--color-surface-sunken)] disabled:opacity-50"
                >
                  <Check className="h-3.5 w-3.5" />
                  采纳
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* 现有配件关系 */}
      <section>
        <h2 className="mb-3 font-mono text-[11px] font-medium uppercase tracking-[0.22em] text-[var(--color-ink-muted)]">
          配件关系 Links · 权威
        </h2>

        {links.length > 0 && (
          <ul className="mb-4 divide-y divide-[var(--color-rule)] overflow-hidden rounded-xl border border-[var(--color-rule)]">
            {links.map((l) => (
              <li key={l.linkId} className="flex items-center justify-between gap-3 px-4 py-3">
                <div className="flex min-w-0 items-center gap-2">
                  <CatChip category={l.category} />
                  <span className="font-mono text-xs text-[var(--color-ink)]">{l.modelNumber}</span>
                  <span className="truncate text-sm text-[var(--color-ink-soft)]">{l.name}</span>
                  <span className="shrink-0 font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--color-ink-muted)]">
                    {REL_ZH[l.relation] ?? l.relation}
                  </span>
                </div>
                <button
                  onClick={() => run(() => removeLink(l.linkId, productId), "已删除")}
                  disabled={pending}
                  className="shrink-0 text-[var(--color-ink-muted)] transition hover:text-red-600 disabled:opacity-50"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
        )}

        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-dashed border-[var(--color-rule)] p-4">
          <input
            value={addModel}
            onChange={(e) => setAddModel(e.target.value)}
            placeholder="适配型号"
            list="candidate-models"
            className="form-input min-w-0 flex-1 font-mono"
          />
          <datalist id="candidate-models">
            {candidateModels.map((m) => (
              <option key={m} value={m} />
            ))}
          </datalist>
          <select
            value={addRel}
            onChange={(e) => setAddRel(e.target.value)}
            className="form-input w-auto"
          >
            <option value="accessory">配件</option>
            <option value="alternative">替代</option>
          </select>
          <button
            onClick={() => {
              if (!addModel.trim()) {
                toast.error("请输入型号");
                return;
              }
              run(() => addAccessoryByModel(productId, addModel, addRel), "已关联", () =>
                setAddModel(""),
              );
            }}
            disabled={pending}
            className="flex shrink-0 items-center gap-1.5 rounded-full bg-[var(--color-ink)] px-4 py-2 text-xs text-white transition hover:bg-[#424245] disabled:opacity-50"
          >
            <Plus className="h-3.5 w-3.5" />
            关联
          </button>
        </div>
      </section>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-[12px] font-medium text-[var(--color-ink)]">{label}</label>
      <div className="mt-1.5">{children}</div>
    </div>
  );
}
