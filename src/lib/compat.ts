// 兼容规则引擎（纯函数，无 IO）。被产品页(建议)与"按规则建链"动作共用。
// 规则 = 从[分类]→配[分类]，满足全部条件(AND)即兼容。支持父分类覆盖子类、双向、多算子。

export type CompatConditionKind =
  | "attr_eq" // from[fromKey] == to[toKey]（数值或文本）
  | "attr_approx" // |from - to| <= tolerance（数值）
  | "attr_gte" // to[toKey] >= from[fromKey]（数值）
  | "attr_lte"; // to[toKey] <= from[fromKey]（数值）

export const CONDITION_KINDS: { kind: CompatConditionKind; label: string }[] = [
  { kind: "attr_eq", label: "相等 =" },
  { kind: "attr_approx", label: "约等 ±" },
  { kind: "attr_gte", label: "配件 ≥ 主品" },
  { kind: "attr_lte", label: "配件 ≤ 主品" },
];

export interface CompatCondition {
  kind: CompatConditionKind;
  fromKey: string;
  toKey: string;
  tolerance?: number;
}

export interface CompatRuleData {
  id: string;
  label: string;
  fromCategoryId: string;
  toCategoryId: string;
  relation: string; // accessory|alternative|required
  bidirectional: boolean;
  conditions: CompatCondition[];
  enabled: boolean;
  priority: number;
}

export interface CompatCategoryNode {
  id: string;
  parentId: string | null;
}

export interface CompatProduct {
  id: string;
  modelNumber: string;
  name: string;
  categoryId: string | null;
  attributes: Record<string, unknown>;
}

export interface CompatSuggestion {
  toId: string;
  modelNumber: string;
  name: string;
  relation: string;
  ruleId: string;
  ruleLabel: string;
  reasons: string[];
}

/** 取第一个数字（"10mm"→10, "AC 24V"→24, 14.4→14.4）。 */
export function numOf(v: unknown): number | null {
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  if (typeof v === "string") {
    const m = v.match(/-?[\d.]+/);
    if (m) {
      const n = parseFloat(m[0]);
      return Number.isFinite(n) ? n : null;
    }
  }
  return null;
}

function strOf(v: unknown): string | null {
  if (v == null) return null;
  return String(v).trim().toLowerCase() || null;
}

/** 校验/清洗 conditions JSON。 */
export function parseConditions(json: unknown): CompatCondition[] {
  if (!Array.isArray(json)) return [];
  const kinds: CompatConditionKind[] = [
    "attr_eq",
    "attr_approx",
    "attr_gte",
    "attr_lte",
  ];
  const out: CompatCondition[] = [];
  for (const raw of json) {
    if (!raw || typeof raw !== "object") continue;
    const r = raw as Record<string, unknown>;
    if (!kinds.includes(r.kind as CompatConditionKind)) continue;
    if (typeof r.fromKey !== "string" || !r.fromKey.trim()) continue;
    if (typeof r.toKey !== "string" || !r.toKey.trim()) continue;
    const c: CompatCondition = {
      kind: r.kind as CompatConditionKind,
      fromKey: r.fromKey.trim(),
      toKey: r.toKey.trim(),
    };
    if (c.kind === "attr_approx") {
      const t = numOf(r.tolerance);
      c.tolerance = t ?? 0;
    }
    out.push(c);
  }
  return out;
}

/** 单条件求值：from 是主品属性，to 是配件属性。 */
export function evalCondition(
  cond: CompatCondition,
  from: Record<string, unknown>,
  to: Record<string, unknown>,
): boolean {
  const fv = from[cond.fromKey];
  const tv = to[cond.toKey];
  if (cond.kind === "attr_eq") {
    const fn = numOf(fv);
    const tn = numOf(tv);
    if (fn != null && tn != null) return fn === tn;
    const fs = strOf(fv);
    const ts = strOf(tv);
    return fs != null && ts != null && fs === ts;
  }
  const fn = numOf(fv);
  const tn = numOf(tv);
  if (fn == null || tn == null) return false;
  if (cond.kind === "attr_approx") return Math.abs(fn - tn) <= (cond.tolerance ?? 0);
  if (cond.kind === "attr_gte") return tn >= fn;
  if (cond.kind === "attr_lte") return tn <= fn;
  return false;
}

function reasonOf(cond: CompatCondition): string {
  const k = cond.fromKey === cond.toKey ? cond.fromKey : `${cond.fromKey}/${cond.toKey}`;
  switch (cond.kind) {
    case "attr_eq":
      return `${k} 相等`;
    case "attr_approx":
      return `${k} 约等(±${cond.tolerance ?? 0})`;
    case "attr_gte":
      return `配件 ${cond.toKey} ≥ 主品 ${cond.fromKey}`;
    case "attr_lte":
      return `配件 ${cond.toKey} ≤ 主品 ${cond.fromKey}`;
  }
}

