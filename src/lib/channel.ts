/**
 * 渠道归因来源码（?s=<code>）的归一化。
 *
 * 读写两侧都过这个函数：
 *  - 导出二维码时，把用户填的「渠道标签」清洗成安全短码拼进 URL；
 *  - 产品页记录 ScanLog 时，把 URL 上的 ?s= 清洗后入库。
 *
 * 规则：转小写 → 空格/下划线转连字符 → 只保留 [a-z0-9-] → 去掉首尾连字符
 * → 截断 24 字符。空值或清洗后为空返回 null（= 直接访问 / 未带渠道码）。
 */
export function normalizeSource(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const code = raw
    .toLowerCase()
    .trim()
    .replace(/[\s_]+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/^-+|-+$/g, "")
    .slice(0, 24);
  return code || null;
}
