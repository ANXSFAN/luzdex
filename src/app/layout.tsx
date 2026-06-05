import type { Metadata, Viewport } from "next";
import { Inter_Tight, JetBrains_Mono } from "next/font/google";
import { getLocale } from "next-intl/server";
import { Toaster } from "sonner";
import "./globals.css";

// Apple lineage: a single tight sans for both body and display (SF Pro
// approximation that stays consistent cross-platform), plus mono for specs.
const sans = Inter_Tight({
  variable: "--font-sans",
  subsets: ["latin"],
});

const mono = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "CLOUD · Datasheet Portal",
  description: "Product specifications, documents, and media — served via QR scan.",
  robots: { index: false, follow: false },
};

// 平台默认 viewport；产品页用 generateViewport 按工厂品牌色覆盖 themeColor。
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#ffffff",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = await getLocale();
  return (
    <html
      lang={locale}
      className={`${sans.variable} ${mono.variable}`}
    >
      <body className="min-h-screen font-sans antialiased">
        {children}
        <Toaster position="top-center" richColors />
      </body>
    </html>
  );
}
