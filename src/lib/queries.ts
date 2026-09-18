// Shared query helpers and lightly-cached reference data.
import { unstable_cache } from "next/cache";
import { asc } from "drizzle-orm";
import { db } from "@/db";
import { categories } from "@/db/schema";

/** Categories change rarely — cache and invalidate via the `categories` tag. */
export const getCategories = unstable_cache(
  async () =>
    db
      .select({ id: categories.id, name: categories.name })
      .from(categories)
      .orderBy(asc(categories.name)),
  ["categories-all"],
  { tags: ["categories"], revalidate: 300 },
);

/** Shape of resolved search params in server components (Next 15/16 async API). */
export type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export function first(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

/**
 * Merge current search params with overrides and produce a query string.
 * Empty / undefined values remove the key entirely.
 */
export function buildQuery(
  current: Record<string, string | undefined>,
  overrides: Record<string, string | number | undefined>,
): string {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(current)) {
    if (v) sp.set(k, v);
  }
  for (const [k, v] of Object.entries(overrides)) {
    if (v === undefined || v === "") sp.delete(k);
    else sp.set(k, String(v));
  }
  const s = sp.toString();
  return s ? `?${s}` : "";
}

/** Normalize a positive integer page number. */
export function pageOf(v: string | undefined): number {
  const n = Number(v);
  return Number.isInteger(n) && n > 0 ? n : 1;
}
