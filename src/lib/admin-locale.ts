import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { normalizeLocale, type AppLocale } from "@/i18n/routing";

export const ADMIN_LOCALE_COOKIE = "admin_locale";

/**
 * 后台界面语言（独立于前台）。cookie 指定，默认中文。
 * React.cache 去重：layout + 各 page 同一请求只读一次 cookie。
 */
export const getAdminLocale = cache(async (): Promise<AppLocale> => {
  const c = (await cookies()).get(ADMIN_LOCALE_COOKIE)?.value;
  return normalizeLocale(c) ?? "zh";
});
