// Admin grading queue: pending written answers shown side-by-side with the
// reference answer and (if present) the AI output, plus the final score form.
import { asc, eq, inArray, sql } from "drizzle-orm";
import {
  BookOpenCheck,
  ChevronsRightLeft,
  NotebookText,
  PenSquare,
  Sparkles,
  UserRound,
} from "lucide-react";
import { db } from "@/db";
import {
  answers,
  aiReviews,
  questions,
  quizzes,
  submissions,
  users,
} from "@/db/schema";
import { first, pageOf, type SearchParams } from "@/lib/queries";
import { Badge, Card, EmptyState, PageHeader } from "@/components/ui";
import Pagination from "@/components/pagination";
import { GradeForm } from "@/components/admin-widgets";
import { faDate, faDigits } from "@/lib/format";
import { PAGE_SIZE } from "@/lib/constants";

export const metadata = { title: "صف تصحیح" };
export const dynamic = "force-dynamic";

export default async function AdminGradingPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const sp = await searchParams;
  const page = pageOf(first(sp.page));

  const where = eq(answers.gradingStatus, "pending");

  const [rows, countRows] = await Promise.all([
    db
      .select({
        id: answers.id,
        answerText: answers.answerText,
        maxPoints: answers.maxPoints,
        submittedAt: submissions.submittedAt,
        quizTitle: quizzes.title,
        questionText: questions.text,
        referenceAnswer: questions.referenceAnswer,
        userName: users.fullName,
        userUsername: users.username,
      })
      .from(answers)
      .innerJoin(submissions, eq(submissions.id, answers.submissionId))
      .innerJoin(quizzes, eq(quizzes.id, submissions.quizId))
      .innerJoin(questions, eq(questions.id, answers.questionId))
      .innerJoin(users, eq(users.id, submissions.userId))
      .where(where)
      .orderBy(asc(submissions.submittedAt)) // oldest first — fairness
      .limit(PAGE_SIZE)
      .offset((page - 1) * PAGE_SIZE),
    db.select({ count: sql<number>`count(*)::int` }).from(answers).where(where),
  ]);

  // AI reviews for these answers (if any) — single IN query.
  const aiMap = new Map<string, { score: number; feedback: string; provider: string }>();
  if (rows.length > 0) {
    const aiRows = await db
      .select({
        answerId: aiReviews.answerId,
        score: aiReviews.score,
        feedback: aiReviews.feedback,
        provider: aiReviews.provider,
      })
      .from(aiReviews)
      .where(inArray(aiReviews.answerId, rows.map((r) => r.id)));
    for (const r of aiRows) aiMap.set(r.answerId, r);
  }

  const total = countRows[0]?.count ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div>
      <PageHeader
        icon={PenSquare}
        title="صف تصحیح"
        subtitle={`${faDigits(total)} پاسخ در انتظار بررسی`}
      />

      {rows.length === 0 ? (
        <EmptyState
          icon={BookOpenCheck}
          title="صف تصحیح خالی است"
          hint="پاسخ‌های تشریحی آزمون‌های «تصحیح دستی» اینجا ظاهر می‌شوند."
        />
      ) : (
        <div className="space-y-4">
          {rows.map((r) => {
            const ai = aiMap.get(r.id);
            return (
              <Card key={r.id} className="p-5 sm:p-6">
                <div className="mb-3 flex flex-wrap items-center gap-2">
                  <Badge tone="amber">در انتظار بررسی</Badge>
                  <Badge tone="indigo">{r.quizTitle}</Badge>
                  <span className="text-[11px] text-stone-400">
                    {faDate(r.submittedAt)} — حداکثر {faDigits(r.maxPoints)} امتیاز
                  </span>
                </div>

                <h3 className="mb-4 font-bold leading-8 text-stone-900">{r.questionText}</h3>

                {/* Side-by-side comparison */}
                <div className="grid gap-3 lg:grid-cols-2">
                  <div className="rounded-xl border border-stone-200 bg-stone-50 p-4">
                    <p className="mb-1.5 flex items-center gap-1.5 text-[11px] font-extrabold text-stone-400">
                      <UserRound className="size-3.5" />
                      پاسخ کاربر — {r.userName || r.userUsername}
                    </p>
                    <p className="whitespace-pre-line text-sm leading-7 text-stone-700">
                      {r.answerText}
                    </p>
                  </div>
                  <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-4">
                    <p className="mb-1.5 flex items-center gap-1.5 text-[11px] font-extrabold text-emerald-600">
                      <NotebookText className="size-3.5" />
                      پاسخ مرجع
                    </p>
                    <p className="whitespace-pre-line text-sm leading-7 text-stone-700">
                      {r.referenceAnswer || "—"}
                    </p>
                  </div>
                </div>

                {ai ? (
                  <div className="mt-3 rounded-xl border border-violet-200 bg-violet-50 p-4">
                    <p className="mb-1 flex items-center gap-1.5 text-[11px] font-extrabold text-violet-600">
                      <Sparkles className="size-3.5" />
                      خروجی هوش مصنوعی ({ai.provider}) — امتیاز {faDigits(ai.score)} از ۱۰۰
                    </p>
                    <p className="text-sm leading-7 text-violet-900">{ai.feedback}</p>
                  </div>
                ) : null}

                <div className="mt-4 flex items-center gap-2 text-[10px] font-bold text-stone-300">
                  <ChevronsRightLeft className="size-3.5" />
                  پاسخ کاربر و مرجع را مقایسه کنید و نمرهٔ نهایی را ثبت کنید
                </div>

                <GradeForm
                  answerId={r.id}
                  aiScore={ai?.score ?? null}
                  aiFeedback={ai?.feedback}
                  aiProvider={ai?.provider}
                />
              </Card>
            );
          })}
        </div>
      )}

      <Pagination page={page} totalPages={totalPages} params={{}} />
    </div>
  );
}
