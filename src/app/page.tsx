import { ScanLine, ArrowDownRight } from "lucide-react";
import { SiteSearch } from "@/components/site-search";

export default function Home() {
  return (
    <>
      {/* Top bar */}
      <header className="glass-nav fixed inset-x-0 top-0 z-20 border-b border-[var(--color-rule)]">
        <div className="mx-auto flex h-12 max-w-[1240px] items-center justify-between px-5 sm:px-10">
          <div className="flex items-center gap-2.5">
            <CloudMark />
            <span className="font-mono text-[11px] font-medium uppercase tracking-[0.22em] text-[var(--color-ink)]">
              Cloud
            </span>
            <span className="hidden font-mono text-[10px] uppercase tracking-[0.22em] text-[var(--color-ink-faint)] sm:inline">
              · Datasheet Portal
            </span>
          </div>
          <div className="flex items-center gap-3">
            <SiteSearch />
            <span className="hidden font-mono text-[10px] uppercase tracking-[0.22em] text-[var(--color-ink-muted)] md:inline">
              White-label · 2026
            </span>
          </div>
        </div>
      </header>

      <main className="relative mx-auto min-h-screen max-w-[1240px] px-5 pb-16 pt-16 sm:px-10 sm:pt-20 lg:pt-28">
        <div className="grid grid-cols-1 gap-y-10 lg:grid-cols-12 lg:gap-x-10 lg:gap-y-12">
          {/* Left rail — pushed below the hero on mobile */}
          <aside className="order-3 lg:order-1 lg:col-span-3 lg:pt-4">
            <div className="rise-in" data-step="1">
              <p className="kicker">
                <span className="kicker-mark">/</span>
                <span>00 · Access Note</span>
              </p>
              <p className="mt-2 text-[13px] text-[var(--color-ink-muted)]">
                访问说明
              </p>
              <div className="mt-4 h-px w-12 bg-[var(--color-rule-strong)]" />
              <p className="mt-5 max-w-[18rem] text-[13px] leading-relaxed text-[var(--color-ink-soft)]">
                This portal is indexed by physical QR markers only.
                There is no public catalogue.
              </p>
            </div>

            <div className="mt-12 rise-in" data-step="2">
              <p className="kicker">
                <span className="kicker-mark">/</span>
                <span>Platform</span>
              </p>
              <dl className="mt-3 space-y-2 font-mono text-[11px] text-[var(--color-ink-soft)]">
                <Meta k="Service" v="Datasheet · SaaS" />
                <Meta k="Tenants" v="Multi-brand" />
                <Meta k="Revision" v="2026.05" />
              </dl>
            </div>
          </aside>

          {/* Center — hero (first on mobile) */}
          <section className="order-1 lg:order-2 lg:col-span-6 lg:pt-2">
            <p className="kicker rise-in" data-step="1">
              <span className="dot-filament" aria-hidden />
              <span>Datasheet Portal · 资料门户</span>
            </p>

            <h1
              className="headline-xl mt-6 text-[48px] leading-[1.02] text-[var(--color-ink)] sm:mt-7 sm:text-[80px] lg:text-[120px] rise-in"
              data-step="2"
            >
              Scan to retrieve
              <br />
              the datasheet.
            </h1>

            {/* Spectrum bar — the one place we admit colour */}
            <div className="mt-10 flex items-center gap-3 rise-in" data-step="3">
              <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-[var(--color-ink-muted)]">
                2700 K
              </span>
              <div className="spectrum-bar flex-1" />
              <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-[var(--color-ink-muted)]">
                6500 K
              </span>
            </div>

            <div
              className="mt-10 flex items-start gap-4 rise-in"
              data-step="3"
            >
              <ScanLine
                className="mt-1 h-5 w-5 shrink-0 text-[var(--color-ink-muted)]"
                strokeWidth={1.25}
              />
              <p className="max-w-[36rem] text-[15px] leading-relaxed text-[var(--color-ink-soft)]">
                Each product carries a printed QR mark linking to its current
                specifications, certificates, installation manuals, and
                reference media. Scan the mark with any camera-equipped
                device to open the page bound to that unit.
              </p>
            </div>

            <div
              className="mt-6 flex items-start gap-4 rise-in"
              data-step="4"
            >
              <span className="mt-1 font-mono text-[10px] font-medium uppercase tracking-[0.22em] text-[var(--color-ink)]">
                ZH
              </span>
              <p className="max-w-[36rem] text-[15px] leading-relaxed text-[var(--color-ink-soft)]">
                每件产品都印有一枚二维码，指向该型号当前的规格书、认证、安装手册及参考媒体。
                请使用任意支持摄像头的设备扫描即可查看。
              </p>
            </div>
          </section>

          {/* Right rail — Index sits right under the hero on mobile */}
          <aside className="order-2 lg:order-3 lg:col-span-3 lg:pt-4">
            <div className="rise-in" data-step="4">
              <div className="flex items-baseline justify-between border-b border-[var(--color-rule-strong)] pb-2">
                <p className="kicker kicker-dark">
                  <span className="kicker-mark">/</span>
                  <span>Index</span>
                </p>
                <span className="font-mono text-[10px] text-[var(--color-ink-muted)]">
                  04
                </span>
              </div>
              <ul className="mt-2 divide-y divide-[var(--color-rule)]">
                <IndexRow no="01" zh="规格书" en="Datasheets" />
                <IndexRow no="02" zh="安装手册" en="Installation" />
                <IndexRow no="03" zh="认证证书" en="Certificates" />
                <IndexRow no="04" zh="参考视频" en="Reference Media" />
              </ul>
            </div>

            <div
              className="mt-10 rounded-2xl border border-[var(--color-rule)] bg-[var(--color-surface-sunken)] p-5 rise-in"
              data-step="5"
            >
              <p className="kicker">
                <span>QR damaged?</span>
              </p>
              <p className="mt-2 text-[12px] leading-relaxed text-[var(--color-ink-soft)]">
                Each datasheet is owned by its manufacturer.
                If a mark is unreadable, contact the company printed on
                the product packaging — they hold the authoritative record.
              </p>
              <div className="mt-3 flex items-center gap-1.5 font-mono text-[10px] text-[var(--color-ink-muted)]">
                <ArrowDownRight className="h-3 w-3" />
                <span>Multi-tenant · White-label SaaS</span>
              </div>
            </div>
          </aside>
        </div>

        {/* Bottom marginalia */}
        <div className="mt-24 border-t border-[var(--color-rule)] pt-5 rise-in" data-step="6">
          <div className="flex flex-col items-start justify-between gap-3 font-mono text-[10px] uppercase tracking-[0.22em] text-[var(--color-ink-muted)] sm:flex-row sm:items-center">
            <span>Cloud · Datasheet Portal · 2026</span>
            <span className="flex items-center gap-3">
              <span className="hidden sm:inline">Access by scan only</span>
              <span className="text-[var(--color-ink-faint)]">·</span>
              <span>Page 01 / 01</span>
            </span>
          </div>
        </div>
      </main>
    </>
  );
}

