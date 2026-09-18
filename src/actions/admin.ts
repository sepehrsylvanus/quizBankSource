"use server";

// Admin server actions: question bank CRUD, quiz management, manual grading,
// request review workflow and category creation. Every mutation is validated
// with Zod and revalidates only the paths it affects.
import { redirect } from "next/navigation";
import { revalidatePath, revalidateTag } from "next/cache";
import { and, asc, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import {
  answers,
  categories,
  options,
  questions,
  quizQuestions,
  quizzes,
  requests,
  submissions,
} from "@/db/schema";
import { requireAdmin } from "@/lib/auth";
import { gradeWrittenAnswer } from "@/lib/ai";
import { aiReviews } from "@/db/schema";

export type ActionResult = { error?: string } | void;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function firstIssue(error: z.ZodError): string {
  return error.issues[0]?.message ?? "ورودی نامعتبر است.";
}

function firstWords(text: string, count: number): string {
  return text.split(/\s+/).slice(0, count).join(" ");
}

// ---------------------------------------------------------------------------
// Categories
// ---------------------------------------------------------------------------

const categorySchema = z.object({
  name: z.string().trim().min(2, "نام دسته‌بندی حداقل ۲ نویسه است.").max(80),
});

export async function createCategoryAction(formData: FormData): Promise<void> {
  await requireAdmin();
  const parsed = categorySchema.safeParse({ name: formData.get("name") });
  if (!parsed.success) {
    redirect(
      `/admin/questions?error=${encodeURIComponent(firstIssue(parsed.error))}`,
    );
  }
  try {
    await db.insert(categories).values({ name: parsed.data.name });
  } catch {
    redirect("/admin/questions?error=" + encodeURIComponent("این دسته‌بندی قبلاً وجود دارد."));
  }
  revalidateTag("categories", "max");
  revalidatePath("/admin/questions");
  redirect("/admin/questions?ok=cat");
}

// ---------------------------------------------------------------------------
// Questions
// ---------------------------------------------------------------------------

function parseQuestionForm(formData: FormData):
  | {
      ok: true;
      data: {
        type: "mcq" | "true_false" | "written";
        categoryId: number;
        text: string;
        difficulty: "easy" | "medium" | "hard";
        explanation: string;
        referenceAnswer: string;
        options?: { text: string; isCorrect: boolean }[];
      };
    }
  | { ok: false; error: string } {
  const base = z.object({
    type: z.enum(["mcq", "true_false", "written"]),
    categoryId: z.coerce.number().int().positive("دسته‌بندی را انتخاب کنید."),
    text: z.string().trim().min(5, "صورت سؤال باید حداقل ۵ نویسه باشد.").max(4000),
    difficulty: z.enum(["easy", "medium", "hard"]),
    explanation: z.string().trim().max(4000).optional().default(""),
    referenceAnswer: z.string().trim().max(8000).optional().default(""),
  });
  const parsed = base.safeParse({
    type: formData.get("type"),
    categoryId: formData.get("categoryId"),
    text: formData.get("text"),
    difficulty: formData.get("difficulty"),
    explanation: formData.get("explanation") ?? "",
    referenceAnswer: formData.get("referenceAnswer") ?? "",
  });
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };
  const d = parsed.data;

  if (d.type === "mcq") {
    const opts = [1, 2, 3, 4].map((i) =>
      String(formData.get(`option${i}`) ?? "").trim(),
    );
    if (opts.some((o) => o.length === 0)) {
      return { ok: false, error: "هر چهار گزینه باید تکمیل شوند." };
    }
    const correct = z.coerce
      .number()
      .int()
      .min(0)
      .max(3)
      .safeParse(formData.get("correctIndex"));
    if (!correct.success) {
      return { ok: false, error: "گزینهٔ درست را مشخص کنید." };
    }
    return {
      ok: true,
      data: {
        ...d,
        options: opts.map((text, i) => ({ text, isCorrect: i === correct.data })),
      },
    };
  }

  if (d.type === "true_false") {
    const tf = z.enum(["true", "false"]).safeParse(formData.get("tfCorrect"));
    if (!tf.success) {
      return { ok: false, error: "پاسخ درست (صحیح یا غلط) را مشخص کنید." };
    }
    return {
      ok: true,
      data: {
        ...d,
        options: [
          { text: "صحیح", isCorrect: tf.data === "true" },
          { text: "غلط", isCorrect: tf.data === "false" },
        ],
      },
    };
  }

  // written
  if (d.referenceAnswer.trim().length < 3) {
    return { ok: false, error: "برای سؤال تشریحی، پاسخ مرجع الزامی است." };
  }
  return { ok: true, data: d };
}

