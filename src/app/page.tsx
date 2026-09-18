// Landing page — server component. Public quiz data is cached with the
// "quizzes" tag and invalidated whenever an admin publishes/unpublishes.
import Link from "next/link";
import { unstable_cache } from "next/cache";
import { desc, eq, sql } from "drizzle-orm";
import {
  ArrowLeft,
  ClipboardList,
  FileQuestion,
  Inbox,
  PenLine,
  Sparkles,
  Timer,
  TrendingUp,
  UserRoundPen,
  Users,
} from "lucide-react";
import { db } from "@/db";
import { categories, quizzes } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { Badge, Card } from "@/components/ui";
import { faDigits, faDuration } from "@/lib/format";
import { GRADING_MODE_LABEL } from "@/lib/constants";

const getLandingData = unstable_cache(
  async () => {
    const stats = await db.execute(sql`
      select
        (select count(*)::int from quizzes where published) as quizzes_count,
        (select count(*)::int from questions) as questions_count,
        (select count(*)::int from submissions where status <> 'in_progress') as attempts_count,
        (select count(*)::int from users where role = 'user') as users_count
    `);
    const latest = await db
      .select({
        id: quizzes.id,
        title: quizzes.title,
        description: quizzes.description,
        gradingMode: quizzes.gradingMode,
        timeLimitMinutes: quizzes.timeLimitMinutes,
        categoryName: categories.name,
        questionCount: sql<number>`(select count(*)::int from quiz_questions where quiz_id = ${quizzes.id})`,
      })
      .from(quizzes)
      .leftJoin(categories, eq(categories.id, quizzes.categoryId))
      .where(eq(quizzes.published, true))
      .orderBy(desc(quizzes.updatedAt))
      .limit(6);
    return { stats: stats.rows[0] as Record<string, number>, latest };
  },
  ["landing-data"],
  { tags: ["quizzes"], revalidate: 120 },
);

