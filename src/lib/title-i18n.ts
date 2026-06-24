import { parseContentI18n, type LocalizedContent } from "@/lib/products";

// 文档/视频标题译文按 sortOrder 顺序存在 contentI18n[locale].docTitles / videoTitles。
// 源标题一改/一删,对应位置的旧译名就过期——这里同步处理,让前台先回退源语言,
// 等运营重跑一次 AI 翻译再补全。数组对齐时做精准改/删(保住其余文档的译名),
// 长度对不上时整组清空兜底(避免错位)。
type TitleField = "docTitles" | "videoTitles";

/**
 * 重命名第 `index` 条:把各语言译名数组的该位置替成新源标题(前台即显示源语言)。
 * `total` 是当前文档/视频总数;数组长度等于 total 才精准改,否则整组清空。
 */
export function renameTitleI18n(
  contentI18n: unknown,
  field: TitleField,
  index: number,
  total: number,
  newTitle: string,
): Record<string, LocalizedContent> {
  const pack = parseContentI18n(contentI18n);
  for (const lc of Object.values(pack)) {
    const arr = lc[field];
    if (!arr) continue;
    if (arr.length === total && index >= 0 && index < total) {
      arr[index] = newTitle;
    } else {
      delete lc[field];
    }
  }
  return pack;
}

/**
 * 删除第 `index` 条:从各语言译名数组里 splice 掉该位置,保持其余对齐。
 * `totalBefore` 是删除前的总数;长度对不上则整组清空兜底。
 */
export function removeTitleI18n(
  contentI18n: unknown,
  field: TitleField,
  index: number,
  totalBefore: number,
): Record<string, LocalizedContent> {
  const pack = parseContentI18n(contentI18n);
  for (const lc of Object.values(pack)) {
    const arr = lc[field];
    if (!arr) continue;
    if (arr.length === totalBefore && index >= 0 && index < totalBefore) {
      arr.splice(index, 1);
      if (arr.length === 0) delete lc[field];
    } else {
      delete lc[field];
    }
  }
  return pack;
}
