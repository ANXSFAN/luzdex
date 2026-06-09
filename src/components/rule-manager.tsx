"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Plus,
  Trash2,
  Loader2,
  Pencil,
  Power,
  Wand2,
  ArrowRight,
} from "lucide-react";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import {
  CONDITION_KINDS,
  type CompatCondition,
  type CompatConditionKind,
} from "@/lib/compat";
import {
  createRule,
  updateRule,
  deleteRule,
  toggleRule,
  applyAutoLinkRules,
} from "@/app/admin/rules/actions";

type Cat = { id: string; name: string; parentId: string | null };
type Rule = {
  id: string;
  label: string;
  description: string | null;
  fromCategoryId: string;
  toCategoryId: string;
  relation: string;
  bidirectional: boolean;
  conditions: CompatCondition[];
  autoLink: boolean;
  enabled: boolean;
  priority: number;
};

const REL_KEY: Record<string, string> = {
  accessory: "relAccessory",
  alternative: "relAlternative",
  required: "relRequired",
};
const COND_KEY: Record<string, string> = {
  attr_eq: "eq",
  attr_approx: "approx",
  attr_gte: "gte",
  attr_lte: "lte",
};
const RELATIONS = [
  { v: "accessory", l: "配件" },
  { v: "alternative", l: "替代" },
  { v: "required", l: "必配" },
];
const ATTR_HINTS = ["pcbWidth", "voltage", "watt"];

const inputCls =
  "rounded-lg border border-[var(--color-rule)] bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-ink)] outline-none transition focus:border-[var(--color-ink)]";
const labelCls =
  "font-mono text-[13px] font-medium uppercase tracking-[0.18em] text-[var(--color-ink-muted)]";

/** 把分类按树序展开成带缩进的下拉选项。 */
function useCatOptions(categories: Cat[]) {
  return useMemo(() => {
    const childrenOf = new Map<string | null, Cat[]>();
    for (const c of categories) {
      if (!childrenOf.has(c.parentId)) childrenOf.set(c.parentId, []);
      childrenOf.get(c.parentId)!.push(c);
    }
    const out: { id: string; label: string }[] = [];
    const walk = (pid: string | null, depth: number) => {
      for (const c of childrenOf.get(pid) ?? []) {
        out.push({ id: c.id, label: `${" ".repeat(depth)}${c.name}` });
        walk(c.id, depth + 1);
      }
    };
    walk(null, 0);
    return out;
  }, [categories]);
}

const EMPTY: Omit<Rule, "id"> = {
  label: "",
  description: "",
  fromCategoryId: "",
  toCategoryId: "",
  relation: "accessory",
  bidirectional: false,
  conditions: [],
  autoLink: false,
  enabled: true,
  priority: 0,
};

