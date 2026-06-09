import "server-only";
import { cookies } from "next/headers";
import { normalizeLocale, type AppLocale } from "@/i18n/routing";

export const ADMIN_LOCALE_COOKIE = "admin_locale";

/** 后台界面语言（独立于前台）。cookie 指定，默认中文。 */
export async function getAdminLocale(): Promise<AppLocale> {
  const c = (await cookies()).get(ADMIN_LOCALE_COOKIE)?.value;
  return normalizeLocale(c) ?? "zh";
}
