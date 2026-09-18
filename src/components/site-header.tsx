"use client";

// Main navigation links with active-state highlighting (client component).
import Link from "next/link";
import { usePathname } from "next/navigation";

export type NavItem = { href: string; label: string };

export function NavLinks({ items }: { items: NavItem[] }) {
  const pathname = usePathname();
  return (
    <nav className="hidden items-center gap-1 md:flex" aria-label="ناوبری اصلی">
      {items.map((item) => {
        const active =
          item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`rounded-xl px-3.5 py-2 text-sm font-bold transition-colors ${
              active
                ? "bg-indigo-50 text-indigo-700"
                : "text-stone-500 hover:bg-stone-100 hover:text-stone-800"
            }`}
            aria-current={active ? "page" : undefined}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

/** Horizontal scroller of nav links for small screens. */
export function MobileNavLinks({ items }: { items: NavItem[] }) {
  const pathname = usePathname();
  return (
    <nav
      className="flex gap-1 overflow-x-auto border-t border-stone-100 px-3 py-2 md:hidden"
      aria-label="ناوبری موبایل"
    >
      {items.map((item) => {
        const active =
          item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`shrink-0 rounded-lg px-3 py-1.5 text-sm font-bold ${
              active ? "bg-indigo-50 text-indigo-700" : "text-stone-500"
            }`}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
