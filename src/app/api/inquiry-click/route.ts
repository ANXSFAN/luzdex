import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";

const ALLOWED_CHANNELS = new Set(["email", "whatsapp"]);

/**
 * Records an inquiry deep-link click. Called by navigator.sendBeacon from the
 * public product page; never blocks the user. Errors are swallowed silently —
 * analytics must not surface to the buyer.
 */
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as unknown;
    if (!body || typeof body !== "object") {
      return new Response(null, { status: 400 });
    }
    const { productId, channel } = body as Record<string, unknown>;
    if (typeof productId !== "string" || !productId) {
      return new Response(null, { status: 400 });
    }
    if (typeof channel !== "string" || !ALLOWED_CHANNELS.has(channel)) {
      return new Response(null, { status: 400 });
    }

    await prisma.inquiryClick.create({
      data: { productId, channel },
    });
  } catch {
    // Swallow — analytics must not break the public flow.
  }
  return new Response(null, { status: 204 });
}
