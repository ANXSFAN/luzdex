"use client";

import { useEffect, useRef, useState } from "react";
import { LuzdexMark } from "@/components/luzdex-mark";

/**
 * 「黑色射灯」系列展示页 —— 完全独立定制，不复用任何站点模板。
 * 暗场基调：黑色灯具只有在暗里打光才出戏（已与「前台浅色」基调约定破例）。
 * 素材全部在 /public/series/black-tracklight：hero / analysis 两段视频 + 6 张精修图。
 */

// 素材存在 R2（不进仓库/部署包），脚本 scripts/upload-black-tracklight.mjs 上传。
const BASE =
  "https://pub-4dbe01d8263e4eb5a9b7a03eb723a383.r2.dev/series/black-tracklight";
// 暖白光的琥珀色：取自 hero 视频里那束光，全页唯一的彩色信号。
const WARM = "#E0A86A";

/* 进入视口才浮现 —— 自带的轻量 reveal，不挂任何全局模板类。 */
function useReveal<T extends HTMLElement>(threshold = 0.18) {
  const ref = useRef<T>(null);
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          setShown(true);
          io.disconnect();
        }
      },
      { threshold },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [threshold]);
  return { ref, shown };
}

function Reveal({
  children,
  className = "",
  delay = 0,
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
}) {
  const { ref, shown } = useReveal<HTMLDivElement>();
  return (
    <div
      ref={ref}
      className={
        "transition-[opacity,transform] duration-[1100ms] ease-[cubic-bezier(0.22,1,0.36,1)] " +
        (shown ? "translate-y-0 opacity-100" : "translate-y-9 opacity-0") +
        (className ? " " + className : "")
      }
      style={{ transitionDelay: `${delay}ms` }}
    >
      {children}
    </div>
  );
}

const PARTS = [
  { n: "01", zh: "防眩前环", en: "Anti-glare ring" },
  { n: "02", zh: "光学透镜", en: "Optical lens" },
  { n: "03", zh: "COB 集成光源", en: "COB module" },
  { n: "04", zh: "多齿反射器", en: "Faceted reflector" },
  { n: "05", zh: "一体压铸筒身", en: "Die-cast barrel" },
  { n: "06", zh: "三相轨道适配器", en: "3-phase track adapter" },
];

