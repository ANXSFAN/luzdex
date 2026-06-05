/**
 * Curated set of accent colours. Each value is referenced to a real lighting
 * concept so tenants pick something LED-appropriate. The first entry is the
 * platform default (filament amber).
 *
 * Kept in a plain (non-"use client") module so it can be imported safely from
 * both server components and the client picker. Importing a value from a
 * "use client" module on the server yields a client-reference proxy, not the
 * real array.
 */
export const ACCENT_SWATCHES: { value: string; label: string }[] = [
  { value: "oklch(0.78 0.13 78)", label: "Filament" },
  { value: "oklch(0.78 0.10 145)", label: "Phosphor" },
  { value: "oklch(0.78 0.06 220)", label: "Cool White" },
  { value: "oklch(0.75 0.13 60)", label: "Sodium" },
  { value: "oklch(0.55 0.13 245)", label: "Cobalt" },
  { value: "oklch(0.46 0.13 38)", label: "Ember" },
  { value: "oklch(0.30 0.02 240)", label: "Charcoal" },
];
