import { renderToBuffer } from "@react-pdf/renderer";
import QRCode from "qrcode";
import { prisma } from "@/lib/prisma";
import { getActiveFactory } from "@/lib/active-factory";
import { siteUrl } from "@/lib/products";
import { normalizeSource } from "@/lib/channel";
import { QrSheetPdf, type QrSheetItem } from "@/lib/qr-sheet";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function fmtDate(d: Date) {
  return new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

/**
 * GET /admin/qr-export?source=<code>
 * 导出「当前工厂」全部产品的二维码联系表（可打印 PDF 网格）。
 * 每个 QR 指向 /p/{slug}?s=<source>，扫码后产品页按 source 归因统计。
 */
export async function GET(req: Request) {
  const factory = await getActiveFactory();
  if (!factory) {
    return new Response("No active factory", { status: 400 });
  }

  const source = normalizeSource(
    new URL(req.url).searchParams.get("source")
  );

  const products = await prisma.product.findMany({
    where: { factoryId: factory.id },
    orderBy: { modelNumber: "asc" },
    select: { slug: true, modelNumber: true },
  });

  if (products.length === 0) {
    return new Response("No products to export", { status: 400 });
  }

  const base = siteUrl();
  const query = source ? `?s=${source}` : "";
  const items: QrSheetItem[] = await Promise.all(
    products.map(async (p) => ({
      slug: p.slug,
      modelNumber: p.modelNumber,
      qrDataUrl: await QRCode.toDataURL(`${base}/p/${p.slug}${query}`, {
        margin: 0,
        width: 232,
        errorCorrectionLevel: "M",
        color: { dark: "#262626", light: "#ffffff" },
      }),
    }))
  );

  const buffer = await renderToBuffer(
    QrSheetPdf({
      factoryName: factory.name,
      source,
      dateStr: fmtDate(new Date()),
      items,
    })
  );

  const safe = (s: string) => s.replace(/[^\w.-]+/g, "_");
  const filename = `${safe(factory.slug)}-qr${source ? `-${safe(source)}` : ""}.pdf`;

  return new Response(buffer as unknown as BodyInit, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