export function RuleManager({
  categories,
  rules,
  catNames,
}: {
  categories: Cat[];
  rules: Rule[];
  catNames: Record<string, string>;
}) {
  const router = useRouter();
  const t = useTranslations("admin");
  const [editing, setEditing] = useState<Rule | "new" | null>(null);
  const [pending, start] = useTransition();
  const opts = useCatOptions(categories);

  function apply() {
    start(async () => {
      try {
        const r = await applyAutoLinkRules();
        toast.success(t("rule.applied", { scanned: r.scanned, created: r.created }));
        router.refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "执行失败");
      }
    });
  }

  function onToggle(rule: Rule) {
    start(async () => {
      try {
        await toggleRule(rule.id, !rule.enabled);
        router.refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "操作失败");
      }
    });
  }
  function onDelete(rule: Rule) {
    if (!window.confirm(`删除规则「${rule.label}」？`)) return;
    start(async () => {
      try {
        await deleteRule(rule.id);
        if (editing !== "new" && editing?.id === rule.id) setEditing(null);
        router.refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "删除失败");
      }
    });
  }

  const condSummary = (c: CompatCondition) => {
    const k = c.fromKey === c.toKey ? c.fromKey : `${c.fromKey}→${c.toKey}`;
    const op =
      c.kind === "attr_eq"
        ? "="
        : c.kind === "attr_approx"
          ? `±${c.tolerance ?? 0}`
          : c.kind === "attr_gte"
            ? "≥"
            : "≤";
    return `${k} ${op}`;
  };

  return (
    <div className="mt-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-[var(--color-ink-muted)]">
          {t("rule.count", { n: rules.length })}
        </p>
        <div className="flex items-center gap-2">
          <button
            onClick={apply}
            disabled={pending}
            className="flex items-center gap-1.5 rounded-lg border border-[var(--color-ink)] px-3.5 py-2 text-sm text-[var(--color-ink)] transition hover:bg-[var(--color-ink)] hover:text-[var(--color-surface)] disabled:opacity-50"
          >
            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
            {t("rule.autoLinkBtn")}
          </button>
          <button
            onClick={() => setEditing("new")}
            className="flex items-center gap-1.5 rounded-lg bg-[var(--color-ink)] px-3.5 py-2 text-sm text-[var(--color-surface)] transition hover:opacity-90"
          >
            <Plus className="h-4 w-4" /> {t("rule.newRule")}
          </button>
        </div>
      </div>

      {editing && (
        <RuleEditor
          key={editing === "new" ? "new" : editing.id}
          initial={editing === "new" ? { id: "", ...EMPTY } : editing}
          opts={opts}
          onClose={() => setEditing(null)}
        />
      )}

      {rules.length === 0 ? (
        <div className="mt-6 rounded-2xl border border-dashed border-[var(--color-rule)] py-14 text-center text-sm text-[var(--color-ink-muted)]">
          {t("rule.empty")}
        </div>
      ) : (
        <ul className="mt-5 space-y-2">
          {rules.map((r) => (
            <li
              key={r.id}
              className={`rounded-xl border px-4 py-3 transition ${
                r.enabled
                  ? "border-[var(--color-rule)] bg-[var(--color-surface)]"
                  : "border-[var(--color-rule)] bg-[var(--color-surface-sunken)] opacity-60"
              }`}
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
                  <span className="text-sm font-medium text-[var(--color-ink)]">
                    {r.label}
                  </span>
                  <span className="flex items-center gap-1 text-sm text-[var(--color-ink-muted)]">
                    {catNames[r.fromCategoryId] ?? "?"}
                    <ArrowRight className="h-3.5 w-3.5" />
                    {catNames[r.toCategoryId] ?? "?"}
                    {r.bidirectional && <span className="text-[var(--color-ink-faint)]">⇄</span>}
                  </span>
                  {r.conditions.length > 0 && (
                    <span className="font-mono text-[13px] text-[var(--color-ink-faint)]">
                      {r.conditions.map(condSummary).join(" · ")}
                    </span>
                  )}
                  {r.autoLink && (
                    <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[12px] text-amber-700">
                      {t("rule.autoLinkTag")}
                    </span>
                  )}
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <button
                    onClick={() => onToggle(r)}
                    title={t("rule.enabled")}
                    className={`p-1.5 transition ${r.enabled ? "text-[var(--color-ink)]" : "text-[var(--color-ink-faint)] hover:text-[var(--color-ink)]"}`}
                  >
                    <Power className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => setEditing(r)}
                    title={t("common.edit")}
                    className="p-1.5 text-[var(--color-ink-muted)] transition hover:text-[var(--color-ink)]"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => onDelete(r)}
                    title={t("common.delete")}
                    className="p-1.5 text-[var(--color-ink-muted)] transition hover:text-red-600"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function RuleEditor({
  initial,
  opts,
  onClose,
}: {
  initial: Rule;
  opts: { id: string; label: string }[];
  onClose: () => void;
}) {
  const router = useRouter();
  const t = useTranslations("admin");
  const isNew = !initial.id;
  const [f, setF] = useState<Rule>(initial);
  const [pending, start] = useTransition();
  const set = <K extends keyof Rule>(k: K, v: Rule[K]) => setF((p) => ({ ...p, [k]: v }));

  function addCond() {
    set("conditions", [
      ...f.conditions,
      { kind: "attr_eq", fromKey: "", toKey: "" },
    ]);
  }
  function updCond(i: number, patch: Partial<CompatCondition>) {
    set(
      "conditions",
      f.conditions.map((c, j) => (j === i ? { ...c, ...patch } : c)),
    );
  }
  function delCond(i: number) {
    set("conditions", f.conditions.filter((_, j) => j !== i));
  }

  function save() {
    if (!f.label.trim()) return toast.error("规则名不能为空");
    if (!f.fromCategoryId || !f.toCategoryId)
      return toast.error("请选择主品分类与配件分类");
    const payload = {
      label: f.label,
      description: f.description ?? "",
      fromCategoryId: f.fromCategoryId,
      toCategoryId: f.toCategoryId,
      relation: f.relation,
      bidirectional: f.bidirectional,
      conditions: f.conditions
        .map((c) => ({
          kind: c.kind,
          fromKey: c.fromKey.trim(),
          toKey: c.toKey.trim(),
          ...(c.kind === "attr_approx" ? { tolerance: c.tolerance ?? 0 } : {}),
        }))
        .filter((c) => c.fromKey && c.toKey),
      autoLink: f.autoLink,
      enabled: f.enabled,
      priority: f.priority,
    };
    start(async () => {
      try {
        if (isNew) await createRule(payload);
        else await updateRule(initial.id, payload);
        toast.success(t("rule.savedOk"));
        onClose();
        router.refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "保存失败");
      }
    });
  }

  return (
    <section className="mt-5 rounded-2xl border border-[var(--color-ink)] bg-[var(--color-surface)] p-5">
      <div className="flex items-baseline justify-between border-b border-[var(--color-rule)] pb-2">
        <p className="font-mono text-[13px] font-medium uppercase tracking-[0.22em] text-[var(--color-ink)]">
          {isNew ? t("rule.newTitle") : t("rule.editTitle")}
        </p>
        <button onClick={onClose} className="text-sm text-[var(--color-ink-muted)] hover:text-[var(--color-ink)]">
          {t("common.cancel")}
        </button>
      </div>

      <datalist id="attr-hints">
        {ATTR_HINTS.map((h) => (
          <option key={h} value={h} />
        ))}
      </datalist>

      <div className="mt-4 space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className={labelCls}>{t("rule.name")}</label>
            <input
              value={f.label}
              onChange={(e) => set("label", e.target.value)}
              placeholder={t("rule.namePh")}
              className={`${inputCls} mt-1.5 w-full`}
            />
          </div>
          <div>
            <label className={labelCls}>{t("rule.relation")}</label>
            <select
              value={f.relation}
              onChange={(e) => set("relation", e.target.value)}
              className={`${inputCls} mt-1.5 w-full`}
            >
              {RELATIONS.map((r) => (
                <option key={r.v} value={r.v}>
                  {t(`rule.${REL_KEY[r.v]}`)}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid items-end gap-3 sm:grid-cols-[1fr_auto_1fr]">
          <div>
            <label className={labelCls}>{t("rule.from")}</label>
            <select
              value={f.fromCategoryId}
              onChange={(e) => set("fromCategoryId", e.target.value)}
              className={`${inputCls} mt-1.5 w-full`}
            >
              <option value="">{t("rule.pick")}</option>
              {opts.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
          <ArrowRight className="mb-2.5 h-5 w-5 text-[var(--color-ink-muted)]" />
          <div>
            <label className={labelCls}>{t("rule.to")}</label>
            <select
              value={f.toCategoryId}
              onChange={(e) => set("toCategoryId", e.target.value)}
              className={`${inputCls} mt-1.5 w-full`}
            >
              <option value="">{t("rule.pick")}</option>
              {opts.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* 条件构建器 */}
        <div>
          <div className="flex items-center justify-between">
            <label className={labelCls}>{t("rule.conditions")}</label>
            <button
              onClick={addCond}
              className="flex items-center gap-1 text-sm text-[var(--color-ink-muted)] transition hover:text-[var(--color-ink)]"
            >
              <Plus className="h-3.5 w-3.5" /> {t("rule.addCond")}
            </button>
          </div>
          <div className="mt-2 space-y-2">
            {f.conditions.map((c, i) => (
              <div key={i} className="flex flex-wrap items-center gap-2 rounded-lg bg-[var(--color-surface-sunken)] p-2">
                <input
                  list="attr-hints"
                  value={c.fromKey}
                  onChange={(e) => updCond(i, { fromKey: e.target.value })}
                  placeholder={t("rule.mainAttr")}
                  className={`${inputCls} w-32`}
                />
                <select
                  value={c.kind}
                  onChange={(e) => updCond(i, { kind: e.target.value as CompatConditionKind })}
                  className={`${inputCls} w-32`}
                >
                  {CONDITION_KINDS.map((k) => (
                    <option key={k.kind} value={k.kind}>
                      {t(`rule.${COND_KEY[k.kind]}`)}
                    </option>
                  ))}
                </select>
                <input
                  list="attr-hints"
                  value={c.toKey}
                  onChange={(e) => updCond(i, { toKey: e.target.value })}
                  placeholder={t("rule.accAttr")}
                  className={`${inputCls} w-32`}
                />
                {c.kind === "attr_approx" && (
                  <input
                    type="number"
                    value={c.tolerance ?? 0}
                    onChange={(e) => updCond(i, { tolerance: Number(e.target.value) })}
                    placeholder={t("rule.tolerance")}
                    className={`${inputCls} w-20`}
                  />
                )}
                <button
                  onClick={() => delCond(i)}
                  className="p-1.5 text-[var(--color-ink-faint)] transition hover:text-red-500"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
            {f.conditions.length === 0 && (
              <p className="text-sm text-[var(--color-ink-faint)]">
                {t("rule.noCond")}
              </p>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
          <label className="flex items-center gap-2 text-sm text-[var(--color-ink)]">
            <input
              type="checkbox"
              checked={f.bidirectional}
              onChange={(e) => set("bidirectional", e.target.checked)}
              className="h-4 w-4 accent-[var(--color-ink)]"
            />
            {t("rule.bidir")}
          </label>
          <label className="flex items-center gap-2 text-sm text-[var(--color-ink)]">
            <input
              type="checkbox"
              checked={f.autoLink}
              onChange={(e) => set("autoLink", e.target.checked)}
              className="h-4 w-4 accent-[var(--color-ink)]"
            />
            {t("rule.autoLinkOpt")}
          </label>
          <label className="flex items-center gap-2 text-sm text-[var(--color-ink)]">
            <input
              type="checkbox"
              checked={f.enabled}
              onChange={(e) => set("enabled", e.target.checked)}
              className="h-4 w-4 accent-[var(--color-ink)]"
            />
            {t("rule.enabled")}
          </label>
          <label className="flex items-center gap-2 text-sm text-[var(--color-ink-muted)]">
            {t("rule.priority")}
            <input
              type="number"
              value={f.priority}
              onChange={(e) => set("priority", Number(e.target.value))}
              className={`${inputCls} w-20`}
            />
          </label>
        </div>

        <div className="flex justify-end border-t border-[var(--color-rule)] pt-3">
          <button
            onClick={save}
            disabled={pending}
            className="rounded-lg bg-[var(--color-ink)] px-5 py-2 text-sm font-medium text-[var(--color-surface)] transition hover:opacity-90 disabled:opacity-50"
          >
            {pending ? t("common.saving") : t("common.save")}
          </button>
        </div>
      </div>
    </section>
  );
}
