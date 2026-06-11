import NextAuth from "next-auth";
import createIntlMiddleware from "next-intl/middleware";
import { NextResponse } from "next/server";
import { authConfig } from "@/lib/auth.config";
import { routing } from "@/i18n/routing";

const intlMiddleware = createIntlMiddleware(routing);

// Auth gates /admin; next-intl rewrites /p/... and /series/... to the active locale.
// 注意：next-auth v5 传入自定义函数时不会再执行 authorized 回调的拦截分支，
// 必须在这里自己查 req.auth，否则 /admin 对未登录用户完全公开。
export default NextAuth(authConfig).auth((req) => {
  if (req.nextUrl.pathname.startsWith("/admin")) {
    if (!req.auth?.user) {
      const signInUrl = req.nextUrl.clone();
      signInUrl.pathname = "/login";
      signInUrl.search = "";
      signInUrl.searchParams.set("callbackUrl", req.nextUrl.href);
      return NextResponse.redirect(signInUrl);
    }
    return NextResponse.next();
  }
  return intlMiddleware(req);
});

export const config = {
  matcher: [
    "/admin/:path*",
    "/p/:path*",
    "/series/:path*",
    "/(es|en|fr|de|it|pt|nl|pl|zh)/:path*",
  ],
};
