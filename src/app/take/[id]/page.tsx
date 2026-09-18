// Quiz runner page (server component). Loads the attempt, enforces ownership,
// and passes only SAFE fields to the client (correct answers never leave the server).
import { notFound, redirect } from "next/navigation";
import { asc, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { options, questions, quizQuestions, quizzes, submissions } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import QuizTaker, { type TakerQuestion } from "@/components/quiz-taker";

export const metadata = { title: "در حال برگزاری آزمون" };

export default async function TakeQuizPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireUser();

  const subRows = await db
    .select({
      id: submissions.id,
      quizId: submissions.quizId,
      userId: submissions.userId,
      status: submissions.status,
      startedAt: submissions.startedAt,
    })
    .from(submissions)
    .where(eq(submissions.id, id))
    .limit(1);
  const sub = subRows[0];
  if (!sub || sub.userId !== user.id) notFound();
  if (sub.status !== "in_progress") redirect(`/results/${sub.id}`);

  const quizRows = await db
    .select({
      id: quizzes.id,
      title: quizzes.title,
      timeLimitMinutes: quizzes.timeLimitMinutes,
    })
    .from(quizzes)
    .where(eq(quizzes.id, sub.quizId))
    .limit(1);
  const quiz = quizRows[0];
  if (!quiz) notFound();

  const qs = await db
    .select({
      id: questions.id,
      type: questions.type,
      text: questions.text,
      points: quizQuestions.points,
    })
    .from(quizQuestions)
    .innerJoin(questions, eq(questions.id, quizQuestions.questionId))
    .where(eq(quizQuestions.quizId, quiz.id))
    .orderBy(asc(quizQuestions.orderIndex));

  // Only id + text of options are sent to the client — never isCorrect.
  const optRows = qs.length
    ? await db
        .select({
          id: options.id,
          questionId: options.questionId,
          text: options.text,
          orderIndex: options.orderIndex,
        })
        .from(options)
        .where(
          inArray(
            options.questionId,
            qs.map((q) => q.id),
          ),
        )
        .orderBy(asc(options.orderIndex))
    : [];

  const optionsByQuestion = new Map<string, { id: string; text: string }[]>();
  for (const o of optRows) {
    const list = optionsByQuestion.get(o.questionId) ?? [];
    list.push({ id: o.id, text: o.text });
    optionsByQuestion.set(o.questionId, list);
  }

  const takerQuestions: TakerQuestion[] = qs.map((q) => ({
    id: q.id,
    type: q.type,
    text: q.text,
    points: q.points,
    options: optionsByQuestion.get(q.id) ?? [],
  }));

  // Remaining time computed server-side so a refresh keeps the real deadline.
  let initialSeconds: number | null = null;
  if (quiz.timeLimitMinutes) {
    const deadline = new Date(sub.startedAt).getTime() + quiz.timeLimitMinutes * 60_000;
    initialSeconds = Math.max(0, Math.floor((deadline - Date.now()) / 1000));
  }

  return (
    <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      <QuizTaker
        submissionId={sub.id}
        quizTitle={quiz.title}
        questions={takerQuestions}
        initialSeconds={initialSeconds}
      />
    </main>
  );
}