function Meta({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="uppercase tracking-[0.18em] text-[var(--color-ink-muted)]">
        {k}
      </dt>
      <dd className="text-[var(--color-ink)]">{v}</dd>
    </div>
  );
}

function IndexRow({ no, zh, en }: { no: string; zh: string; en: string }) {
  return (
    <li className="flex items-baseline gap-3 py-2.5 font-sans text-[13px] text-[var(--color-ink)]">
      <span className="font-mono text-[10px] text-[var(--color-ink-muted)]">
        {no}
      </span>
      <span className="flex-1">{zh}</span>
      <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--color-ink-muted)]">
        {en}
      </span>
    </li>
  );
}

function CloudMark() {
  return (
    <svg
      width="20"
      height="14"
      viewBox="0 0 20 14"
      aria-hidden
      className="text-[var(--color-ink)]"
    >
      <path
        d="M14.8 12.8H4.4c-2.1 0-3.9-1.6-3.9-3.8 0-1.9 1.4-3.5 3.2-3.8 0.3-2.6 2.5-4.6 5.2-4.6 2.4 0 4.4 1.6 5 3.7 0.2 0 0.4-0.1 0.6-0.1 2.2 0 4 1.8 4 4 0 2.6-2 4.6-4.7 4.6Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.1"
        strokeLinejoin="round"
      />
      <circle cx="9.5" cy="7" r="1.6" fill="currentColor" />
    </svg>
  );
}
