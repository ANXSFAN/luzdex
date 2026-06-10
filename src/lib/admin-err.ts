import "server-only";
import { getTranslations } from "next-intl/server";
import { getAdminLocale } from "@/lib/admin-locale";

type ErrValues = Record<string, string | number>;

/** 按后台界面语言取 `err` 命名空间的错误文案（服务端 action / API 用）。 */
export async function errMsg(key: string, values?: ErrValues): Promise<string> {
  const locale = await getAdminLocale();
  const t = await getTranslations({ locale, namespace: "err" });
  return t(key, values);
}

/** 本地化错误对象。用法：`throw await adminErr("productNotFound")`。 */
export async function adminErr(key: string, values?: ErrValues): Promise<Error> {
  return new Error(await errMsg(key, values));
}
