"use client";

import {
  createContext,
  useContext,
  useState,
  useTransition,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { Languages } from "lucide-react";
import { LOCALE_LABELS, LOCALE_ORDER } from "@/i18n/routing";
import { confirmDialog } from "@/components/confirm-dialog";
import { translateShowcase } from "@/app/admin/products/actions";

// 产品编辑页的「当前编辑语言」共享状态：顶部语言栏切换，名称/规格/展示/素材各卡片同步。
// 没有"源语言"概念——任何语言 tab 都平等可编辑；baseLocale 仅作底层回退锚点（对操作员透明）。
type ProductLocaleCtx = {
  editingLocale: string;
  baseLocale: string;
  isBase: boolean;
  switchLocale: (loc: string) => Promise<void>;
};

const Ctx = createContext<ProductLocaleCtx | null>(null);

export function useProductLocale(): ProductLocaleCtx {
  const v = useContext(Ctx);
  if (!v) throw new Error("useProductLocale 必须在 ProductI18nProvider 内使用");
  return v;
}

export function ProductI18nProvider({
  baseLocale,
  children,
}: {
  baseLocale: string;
  children: ReactNode;
}) {
  const s = useTranslations("show");
  const [editingLocale, setEditingLocale] = useState(baseLocale);

  // 切换语言：未保存修改会丢，先确认。各卡片自行在 editingLocale 变化时 reload。
  async function switchLocale(loc: string) {
    if (loc === editingLocale) return;
    if (!(await confirmDialog({ message: s("switchConfirm") }))) return;
    setEditingLocale(loc);
  }

  return (
    <Ctx.Provider
      value={{
        editingLocale,
        baseLocale,
        isBase: editingLocale === baseLocale,
        switchLocale,
      }}
    >
      {children}
    </Ctx.Provider>
  );
}

/**
 * 顶部统一语言栏：语言 tab + AI 翻译按钮。
 * 翻译以「当前 tab 语言」为基准，覆盖其余所有语言。
 */
export function ProductLocaleBar({
  productId,
  translatedLocales,
  translationStale,
}: {
  productId: string;
  translatedLocales: string[];
  translationStale: boolean;
}) {
  const { editingLocale, baseLocale, switchLocale } = useProductLocale();
  const s = useTranslations("show");
  const tc = useTranslations("admin.common");
  const router = useRouter();
  const [pending, start] = useTransition();

  const hasContent = (loc: string) =>
    loc === baseLocale || translatedLocales.includes(loc);

  async function translate() {
    const lang =
      LOCALE_LABELS[editingLocale as keyof typeof LOCALE_LABELS] ??
      editingLocale;
    if (!(await confirmDialog({ message: s("transFromConfirm", { lang }) })))
      return;
    start(async () => {
      try {
        const r = await translateShowcase(productId, editingLocale);
        toast.success(s("transDoneCount", { ok: r.ok, total: r.total }));
        router.refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : tc("transFail"));
      }
    });
  }

  return (
    <section className="sticky top-0 z-20 mt-6 rounded-2xl border border-[var(--color-rule)] bg-[var(--color-surface)]/95 p-4 backdrop-blur">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="mr-1 font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--color-ink-muted)]">
            {s("editLang")}
          </span>
          {LOCALE_ORDER.map((loc) => {
            const isCur = loc === editingLocale;
            const has = hasContent(loc);
            return (
              <button
                key={loc}
                type="button"
                onClick={() => switchLocale(loc)}
                className={`rounded-full border px-2.5 py-1 text-[12px] transition ${
                  isCur
                    ? "border-[var(--color-ink)] bg-[var(--color-ink)] text-[var(--color-surface)]"
                    : has
                      ? "border-[var(--color-rule-strong)] text-[var(--color-ink-soft)] hover:border-[var(--color-ink)]"
                      : "border-[var(--color-rule)] text-[var(--color-ink-faint)] hover:border-[var(--color-ink)]"
                }`}
              >
                {LOCALE_LABELS[loc]}
              </button>
            );
          })}
        </div>
        <button
          type="button"
          onClick={translate}
          disabled={pending}
          className="flex shrink-0 items-center gap-1.5 rounded-lg border border-[var(--color-ink)] px-3.5 py-2 text-sm font-medium text-[var(--color-ink)] transition hover:bg-[var(--color-ink)] hover:text-[var(--color-surface)] disabled:opacity-50"
        >
          <Languages className="h-4 w-4" />
          {pending ? s("aiTransing") : s("aiTransBtn")}
        </button>
      </div>
      <p className="mt-2 text-[11px] text-[var(--color-ink-faint)]">
        {s("editLangHint")}
      </p>
      {translationStale && (
        <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-[12px] text-amber-700">
          {s("staleWarn")}
        </p>
      )}
    </section>
  );
}
