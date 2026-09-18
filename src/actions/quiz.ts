"use server";

// Quiz-taking server actions: start an attempt and submit it for grading.
// Multiple-choice and true/false answers are graded deterministically here;
// written answers are either graded by the AI agent (gradingMode = "ai") or
// pushed into the manual review queue (gradingMode = "manual").
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { and, asc, eq, inArray, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import {
  answers,
  aiReviews,
  options,
  questions,
  quizQuestions,
  quizzes,
  submissions,
} from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { gradeWrittenAnswer, type GradeResult } from "@/lib/ai";

/** Start (or resume) a quiz attempt. */
export async function startQuizAction(quizId: string): Promise<void> {
  const user = await requireUser();

  const quizRows = await db
    .select({ id: quizzes.id, published: quizzes.published })
    .from(quizzes)
    .where(eq(quizzes.id, quizId))
    .limit(1);
  const quiz = quizRows[0];
  if (!quiz || !quiz.published) redirect("/quizzes");

  // Reuse an unfinished attempt so a refresh never loses progress.
  const existing = await db
    .select({ id: submissions.id })
    .from(submissions)
    .where(
      and(
        eq(submissions.quizId, quizId),
        eq(submissions.userId, user.id),
        eq(submissions.status, "in_progress"),
      ),
    )
    .limit(1);
  if (existing[0]) redirect(`/take/${existing[0].id}`);

  const agg = await db
    .select({
      count: sql<number>`count(*)::int`,
      maxScore: sql<number>`coalesce(sum(${quizQuestions.points}), 0)::int`,
    })
    .from(quizQuestions)
    .where(eq(quizQuestions.quizId, quizId));
  if (!agg[0] || agg[0].count === 0) redirect("/quizzes");

  const [sub] = await db
    .insert(submissions)
    .values({ quizId, userId: user.id, maxScore: agg[0].maxScore })
    .returning({ id: submissions.id });

  revalidatePath("/results");
  redirect(`/take/${sub.id}`);
}

const submitSchema = z.object({
  submissionId: z.string().uuid(),
  answers: z
    .array(
      z.object({
        questionId: z.string().uuid(),
        selectedOptionId: z.string().uuid().nullish(),
        answerText: z.string().max(20000).nullish(),
      }),
    )
    .max(500),
});

export type SubmitQuizResult = { ok: boolean; error?: string };

/** Grade and persist a submitted attempt. */
export async function submitQuizAction(payload: unknown): Promise<SubmitQuizResult> {
  const user = await requireUser();
  const parsed = submitSchema.safeParse(payload);
  if (!parsed.success) return { ok: false, error: "داده‌های ارسالی معتبر نیست." };
  const { submissionId, answers: submitted } = parsed.data;

  // Ownership + status check (only the fields we need).
  const subRows = await db
    .select({
      id: submissions.id,
      userId: submissions.userId,
      quizId: submissions.quizId,
      status: submissions.status,
    })
    .from(submissions)
    .where(eq(submissions.id, submissionId))
    .limit(1);
  const sub = subRows[0];
  if (!sub || sub.userId !== user.id) {
    return { ok: false, error: "آزمون یافت نشد." };
  }
  if (sub.status !== "in_progress") redirect(`/results/${submissionId}`);

  const quizRows = await db
    .select({ id: quizzes.id, gradingMode: quizzes.gradingMode })
    .from(quizzes)
    .where(eq(quizzes.id, sub.quizId))
    .limit(1);
  const quiz = quizRows[0];
  if (!quiz) return { ok: false, error: "آزمون یافت نشد." };

  // Fetch only the questions of this quiz (single join, ordered).
  const qs = await db
    .select({
      id: questions.id,
      type: questions.type,
      text: questions.text,
      referenceAnswer: questions.referenceAnswer,
      points: quizQuestions.points,
    })
    .from(quizQuestions)
    .innerJoin(questions, eq(questions.id, quizQuestions.questionId))
    .where(eq(quizQuestions.quizId, quiz.id))
    .orderBy(asc(quizQuestions.orderIndex));
  if (qs.length === 0) return { ok: false, error: "سؤالی برای این آزمون تعریف نشده است." };

  // Correct option ids for deterministic grading (single IN query, no N+1).
  const correctRows = await db
    .select({ id: options.id, questionId: options.questionId })
    .from(options)
    .where(
      and(
        inArray(
          options.questionId,
          qs.map((q) => q.id),
        ),
        eq(options.isCorrect, true),
      ),
    );
  const correctByQuestion = new Map(correctRows.map((r) => [r.questionId, r.id]));
  const submittedByQuestion = new Map(submitted.map((a) => [a.questionId, a]));

  type GradedRow = typeof answers.$inferInsert & { ai?: GradeResult | null };

  // Grade every question; AI-written grading runs concurrently per answer.
  const graded: GradedRow[] = await Promise.all(
    qs.map(async (q): Promise<GradedRow> => {
      const s = submittedByQuestion.get(q.id);
      const selectedId = s?.selectedOptionId ?? null;
      const text = (s?.answerText ?? "").trim();

      if (q.type !== "written") {
        const correctId = correctByQuestion.get(q.id);
        const ok = !!selectedId && !!correctId && selectedId === correctId;
        return {
          submissionId,
          questionId: q.id,
          selectedOptionId: selectedId,
          answerText: null,
          isCorrect: ok,
          score: ok ? q.points : 0,
          maxPoints: q.points,
          gradingStatus: "auto",
          ai: null,
        };
      }

      // Written questions
      if (!text) {
        return {
          submissionId,
          questionId: q.id,
          selectedOptionId: null,
          answerText: null,
          isCorrect: false,
          score: 0,
          maxPoints: q.points,
          gradingStatus: "auto",
          feedback: "پاسخی ثبت نشده است.",
          ai: null,
        };
      }
      if (quiz.gradingMode === "ai") {
        const r = await gradeWrittenAnswer({
          questionText: q.text,
          referenceAnswer: q.referenceAnswer,
          userAnswer: text,
        });
        return {
          submissionId,
          questionId: q.id,
          selectedOptionId: null,
          answerText: text,
          isCorrect: r.score >= 60,
          score: Math.round(((q.points * r.score) / 100) * 100) / 100,
          maxPoints: q.points,
          gradingStatus: "ai_scored",
          aiScore: r.score,
          feedback: r.feedback,
          ai: r,
        };
      }
      // Manual mode: enqueue for review
      return {
        submissionId,
        questionId: q.id,
        selectedOptionId: null,
        answerText: text,
        isCorrect: null,
        score: null,
        maxPoints: q.points,
        gradingStatus: "pending",
        ai: null,
      };
    }),
  );

  const pendingCount = graded.filter((g) => g.gradingStatus === "pending").length;
  const totalScore = graded.reduce((sum, g) => sum + (Number(g.score) || 0), 0);
  const status = pendingCount > 0 ? "awaiting_grading" : "graded";
  const now = new Date();

  await db.transaction(async (tx) => {
    const inserted = await tx
      .insert(answers)
      .values(graded.map(({ ai: _ai, ...row }) => row))
      .returning({ id: answers.id, questionId: answers.questionId });

    const idByQuestion = new Map(inserted.map((r) => [r.questionId, r.id]));
    const aiRows = graded
      .filter((g) => g.ai)
      .map((g) => ({
        answerId: idByQuestion.get(g.questionId)!,
        provider: g.ai!.provider,
        model: g.ai!.model,
        score: g.ai!.score,
        feedback: g.ai!.feedback,
        latencyMs: g.ai!.latencyMs,
      }));
    if (aiRows.length > 0) {
      await tx.insert(aiReviews).values(aiRows);
    }

    await tx
      .update(submissions)
      .set({
        status,
        totalScore: Math.round(totalScore * 100) / 100,
        submittedAt: now,
        gradedAt: status === "graded" ? now : null,
      })
      .where(eq(submissions.id, submissionId));
  });

  revalidatePath("/results");
  revalidatePath("/admin/grading");
  return { ok: true };
}
