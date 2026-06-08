import { defineRouting } from "next-intl/routing";

// 9 语言，默认西语 es（根路径不带前缀）；其余 /{locale}/...。
// localeDetection 默认开启：无前缀访问时按 Accept-Language 协商（中文设备→zh）。
export const routing = defineRouting({
  locales: ["es", "en", "fr", "de", "it", "pt", "nl", "pl", "zh"],
  defaultLocale: "es",
  localePrefix: "as-needed",
});

export type AppLocale = (typeof routing.locales)[number];

// 切换器展示顺序（对齐设计稿）。
export const LOCALE_ORDER: AppLocale[] = [
  "en",
  "es",
  "fr",
  "de",
  "it",
  "pt",
  "nl",
  "pl",
  "zh",
];

// 语言原名（endonym）。
export const LOCALE_LABELS: Record<AppLocale, string> = {
  es: "Español",
  en: "English",
  fr: "Français",
  de: "Deutsch",
  it: "Italiano",
  pt: "Português",
  nl: "Nederlands",
  pl: "Polski",
  zh: "中文",
};

// 旗标用的国家码角标（与设计稿一致：英文 GB、中文 CN）。
export const LOCALE_FLAGS: Record<AppLocale, string> = {
  es: "ES",
  en: "GB",
  fr: "FR",
  de: "DE",
  it: "IT",
  pt: "PT",
  nl: "NL",
  pl: "PL",
  zh: "CN",
};

/** 把历史/外部 locale 串归一到受支持的 AppLocale；zh-CN/zh_* → zh，其余取前缀。 */
export function normalizeLocale(input: string | null | undefined): AppLocale | null {
  if (!input) return null;
  const low = input.toLowerCase();
  if (low === "zh" || low.startsWith("zh-") || low.startsWith("zh_")) return "zh";
  const base = low.split(/[-_]/)[0];
  return (routing.locales as readonly string[]).includes(base)
    ? (base as AppLocale)
    : null;
}
