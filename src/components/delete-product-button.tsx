"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { deleteProduct } from "@/app/admin/products/actions";

export function DeleteProductButton({
  productId,
  productName,
}: {
  productId: string;
  productName: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();

  function onDelete() {
    if (
      !window.confirm(
        `确定删除「${productName}」？\n图片 / 文档 / 视频 / 配件关系 / 扫码记录都会一并删除，且不可恢复。`,
      )
    )
      return;
    start(async () => {
      try {
        await deleteProduct(productId);
        toast.success("产品已删除");
        router.push("/admin/products");
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "删除失败");
      }
    });
  }

  return (
    <section className="mt-6 rounded-2xl border border-red-200 bg-red-50/40 p-6">
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0">
          <p className="text-[13px] font-medium text-red-700">删除产品</p>
          <p className="mt-0.5 text-[11px] text-red-600/80">
            连带清除该产品的图片 / 文档 / 视频 / 关系 / 统计数据，不可恢复。
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
          删除此产品
        </button>
      </div>
    </section>
  );
}
