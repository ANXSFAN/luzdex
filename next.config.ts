import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const r2Host = (() => {
  try {
    return new URL(process.env.R2_PUBLIC_URL || "").hostname;
  } catch {
    return "";
  }
})();

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "images.unsplash.com" },
      ...(r2Host ? [{ protocol: "https" as const, hostname: r2Host }] : []),
    ],
    unoptimized: true,
  },
};

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

export default withNextIntl(nextConfig);