export default async function HomePage() {
  const [user, { stats, latest }] = await Promise.all([
    getCurrentUser(),
    getLandingData(),
  ]);

  const statItems = [
    {
      label: "آزمون فعال",
      value: stats.quizzes_count ?? 0,
      icon: ClipboardList,
    },
    {
      label: "سؤال در بانک",
      value: stats.questions_count ?? 0,
      icon: FileQuestion,
    },
    {
      label: "آزمون برگزار شده",
      value: stats.attempts_count ?? 0,
      icon: TrendingUp,
    },
    { label: "کاربر ثبت‌نامی", value: stats.users_count ?? 0, icon: Users },
  ];

  const features = [
    {
      icon: Sparkles,
      title: "تصحیح هوشمند با AI",
      text: "پاسخ‌های تشریحی با مقایسهٔ هوشمند با پاسخ مرجع، امتیاز ۰ تا ۱۰۰ و بازخورد فارسی می‌گیرند.",
    },
    {
      icon: UserRoundPen,
      title: "صف تصحیح دستی",
      text: "سازندهٔ آزمون می‌تواند تصحیح دستی را انتخاب کند؛ پاسخ‌ها در صف بررسی ادمین قرار می‌گیرند.",
    },
    {
      icon: PenLine,
      title: "سه نوع سؤال",
      text: "چهارگزینه‌ای، صحیح/غلط و تشریحی — همه با توضیح پاسخ و درجهٔ سختی در بانک سؤال.",
    },
    {
      icon: Inbox,
      title: "سامانهٔ درخواست",
      text: "کاربران موضوع یا آزمون جدید درخواست می‌دهند و وضعیت بررسی را لحظه‌ای دنبال می‌کنند.",
    },
  ];

  return (
    <main>
      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0 pattern-tile-dark opacity-60" />
        <div className="pointer-events-none absolute -top-32 left-1/2 size-[34rem] -translate-x-1/2 rounded-full bg-gradient-to-br from-indigo-200/60 via-violet-200/50 to-transparent blur-3xl" />
        <div className="relative mx-auto max-w-6xl px-4 pt-16 pb-14 text-center sm:px-6 sm:pt-24 sm:pb-20">
          <div className="animate-fade-up">
            <Badge tone="indigo" className="mb-5">
              <Sparkles className="size-3.5" />
              تصحیح تشریحی با هوش مصنوعی
            </Badge>
            <h1 className="mx-auto max-w-3xl text-4xl leading-[1.25] font-black tracking-tight text-stone-900 sm:text-6xl sm:leading-[1.2]">
              بانک سؤال و آزمون آنلاین،
              <span className="block bg-gradient-to-l from-indigo-600 via-violet-600 to-fuchsia-500 bg-clip-text text-transparent">
                دقیق و سریع
              </span>
            </h1>
            <p className="mx-auto mt-5 max-w-xl text-base leading-8 text-stone-500 sm:text-lg">
              در آزمون‌های چهارگزینه‌ای، صحیح/غلط و تشریحی شرکت کنید؛ پاسخ‌ها
              بلافاصله تصحیح می‌شوند و بازخورد فارسی دریافت می‌کنید.
            </p>
            <div className="mt-8 flex items-center justify-center gap-3">
              <Link href="/quizzes" className="btn-primary px-6 py-3 text-base">
                مشاهدهٔ آزمون‌ها
                <ArrowLeft className="size-4" />
              </Link>
              {!user ? (
                <Link
                  href="/register"
                  className="btn-secondary px-6 py-3 text-base"
                >
                  ساخت حساب رایگان
                </Link>
              ) : (
                <Link
                  href="/results"
                  className="btn-secondary px-6 py-3 text-base"
                >
                  نتایج من
                </Link>
              )}
            </div>
          </div>

          {/* Stats */}
          <div className="stagger mx-auto mt-14 grid max-w-3xl grid-cols-2 gap-3 sm:grid-cols-4">
            {statItems.map((s) => (
              <Card key={s.label} className="p-4 text-center">
                <s.icon className="mx-auto size-5 text-indigo-500" />
                <div className="mt-2 text-2xl font-black tabular-nums text-stone-900">
                  {faDigits(s.value)}
                </div>
                <div className="text-xs font-medium text-stone-500">
                  {s.label}
                </div>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Latest quizzes */}
      <section className="mx-auto max-w-6xl px-4 pb-20 sm:px-6">
        <div className="mb-6 flex items-end justify-between">
          <div>
            <h2 className="text-2xl font-extrabold text-stone-900">
              جدیدترین آزمون‌ها
            </h2>
            <p className="mt-1 text-sm text-stone-500">
              همین حالا شروع کنید — نتیجه بلافاصله پس از ثبت.
            </p>
          </div>
          <Link href="/quizzes" className="btn-ghost text-indigo-600">
            همهٔ آزمون‌ها
            <ArrowLeft className="size-4" />
          </Link>
        </div>
        {latest.length === 0 ? (
          <Card className="p-10 text-center text-sm text-stone-400">
            هنوز آزمونی منتشر نشده است.
          </Card>
        ) : (
          <div className="stagger grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {latest.map((q) => (
              <Link key={q.id} href={`/quizzes/${q.id}`} className="group">
                <Card className="flex h-full flex-col p-5 transition-all duration-300 group-hover:-translate-y-1 group-hover:border-indigo-300 group-hover:shadow-lg group-hover:shadow-indigo-600/10">
                  <div className="mb-3 flex items-center gap-2">
                    {q.categoryName ? (
                      <Badge tone="sky">{q.categoryName}</Badge>
                    ) : null}
                    <Badge tone={q.gradingMode === "ai" ? "violet" : "amber"}>
                      {GRADING_MODE_LABEL[q.gradingMode]}
                    </Badge>
                  </div>
                  <h3 className="font-extrabold text-stone-900 group-hover:text-indigo-700">
                    {q.title}
                  </h3>
                  <p className="mt-1.5 line-clamp-2 flex-1 text-sm leading-7 text-stone-500">
                    {q.description || "بدون توضیحات"}
                  </p>
                  <div className="mt-4 flex items-center gap-4 border-t border-stone-100 pt-3 text-xs text-stone-400">
                    <span className="inline-flex items-center gap-1">
                      <FileQuestion className="size-3.5" />
                      {faDigits(q.questionCount)} سؤال
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <Timer className="size-3.5" />
                      {faDuration(q.timeLimitMinutes)}
                    </span>
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* Features */}
      <section className="border-t border-stone-200/70 bg-white/60">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
          <h2 className="text-center text-2xl font-extrabold text-stone-900">
            چرا بانک سؤال؟
          </h2>
          <div className="stagger mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {features.map((f) => (
              <Card key={f.title} className="p-5">
                <span className="grid size-11 place-items-center rounded-2xl bg-gradient-to-br from-indigo-600 to-violet-600 text-white shadow-md shadow-indigo-600/25">
                  <f.icon className="size-5" />
                </span>
                <h3 className="mt-4 font-extrabold text-stone-900">
                  {f.title}
                </h3>
                <p className="mt-1.5 text-sm leading-7 text-stone-500">
                  {f.text}
                </p>
              </Card>
            ))}
          </div>
        </div>
      </section>

      <footer className="border-t border-stone-200/70 py-8 text-center text-xs text-stone-400">
        بانک سؤال — پلتفرم آزمون آنلاین با تصحیح خودکار و هوش مصنوعی
      </footer>
    </main>
  );
}
