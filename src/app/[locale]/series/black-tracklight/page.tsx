import type { Metadata } from "next";
import Showcase from "@/components/black-tracklight/showcase";

// 完全定制的系列展示页，先做出来看看；暂不进搜索引擎。
export const metadata: Metadata = {
  title: "黑色射灯 — Luzdex",
  robots: { index: false, follow: false },
};

export default function BlackTracklightPage() {
  return <Showcase />;
}
