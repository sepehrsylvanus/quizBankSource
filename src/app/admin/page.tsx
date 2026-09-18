// Admin dashboard: KPI cards, per-quiz analytics and per-question statistics.
// Heavy aggregates run as a handful of optimized SQL queries (no N+1).
import Link from "next/link";
import { sql } from "drizzle-orm";
import {
  ClipboardList,
  FileQuestion,
  Hourglass,
  Inbox,
  Layers,
  LayoutDashboard,
  TrendingUp,
  Users,
} from "lucide-react";
import { db } from "@/db";
import { Badge, Card, PageHeader, StatCard } from "@/components/ui";
import { faDigits, faPercent } from "@/lib/format";
import { QUESTION_TYPE_LABEL, SUBMISSION_STATUS_LABEL } from "@/lib/constants";

export const metadata = { title: "داشبورد مدیریت" };

type QuizRow = {
  id: string;
  title: string;
  published: boolean;
  grading_mode: "ai" | "manual";
  participants: number;
  avg_pct: number;
  awaiting: number;
};

type QuestionRow = {
  id: string;
  text: string;
  type: "mcq" | "true_false" | "written";
  attempts: number;
  avg_pct: number | null;
  correct_rate: number | null;
};

export default async function AdminDashboardPage() {
  // Single round trip for the headline KPIs.
  const kpiRes = await db.execute(sql`
    select
      (select count(*)::int from users where role = 'user') as users_count,
      (select count(*)::int from quizzes where published) as published_quizzes,
      (select count(*)::int from questions) as questions_count,
      (select count(*)::int from submissions where status <> 'in_progress') as attempts_count,
      (select coalesce(avg(case when max_score > 0 then total_score/max_score end), 0)::float
         from submissions where status = 'graded') as avg_score,
      (select count(*)::int from answers where grading_status = 'pending') as pending_grading,
      (select count(*)::int from requests where status = 'pending') as pending_requests
  `);
  const kpi = kpiRes.rows[0] as Record<string, number>;

  const perQuiz = (
    await db.execute(sql`
      select
        q.id, q.title, q.published, q.grading_mode,
        count(s.id)::int as participants,
        coalesce(avg(case when s.max_score > 0 then s.total_score/s.max_score end), 0)::float as avg_pct,
        count(*) filter (where s.status = 'awaiting_grading')::int as awaiting
      from quizzes q
      left join submissions s on s.quiz_id = q.id and s.status <> 'in_progress'
      group by q.id
      order by participants desc, q.created_at desc
      limit 8
    `)
  ).rows as unknown as QuizRow[];

  const perQuestion = (
    await db.execute(sql`
      select
        q.id, left(q.text, 100) as text, q.type,
        count(a.id)::int as attempts,
        avg(case when a.max_points > 0 and a.score is not null then a.score/a.max_points end)::float as avg_pct,
        avg(case when q.type <> 'written' and a.selected_option_id is not null then (a.is_correct)::int end)::float as correct_rate
      from answers a
      join questions q on q.id = a.question_id
      group by q.id, q.text, q.type
      order by attempts desc
      limit 10
    `)
  ).rows as unknown as QuestionRow[];

  return (
    <div>
      <PageHeader
        icon={LayoutDashboard}
        title="داشبورد"
        subtitle="نمای کلی عملکرد پلتفرم"
      />

      {/* KPI cards */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard icon={Users} label="کاربران" value={faDigits(kpi.users_count)} tone="sky" />
        <StatCard icon={Layers} label="آزمون‌های منتشرشده" value={faDigits(kpi.published_quizzes)} tone="indigo" />
        <StatCard icon={FileQuestion} label="سؤال در بانک" value={faDigits(kpi.questions_count)} tone="violet" />
        <StatCard icon={ClipboardList} label="آزمون برگزار شده" value={faDigits(kpi.attempts_count)} tone="emerald" />
        <StatCard icon={TrendingUp} label="میانگین نمرهٔ نهایی" value={faPercent(kpi.avg_score)} tone="emerald" />
        <StatCard icon={Hourglass} label="پاسخ در صف تصحیح" value={faDigits(kpi.pending_grading)} tone="amber" />
        <StatCard icon={Inbox} label="درخواست بررسی‌نشده" value={faDigits(kpi.pending_requests)} tone="rose" />
      </div>

      {/* Per-quiz analytics */}
      <Card className="mt-6 overflow-hidden">
        <div className="flex items-center justify-between border-b border-stone-100 px-5 py-4">
          <h2 className="font-extrabold text-stone-900">آمار هر آزمون</h2>
          <Link href="/admin/quizzes" className="text-xs font-bold text-indigo-600 hover:underline">
            مدیریت آزمون‌ها
          </Link>
        </div>
        {perQuiz.length === 0 ? (
          <p className="p-6 text-sm text-stone-400">هنوز آزمونی ساخته نشده است.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-right text-sm">
              <thead>
                <tr className="border-b border-stone-100 text-xs text-stone-400">
                  <th className="px-5 py-3 font-medium">آزمون</th>
                  <th className="px-5 py-3 font-medium">وضعیت</th>
                  <th className="px-5 py-3 font-medium">شرکت‌کنندگان</th>
                  <th className="px-5 py-3 font-medium">میانگین نمره</th>
                  <th className="px-5 py-3 font-medium">در انتظار تصحیح</th>
                </tr>
              </thead>
              <tbody>
                {perQuiz.map((q) => (
                  <tr key={q.id} className="border-b border-stone-50 last:border-0 hover:bg-stone-50/60">
                    <td className="px-5 py-3">
                      <Link href={`/admin/quizzes/${q.id}`} className="font-bold text-stone-800 hover:text-indigo-700">
                        {q.title}
                      </Link>
                    </td>
                    <td className="px-5 py-3">
                      <Badge tone={q.published ? "emerald" : "stone"}>
                        {q.published ? "منتشر شده" : "پیش‌نویس"}
                      </Badge>
                    </td>
                    <td className="px-5 py-3 tabular-nums">{faDigits(q.participants)}</td>
                    <td className="px-5 py-3 tabular-nums">{faPercent(q.avg_pct)}</td>
                    <td className="px-5 py-3">
                      {q.awaiting > 0 ? (
                        <Badge tone="amber">{faDigits(q.awaiting)}</Badge>
                      ) : (
                        <span className="text-stone-300">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Per-question statistics */}
      <Card className="mt-6 overflow-hidden">
        <div className="border-b border-stone-100 px-5 py-4">
          <h2 className="font-extrabold text-stone-900">آمار هر سؤال</h2>
          <p className="mt-0.5 text-xs text-stone-400">
            سؤالات با بیشترین پاسخ ثبت‌شده — نرخ پاسخ درست و میانگین امتیاز
          </p>
        </div>
        {perQuestion.length === 0 ? (
          <p className="p-6 text-sm text-stone-400">هنوز پاسخی ثبت نشده است.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-right text-sm">
              <thead>
                <tr className="border-b border-stone-100 text-xs text-stone-400">
                  <th className="px-5 py-3 font-medium">سؤال</th>
                  <th className="px-5 py-3 font-medium">نوع</th>
                  <th className="px-5 py-3 font-medium">پاسخ‌ها</th>
                  <th className="px-5 py-3 font-medium">نرخ پاسخ درست</th>
                  <th className="px-5 py-3 font-medium">میانگین امتیاز</th>
                </tr>
              </thead>
              <tbody>
                {perQuestion.map((q) => (
                  <tr key={q.id} className="border-b border-stone-50 last:border-0 hover:bg-stone-50/60">
                    <td className="max-w-72 px-5 py-3">
                      <Link href={`/admin/questions/${q.id}`} className="line-clamp-1 font-medium text-stone-700 hover:text-indigo-700">
                        {q.text}
                      </Link>
                    </td>
                    <td className="px-5 py-3">
                      <Badge tone="stone">{QUESTION_TYPE_LABEL[q.type]}</Badge>
                    </td>
                    <td className="px-5 py-3 tabular-nums">{faDigits(q.attempts)}</td>
                    <td className="px-5 py-3 tabular-nums">
                      {q.correct_rate === null ? "—" : faPercent(q.correct_rate)}
                    </td>
                    <td className="px-5 py-3 tabular-nums">
                      {q.avg_pct === null ? "—" : faPercent(q.avg_pct)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
