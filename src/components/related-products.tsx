import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { ArrowUpRight } from "lucide-react";
import { getPathname } from "@/i18n/navigation";
import type { AppLocale } from "@/i18n/routing";
import type { RelatedItem, RelatedAccessory } from "@/lib/products";

const KNOWN_CATS = new Set(["strip", "channel", "power", "connector", "accessory"]);

/**
 * 产品页「相关产品」：同系列 + 适配配件两组横向卡片。
 * 同租户内、只读展示，点击跳到对应产品页（带 locale 前缀），打通浏览动线。
 */
export async function RelatedProducts({
  siblings,
  accessories,
  locale,
}: {
  siblings: RelatedItem[];
  accessories: RelatedAccessory[];
  locale: AppLocale;
}) {
  const t = await getTranslations("product.related");
  const catLabel = (category: string | null) =>
    category && KNOWN_CATS.has(category)
      ? t(("cat." + category) as Parameters<typeof t>[0])
      : null;

  return (
    <div className="space-y-12">
      {siblings.length > 0 && (
        <Group title={t("seriesLabel")} sub={t("seriesSub")} count={siblings.length}>
          {siblings.map((p) => (
            <Card key={p.id} item={p} locale={locale} catLabel={catLabel(p.category)} />
          ))}
        </Group>
      )}
      {accessories.length > 0 && (
        <Group
          title={t("accessoriesLabel")}
          sub={t("accessoriesSub")}
          count={accessories.length}
        >
          {accessories.map((p) => (
            <Card key={p.id} item={p} locale={locale} catLabel={catLabel(p.category)} />
          ))}
        </Group>
      )}
    </div>
  );
}

function Group({
  title,
  sub,
  count,
  children,
}: {
  title: string;
  sub: string;
  count: number;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="mb-4 flex items-baseline gap-3">
        <span className="dot-filament" aria-hidden />
        <span className="font-mono text-[10px] font-medium uppercase tracking-[0.22em] text-[var(--color-ink)]">
          {title}
        </span>
        <span className="text-[12px] text-[var(--color-ink-muted)]">{sub}</span>
        <span className="h-px flex-1 bg-[var(--color-rule)]" />
        <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-[var(--color-ink-muted)]">
          {String(count).padStart(2, "0")}
        </span>
      </div>
      {/* 京东式横滑推荐：移动端可左右滑动浏览，卡片定宽不挤压 */}
      <div className="-mx-5 flex snap-x snap-mandatory gap-3 overflow-x-auto px-5 pb-2 sm:mx-0 sm:gap-4 sm:px-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {children}
      </div>
    </div>
  );
}

function Card({
  item,
  locale,
  catLabel,
}: {
  item: RelatedItem;
  locale: AppLocale;
  catLabel: string | null;
}) {
  const href = getPathname({ href: `/p/${item.slug}`, locale });
  return (
    <Link
      href={href}
      className="group block w-[148px] shrink-0 snap-start sm:w-[176px] lg:w-[200px]"
    >
      <div className="relative aspect-[4/3] overflow-hidden rounded-xl border border-[var(--color-rule)] bg-[var(--color-surface-sunken)]">
        {item.coverImage ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={item.coverImage}
            alt={item.name}
            className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center font-mono text-[10px] uppercase tracking-[0.22em] text-[var(--color-ink-faint)]">
            No image
          </div>
        )}
        {catLabel && (
          <span className="absolute left-2 top-2 rounded-full border border-[var(--color-rule)] bg-[var(--color-surface)]/85 px-2 py-0.5 font-mono text-[9px] font-medium uppercase tracking-[0.16em] text-[var(--color-ink-soft)] backdrop-blur">
            {catLabel}
          </span>
        )}
        <span className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full bg-[var(--color-ink)] text-white opacity-0 transition group-hover:opacity-100 [@media(hover:none)]:opacity-100">
          <ArrowUpRight className="h-3.5 w-3.5" strokeWidth={1.5} />
        </span>
      </div>
      <p className="mt-2.5 truncate font-mono text-[10px] font-medium uppercase tracking-[0.16em] text-[var(--color-ink-muted)]">
        {item.modelNumber}
      </p>
      <p className="mt-0.5 truncate text-[14px] font-medium text-[var(--color-ink)] transition group-hover:text-[var(--color-accent)]">
        {item.name}
      </p>
    </Link>
  );
}
