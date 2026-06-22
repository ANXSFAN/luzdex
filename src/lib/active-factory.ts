import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { prisma } from "./prisma";

/**
 * v1 平台代运营：后台不绑定单一工厂，靠一个 cookie 记住"当前正在操作哪家工厂"。
 * 同步 / 产品列表 / 批量导入都以此为作用域。
 * (AdminUser.factoryId 已预留，将来工厂自助登录时可在此优先采用其绑定工厂。)
 */
const COOKIE = "active_factory";

export type ActiveFactory = NonNullable<
  Awaited<ReturnType<typeof prisma.factory.findFirst>>
>;

/**
 * 当前操作工厂：cookie 指定优先，否则回退到最早创建的一家。可能为 null（库里没有工厂）。
 * 用 React.cache 包裹：同一次请求里 layout + page 各调一遍时只查一次库（去重鉴权/导航重复成本）。
 */
export const getActiveFactory = cache(
  async (): Promise<ActiveFactory | null> => {
    const store = await cookies();
    const id = store.get(COOKIE)?.value;
    if (id) {
      const f = await prisma.factory.findUnique({ where: { id } });
      if (f) return f;
    }
    return prisma.factory.findFirst({ orderBy: { createdAt: "asc" } });
  },
);

/** 仅取 id 的便捷版（同步路由 / 导入用）。 */
export async function getActiveFactoryId(): Promise<string | null> {
  return (await getActiveFactory())?.id ?? null;
}

export const ACTIVE_FACTORY_COOKIE = COOKIE;