async function insertQuestionWithOptions(
  data: Extract<ReturnType<typeof parseQuestionForm>, { ok: true }>["data"],
  createdById: string | null,
): Promise<string> {
  return db.transaction(async (tx) => {
    const [q] = await tx
      .insert(questions)
      .values({
        type: data.type,
        categoryId: data.categoryId,
        text: data.text,
        difficulty: data.difficulty,
        explanation: data.explanation,
        referenceAnswer: data.referenceAnswer,
        createdById,
      })
      .returning({ id: questions.id });

    if (data.options && data.options.length > 0) {
      await tx.insert(options).values(
        data.options.map((o, i) => ({
          questionId: q.id,
          text: o.text,
          isCorrect: o.isCorrect,
          orderIndex: i,
        })),
      );
    }
    return q.id;
  });
}

export async function createQuestionAction(formData: FormData): Promise<ActionResult> {
  const admin = await requireAdmin();
  const parsed = parseQuestionForm(formData);
  if (!parsed.ok) return { error: parsed.error };

  try {
    await insertQuestionWithOptions(parsed.data, admin.id);
  } catch (e) {
    console.error("[admin] createQuestion failed", e);
    return { error: "خطا در ذخیره سؤال. دوباره تلاش کنید." };
  }
  revalidatePath("/admin/questions");
  revalidateTag("categories", "max");
  redirect("/admin/questions?ok=1");
}

export async function updateQuestionAction(
  questionId: string,
  formData: FormData,
): Promise<ActionResult> {
  await requireAdmin();
  if (!z.string().uuid().safeParse(questionId).success) {
    return { error: "شناسه سؤال نامعتبر است." };
  }
  const parsed = parseQuestionForm(formData);
  if (!parsed.ok) return { error: parsed.error };

  try {
    await db.transaction(async (tx) => {
      await tx
        .update(questions)
        .set({
          type: parsed.data.type,
          categoryId: parsed.data.categoryId,
          text: parsed.data.text,
          difficulty: parsed.data.difficulty,
          explanation: parsed.data.explanation,
          referenceAnswer: parsed.data.referenceAnswer,
          updatedAt: new Date(),
        })
        .where(eq(questions.id, questionId));

      // Replace options atomically (simpler and consistent for all types)
      await tx.delete(options).where(eq(options.questionId, questionId));
      if (parsed.data.options && parsed.data.options.length > 0) {
        await tx.insert(options).values(
          parsed.data.options.map((o, i) => ({
            questionId,
            text: o.text,
            isCorrect: o.isCorrect,
            orderIndex: i,
          })),
        );
      }
    });
  } catch (e) {
    console.error("[admin] updateQuestion failed", e);
    return { error: "خطا در به‌روزرسانی سؤال." };
  }
  revalidatePath("/admin/questions");
  redirect("/admin/questions?ok=1");
}

export async function deleteQuestionAction(questionId: string): Promise<void> {
  await requireAdmin();
  // Refuse deletion when the question is already used, to protect history.
  const usage = await db
    .select({
      inQuiz: sql<number>`(select count(*)::int from ${quizQuestions} where ${quizQuestions.questionId} = ${questionId})`,
      inAnswers: sql<number>`(select count(*)::int from ${answers} where ${answers.questionId} = ${questionId})`,
    })
    .from(questions)
    .where(eq(questions.id, questionId))
    .limit(1);
  const u = usage[0];
  if (u && (u.inQuiz > 0 || u.inAnswers > 0)) {
    redirect(
      "/admin/questions?error=" +
        encodeURIComponent("این سؤال در آزمون یا پاسخ‌ها استفاده شده و قابل حذف نیست."),
    );
  }
  await db.delete(questions).where(eq(questions.id, questionId));
  revalidatePath("/admin/questions");
  redirect("/admin/questions?ok=del");
}

