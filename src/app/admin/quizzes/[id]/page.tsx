// Admin quiz manage page: settings form, ordered question list (points,
// reorder, remove) and a server-side search to add questions from the bank.
import Link from "next/link";
import { notFound } from "next/navigation";
import { asc, eq, ilike } from "drizzle-orm";
import {
  ArrowDown,
  ArrowRight,
  ArrowUp,
  Layers,
  Plus,
  Search,
  Settings2,
  X,
} from "lucide-react";
import { db } from "@/db";
import { categories, questions, quizQuestions, quizzes } from "@/db/schema";
import {
  addQuestionToQuizAction,
  moveQuizQuestionAction,
  removeQuizQuestionAction,
  updateQuizAction,
  updateQuizQuestionPointsAction,
} from "@/actions/admin";
import { getCategories, first, type SearchParams } from "@/lib/queries";
import { Badge, Card, Flash, PageHeader } from "@/components/ui";
import { PublishToggle } from "@/components/admin-widgets";
import QuizSettingsForm from "@/components/quiz-settings-form";
import { faDigits } from "@/lib/format";
import { QUESTION_TYPE_LABEL, QUESTION_TYPE_ICON } from "@/lib/constants";

export const metadata = { title: "مدیریت آزمون" };
export const dynamic = "force-dynamic";

