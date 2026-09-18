// Admin: edit an existing question (loads current options for the form).
import Link from "next/link";
import { notFound } from "next/navigation";
import { asc, eq } from "drizzle-orm";
import { ArrowRight, Pencil } from "lucide-react";
import { db } from "@/db";
import { options, questions } from "@/db/schema";
import { getCategories } from "@/lib/queries";
import { Card, PageHeader } from "@/components/ui";
import QuestionForm, { type QuestionFormInitial } from "@/components/question-form";

export const metadata = { title: "ویرایش سؤال" };

export default async function EditQuestionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const [rows, cats] = await Promise.all([
    db
      .select({
        id: questions.id,
        type: questions.type,
        categoryId: questions.categoryId,
        text: questions.text,
        difficulty: questions.difficulty,
        explanation: questions.explanation,
        referenceAnswer: questions.referenceAnswer,
      })
      .from(questions)
      .where(eq(questions.id, id))
      .limit(1),
    getCategories(),
  ]);
  const question = rows[0];
  if (!question) notFound();

  const opts = await db
    .select({
      text: options.text,
      isCorrect: options.isCorrect,
    })
    .from(options)
    .where(eq(options.questionId, id))
    .orderBy(asc(options.orderIndex));

  // Derive the form's initial state from the persisted question + options.
  const correctIdx = Math.max(0, opts.findIndex((o) => o.isCorrect));
  const initial: QuestionFormInitial = {
    type: question.type,
    categoryId: question.categoryId,
    text: question.text,
    difficulty: question.difficulty,
    explanation: question.explanation,
    referenceAnswer: question.referenceAnswer,
    options:
      question.type === "mcq"
        ? opts.map((o) => o.text)
        : ["", "", "", ""],
    correctIndex: question.type === "true_false" ? (correctIdx === 0 ? 0 : 1) : correctIdx,
  };

  return (
    <div>
      <Link
        href="/admin/questions"
        className="mb-4 inline-flex items-center gap-1 text-sm font-bold text-stone-400 hover:text-indigo-600"
      >
        <ArrowRight className="size-4" />
        بازگشت به بانک سؤالات
      </Link>
      <PageHeader icon={Pencil} title="ویرایش سؤال" />
      <Card className="p-5 sm:p-6">
        <QuestionForm categories={cats} initial={initial} questionId={question.id} />
      </Card>
    </div>
  );
}
