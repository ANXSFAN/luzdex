import { renderToBuffer } from "@react-pdf/renderer";
import QRCode from "qrcode";
import { findPublicProductBySlug, parseSpecs, siteUrl } from "@/lib/products";
import { pdfOf } from "@/lib/images";
import { stripMarkdown } from "@/lib/md";
import { ProductPdf } from "@/lib/pdf-template";
import { routing } from "@/i18n/routing";

export const runtime = "nodejs";
// Server cache 60s for the same product — high-frequency print requests
// should not re-render the PDF every time.
export const revalidate = 60;

function makeDocRef(slug: string) {
  let h = 0;
  for (let i = 0; i < slug.length; i++) h = (h * 31 + slug.charCodeAt(i)) >>> 0;
  return h.toString(36).toUpperCase().padStart(6, "0").slice(0, 6);
}

function fmtDate(d: Date) {
  return new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

/**
 * @react-pdf/renderer 只能解码 PNG / JPEG，且必须告知正确 format。按 magic bytes
 * 判定真实格式：传错（如把 PNG 当 jpg）会解码失败、PDF 里只剩一个空框。
 * webp / avif / gif / svg 等返回 null（react-pdf 渲染不了，宁可不画也别留空框）。
 */
function detectImageFormat(b: Uint8Array): "png" | "jpg" | null {
  if (
    b.length >= 4 &&
    b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47
  ) {
    return "png";
  }
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) {
    return "jpg";
  }
  return null;
}

async function fetchOne(
  url: string,
): Promise<{ data: Uint8Array; format: "png" | "jpg" } | null> {
  try {
    const res = await fetch(url, {
      next: { revalidate: 3600 },
      headers: { Accept: "image/*" },
    });
    if (!res.ok) return null;
    const data = new Uint8Array(await res.arrayBuffer());
    const format = detectImageFormat(data);
    return format ? { data, format } : null;
  } catch {
    return null;
  }
}

/**
 * 封面：优先取缩小白底 JPEG 变体(_pdf.jpg)——体积小、react-pdf 直接能解；
 * 变体不存在(老图未回填 / 外链)时回退原图。原图 WebP/avif 仍会被 detectImageFormat 拦掉。
 */
async function fetchCover(
  url: string | null,
): Promise<{ data: Uint8Array; format: "png" | "jpg" } | null> {
  if (!url) return null;
  const preferred = pdfOf(url);
  if (preferred && preferred !== url) {
    const v = await fetchOne(preferred);
    if (v) return v;
  }
  return fetchOne(url);
}

interface RouteContext {
  params: Promise<{ locale: string; slug: string }>;
}

export async function GET(_req: Request, ctx: RouteContext) {
  const { locale, slug } = await ctx.params;
  const product = await findPublicProductBySlug(slug);
  if (!product) {
    return new Response("Not found", { status: 404 });
  }

  // QR points back to the localized public page so scanning preserves language.
  const localePrefix = locale === routing.defaultLocale ? "" : `/${locale}`;
  const url = `${siteUrl()}${localePrefix}/p/${product.slug}`;
  const docRef = makeDocRef(product.slug);
  const updated = fmtDate(product.syncedAt);

  const [cover, qrDataUrl] = await Promise.all([
    fetchCover(product.coverImage),
    QRCode.toDataURL(url, {
      margin: 0,
      width: 240,
      errorCorrectionLevel: "M",
      color: { dark: "#262626", light: "#ffffff" },
    }),
  ]);

  const buffer = await renderToBuffer(
    ProductPdf({
      name: product.name,
      modelNumber: product.modelNumber,
      description: product.description ? stripMarkdown(product.description) : null,
      certifications: product.certifications,
      specs: parseSpecs(product.specs),
      coverImage: cover,
      documents: product.documents.map((d) => ({
        title: d.title,
        fileName: d.fileName,
        fileUrl: d.fileUrl,
      })),
      url,
      docRef,
      updated,
      qrDataUrl,
    })
  );

  const safeModel = product.modelNumber.replace(/[^\w.-]+/g, "_");
  const filename = `${safeModel}__${docRef}.pdf`;

  return new Response(buffer as unknown as BodyInit, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${filename}"`,
      "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300",
    },
  });
}