export default async function AdminQuizManagePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: SearchParams;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const aq = first(sp.aq)?.trim();

  const quizRows = await db
    .select({
      id: quizzes.id,
      title: quizzes.title,
      description: quizzes.description,
      categoryId: quizzes.categoryId,
      gradingMode: quizzes.gradingMode,
      timeLimitMinutes: quizzes.timeLimitMinutes,
      published: quizzes.published,
      categoryName: categories.name,
    })
    .from(quizzes)
    .leftJoin(categories, eq(categories.id, quizzes.categoryId))
    .where(eq(quizzes.id, id))
    .limit(1);
  const quiz = quizRows[0];
  if (!quiz) notFound();

  const [cats, quizQs] = await Promise.all([
    getCategories(),
    db
      .select({
        questionId: quizQuestions.questionId,
        orderIndex: quizQuestions.orderIndex,
        points: quizQuestions.points,
        text: questions.text,
        type: questions.type,
      })
      .from(quizQuestions)
      .innerJoin(questions, eq(questions.id, quizQuestions.questionId))
      .where(eq(quizQuestions.quizId, id))
      .orderBy(asc(quizQuestions.orderIndex)),
  ]);

  const inQuiz = new Set(quizQs.map((q) => q.questionId));

  // Candidate questions for the add-search (excludes already-added ones).
  const candidates = await db
    .select({
      id: questions.id,
      text: questions.text,
      type: questions.type,
      categoryName: categories.name,
    })
    .from(questions)
    .innerJoin(categories, eq(categories.id, questions.categoryId))
    // Candidates already inside the quiz are filtered out below, in JS.
    .where(aq ? ilike(questions.text, `%${aq}%`) : undefined)
    .orderBy(asc(questions.updatedAt))
    .limit(aq ? 20 : 8);

  const visibleCandidates = candidates.filter((c) => !inQuiz.has(c.id)).slice(0, 8);

  const updateSettings = updateQuizAction.bind(null, quiz.id);
  const totalPoints = quizQs.reduce((s, q) => s + q.points, 0);

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <Link
          href="/admin/quizzes"
          className="inline-flex items-center gap-1 text-sm font-bold text-stone-400 hover:text-indigo-600"
        >
          <ArrowRight className="size-4" />
          بازگشت به آزمون‌ها
        </Link>
        <div className="flex items-center gap-2">
          <PublishToggle quizId={quiz.id} published={quiz.published} />
          <span className="text-xs font-bold text-stone-500">
            {quiz.published ? "منتشر شده" : "پیش‌نویس"}
          </span>
        </div>
      </div>

      <PageHeader
        icon={Layers}
        title={quiz.title}
        subtitle={`${faDigits(quizQs.length)} سؤال — مجموع ${faDigits(totalPoints)} امتیاز`}
      />

      <Flash
        error={first(sp.error)}
        ok={first(sp.ok) !== undefined}
        okText="تغییرات ذخیره شد."
      />

      <div className="grid gap-6 lg:grid-cols-5">
        {/* Settings */}
        <Card className="h-fit p-5 lg:col-span-2">
          <h2 className="mb-4 flex items-center gap-2 font-extrabold text-stone-900">
            <Settings2 className="size-4 text-indigo-500" />
            تنظیمات آزمون
          </h2>
          <QuizSettingsForm
            categories={cats}
            action={updateSettings}
            submitLabel="ذخیرهٔ تنظیمات"
            initial={{
              title: quiz.title,
              description: quiz.description,
              categoryId: quiz.categoryId,
              timeLimitMinutes: quiz.timeLimitMinutes,
              gradingMode: quiz.gradingMode,
            }}
          />
        </Card>

        {/* Question manager */}
        <div className="space-y-6 lg:col-span-3">
          <Card className="p-5">
            <h2 className="mb-4 font-extrabold text-stone-900">
              سؤالات آزمون ({faDigits(quizQs.length)})
            </h2>
            {quizQs.length === 0 ? (
              <p className="rounded-xl bg-stone-50 p-4 text-center text-sm text-stone-400">
                هنوز سؤالی اضافه نشده است؛ از کادر جستجوی زیر اضافه کنید.
              </p>
            ) : (
              <ol className="space-y-2">
                {quizQs.map((q, i) => {
                  const TypeIcon = QUESTION_TYPE_ICON[q.type];
                  return (
                    <li
                      key={q.questionId}
                      className="flex items-center gap-2 rounded-xl border border-stone-200 bg-white p-3"
                    >
                      <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-stone-100 text-xs font-black text-stone-500">
                        {faDigits(i + 1)}
                      </span>
                      <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-indigo-600/10 text-indigo-600">
                        <TypeIcon className="size-4" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="line-clamp-1 text-sm font-bold text-stone-800">{q.text}</p>
                        <Badge tone="stone" className="mt-0.5">{QUESTION_TYPE_LABEL[q.type]}</Badge>
                      </div>

                      {/* Points */}
                      <form
                        action={updateQuizQuestionPointsAction.bind(null, quiz.id, q.questionId)}
                        className="flex items-center gap-1"
                        title="امتیاز سؤال"
                      >
                        <input
                          name="points"
                          type="number"
                          min={1}
                          max={50}
                          defaultValue={q.points}
                          className="input w-16 px-2 py-1 text-center text-xs tabular-nums"
                          aria-label="امتیاز"
                        />
                        <button type="submit" className="btn-ghost px-1.5 py-1 text-[10px] font-bold text-indigo-600">
                          اعمال
                        </button>
                      </form>

                      {/* Reorder */}
                      <div className="flex flex-col">
                        <form action={moveQuizQuestionAction.bind(null, quiz.id, q.questionId, "up")}>
                          <button type="submit" disabled={i === 0} className="btn-ghost px-1 py-0.5" aria-label="بالا">
                            <ArrowUp className="size-3.5" />
                          </button>
                        </form>
                        <form action={moveQuizQuestionAction.bind(null, quiz.id, q.questionId, "down")}>
                          <button
                            type="submit"
                            disabled={i === quizQs.length - 1}
                            className="btn-ghost px-1 py-0.5"
                            aria-label="پایین"
                          >
                            <ArrowDown className="size-3.5" />
                          </button>
                        </form>
                      </div>

                      <form action={removeQuizQuestionAction.bind(null, quiz.id, q.questionId)}>
                        <button type="submit" className="btn-ghost text-rose-500 hover:bg-rose-50" aria-label="حذف از آزمون">
                          <X className="size-4" />
                        </button>
                      </form>
                    </li>
                  );
                })}
              </ol>
            )}
          </Card>

          {/* Add questions */}
          <Card className="p-5">
            <h2 className="mb-3 font-extrabold text-stone-900">افزودن سؤال از بانک</h2>
            <form method="GET" className="relative mb-3">
              <Search className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-stone-400" />
              <input
                name="aq"
                defaultValue={aq}
                placeholder="جستجو در بانک سؤالات…"
                className="input pr-9"
              />
            </form>
            {visibleCandidates.length === 0 ? (
              <p className="rounded-xl bg-stone-50 p-4 text-center text-sm text-stone-400">
                سؤالی یافت نشد.
              </p>
            ) : (
              <ul className="space-y-2">
                {visibleCandidates.map((c) => {
                  const TypeIcon = QUESTION_TYPE_ICON[c.type];
                  return (
                    <li
                      key={c.id}
                      className="flex items-center gap-3 rounded-xl border border-stone-100 bg-stone-50/60 p-3"
                    >
                      <TypeIcon className="size-4 shrink-0 text-stone-400" />
                      <div className="min-w-0 flex-1">
                        <p className="line-clamp-1 text-sm font-medium text-stone-700">{c.text}</p>
                        <span className="text-[10px] text-stone-400">{c.categoryName}</span>
                      </div>
                      <form action={addQuestionToQuizAction.bind(null, quiz.id, c.id)}>
                        <button type="submit" className="btn-secondary btn-sm">
                          <Plus className="size-3.5" />
                          افزودن
                        </button>
                      </form>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
