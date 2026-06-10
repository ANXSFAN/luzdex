"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ACTIVE_FACTORY_COOKIE } from "@/lib/active-factory";
import { ADMIN_LOCALE_COOKIE } from "@/lib/admin-locale";
import { adminErr } from "@/lib/admin-err";
import { routing } from "@/i18n/routing";

/** 切换后台「当前工厂」。仅平台超管可用，校验工厂存在后写 cookie 并刷新。 */
export async function setActiveFactory(factoryId: string) {
  const session = await auth();
  if (!session) throw await adminErr("unauthorized");

  const factory = await prisma.factory.findUnique({
    where: { id: factoryId },
    select: { id: true },
  });
  if (!factory) throw await adminErr("factoryNotFound");

  const store = await cookies();
  store.set(ACTIVE_FACTORY_COOKIE, factory.id, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });

  revalidatePath("/admin", "layout");
}

/** 切换后台界面语言。写 cookie 并整层刷新。 */
export async function setAdminLocale(locale: string) {
  const session = await auth();
  if (!session) throw await adminErr("unauthorized");
  if (!(routing.locales as readonly string[]).includes(locale)) {
    throw await adminErr("unsupportedLang");
  }
  const store = await cookies();
  store.set(ADMIN_LOCALE_COOKIE, locale, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
  revalidatePath("/admin", "layout");
}