// ---------------------------------------------------------------------------
// Quizzes
// ---------------------------------------------------------------------------

const quizSchema = z.object({
  title: z.string().trim().min(3, "عنوان آزمون باید حداقل ۳ نویسه باشد.").max(200),
  description: z.string().trim().max(4000).optional().default(""),
  categoryId: z.coerce.number().int().positive("دسته‌بندی را انتخاب کنید."),
  timeLimitMinutes: z
    .union([z.literal(""), z.coerce.number().int().min(1, "حداقل ۱ دقیقه").max(600)])
    .optional()
    .transform((v) => (v === "" || v === undefined ? null : v)),
  gradingMode: z.enum(["ai", "manual"]),
});

function quizFormData(formData: FormData) {
  return quizSchema.safeParse({
    title: formData.get("title"),
    description: formData.get("description") ?? "",
    categoryId: formData.get("categoryId"),
    timeLimitMinutes: formData.get("timeLimitMinutes") ?? "",
    gradingMode: formData.get("gradingMode"),
  });
}

export async function createQuizAction(formData: FormData): Promise<void> {
  const admin = await requireAdmin();
  const parsed = quizFormData(formData);
  if (!parsed.success) {
    redirect(`/admin/quizzes/new?error=${encodeURIComponent(firstIssue(parsed.error))}`);
  }

  const [q] = await db
    .insert(quizzes)
    .values({
      title: parsed.data.title,
      description: parsed.data.description,
      categoryId: parsed.data.categoryId,
      timeLimitMinutes: parsed.data.timeLimitMinutes,
      gradingMode: parsed.data.gradingMode,
      createdById: admin.id,
    })
    .returning({ id: quizzes.id });

  revalidatePath("/admin/quizzes");
  redirect(`/admin/quizzes/${q.id}?ok=1`);
}

export async function updateQuizAction(
  quizId: string,
  formData: FormData,
): Promise<void> {
  await requireAdmin();
  if (!z.string().uuid().safeParse(quizId).success) {
    redirect("/admin/quizzes?error=" + encodeURIComponent("شناسه نامعتبر است."));
  }
  const parsed = quizFormData(formData);
  if (!parsed.success) {
    redirect(`/admin/quizzes/${quizId}?error=${encodeURIComponent(firstIssue(parsed.error))}`);
  }

  await db
    .update(quizzes)
    .set({ ...parsed.data, updatedAt: new Date() })
    .where(eq(quizzes.id, quizId));

  revalidatePath("/admin/quizzes");
  revalidatePath(`/admin/quizzes/${quizId}`);
  revalidateTag("quizzes", "max");
  redirect(`/admin/quizzes/${quizId}?ok=1`);
}

export async function togglePublishAction(quizId: string): Promise<void> {
  await requireAdmin();
  const rows = await db
    .select({ published: quizzes.published })
    .from(quizzes)
    .where(eq(quizzes.id, quizId))
    .limit(1);
  if (!rows[0]) return;
  await db
    .update(quizzes)
    .set({ published: !rows[0].published, updatedAt: new Date() })
    .where(eq(quizzes.id, quizId));
  revalidatePath("/admin/quizzes");
  revalidatePath(`/admin/quizzes/${quizId}`);
  revalidatePath("/quizzes");
  revalidatePath("/");
  revalidateTag("quizzes", "max");
}

export async function deleteQuizAction(quizId: string): Promise<void> {
  await requireAdmin();
  await db.delete(quizzes).where(eq(quizzes.id, quizId));
  revalidatePath("/admin/quizzes");
  revalidatePath("/quizzes");
  revalidateTag("quizzes", "max");
  redirect("/admin/quizzes?ok=del");
}

// ---------------------------------------------------------------------------
// Quiz question management (add / remove / reorder / points)
// ---------------------------------------------------------------------------

