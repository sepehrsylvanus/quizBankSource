"use client";

// Admin sidebar navigation with active-state highlighting.
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ExternalLink,
  FileQuestion,
  GraduationCap,
  Inbox,
  Layers,
  LayoutDashboard,
  PenSquare,
  type LucideIcon,
} from "lucide-react";

type Item = { href: string; label: string; icon: LucideIcon; badge?: number };

const BASE_ITEMS: Item[] = [
  { href: "/admin", label: "داشبورد", icon: LayoutDashboard },
  { href: "/admin/questions", label: "بانک سؤالات", icon: FileQuestion },
  { href: "/admin/quizzes", label: "مدیریت آزمون‌ها", icon: Layers },
  { href: "/admin/grading", label: "صف تصحیح", icon: PenSquare },
  { href: "/admin/requests", label: "درخواست‌ها", icon: Inbox },
];

export default function AdminNav({
  pendingGrading,
  pendingRequests,
}: {
  pendingGrading: number;
  pendingRequests: number;
}) {
  const pathname = usePathname();
  const items: Item[] = BASE_ITEMS.map((i) =>
    i.href === "/admin/grading"
      ? { ...i, badge: pendingGrading }
      : i.href === "/admin/requests"
        ? { ...i, badge: pendingRequests }
        : i,
  );

  return (
    <nav className="flex h-full flex-col" aria-label="ناوبری مدیریت">
      <Link href="/admin" className="mb-6 flex items-center gap-2.5 px-2">
        <span className="grid size-10 place-items-center rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-500 text-white shadow-lg shadow-indigo-500/30">
          <GraduationCap className="size-5" />
        </span>
        <div>
          <div className="text-sm font-extrabold text-white">پنل مدیریت</div>
          <div className="text-[10px] text-indigo-300/70">بانک سؤال</div>
        </div>
      </Link>

      <div className="flex-1 space-y-1">
        {items.map((item) => {
          const active =
            item.href === "/admin"
              ? pathname === "/admin"
              : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-bold transition-colors ${
                active
                  ? "bg-white/10 text-white"
                  : "text-indigo-200/70 hover:bg-white/5 hover:text-white"
              }`}
              aria-current={active ? "page" : undefined}
            >
              <item.icon className="size-4.5 shrink-0" />
              <span className="flex-1">{item.label}</span>
              {item.badge ? (
                <span className="grid min-w-6 place-items-center rounded-full bg-amber-400 px-1.5 py-0.5 text-[11px] font-black text-amber-950">
                  {item.badge}
                </span>
              ) : null}
            </Link>
          );
        })}
      </div>

      <Link
        href="/"
        className="mt-4 flex items-center gap-2 rounded-xl border border-white/10 px-3 py-2.5 text-xs font-bold text-indigo-200/70 transition-colors hover:bg-white/5 hover:text-white"
      >
        <ExternalLink className="size-4" />
        مشاهدهٔ سایت
      </Link>
    </nav>
  );
}
