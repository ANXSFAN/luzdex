"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { deleteProduct } from "@/app/admin/products/actions";
import { confirmDialog } from "@/components/confirm-dialog";

export function DeleteProductButton({
  productId,
  productName,
}: {
  productId: string;
  productName: string;
}) {
  const router = useRouter();
  const t = useTranslations();
  const [pending, start] = useTransition();

  async function onDelete() {
    if (
      !(await confirmDialog({
        title: t("prod.deleteTitle"),
        message: `${productName}\n${t("prod.deleteSub")}`,
        confirmText: t("prod.deleteBtn"),
        danger: true,
      }))
    )
      return;
    start(async () => {
      try {
        await deleteProduct(productId);
        toast.success(t("prod.deleteBtn"));
        router.push("/admin/products");
      } catch (e) {
        toast.error(e instanceof Error ? e.message : t("admin.common.delete"));
      }
    });
  }

  return (
    <section className="mt-6 rounded-2xl border border-red-200 bg-red-50/40 p-6">
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0">
          <p className="text-[13px] font-medium text-red-700">{t("prod.deleteTitle")}</p>
          <p className="mt-0.5 text-[11px] text-red-600/80">
            {t("prod.deleteSub")}
          </p>
        </div>
        <button
          type="button"
          onClick={onDelete}
          disabled={pending}
          className="flex shrink-0 items-center gap-1.5 rounded-lg border border-red-300 px-4 py-2 text-sm font-medium text-red-700 transition hover:bg-red-600 hover:text-white disabled:opacity-50"
        >
          {pending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Trash2 className="h-4 w-4" />
          )}
          {t("prod.deleteBtn")}
        </button>
      </div>
    </section>
  );
}