export async function addQuestionToQuizAction(
  quizId: string,
  questionId: string,
): Promise<void> {
  await requireAdmin();
  const existing = await db
    .select({ questionId: quizQuestions.questionId })
    .from(quizQuestions)
    .where(and(eq(quizQuestions.quizId, quizId), eq(quizQuestions.questionId, questionId)))
    .limit(1);
  if (!existing[0]) {
    const agg = await db
      .select({ max: sql<number>`coalesce(max(${quizQuestions.orderIndex}), -1)::int` })
      .from(quizQuestions)
      .where(eq(quizQuestions.quizId, quizId));
    await db.insert(quizQuestions).values({
      quizId,
      questionId,
      orderIndex: (agg[0]?.max ?? -1) + 1,
      points: 1,
    });
  }
  // Adding a question changes the max score of future attempts only.
  revalidatePath(`/admin/quizzes/${quizId}`);
}

export async function removeQuizQuestionAction(
  quizId: string,
  questionId: string,
): Promise<void> {
  await requireAdmin();
  await db
    .delete(quizQuestions)
    .where(and(eq(quizQuestions.quizId, quizId), eq(quizQuestions.questionId, questionId)));
  revalidatePath(`/admin/quizzes/${quizId}`);
}

export async function moveQuizQuestionAction(
  quizId: string,
  questionId: string,
  dir: "up" | "down",
): Promise<void> {
  await requireAdmin();
  const rows = await db
    .select({ questionId: quizQuestions.questionId })
    .from(quizQuestions)
    .where(eq(quizQuestions.quizId, quizId))
    .orderBy(asc(quizQuestions.orderIndex));

  const ids = rows.map((r) => r.questionId);
  const i = ids.indexOf(questionId);
  const j = dir === "up" ? i - 1 : i + 1;
  if (i === -1 || j < 0 || j >= ids.length) return;
  [ids[i], ids[j]] = [ids[j], ids[i]];

  // Persist the full normalized ordering in one transaction.
  await db.transaction(async (tx) => {
    for (let k = 0; k < ids.length; k++) {
      await tx
        .update(quizQuestions)
        .set({ orderIndex: k })
        .where(and(eq(quizQuestions.quizId, quizId), eq(quizQuestions.questionId, ids[k])));
    }
  });
  revalidatePath(`/admin/quizzes/${quizId}`);
}

export async function updateQuizQuestionPointsAction(
  quizId: string,
  questionId: string,
  formData: FormData,
): Promise<void> {
  await requireAdmin();
  const parsed = z.coerce.number().int().min(1).max(50).safeParse(formData.get("points"));
  if (parsed.success) {
    await db
      .update(quizQuestions)
      .set({ points: parsed.data })
      .where(and(eq(quizQuestions.quizId, quizId), eq(quizQuestions.questionId, questionId)));
    revalidatePath(`/admin/quizzes/${quizId}`);
  }
}

// ---------------------------------------------------------------------------
// Manual grading queue
// ---------------------------------------------------------------------------

const gradeSchema = z.object({
  score: z.coerce.number().min(0, "امتیاز بین ۰ تا ۱۰۰ است.").max(100, "امتیاز بین ۰ تا ۱۰۰ است."),
  feedback: z.string().trim().max(2000).optional().default(""),
});

