"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Copy, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { duplicateProduct } from "@/app/admin/products/actions";

/** 编辑页头部「复制产品」：复制全部内容后直接跳到副本编辑页改细节。 */
export function DuplicateProductButton({ productId }: { productId: string }) {
  const router = useRouter();
  const t = useTranslations();
  const [pending, start] = useTransition();

  function run() {
    start(async () => {
      try {
        const id = await duplicateProduct({ productId });
        toast.success(t("prod.duplicatedOk"));
        router.push(`/admin/products/${id}`);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Error");
      }
    });
  }

  return (
    <button
      type="button"
      onClick={run}
      disabled={pending}
      className="flex shrink-0 items-center gap-1.5 text-xs text-[var(--color-ink-muted)] transition hover:text-[var(--color-ink)] disabled:opacity-50"
    >
      {pending ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
      ) : (
        <Copy className="h-3.5 w-3.5" />
      )}
      {t("prod.duplicate")}
    </button>
  );
}
