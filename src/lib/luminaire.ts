// 灯具类型枚举（稳定 key + 多语言标签）。存 key，显示按 locale 取标签。
// 用途：后台下拉选择、AI 生成上下文、将来按类目筛选 / 安装模板。client/server 通用。

export const LUMINAIRE_TYPES = [
  { key: "strip", zh: "灯带", en: "LED strip" },
  { key: "downlight", zh: "筒灯", en: "Downlight" },
  { key: "spotlight", zh: "射灯", en: "Spotlight" },
  { key: "track", zh: "轨道灯", en: "Track light" },
  { key: "panel", zh: "面板灯", en: "Panel light" },
  { key: "ceiling", zh: "吸顶灯", en: "Ceiling light" },
  { key: "linear", zh: "线条灯", en: "Linear light" },
  { key: "floodlight", zh: "投光灯", en: "Floodlight" },
  { key: "streetlight", zh: "路灯", en: "Street light" },
  { key: "highbay", zh: "高棚灯 / 工矿灯", en: "High bay" },
  { key: "wallwasher", zh: "洗墙灯", en: "Wall washer" },
  { key: "bulb", zh: "球泡灯", en: "Bulb" },
  { key: "tube", zh: "灯管", en: "Tube" },
  { key: "other", zh: "其他", en: "Other" },
] as const;

export type LuminaireType = (typeof LUMINAIRE_TYPES)[number]["key"];

const BY_KEY = new Map(LUMINAIRE_TYPES.map((t) => [t.key, t]));

/** 取灯具类型的显示标签；未知 key 原样返回（兼容历史自由文本值）。 */
export function luminaireLabel(
  key: string | null | undefined,
  locale?: string
): string {
  if (!key) return "";
  const t = BY_KEY.get(key as LuminaireType);
  if (!t) return key;
  return locale === "zh" || !locale ? t.zh : t.en;
}
