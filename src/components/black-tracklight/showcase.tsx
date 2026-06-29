"use client";

import { useEffect, useRef, useState } from "react";
import { LuzdexMark } from "@/components/luzdex-mark";

/**
 * 「黑色射灯」系列展示页 —— 完全独立定制，不复用任何站点模板。
 * 暗场基调：黑色灯具只有在暗里打光才出戏（已与「前台浅色」基调约定破例）。
 * 素材全部在 R2 的 /series/black-tracklight：hero / analysis 两段视频 + 6 张精修图。
 *
 * 文案多语言：内联字典，按 locale 取一份（同 share-button 的做法）。
 * 英文技术关键词（Anatomy / Light / Finish、PART 的 en 副标、PARTS 计数）作为版式常量保留。
 */

// 素材存在 R2（不进仓库/部署包），脚本 scripts/upload-black-tracklight.mjs 上传。
const BASE =
  "https://pub-4dbe01d8263e4eb5a9b7a03eb723a383.r2.dev/series/black-tracklight";
// 暖白光的琥珀色：取自 hero 视频里那束光，全页唯一的彩色信号。
const WARM = "#E0A86A";

type Locale = "es" | "en" | "fr" | "de" | "it" | "pt" | "nl" | "pl" | "zh";

interface Copy {
  statementHead: [string, string];
  statementBody: string;
  anatomyEyebrow: string;
  anatomyH2: string;
  parts: [string, string, string, string, string, string];
  lightEyebrow: string;
  lightH2: string;
  lightBody: string;
  lightAlt: string;
  spectrum: [string, string, string]; // 暖 / 中 / 冷
  finishEyebrow: string;
  finishH2: string;
  bodyDarkAlt: string;
  details: [string, string, string]; // lens / heat sink / profile
  outroHead: [string, string];
  seriesName: string;
}

// PART 副标固定英文（版式上的「技术代号」）；主标题走 copy.parts。
const PART_KEYS: { n: string; en: string }[] = [
  { n: "01", en: "Anti-glare ring" },
  { n: "02", en: "Optical lens" },
  { n: "03", en: "COB module" },
  { n: "04", en: "Faceted reflector" },
  { n: "05", en: "Die-cast barrel" },
  { n: "06", en: "3-phase track adapter" },
];

// 细节三联：英文关键词固定，本地词走 copy.details。
const DETAIL_KEYS: { src: string; en: string }[] = [
  { src: "lens.webp", en: "Lens" },
  { src: "back-dark.webp", en: "Heat sink" },
  { src: "angle-cool.webp", en: "Profile" },
];

