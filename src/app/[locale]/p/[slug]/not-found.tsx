import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";

export default async function NotFound() {
  const locale = await getLocale();
  const t = await getTranslations("notFound");
  return (
    <main className="relative mx-auto flex min-h-screen max-w-[1240px] flex-col px-5 pb-16 pt-20 sm:px-10 sm:pt-28">
      <header className="glass-nav fixed inset-x-0 top-0 z-20 border-b border-[var(--color-rule)]">
        <div className="mx-auto flex h-12 max-w-[1240px] items-center justify-between px-5 sm:px-10">
          <span className="font-mono text-[11px] font-medium uppercase tracking-[0.22em] text-[var(--color-ink)]">
            Cloud
          </span>
          <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-[var(--color-ink-muted)]">
            Datasheet · Not found
          </span>
        </div>
      </header>

      <div className="grid grow grid-cols-1 items-start gap-y-10 lg:grid-cols-12 lg:gap-x-10 lg:pt-10">
        <div className="lg:col-span-3">
          <p className="headline-xl text-[44px] leading-none text-[var(--color-ink-faint)]">
            404
          </p>
          <p className="kicker mt-4">
            <span>Record not found</span>
          </p>
          {locale !== "en" && (
            <p className="mt-1 text-[13px] text-[var(--color-ink-muted)]">
              {t("title")}
            </p>
          )}
        </div>

        <div className="lg:col-span-9">
          <p className="kicker">
            <span>Lookup result</span>
          </p>
          <h1 className="headline-xl mt-4 text-[44px] leading-[1.03] text-[var(--color-ink)] sm:text-[64px] lg:text-[78px]">
            No datasheet matches
            <br />
            this reference.
          </h1>

          <p className="mt-8 max-w-[36rem] text-[15px] leading-relaxed text-[var(--color-ink-soft)]">
            The QR mark you scanned may be from a discontinued unit, a
            development prototype, or a counterfeit. Please verify the
            reference printed on the product label, or contact the
            manufacturer printed on the packaging.
          </p>

          {locale !== "en" && (
            <p className="mt-3 max-w-[36rem] text-[15px] leading-relaxed text-[var(--color-ink-soft)]">
              {t("desc")}
            </p>
          )}

          <div className="mt-10">
            <Link href="/" className="appbtn">
              Return to portal
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
