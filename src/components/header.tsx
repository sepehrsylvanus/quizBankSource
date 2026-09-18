// Site header (server component): brand, nav and auth state.
import Link from "next/link";
import { GraduationCap, LayoutDashboard, LogIn, LogOut, UserRound } from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import { logoutAction } from "@/actions/auth";
import { MobileNavLinks, NavLinks, type NavItem } from "@/components/site-header";

export default async function Header() {
  const user = await getCurrentUser();

  const items: NavItem[] = [
    { href: "/", label: "خانه" },
    { href: "/quizzes", label: "آزمون‌ها" },
    ...(user
      ? [
          { href: "/results", label: "نتایج من" },
          { href: "/requests", label: "درخواست‌ها" },
        ]
      : []),
    ...(user?.role === "admin" ? [{ href: "/admin", label: "پنل مدیریت" }] : []),
  ];

  return (
    <header className="sticky top-0 z-40 border-b border-stone-200/70 bg-[#f7f5f0]/85 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        <div className="flex items-center gap-6">
          <Link href="/" className="flex items-center gap-2.5">
            <span className="grid size-10 place-items-center rounded-2xl bg-gradient-to-br from-indigo-600 to-violet-600 text-white shadow-lg shadow-indigo-600/25">
              <GraduationCap className="size-5" />
            </span>
            <span className="text-lg font-extrabold tracking-tight text-stone-900">
              بانک سؤال
            </span>
          </Link>
          <NavLinks items={items} />
        </div>

        <div className="flex items-center gap-2">
          {user ? (
            <>
              {user.role === "admin" ? (
                <Link href="/admin" className="btn-ghost hidden sm:inline-flex" title="پنل مدیریت">
                  <LayoutDashboard className="size-4" />
                </Link>
              ) : null}
              <span className="hidden items-center gap-2 rounded-xl bg-white px-3 py-2 text-xs font-bold text-stone-700 sm:inline-flex">
                <UserRound className="size-4 text-indigo-500" />
                {user.fullName || user.username}
              </span>
              <form action={logoutAction}>
                <button type="submit" className="btn-ghost" title="خروج از حساب">
                  <LogOut className="size-4" />
                  <span className="hidden sm:inline">خروج</span>
                </button>
              </form>
            </>
          ) : (
            <>
              <Link href="/login" className="btn-ghost">
                <LogIn className="size-4" />
                ورود
              </Link>
              <Link href="/register" className="btn-primary">
                ثبت‌نام
              </Link>
            </>
          )}
        </div>
      </div>
      <MobileNavLinks items={items} />
    </header>
  );
}
