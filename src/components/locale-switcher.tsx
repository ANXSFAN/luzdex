import { LOCALE_LABELS, type AppLocale } from "@/i18n/routing";
import { Link } from "@/i18n/navigation";

/**
 * Tenant-aware locale switcher. Shows only the locales the factory has opted
 * into; current locale is rendered as plain text (not a link). Used in the
 * product page header so the link target always points to the same product.
 */
export function LocaleSwitcher({
  current,
  supported,
  slug,
}: {
  current: AppLocale;
  supported: readonly AppLocale[];
  slug: string;
}) {
  if (supported.length < 2) return null;

  return (
    <span
      className="ml-1 flex items-center gap-1 font-mono text-[10px] uppercase tracking-[0.22em]"
      aria-label="Language"
    >
      <span className="hidden text-[var(--color-ink-faint)] sm:inline">/</span>
      {supported.map((loc, i) => {
        const isCurrent = loc === current;
        return (
          <span key={loc} className="flex items-center gap-1">
            {i > 0 && (
              <span
                aria-hidden
                className="text-[var(--color-ink-faint)]"
              >
                ·
              </span>
            )}
            {isCurrent ? (
              <span
                aria-current="true"
                className="inline-flex items-center px-1 py-2 text-[var(--color-ink)]"
              >
                {LOCALE_LABELS[loc]}
              </span>
            ) : (
              <Link
                href={`/p/${slug}`}
                locale={loc}
                className="inline-flex items-center px-1 py-2 text-[var(--color-ink-muted)] transition hover:text-[var(--color-ink)]"
              >
                {LOCALE_LABELS[loc]}
              </Link>
            )}
          </span>
        );
      })}
    </span>
  );
}
