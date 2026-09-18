// Server-side pagination bar. Preserves current search params via buildQuery.
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { buildQuery } from "@/lib/queries";
import { faDigits } from "@/lib/format";

export default function Pagination({
  page,
  totalPages,
  params,
}: {
  page: number;
  totalPages: number;
  params: Record<string, string | undefined>;
}) {
  if (totalPages <= 1) return null;

  // Window of up to 5 page numbers around the current page.
  const start = Math.max(1, Math.min(page - 2, totalPages - 4));
  const end = Math.min(totalPages, start + 4);
  const pages: number[] = [];
  for (let i = start; i <= end; i++) pages.push(i);

  const itemCls =
    "grid size-9 place-items-center rounded-xl text-sm font-bold transition-colors";
  const normal = "text-stone-500 hover:bg-stone-100";
  const active = "bg-indigo-600 text-white shadow-sm shadow-indigo-600/30";

  return (
    <nav className="mt-6 flex items-center justify-center gap-1.5" aria-label="صفحه‌بندی">
      {page > 1 ? (
        <Link
          href={buildQuery(params, { page: page - 1 })}
          className={`${itemCls} ${normal}`}
          aria-label="صفحهٔ قبل"
        >
          {/* In RTL, "previous" points to the right */}
          <ChevronRight className="size-4" />
        </Link>
      ) : null}
      {pages.map((p) => (
        <Link
          key={p}
          href={buildQuery(params, { page: p })}
          className={`${itemCls} ${p === page ? active : normal}`}
          aria-current={p === page ? "page" : undefined}
        >
          {faDigits(p)}
        </Link>
      ))}
      {page < totalPages ? (
        <Link
          href={buildQuery(params, { page: page + 1 })}
          className={`${itemCls} ${normal}`}
          aria-label="صفحهٔ بعد"
        >
          <ChevronLeft className="size-4" />
        </Link>
      ) : null}
    </nav>
  );
}