const COPY: Record<Locale, Copy> = {
  zh: {
    statementHead: ["光，是这支灯", "唯一的输出。"],
    statementBody:
      "通体哑黑、无反光的筒身，刻意退到背景里。它不在空间里抢镜——它只负责把光，干净、精准地落到你想强调的地方。",
    anatomyEyebrow: "Anatomy · 结构",
    anatomyH2: "拆开看，每一层都在做光学",
    parts: [
      "防眩前环",
      "光学透镜",
      "COB 集成光源",
      "多齿反射器",
      "一体压铸筒身",
      "三相轨道适配器",
    ],
    lightEyebrow: "Light · 光色",
    lightH2: "从暖白，到冷白",
    lightBody:
      "同一支灯，覆盖从烛光般的暖白到正午般的冷白。深杯反射器把眩光压在杯口之内，落到物体上的是一圈干净、均匀的光斑。",
    lightAlt: "点亮的射灯正面，暖白光从多齿反射器里铺开",
    spectrum: ["暖白", "中性", "冷白"],
    finishEyebrow: "Finish · 质感",
    finishH2: "哑黑无反光，每个角度都收得住",
    bodyDarkAlt: "暗场里的射灯筒身，哑黑表面只留一道高光",
    details: ["光学透镜", "尾盖散热", "整机姿态"],
    outroHead: ["把光留给空间，", "把自己藏进黑里。"],
    seriesName: "黑色射灯",
  },
  en: {
    statementHead: ["Light is the only thing", "this fixture outputs."],
    statementBody:
      "A matte-black, glare-free barrel that deliberately recedes into the background. It doesn't fight for attention in the room — it simply lays light onto whatever you want to highlight, cleanly and precisely.",
    anatomyEyebrow: "Anatomy",
    anatomyH2: "Take it apart — every layer is doing optics.",
    parts: [
      "Anti-glare ring",
      "Optical lens",
      "COB module",
      "Faceted reflector",
      "Die-cast barrel",
      "3-phase track adapter",
    ],
    lightEyebrow: "Light",
    lightH2: "From warm white to cool white.",
    lightBody:
      "One fixture spans from candle-warm white to noon-cool white. The deep-cup reflector keeps glare inside the rim, casting a clean, even pool of light onto the object.",
    lightAlt:
      "Lit spotlight, front view — warm white spreading from the faceted reflector.",
    spectrum: ["Warm", "Neutral", "Cool"],
    finishEyebrow: "Finish",
    finishH2: "Matte black, non-reflective — composed from every angle.",
    bodyDarkAlt:
      "Spotlight barrel in darkness — a single highlight on the matte-black surface.",
    details: ["Lens", "Heat sink", "Profile"],
    outroHead: ["Give the light to the room,", "hide itself in the dark."],
    seriesName: "Black Tracklight",
  },
  es: {
    statementHead: ["La luz es lo único", "que emite esta luminaria."],
    statementBody:
      "Un cuerpo negro mate y sin reflejos que se retira a propósito al fondo. No compite por la atención en el espacio: solo deposita la luz, limpia y precisa, sobre aquello que quieres destacar.",
    anatomyEyebrow: "Anatomy · Anatomía",
    anatomyH2: "Desmóntalo: cada capa hace óptica.",
    parts: [
      "Aro antideslumbrante",
      "Lente óptica",
      "Módulo COB",
      "Reflector facetado",
      "Cuerpo de fundición",
      "Adaptador de carril trifásico",
    ],
    lightEyebrow: "Light · Color de luz",
    lightH2: "Del blanco cálido al blanco frío.",
    lightBody:
      "Una misma luminaria abarca desde el blanco cálido de una vela hasta el blanco frío del mediodía. El reflector de copa profunda mantiene el deslumbramiento dentro del borde y proyecta un haz limpio y uniforme sobre el objeto.",
    lightAlt:
      "Foco encendido de frente: blanco cálido saliendo del reflector facetado.",
    spectrum: ["Cálido", "Neutro", "Frío"],
    finishEyebrow: "Finish · Acabado",
    finishH2: "Negro mate, sin reflejos: cuidado desde cualquier ángulo.",
    bodyDarkAlt:
      "Cuerpo del foco en la oscuridad: un único brillo sobre la superficie negro mate.",
    details: ["Lente óptica", "Disipador trasero", "Perfil"],
    outroHead: ["Deja la luz al espacio,", "y escóndete en la oscuridad."],
    seriesName: "Foco negro",
  },
  fr: {
    statementHead: ["La lumière est la seule chose", "qu'émet ce projecteur."],
    statementBody:
      "Un corps noir mat et anti-reflets qui s'efface volontairement à l'arrière-plan. Il ne cherche pas à attirer le regard — il se contente de poser la lumière, nette et précise, sur ce que vous voulez mettre en valeur.",
    anatomyEyebrow: "Anatomy · Anatomie",
    anatomyH2: "Démontez-le : chaque couche fait de l'optique.",
    parts: [
      "Anneau anti-éblouissement",
      "Lentille optique",
      "Module COB",
      "Réflecteur à facettes",
      "Corps moulé sous pression",
      "Adaptateur rail triphasé",
    ],
    lightEyebrow: "Light · Couleur",
    lightH2: "Du blanc chaud au blanc froid.",
    lightBody:
      "Un même projecteur couvre du blanc chaud d'une bougie au blanc froid de midi. Le réflecteur à coupe profonde contient l'éblouissement sous le bord et projette un faisceau net et uniforme sur l'objet.",
    lightAlt:
      "Projecteur allumé de face : blanc chaud diffusé par le réflecteur à facettes.",
    spectrum: ["Chaud", "Neutre", "Froid"],
    finishEyebrow: "Finish · Finition",
    finishH2: "Noir mat, anti-reflets : maîtrisé sous tous les angles.",
    bodyDarkAlt:
      "Corps du projecteur dans le noir : un seul reflet sur la surface noir mat.",
    details: ["Lentille optique", "Dissipateur", "Profil"],
    outroHead: [
      "Laissez la lumière à l'espace,",
      "et disparaissez dans le noir.",
    ],
    seriesName: "Projecteur noir",
  },
  de: {
    statementHead: ["Licht ist das Einzige,", "was dieser Strahler abgibt."],
    statementBody:
      "Ein mattschwarzer, reflexfreier Korpus, der bewusst in den Hintergrund tritt. Er drängt sich im Raum nicht auf — er legt das Licht nur sauber und präzise auf das, was du betonen willst.",
    anatomyEyebrow: "Anatomy · Aufbau",
    anatomyH2: "Auseinandergenommen: jede Schicht macht Optik.",
    parts: [
      "Blendschutzring",
      "Optische Linse",
      "COB-Modul",
      "Facettenreflektor",
      "Druckguss-Korpus",
      "3-Phasen-Schienenadapter",
    ],
    lightEyebrow: "Light · Lichtfarbe",
    lightH2: "Von Warmweiß zu Kaltweiß.",
    lightBody:
      "Ein und derselbe Strahler reicht vom kerzenwarmen Weiß bis zum mittagskalten Weiß. Der tiefe Reflektor hält die Blendung im Rand und wirft einen sauberen, gleichmäßigen Lichtkreis auf das Objekt.",
    lightAlt:
      "Eingeschalteter Strahler von vorn – Warmweiß breitet sich aus dem Facettenreflektor aus.",
    spectrum: ["Warm", "Neutral", "Kalt"],
    finishEyebrow: "Finish · Oberfläche",
    finishH2: "Mattschwarz, reflexfrei – aus jedem Winkel stimmig.",
    bodyDarkAlt:
      "Strahlerkorpus im Dunkeln – nur ein Glanzlicht auf der mattschwarzen Oberfläche.",
    details: ["Optische Linse", "Kühlkörper", "Profil"],
    outroHead: ["Gib das Licht dem Raum,", "und verschwinde im Schwarz."],
    seriesName: "Schwarzer Strahler",
  },
  it: {
    statementHead: ["La luce è l'unica cosa", "che questo faretto emette."],
    statementBody:
      "Un corpo nero opaco e antiriflesso che si ritira volutamente sullo sfondo. Non compete per l'attenzione nello spazio: posa soltanto la luce, pulita e precisa, su ciò che vuoi mettere in risalto.",
    anatomyEyebrow: "Anatomy · Anatomia",
    anatomyH2: "Smontalo: ogni strato fa ottica.",
    parts: [
      "Anello antiabbagliamento",
      "Lente ottica",
      "Modulo COB",
      "Riflettore sfaccettato",
      "Corpo pressofuso",
      "Adattatore binario trifase",
    ],
    lightEyebrow: "Light · Colore",
    lightH2: "Dal bianco caldo al bianco freddo.",
    lightBody:
      "Uno stesso faretto copre dal bianco caldo di una candela al bianco freddo del mezzogiorno. Il riflettore a coppa profonda trattiene l'abbagliamento entro il bordo e proietta un fascio pulito e uniforme sull'oggetto.",
    lightAlt:
      "Faretto acceso, vista frontale: bianco caldo che si diffonde dal riflettore sfaccettato.",
    spectrum: ["Caldo", "Neutro", "Freddo"],
    finishEyebrow: "Finish · Finitura",
    finishH2: "Nero opaco, antiriflesso: curato da ogni angolazione.",
    bodyDarkAlt:
      "Corpo del faretto nel buio: un solo riflesso sulla superficie nero opaco.",
    details: ["Lente ottica", "Dissipatore", "Profilo"],
    outroHead: ["Lascia la luce allo spazio,", "e nasconditi nel buio."],
    seriesName: "Faretto nero",
  },
  pt: {
    statementHead: ["A luz é a única coisa", "que esta luminária emite."],
    statementBody:
      "Um corpo preto fosco e sem reflexos que recua de propósito para o fundo. Não disputa a atenção no espaço — apenas deposita a luz, limpa e precisa, sobre aquilo que quer destacar.",
    anatomyEyebrow: "Anatomy · Anatomia",
    anatomyH2: "Desmonte-o: cada camada faz óptica.",
    parts: [
      "Anel antiofuscamento",
      "Lente óptica",
      "Módulo COB",
      "Refletor facetado",
      "Corpo fundido",
      "Adaptador de calha trifásica",
    ],
    lightEyebrow: "Light · Cor da luz",
    lightH2: "Do branco quente ao branco frio.",
    lightBody:
      "A mesma luminária abrange do branco quente de uma vela ao branco frio do meio-dia. O refletor de copo profundo mantém o ofuscamento dentro da borda e projeta um facho limpo e uniforme sobre o objeto.",
    lightAlt:
      "Foco aceso de frente: branco quente saindo do refletor facetado.",
    spectrum: ["Quente", "Neutro", "Frio"],
    finishEyebrow: "Finish · Acabamento",
    finishH2: "Preto fosco, sem reflexos: cuidado de qualquer ângulo.",
    bodyDarkAlt:
      "Corpo do foco no escuro: um único brilho na superfície preto fosco.",
    details: ["Lente óptica", "Dissipador", "Perfil"],
    outroHead: ["Deixa a luz ao espaço,", "e esconde-te no escuro."],
    seriesName: "Foco preto",
  },
  nl: {
    statementHead: ["Licht is het enige", "dat dit armatuur geeft."],
    statementBody:
      "Een matzwarte, reflectievrije behuizing die bewust naar de achtergrond verdwijnt. Hij eist geen aandacht op in de ruimte — hij legt het licht alleen schoon en precies op wat je wilt benadrukken.",
    anatomyEyebrow: "Anatomy · Opbouw",
    anatomyH2: "Haal het uit elkaar: elke laag doet optiek.",
    parts: [
      "Antiverblindingsring",
      "Optische lens",
      "COB-module",
      "Gefacetteerde reflector",
      "Spuitgegoten behuizing",
      "3-fase rail-adapter",
    ],
    lightEyebrow: "Light · Lichtkleur",
    lightH2: "Van warmwit naar koelwit.",
    lightBody:
      "Eén armatuur reikt van kaarswarm wit tot middagkoel wit. De diepe reflector houdt verblinding binnen de rand en werpt een schone, gelijkmatige lichtbundel op het object.",
    lightAlt:
      "Brandende spot, vooraanzicht — warmwit dat uit de gefacetteerde reflector komt.",
    spectrum: ["Warm", "Neutraal", "Koel"],
    finishEyebrow: "Finish · Afwerking",
    finishH2: "Matzwart, reflectievrij – vanuit elke hoek verzorgd.",
    bodyDarkAlt:
      "Spotbehuizing in het donker — één glanslijn op het matzwarte oppervlak.",
    details: ["Optische lens", "Koellichaam", "Profiel"],
    outroHead: [
      "Geef het licht aan de ruimte,",
      "en verberg jezelf in het zwart.",
    ],
    seriesName: "Zwarte spot",
  },
  pl: {
    statementHead: ["Światło to jedyne,", "co daje ten reflektor."],
    statementBody:
      "Matowo-czarny, niedający refleksów korpus, który celowo usuwa się w tło. Nie walczy o uwagę w przestrzeni — po prostu kładzie światło, czysto i precyzyjnie, na tym, co chcesz wyeksponować.",
    anatomyEyebrow: "Anatomy · Budowa",
    anatomyH2: "Rozłóż go: każda warstwa to optyka.",
    parts: [
      "Pierścień antyolśnieniowy",
      "Soczewka optyczna",
      "Moduł COB",
      "Reflektor fasetowany",
      "Odlewany korpus",
      "Adapter szyny 3-fazowej",
    ],
    lightEyebrow: "Light · Barwa światła",
    lightH2: "Od ciepłej bieli do chłodnej.",
    lightBody:
      "Jedna oprawa obejmuje od ciepłej bieli świecy po chłodną biel południa. Głęboki reflektor zatrzymuje olśnienie w obrębie krawędzi i rzuca czystą, równą plamę światła na obiekt.",
    lightAlt:
      "Zapalony reflektor z przodu — ciepła biel rozchodząca się z fasetowanego reflektora.",
    spectrum: ["Ciepła", "Neutralna", "Chłodna"],
    finishEyebrow: "Finish · Wykończenie",
    finishH2: "Matowa czerń, bez refleksów — dopracowany z każdej strony.",
    bodyDarkAlt:
      "Korpus reflektora w ciemności — pojedynczy refleks na matowo-czarnej powierzchni.",
    details: ["Soczewka optyczna", "Radiator", "Sylwetka"],
    outroHead: ["Oddaj światło przestrzeni,", "a sam skryj się w czerni."],
    seriesName: "Czarny reflektor",
  },
};

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

