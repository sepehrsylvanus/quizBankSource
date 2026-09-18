// Result detail page — per-question breakdown with feedback.
// Written answers show "awaiting grading" state until an admin finalizes them.
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { asc, eq, inArray } from "drizzle-orm";
import {
  ArrowRight,
  Check,
  CheckCircle2,
  Hourglass,
  Lightbulb,
  NotebookPen,
  Sparkles,
  Target,
  UserRoundPen,
  X,
} from "lucide-react";
import { db } from "@/db";
import { answers, aiReviews, options, questions, quizzes, submissions } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { Badge, Card } from "@/components/ui";
import { faDate, faDigits, faNumber, faPercent } from "@/lib/format";
import { QUESTION_TYPE_LABEL, SUBMISSION_STATUS_LABEL } from "@/lib/constants";

export const metadata = { title: "جزئیات نتیجه" };

export default async function ResultDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const subRows = await db
    .select({
      id: submissions.id,
      userId: submissions.userId,
      status: submissions.status,
      totalScore: submissions.totalScore,
      maxScore: submissions.maxScore,
      startedAt: submissions.startedAt,
      submittedAt: submissions.submittedAt,
      quizId: submissions.quizId,
      quizTitle: quizzes.title,
      gradingMode: quizzes.gradingMode,
    })
    .from(submissions)
    .innerJoin(quizzes, eq(quizzes.id, submissions.quizId))
    .where(eq(submissions.id, id))
    .limit(1);
  const sub = subRows[0];
  if (!sub || (sub.userId !== user.id && user.role !== "admin")) notFound();
  if (sub.status === "in_progress") redirect(`/take/${sub.id}`);

  // Answers joined with question metadata (single query).
  const answerRows = await db
    .select({
      id: answers.id,
      questionId: answers.questionId,
      selectedOptionId: answers.selectedOptionId,
      answerText: answers.answerText,
      isCorrect: answers.isCorrect,
      score: answers.score,
      maxPoints: answers.maxPoints,
      gradingStatus: answers.gradingStatus,
      aiScore: answers.aiScore,
      feedback: answers.feedback,
      questionText: questions.text,
      questionType: questions.type,
      explanation: questions.explanation,
      referenceAnswer: questions.referenceAnswer,
    })
    .from(answers)
    .innerJoin(questions, eq(questions.id, answers.questionId))
    .where(eq(answers.submissionId, sub.id));

  // Options for choice questions (single IN query).
  const optionRows = await db
    .select({
      id: options.id,
      questionId: options.questionId,
      text: options.text,
      isCorrect: options.isCorrect,
      orderIndex: options.orderIndex,
    })
    .from(options)
    .where(
      inArray(
        options.questionId,
        answerRows.map((a) => a.questionId),
      ),
    )
    .orderBy(asc(options.orderIndex));
  const optionsByQuestion = new Map<string, typeof optionRows>();
  for (const o of optionRows) {
    const list = optionsByQuestion.get(o.questionId) ?? [];
    list.push(o);
    optionsByQuestion.set(o.questionId, list);
  }

  // AI reviews for transparency (single IN query).
  const aiRows = await db
    .select({
      answerId: aiReviews.answerId,
      provider: aiReviews.provider,
      score: aiReviews.score,
      feedback: aiReviews.feedback,
    })
    .from(aiReviews)
    .where(
      inArray(
        aiReviews.answerId,
        answerRows.map((a) => a.id),
      ),
    );
  const aiByAnswer = new Map(aiRows.map((r) => [r.answerId, r]));

  const pct = sub.maxScore > 0 ? sub.totalScore / sub.maxScore : 0;
  const pendingCount = answerRows.filter((a) => a.gradingStatus === "pending").length;

  return (
    <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <Link href="/results" className="mb-4 inline-flex items-center gap-1 text-sm font-bold text-stone-400 hover:text-indigo-600">
        <ArrowRight className="size-4" />
        بازگشت به نتایج
      </Link>

      {/* Summary card */}
      <Card className="mb-6 overflow-hidden">
        <div className="pattern-tile bg-gradient-to-br from-indigo-600 via-violet-600 to-fuchsia-600 p-6 text-white sm:p-8">
          <p className="text-xs font-bold text-indigo-200">{sub.quizTitle}</p>
          <div className="mt-3 flex flex-wrap items-end justify-between gap-4">
            <div>
              <div className="text-5xl font-black tabular-nums">{faPercent(pct)}</div>
              <div className="mt-1 text-sm text-indigo-100">
                {faNumber(sub.totalScore)} از {faDigits(sub.maxScore)} امتیاز
              </div>
            </div>
            <span className="badge bg-white/15 text-white backdrop-blur">
              {SUBMISSION_STATUS_LABEL[sub.status]}
            </span>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-x-6 gap-y-1 px-6 py-4 text-xs text-stone-400">
          <span>شروع: {faDate(sub.startedAt)}</span>
          {sub.submittedAt ? <span>ثبت: {faDate(sub.submittedAt)}</span> : null}
          <span className="inline-flex items-center gap-1">
            <Target className="size-3.5" />
            {faDigits(answerRows.filter((a) => a.isCorrect).length)} پاسخ درست از{" "}
            {faDigits(answerRows.length)}
          </span>
        </div>
      </Card>

      {/* Awaiting grading banner */}
      {sub.status === "awaiting_grading" ? (
        <div className="mb-6 flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm leading-7 text-amber-800">
          <Hourglass className="mt-1 size-5 shrink-0 text-amber-500" />
          <div>
            <p className="font-extrabold">در انتظار تکمیل تصحیح</p>
            <p>
              {faDigits(pendingCount)} پاسخ تشریحی شما هنوز توسط ادمین بررسی نشده است؛
              نمرهٔ نهایی پس از اتمام تصحیح به‌روزرسانی می‌شود.
            </p>
          </div>
        </div>
      ) : null}

      {/* Per-question breakdown */}
      <div className="space-y-4">
        {answerRows.map((a, i) => {
          const opts = optionsByQuestion.get(a.questionId) ?? [];
          const ai = aiByAnswer.get(a.id);
          const correctOpt = opts.find((o) => o.isCorrect);
          const selectedOpt = opts.find((o) => o.id === a.selectedOptionId);
          const isPending = a.gradingStatus === "pending";

          return (
            <Card key={a.id} className="p-5 sm:p-6">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-xs text-stone-400">
                  <Badge tone="stone">{QUESTION_TYPE_LABEL[a.questionType]}</Badge>
                  <span>
                    {isPending
                      ? "در انتظار نمره"
                      : `${faNumber(a.score ?? 0)} از ${faDigits(a.maxPoints)} امتیاز`}
                  </span>
                </div>
                {a.gradingStatus === "ai_scored" ? (
                  <Badge tone="violet">
                    <Sparkles className="size-3.5" />
                    تصحیح هوش مصنوعی{ai ? ` (${ai.provider})` : ""}
                  </Badge>
                ) : a.gradingStatus === "graded" ? (
                  <Badge tone="sky">
                    <UserRoundPen className="size-3.5" />
                    تصحیح دستی ادمین
                  </Badge>
                ) : (
                  <span
                    className={`grid size-6 place-items-center rounded-full ${
                      a.isCorrect ? "bg-emerald-100 text-emerald-600" : "bg-rose-100 text-rose-600"
                    }`}
                  >
                    {a.isCorrect ? <Check className="size-4" /> : <X className="size-4" />}
                  </span>
                )}
              </div>

              <p className="mb-4 font-bold leading-8 text-stone-900">
                <span className="ml-1 text-stone-300">{faDigits(i + 1)}.</span>
                {a.questionText}
              </p>

              {a.questionType !== "written" ? (
                <div className="grid gap-2">
                  {opts.map((o) => {
                    const isSel = o.id === a.selectedOptionId;
                    const cls = o.isCorrect
                      ? "border-emerald-400 bg-emerald-50 text-emerald-900 font-bold"
                      : isSel
                        ? "border-rose-300 bg-rose-50 text-rose-800"
                        : "border-stone-200 bg-white text-stone-500";
                    return (
                      <div key={o.id} className={`flex items-center gap-3 rounded-xl border px-4 py-2.5 text-sm ${cls}`}>
                        {o.isCorrect ? (
                          <CheckCircle2 className="size-4 shrink-0 text-emerald-600" />
                        ) : isSel ? (
                          <X className="size-4 shrink-0 text-rose-500" />
                        ) : (
                          <span className="size-4 shrink-0" />
                        )}
                        {o.text}
                        {isSel ? (
                          <span className="mr-auto text-[10px] font-bold opacity-70">پاسخ شما</span>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="rounded-xl border border-stone-200 bg-stone-50 p-4">
                    <p className="mb-1 text-[11px] font-bold text-stone-400">پاسخ شما</p>
                    <p className="whitespace-pre-line text-sm leading-7 text-stone-700">
                      {a.answerText || "— بدون پاسخ —"}
                    </p>
                  </div>
                  {isPending ? (
                    <div className="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs font-bold text-amber-700">
                      <Hourglass className="size-4" />
                      این پاسخ در صف تصحیح ادمین قرار دارد.
                    </div>
                  ) : a.feedback ? (
                    <div
                      className={`rounded-xl border px-4 py-3 text-sm leading-7 ${
                        a.gradingStatus === "ai_scored"
                          ? "border-violet-200 bg-violet-50 text-violet-900"
                          : "border-sky-200 bg-sky-50 text-sky-900"
                      }`}
                    >
                      <p className="mb-1 flex items-center gap-1.5 text-[11px] font-extrabold">
                        {a.gradingStatus === "ai_scored" ? (
                          <Sparkles className="size-3.5" />
                        ) : (
                          <UserRoundPen className="size-3.5" />
                        )}
                        بازخورد{a.aiScore !== null ? ` — امتیاز ${faDigits(a.aiScore)} از ۱۰۰` : ""}
                      </p>
                      {a.feedback}
                    </div>
                  ) : null}
                </div>
              )}

              {a.explanation ? (
                <div className="mt-3 flex items-start gap-2 rounded-xl bg-indigo-50/70 px-4 py-3 text-xs leading-6 text-indigo-900">
                  <Lightbulb className="mt-0.5 size-4 shrink-0 text-indigo-500" />
                  <div>
                    <span className="font-extrabold">توضیح: </span>
                    {a.explanation}
                  </div>
                </div>
              ) : null}
            </Card>
          );
        })}
      </div>

      <div className="mt-8 flex justify-center">
        <Link href="/quizzes" className="btn-secondary">
          <NotebookPen className="size-4" />
          شرکت در آزمون دیگر
        </Link>
      </div>
    </main>
  );
}
