// Registration page — plain server-rendered form posting to registerAction.
import Link from "next/link";
import { redirect } from "next/navigation";
import { UserRoundPlus } from "lucide-react";
import { registerAction } from "@/actions/auth";
import { getCurrentUser } from "@/lib/auth";
import { Flash } from "@/components/ui";
import { first, type SearchParams } from "@/lib/queries";

export const metadata = { title: "ثبت‌نام" };

export default async function RegisterPage({ searchParams }: { searchParams: SearchParams }) {
  const user = await getCurrentUser();
  if (user) redirect("/");

  const sp = await searchParams;
  const error = first(sp.error);

  return (
    <main className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-md items-center px-4 py-12">
      <div className="card w-full p-8">
        <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-gradient-to-br from-indigo-600 to-violet-600 text-white shadow-lg shadow-indigo-600/25">
          <UserRoundPlus className="size-6" />
        </span>
        <h1 className="mt-5 text-center text-2xl font-extrabold text-stone-900">
          ساخت حساب کاربری
        </h1>
        <p className="mt-1.5 mb-6 text-center text-sm text-stone-500">
          کمتر از یک دقیقه طول می‌کشد.
        </p>

        <Flash error={error} />

        <form action={registerAction} className="space-y-4">
          <div>
            <label className="label" htmlFor="fullName">نام و نام خانوادگی</label>
            <input
              id="fullName"
              name="fullName"
              className="input"
              autoComplete="name"
              required
              minLength={2}
              placeholder="مثلاً سارا محمدی"
            />
          </div>
          <div>
            <label className="label" htmlFor="username">نام کاربری (لاتین)</label>
            <input
              id="username"
              name="username"
              className="input"
              dir="ltr"
              autoComplete="username"
              required
              minLength={4}
              placeholder="sara.m"
            />
          </div>
          <div>
            <label className="label" htmlFor="password">گذرواژه (حداقل ۸ نویسه)</label>
            <input
              id="password"
              name="password"
              type="password"
              className="input"
              dir="ltr"
              autoComplete="new-password"
              required
              minLength={8}
              placeholder="••••••••"
            />
          </div>
          <button type="submit" className="btn-primary w-full py-3">
            <UserRoundPlus className="size-4" />
            ثبت‌نام و ورود
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-stone-500">
          قبلاً ثبت‌نام کرده‌اید؟{" "}
          <Link href="/login" className="font-bold text-indigo-600 hover:underline">
            وارد شوید
          </Link>
        </p>
      </div>
    </main>
  );
}