export default function Showcase({ locale }: { locale: string }) {
  const c = COPY[(locale as Locale) in COPY ? (locale as Locale) : "en"];
  // 细节三联标题：英文锚定，非英文前缀本地词（local · English）。
  const caption = (i: number) =>
    locale === "en"
      ? DETAIL_KEYS[i].en
      : `${c.details[i]} · ${DETAIL_KEYS[i].en}`;

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
            {c.statementHead[0]}
            <br />
            {c.statementHead[1]}
          </p>
          <p className="mt-8 max-w-[52ch] text-[16px] leading-[1.75] text-white/55 sm:text-[18px]">
            {c.statementBody}
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
                  {c.anatomyEyebrow}
                </p>
                <h2 className="font-display mt-4 text-[2rem] leading-tight tracking-tight sm:text-[2.8rem]">
                  {c.anatomyH2}
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
              {PART_KEYS.map((p, i) => (
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
                      {c.parts[i]}
                    </p>
                    {locale !== "en" && (
                      <p className="mt-0.5 font-mono text-[10px] uppercase tracking-[0.16em] text-white/35">
                        {p.en}
                      </p>
                    )}
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
                alt={c.lightAlt}
                className="h-full w-full object-cover"
              />
            </div>
          </Reveal>
          <Reveal delay={120}>
            <p
              className="font-mono text-[11px] uppercase tracking-[0.3em]"
              style={{ color: WARM }}
            >
              {c.lightEyebrow}
            </p>
            <h2 className="font-display mt-4 text-[2rem] leading-tight tracking-tight sm:text-[2.8rem]">
              {c.lightH2}
            </h2>
            <p className="mt-6 max-w-[44ch] text-[16px] leading-[1.75] text-white/55 sm:text-[17px]">
              {c.lightBody}
            </p>
            <div className="spectrum-bar mt-10 w-full" />
            <div className="mt-3 flex justify-between font-mono text-[10px] uppercase tracking-[0.2em] text-white/40">
              <span>{c.spectrum[0]}</span>
              <span>{c.spectrum[1]}</span>
              <span>{c.spectrum[2]}</span>
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
              {c.finishEyebrow}
            </p>
            <h2 className="font-display mt-4 max-w-[20ch] text-[2rem] leading-tight tracking-tight sm:text-[2.8rem]">
              {c.finishH2}
            </h2>
          </Reveal>

          {/* 暗场大图 */}
          <Reveal delay={120} className="mt-12">
            <div className="overflow-hidden rounded-2xl border border-white/10">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={`${BASE}/body-dark.webp`}
                alt={c.bodyDarkAlt}
                className="h-full w-full object-cover"
              />
            </div>
          </Reveal>

          {/* 细节三联 */}
          <div className="mt-6 grid grid-cols-1 gap-6 sm:grid-cols-3">
            {DETAIL_KEYS.map((it, i) => (
              <Reveal key={it.src} delay={i * 100}>
                <figure className="overflow-hidden rounded-2xl bg-[#0c0c0c]">
                  <div className="aspect-[4/5] w-full overflow-hidden">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={`${BASE}/${it.src}`}
                      alt={caption(i)}
                      loading="lazy"
                      className="h-full w-full object-cover transition duration-700 hover:scale-[1.04]"
                    />
                  </div>
                  <figcaption className="px-4 py-3 font-mono text-[10px] uppercase tracking-[0.16em] text-white/40">
                    {caption(i)}
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
            {c.outroHead[0]}
            <br />
            {c.outroHead[1]}
          </p>
          <div className="mt-16 flex flex-col gap-3 border-t border-white/10 pt-8 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2.5">
              <LuzdexMark size={20} mono className="text-white/80" />
              <span className="text-[14px] font-semibold tracking-tight text-white/80">
                Luzdex · {c.seriesName}
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
