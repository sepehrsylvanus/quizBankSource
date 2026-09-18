// Quiz detail page: overview, stats and the start button (server action form).
import Link from "next/link";
import { notFound } from "next/navigation";
import { and, eq, sql } from "drizzle-orm";
import {
  ArrowRight,
  ClipboardList,
  FileQuestion,
  Play,
  Sparkles,
  Timer,
  TrendingUp,
  UserRoundPen,
  Users,
} from "lucide-react";
import { db } from "@/db";
import { categories, quizzes } from "@/db/schema";
import { startQuizAction } from "@/actions/quiz";
import { Badge, Card } from "@/components/ui";
import { faDigits, faDuration, faPercent } from "@/lib/format";
import { GRADING_MODE_LABEL } from "@/lib/constants";

export default async function QuizDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const rows = await db
    .select({
      id: quizzes.id,
      title: quizzes.title,
      description: quizzes.description,
      gradingMode: quizzes.gradingMode,
      timeLimitMinutes: quizzes.timeLimitMinutes,
      published: quizzes.published,
      categoryName: categories.name,
      questionCount: sql<number>`(select count(*)::int from quiz_questions where quiz_id = ${quizzes.id})`,
      maxScore: sql<number>`coalesce((select sum(points)::int from quiz_questions where quiz_id = ${quizzes.id}), 0)`,
    })
    .from(quizzes)
    .leftJoin(categories, eq(categories.id, quizzes.categoryId))
    .where(eq(quizzes.id, id))
    .limit(1);
  const quiz = rows[0];
  if (!quiz || !quiz.published) notFound();

  // Aggregate stats of finished attempts (participants + average score ratio)
  const statsRes = await db.execute(sql`
    select
      count(*)::int as participants,
      coalesce(avg(case when max_score > 0 then total_score/max_score end), 0)::float as avg_pct
    from submissions
    where quiz_id = ${id} and status <> 'in_progress'
  `);
  const stats = (statsRes.rows[0] ?? { participants: 0, avg_pct: 0 }) as {
    participants: number;
    avg_pct: number;
  };
  const start = startQuizAction.bind(null, quiz.id);

  return (
    <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <Link href="/quizzes" className="mb-4 inline-flex items-center gap-1 text-sm font-bold text-stone-400 hover:text-indigo-600">
        <ArrowRight className="size-4" />
        بازگشت به آزمون‌ها
      </Link>

      <Card className="overflow-hidden">
        <div className="pattern-tile bg-gradient-to-br from-indigo-600 via-violet-600 to-fuchsia-600 p-6 text-white sm:p-8">
          <div className="flex flex-wrap items-center gap-2">
            {quiz.categoryName ? (
              <span className="badge bg-white/15 text-white backdrop-blur">{quiz.categoryName}</span>
            ) : null}
            <span className="badge inline-flex items-center gap-1 bg-white/15 text-white backdrop-blur">
              {quiz.gradingMode === "ai" ? (
                <Sparkles className="size-3.5" />
              ) : (
                <UserRoundPen className="size-3.5" />
              )}
              {GRADING_MODE_LABEL[quiz.gradingMode]}
            </span>
          </div>
          <h1 className="mt-4 text-2xl font-black sm:text-3xl">{quiz.title}</h1>
          {quiz.description ? (
            <p className="mt-2 text-sm leading-7 text-indigo-100">{quiz.description}</p>
          ) : null}
        </div>

        <div className="grid grid-cols-2 gap-px bg-stone-100 sm:grid-cols-4">
          {[
            { icon: FileQuestion, label: "تعداد سؤال", value: faDigits(quiz.questionCount) },
            { icon: ClipboardList, label: "مجموع امتیاز", value: faDigits(quiz.maxScore) },
            { icon: Timer, label: "زمان", value: faDuration(quiz.timeLimitMinutes) },
            { icon: Users, label: "شرکت‌کننده", value: faDigits(stats.participants) },
          ].map((s) => (
            <div key={s.label} className="bg-white px-4 py-5 text-center">
              <s.icon className="mx-auto size-5 text-indigo-500" />
              <div className="mt-1.5 text-lg font-extrabold text-stone-900">{s.value}</div>
              <div className="text-[11px] font-medium text-stone-400">{s.label}</div>
            </div>
          ))}
        </div>

        <div className="flex flex-col items-center gap-3 p-6 sm:p-8">
          <form action={start}>
            <button type="submit" className="btn-primary px-8 py-3 text-base">
              <Play className="size-5" />
              شروع آزمون
            </button>
          </form>
          <p className="inline-flex items-center gap-1.5 text-xs text-stone-400">
            <TrendingUp className="size-3.5" />
            میانگین نمرهٔ شرکت‌کنندگان: {faPercent(stats.avg_pct)}
          </p>
        </div>
      </Card>

      <Card className="mt-6 p-5 text-sm leading-7 text-stone-500">
        <h2 className="mb-2 font-extrabold text-stone-800">راهنمای آزمون</h2>
        <ul className="list-disc space-y-1 pr-5">
          <li>سؤالات چهارگزینه‌ای و صحیح/غلط بلافاصله و خودکار تصحیح می‌شوند.</li>
          <li>
            سؤالات تشریحی
            {quiz.gradingMode === "ai"
              ? " توسط هوش مصنوعی بر اساس پاسخ مرجع نمره (۰ تا ۱۰۰) و بازخورد فارسی می‌گیرند."
              : " به صف تصحیح ادمین می‌روند و تا زمان بررسی، وضعیت آزمون «در انتظار تکمیل تصحیح» می‌ماند."}
          </li>
          {quiz.timeLimitMinutes ? (
            <li>پس از اتمام زمان، پاسخ‌ها به‌صورت خودکار ثبت می‌شوند.</li>
          ) : null}
          <li>اگر صفحه را ببندید، می‌توانید از بخش «نتایج من» به آزمون ناتمام برگردید.</li>
        </ul>
      </Card>
    </main>
  );
}
