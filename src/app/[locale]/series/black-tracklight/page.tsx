import type { Metadata } from "next";
import Showcase from "@/components/black-tracklight/showcase";

// 标题用的系列名（与 showcase 里的 seriesName 一致）。
const TITLES: Record<string, string> = {
  es: "Foco negro",
  en: "Black Tracklight",
  fr: "Projecteur noir",
  de: "Schwarzer Strahler",
  it: "Faretto nero",
  pt: "Foco preto",
  nl: "Zwarte spot",
  pl: "Czarny reflektor",
  zh: "黑色射灯",
};

// 完全定制的系列展示页，先做出来看看；暂不进搜索引擎。
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  return {
    title: `${TITLES[locale] ?? TITLES.en} — Luzdex`,
    robots: { index: false, follow: false },
  };
}

export default async function BlackTracklightPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  return <Showcase locale={locale} />;
}