/** 由扁平分类列表构建：每个分类的「自身+祖先」与「自身+后代」集合。 */
export function buildCategoryMaps(categories: CompatCategoryNode[]): {
  selfAndAncestors: Map<string, Set<string>>;
  selfAndDescendants: Map<string, Set<string>>;
} {
  const parentOf = new Map<string, string | null>();
  const childrenOf = new Map<string, string[]>();
  for (const c of categories) {
    parentOf.set(c.id, c.parentId);
    if (c.parentId) {
      if (!childrenOf.has(c.parentId)) childrenOf.set(c.parentId, []);
      childrenOf.get(c.parentId)!.push(c.id);
    }
  }
  const selfAndAncestors = new Map<string, Set<string>>();
  for (const c of categories) {
    const set = new Set<string>();
    let cur: string | null = c.id;
    const guard = new Set<string>();
    while (cur && !guard.has(cur)) {
      guard.add(cur);
      set.add(cur);
      cur = parentOf.get(cur) ?? null;
    }
    selfAndAncestors.set(c.id, set);
  }
  const selfAndDescendants = new Map<string, Set<string>>();
  const buildDesc = (id: string): Set<string> => {
    if (selfAndDescendants.has(id)) return selfAndDescendants.get(id)!;
    const set = new Set<string>([id]);
    for (const ch of childrenOf.get(id) ?? [])
      for (const d of buildDesc(ch)) set.add(d);
    selfAndDescendants.set(id, set);
    return set;
  };
  for (const c of categories) buildDesc(c.id);
  return { selfAndAncestors, selfAndDescendants };
}

/**
 * 对一个主品，按规则在候选里找兼容配件。
 * - 规则适用：rule.fromCategoryId 在主品分类的「自身+祖先」里（父规则覆盖子类）
 * - 候选范围：candidate.categoryId 在 rule.toCategoryId 的「自身+后代」里
 * - 全部条件通过即兼容；双向规则额外反向匹配
 * 同一候选被多规则命中时合并，按 priority 排序。
 */
export function suggestByRules(params: {
  product: CompatProduct;
  candidates: CompatProduct[];
  rules: CompatRuleData[];
  categories: CompatCategoryNode[];
  excludeIds?: Set<string>;
}): CompatSuggestion[] {
  const { product, candidates, rules, categories } = params;
  const exclude = params.excludeIds ?? new Set<string>();
  if (!product.categoryId) return [];
  const { selfAndAncestors, selfAndDescendants } = buildCategoryMaps(categories);
  const myAnc = selfAndAncestors.get(product.categoryId) ?? new Set([product.categoryId]);

  // toId -> 合并后的建议
  const byTo = new Map<string, CompatSuggestion & { priority: number }>();

  const consider = (
    rule: CompatRuleData,
    toCatId: string,
    fromAttrsOf: (cand: CompatProduct) => [Record<string, unknown>, Record<string, unknown>],
  ) => {
    const toSet = selfAndDescendants.get(toCatId) ?? new Set([toCatId]);
    for (const cand of candidates) {
      if (cand.id === product.id || exclude.has(cand.id)) continue;
      if (!cand.categoryId || !toSet.has(cand.categoryId)) continue;
      const [fromA, toA] = fromAttrsOf(cand);
      const reasons: string[] = [];
      let ok = true;
      for (const cond of rule.conditions) {
        if (evalCondition(cond, fromA, toA)) reasons.push(reasonOf(cond));
        else {
          ok = false;
          break;
        }
      }
      if (!ok) continue;
      const prev = byTo.get(cand.id);
      if (!prev || rule.priority > prev.priority) {
        byTo.set(cand.id, {
          toId: cand.id,
          modelNumber: cand.modelNumber,
          name: cand.name,
          relation: rule.relation,
          ruleId: rule.id,
          ruleLabel: rule.label,
          reasons: rule.conditions.length ? reasons : ["同类目即配"],
          priority: rule.priority,
        });
      }
    }
  };

  for (const rule of rules) {
    if (!rule.enabled) continue;
    // 正向：主品在 fromCategory（含祖先匹配）→ 配 toCategory
    if (myAnc.has(rule.fromCategoryId)) {
      consider(rule, rule.toCategoryId, (cand) => [product.attributes, cand.attributes]);
    }
    // 反向（双向规则）：主品在 toCategory → 配 fromCategory，条件 from/to 互换
    if (rule.bidirectional && myAnc.has(rule.toCategoryId)) {
      consider(rule, rule.fromCategoryId, (cand) => [cand.attributes, product.attributes]);
    }
  }

  return [...byTo.values()]
    .sort((a, b) => b.priority - a.priority)
    .map((s) => ({
      toId: s.toId,
      modelNumber: s.modelNumber,
      name: s.name,
      relation: s.relation,
      ruleId: s.ruleId,
      ruleLabel: s.ruleLabel,
      reasons: s.reasons,
    }));
}
