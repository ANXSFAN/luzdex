import { defineRouting } from "next-intl/routing";

export const routing = defineRouting({
  locales: ["zh-CN", "en"],
  defaultLocale: "zh-CN",
  // `/p/{slug}` stays unprefixed for zh-CN; English is `/en/p/{slug}`.
  // Matches PLAN.md M5 phase-1: default locale = zh-CN.
  localePrefix: "as-needed",
});

export type AppLocale = (typeof routing.locales)[number];

export const LOCALE_LABELS: Record<AppLocale, string> = {
  "zh-CN": "中文",
  en: "EN",
};
