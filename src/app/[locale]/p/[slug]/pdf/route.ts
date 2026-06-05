import { renderToBuffer } from "@react-pdf/renderer";
import QRCode from "qrcode";
import { findPublicProductBySlug, parseSpecs, siteUrl } from "@/lib/products";
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

async function fetchCoverBytes(url: string | null): Promise<Uint8Array | null> {
  if (!url) return null;
  try {
    const res = await fetch(url, {
      next: { revalidate: 3600 },
      headers: { Accept: "image/*" },
    });
    if (!res.ok) return null;
    const buf = await res.arrayBuffer();
    return new Uint8Array(buf);
  } catch {
    return null;
  }
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

  const [coverBytes, qrDataUrl] = await Promise.all([
    fetchCoverBytes(product.coverImage),
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
      description: product.description,
      certifications: product.certifications,
      specs: parseSpecs(product.specs),
      coverImageBytes: coverBytes,
      documents: product.documents.map((d) => ({
        title: d.title,
        fileName: d.fileName,
        fileUrl: d.fileUrl,
      })),
      factory: {
        name: product.factory.name,
        brandShort: product.factory.brandShort,
      },
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