export async function gradeAnswerAction(
  answerId: string,
  scorePercent: number,
  feedback: string,
): Promise<{ ok: boolean; error?: string }> {
  const admin = await requireAdmin();
  const parsed = gradeSchema.safeParse({ score: scorePercent, feedback });
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };

  const rows = await db
    .select({
      id: answers.id,
      submissionId: answers.submissionId,
      maxPoints: answers.maxPoints,
      gradingStatus: answers.gradingStatus,
    })
    .from(answers)
    .where(eq(answers.id, answerId))
    .limit(1);
  const answer = rows[0];
  if (!answer) return { ok: false, error: "پاسخ یافت نشد." };
  if (answer.gradingStatus !== "pending") {
    return { ok: false, error: "این پاسخ قبلاً تصحیح شده است." };
  }

  const finalScore =
    Math.round(((answer.maxPoints * parsed.data.score) / 100) * 100) / 100;
  const now = new Date();

  await db
    .update(answers)
    .set({
      score: finalScore,
      isCorrect: parsed.data.score >= 60,
      gradingStatus: "graded",
      feedback: parsed.data.feedback || null,
      gradedById: admin.id,
      gradedAt: now,
    })
    .where(eq(answers.id, answerId));

  // Recompute the parent submission; flip to "graded" when the queue empties.
  const agg = await db
    .select({
      total: sql<number>`coalesce(sum(${answers.score}), 0)::float`,
      pending: sql<number>`count(*) filter (where ${answers.gradingStatus} = 'pending')::int`,
    })
    .from(answers)
    .where(eq(answers.submissionId, answer.submissionId));
  const a = agg[0];
  if (a) {
    await db
      .update(submissions)
      .set({
        totalScore: Math.round(a.total * 100) / 100,
        status: a.pending > 0 ? "awaiting_grading" : "graded",
        gradedAt: a.pending > 0 ? null : now,
      })
      .where(eq(submissions.id, answer.submissionId));
  }

  revalidatePath("/admin/grading");
  revalidatePath(`/results/${answer.submissionId}`);
  revalidatePath("/results");
  return { ok: true };
}

// ---------------------------------------------------------------------------
// On-demand AI grading (admin helper for the manual grading queue)
// ---------------------------------------------------------------------------

/**
 * Run the AI grading agent on a pending written answer and store the result in
 * ai_reviews (upsert — re-grading overwrites the previous run). Returns the
 * score/feedback so the admin can accept or tweak it before finalizing.
 */
export async function aiGradeAnswerAction(
  answerId: string,
): Promise<{
  ok: boolean;
  error?: string;
  score?: number;
  feedback?: string;
  provider?: string;
  model?: string;
}> {
  await requireAdmin();

  const rows = await db
    .select({
      id: answers.id,
      answerText: answers.answerText,
      gradingStatus: answers.gradingStatus,
      questionText: questions.text,
      referenceAnswer: questions.referenceAnswer,
    })
    .from(answers)
    .innerJoin(questions, eq(questions.id, answers.questionId))
    .where(eq(answers.id, answerId))
    .limit(1);
  const answer = rows[0];
  if (!answer) return { ok: false, error: "پاسخ یافت نشد." };
  if (answer.gradingStatus !== "pending") {
    return { ok: false, error: "این پاسخ قبلاً تصحیح نهایی شده است." };
  }

  const result = await gradeWrittenAnswer({
    questionText: answer.questionText,
    referenceAnswer: answer.referenceAnswer ?? "",
    userAnswer: answer.answerText ?? "",
  });

  await db
    .insert(aiReviews)
    .values({
      answerId: answer.id,
      provider: result.provider,
      model: result.model,
      score: result.score,
      feedback: result.feedback,
      latencyMs: result.latencyMs,
    })
    .onConflictDoUpdate({
      target: aiReviews.answerId,
      set: {
        provider: result.provider,
        model: result.model,
        score: result.score,
        feedback: result.feedback,
        latencyMs: result.latencyMs,
        createdAt: new Date(),
      },
    });

  revalidatePath("/admin/grading");
  return {
    ok: true,
    score: result.score,
    feedback: result.feedback,
    provider: result.provider,
    model: result.model,
  };
}

// ---------------------------------------------------------------------------
// Request review workflow
// ---------------------------------------------------------------------------

const reviewSchema = z.object({
  status: z.enum(["approved", "rejected"]),
  note: z.string().trim().max(1000).optional().default(""),
});

export async function reviewRequestAction(
  requestId: string,
  status: "approved" | "rejected",
  note: string,
): Promise<{ ok: boolean; error?: string }> {
  const admin = await requireAdmin();
  const parsed = reviewSchema.safeParse({ status, note });
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };

  await db
    .update(requests)
    .set({
      status: parsed.data.status,
      adminNote: parsed.data.note || null,
      reviewedById: admin.id,
      reviewedAt: new Date(),
    })
    .where(eq(requests.id, requestId));

  revalidatePath("/admin/requests");
  revalidatePath("/requests");
  return { ok: true };
}
