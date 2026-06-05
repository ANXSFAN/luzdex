import type { ProductAttributes } from "@/lib/products";

/** 类目枚举（与导入 / 展示共用）。 */
export const CATEGORIES = ["strip", "channel", "power", "connector", "accessory"] as const;
export type Category = (typeof CATEGORIES)[number];

export const CATEGORY_LABELS_ZH: Record<Category, string> = {
  strip: "灯带",
  channel: "铝槽",
  power: "电源",
  connector: "连接件",
  accessory: "配件",
};

export function isCategory(v: string | null | undefined): v is Category {
  return !!v && (CATEGORIES as readonly string[]).includes(v);
}

/** 取字符串里的第一个数字，用于把 "10mm" / "24V" 归一成可比较的数值串。 */
function normNum(s?: string): string | null {
  if (!s) return null;
  const m = s.match(/[\d.]+/);
  return m ? m[0] : null;
}

export interface MatchCandidate {
  id: string;
  modelNumber: string;
  name: string;
  category: string | null;
  attributes: ProductAttributes;
}

export interface Suggestion {
  toId: string;
  modelNumber: string;
  name: string;
  category: string | null;
  relation: "accessory";
  basis: "pcbWidth" | "voltage";
  reason: string;
}

/**
 * 属性自动匹配：只对灯带(strip)产品，按属性在同工厂内找适配的铝槽 / 电源。
 * - PCB 宽度相同 → 铝槽(channel)
 * - 电压相同 → 电源(power)（功率仅作为提示，不强约束）
 * 只产出"建议"，由后台确认后才写 ProductLink，绝不静默写库。
 * excludeIds 用于过滤已手动关联 / 自身，避免重复建议。
 */
export function suggestAccessories(
  current: { category: string | null; attributes: ProductAttributes },
  candidates: MatchCandidate[],
  excludeIds: Set<string>,
): Suggestion[] {
  if (current.category !== "strip") return [];

  const width = normNum(current.attributes.pcbWidth);
  const volt = normNum(current.attributes.voltage);
  const out: Suggestion[] = [];

  for (const c of candidates) {
    if (excludeIds.has(c.id)) continue;

    if (c.category === "channel" && width && normNum(c.attributes.pcbWidth) === width) {
      out.push({
        toId: c.id,
        modelNumber: c.modelNumber,
        name: c.name,
        category: c.category,
        relation: "accessory",
        basis: "pcbWidth",
        reason: `PCB 宽度 ${current.attributes.pcbWidth} 匹配`,
      });
    } else if (c.category === "power" && volt && normNum(c.attributes.voltage) === volt) {
      const wattHint =
        current.attributes.watt && c.attributes.watt
          ? `；电源 ${c.attributes.watt}W ${c.attributes.watt >= current.attributes.watt ? "≥" : "<"} 灯带 ${current.attributes.watt}W/m`
          : "";
      out.push({
        toId: c.id,
        modelNumber: c.modelNumber,
        name: c.name,
        category: c.category,
        relation: "accessory",
        basis: "voltage",
        reason: `电压 ${current.attributes.voltage} 匹配${wattHint}`,
      });
    }
  }
  return out;
}
