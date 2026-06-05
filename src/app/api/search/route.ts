import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";

const MAX_RESULTS = 8;
const MIN_LEN = 2;

/**
 * Public model-number search. Intentionally narrow:
 * only modelNumber, only active tenants, capped at MAX_RESULTS.
 * This is a fallback for damaged QR codes, not a catalogue.
 */
export async function GET(req: NextRequest) {
  const q = (req.nextUrl.searchParams.get("q") ?? "").trim();
  if (q.length < MIN_LEN) {
    return Response.json({ q, results: [] });
  }

  const rows = await prisma.product.findMany({
    where: {
      factory: { isActive: true },
      modelNumber: { contains: q, mode: "insensitive" },
    },
    select: {
      slug: true,
      modelNumber: true,
      name: true,
      factory: { select: { brandShort: true, name: true } },
    },
    orderBy: { modelNumber: "asc" },
    take: MAX_RESULTS,
  });

  const results = rows.map((p) => ({
    slug: p.slug,
    modelNumber: p.modelNumber,
    name: p.name,
    brand: p.factory.brandShort ?? p.factory.name,
  }));

  return Response.json({ q, results });
}
