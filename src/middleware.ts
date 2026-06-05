import NextAuth from "next-auth";
import createIntlMiddleware from "next-intl/middleware";
import { NextResponse } from "next/server";
import { authConfig } from "@/lib/auth.config";
import { routing } from "@/i18n/routing";

const intlMiddleware = createIntlMiddleware(routing);

// Auth gates /admin; next-intl rewrites /p/... to the active locale.
export default NextAuth(authConfig).auth((req) => {
  if (req.nextUrl.pathname.startsWith("/admin")) {
    return NextResponse.next();
  }
  return intlMiddleware(req);
});

export const config = {
  matcher: [
    "/admin/:path*",
    "/p/:path*",
    "/zh-CN/:path*",
    "/en/:path*",
  ],
};
