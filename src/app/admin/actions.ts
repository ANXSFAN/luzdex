"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ACTIVE_FACTORY_COOKIE } from "@/lib/active-factory";

/** 切换后台「当前工厂」。仅平台超管可用，校验工厂存在后写 cookie 并刷新。 */
export async function setActiveFactory(factoryId: string) {
  const session = await auth();
  if (!session) throw new Error("未授权");

  const factory = await prisma.factory.findUnique({
    where: { id: factoryId },
    select: { id: true },
  });
  if (!factory) throw new Error("工厂不存在");

  const store = await cookies();
  store.set(ACTIVE_FACTORY_COOKIE, factory.id, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });

  revalidatePath("/admin", "layout");
}