export default function Showcase() {
  return (
    <main className="min-h-screen bg-[#050505] text-white">
      {/* ───────────────────────── Hero ───────────────────────── */}
      <section className="relative h-[100svh] w-full overflow-hidden">
        <video
          className="absolute inset-0 h-full w-full object-cover"
          src={`${BASE}/hero.mp4`}
          poster={`${BASE}/hero-poster.webp`}
          autoPlay
          muted
          loop
          playsInline
          preload="metadata"
        />
      </section>

      {/* ─────────────────────── Statement ─────────────────────── */}
      <section className="mx-auto max-w-[1100px] px-6 py-28 sm:px-10 sm:py-40">
        <Reveal>
          <div className="spectrum-bar w-24" />
          <p className="font-display mt-8 max-w-[22ch] text-[8vw] leading-[1.05] tracking-tight sm:text-[3.4rem] lg:text-[4.6rem]">
            光，是这支灯
            <br />
            唯一的输出。
          </p>
          <p className="mt-8 max-w-[52ch] text-[16px] leading-[1.75] text-white/55 sm:text-[18px]">
            通体哑黑、无反光的筒身，刻意退到背景里。它不在空间里抢镜——它只负责把光，干净、精准地落到你想强调的地方。
          </p>
        </Reveal>
      </section>

      {/* ─────────────────────── Anatomy ─────────────────────── */}
      <section className="border-t border-white/10 px-6 py-24 sm:px-10 sm:py-32">
        <div className="mx-auto max-w-[1240px]">
          <Reveal>
            <div className="flex items-baseline justify-between gap-4">
              <div>
                <p
                  className="font-mono text-[11px] uppercase tracking-[0.3em]"
                  style={{ color: WARM }}
                >
                  Anatomy · 结构
                </p>
                <h2 className="font-display mt-4 text-[2rem] leading-tight tracking-tight sm:text-[2.8rem]">
                  拆开看，每一层都在做光学
                </h2>
              </div>
              <span className="hidden font-mono text-[11px] tabular-nums text-white/35 sm:block">
                06 PARTS
              </span>
            </div>
          </Reveal>

          <Reveal delay={120} className="mt-12">
            <div className="overflow-hidden rounded-2xl bg-black">
              <video
                className="h-full w-full"
                src={`${BASE}/analysis.mp4`}
                autoPlay
                muted
                loop
                playsInline
                preload="none"
              />
            </div>
          </Reveal>

          <Reveal delay={200} className="mt-12">
            <ul className="grid grid-cols-1 gap-x-10 gap-y-px overflow-hidden rounded-xl border border-white/10 sm:grid-cols-2 lg:grid-cols-3">
              {PARTS.map((p) => (
                <li
                  key={p.n}
                  className="flex items-center gap-4 bg-white/[0.02] px-5 py-5"
                >
                  <span
                    className="font-mono text-[12px] tabular-nums"
                    style={{ color: WARM }}
                  >
                    {p.n}
                  </span>
                  <div>
                    <p className="text-[15px] font-medium text-white/90">
                      {p.zh}
                    </p>
                    <p className="mt-0.5 font-mono text-[10px] uppercase tracking-[0.16em] text-white/35">
                      {p.en}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </Reveal>
        </div>
      </section>

      {/* ─────────────────────── Light / 光色 ─────────────────────── */}
      <section className="border-t border-white/10 px-6 py-24 sm:px-10 sm:py-32">
        <div className="mx-auto grid max-w-[1240px] grid-cols-1 items-center gap-14 lg:grid-cols-2">
          <Reveal>
            <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-black">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={`${BASE}/front-warm.webp`}
                alt="点亮的射灯正面，暖白光从多齿反射器里铺开"
                className="h-full w-full object-cover"
              />
            </div>
          </Reveal>
          <Reveal delay={120}>
            <p
              className="font-mono text-[11px] uppercase tracking-[0.3em]"
              style={{ color: WARM }}
            >
              Light · 光色
            </p>
            <h2 className="font-display mt-4 text-[2rem] leading-tight tracking-tight sm:text-[2.8rem]">
              从暖白，到冷白
            </h2>
            <p className="mt-6 max-w-[44ch] text-[16px] leading-[1.75] text-white/55 sm:text-[17px]">
              同一支灯，覆盖从烛光般的暖白到正午般的冷白。深杯反射器把眩光压在杯口之内，落到物体上的是一圈干净、均匀的光斑。
            </p>
            <div className="spectrum-bar mt-10 w-full" />
            <div className="mt-3 flex justify-between font-mono text-[10px] uppercase tracking-[0.2em] text-white/40">
              <span>暖白 Warm</span>
              <span>中性 Neutral</span>
              <span>冷白 Cool</span>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ─────────────────────── Finish / 质感 ─────────────────────── */}
      <section className="border-t border-white/10 px-6 py-24 sm:px-10 sm:py-32">
        <div className="mx-auto max-w-[1240px]">
          <Reveal>
            <p
              className="font-mono text-[11px] uppercase tracking-[0.3em]"
              style={{ color: WARM }}
            >
              Finish · 质感
            </p>
            <h2 className="font-display mt-4 max-w-[20ch] text-[2rem] leading-tight tracking-tight sm:text-[2.8rem]">
              哑黑无反光，每个角度都收得住
            </h2>
          </Reveal>

          {/* 暗场大图 */}
          <Reveal delay={120} className="mt-12">
            <div className="overflow-hidden rounded-2xl border border-white/10">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={`${BASE}/body-dark.webp`}
                alt="暗场里的射灯筒身，哑黑表面只留一道高光"
                className="h-full w-full object-cover"
              />
            </div>
          </Reveal>

          {/* 细节三联 */}
          <div className="mt-6 grid grid-cols-1 gap-6 sm:grid-cols-3">
            {[
              { src: "lens.webp", cap: "光学透镜 · Lens" },
              { src: "back-dark.webp", cap: "尾盖散热 · Heat sink" },
              { src: "angle-cool.webp", cap: "整机姿态 · Profile" },
            ].map((it, i) => (
              <Reveal key={it.src} delay={i * 100}>
                <figure className="overflow-hidden rounded-2xl bg-[#0c0c0c]">
                  <div className="aspect-[4/5] w-full overflow-hidden">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={`${BASE}/${it.src}`}
                      alt={it.cap}
                      loading="lazy"
                      className="h-full w-full object-cover transition duration-700 hover:scale-[1.04]"
                    />
                  </div>
                  <figcaption className="px-4 py-3 font-mono text-[10px] uppercase tracking-[0.16em] text-white/40">
                    {it.cap}
                  </figcaption>
                </figure>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ─────────────────────── Outro ─────────────────────── */}
      <section className="border-t border-white/10 px-6 py-28 sm:px-10 sm:py-36">
        <Reveal className="mx-auto max-w-[1100px]">
          <div className="spectrum-bar w-24" />
          <p className="font-display mt-8 max-w-[24ch] text-[7vw] leading-[1.05] tracking-tight sm:text-[3rem] lg:text-[3.8rem]">
            把光留给空间，
            <br />
            把自己藏进黑里。
          </p>
          <div className="mt-16 flex flex-col gap-3 border-t border-white/10 pt-8 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2.5">
              <LuzdexMark size={20} mono className="text-white/80" />
              <span className="text-[14px] font-semibold tracking-tight text-white/80">
                Luzdex · 黑色射灯
              </span>
            </div>
            <span className="font-mono text-[10px] uppercase tracking-[0.3em] text-white/30">
              Black Tracklight Series
            </span>
          </div>
        </Reveal>
      </section>
    </main>
  );
}
