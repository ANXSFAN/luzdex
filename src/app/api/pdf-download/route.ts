import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { normalizeSource } from "@/lib/channel";

/**
 * Records a datasheet PDF download. Called by navigator.sendBeacon from the
 * public product page (the PDF route itself is cached 60s and would undercount).
 * Never blocks the user; errors are swallowed silently.
 */
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as unknown;
    if (!body || typeof body !== "object") {
      return new Response(null, { status: 400 });
    }
    const { productId, source } = body as Record<string, unknown>;
    if (typeof productId !== "string" || !productId) {
      return new Response(null, { status: 400 });
    }

    await prisma.pdfDownload.create({
      data: {
        productId,
        source: normalizeSource(typeof source === "string" ? source : null),
      },
    });
  } catch {
    // Swallow — analytics must not break the public flow.
  }
  return new Response(null, { status: 204 });
}
