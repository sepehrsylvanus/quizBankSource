// Admin quiz list: publish toggles (optimistic), manage links and deletion.
import Link from "next/link";
import { desc, eq, sql } from "drizzle-orm";
import { Layers, Pencil, Plus, Timer, Trash2 } from "lucide-react";
import { db } from "@/db";
import { categories, quizzes } from "@/db/schema";
import { deleteQuizAction } from "@/actions/admin";
import { first, type SearchParams } from "@/lib/queries";
import { Badge, Card, EmptyState, Flash, PageHeader } from "@/components/ui";
import { PublishToggle } from "@/components/admin-widgets";
import { faDigits, faDuration } from "@/lib/format";
import { GRADING_MODE_LABEL } from "@/lib/constants";

export const metadata = { title: "مدیریت آزمون‌ها" };
export const dynamic = "force-dynamic";

export default async function AdminQuizzesPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const sp = await searchParams;

  const rows = await db
    .select({
      id: quizzes.id,
      title: quizzes.title,
      published: quizzes.published,
      gradingMode: quizzes.gradingMode,
      timeLimitMinutes: quizzes.timeLimitMinutes,
      categoryName: categories.name,
      questionCount: sql<number>`(select count(*)::int from quiz_questions where quiz_id = ${quizzes.id})`,
      attemptCount: sql<number>`(select count(*)::int from submissions where quiz_id = ${quizzes.id} and status <> 'in_progress')`,
    })
    .from(quizzes)
    .leftJoin(categories, eq(categories.id, quizzes.categoryId))
    .orderBy(desc(quizzes.updatedAt))
    .limit(100);

  return (
    <div>
      <PageHeader
        icon={Layers}
        title="مدیریت آزمون‌ها"
        subtitle={`${faDigits(rows.length)} آزمون`}
        actions={
          <Link href="/admin/quizzes/new" className="btn-primary btn-sm">
            <Plus className="size-4" />
            آزمون جدید
          </Link>
        }
      />

      <Flash ok={first(sp.ok) !== undefined} okText="عملیات با موفقیت انجام شد." />

      {rows.length === 0 ? (
        <EmptyState
          icon={Layers}
          title="هنوز آزمونی ساخته نشده"
          hint="اولین آزمون را بسازید و سؤالات آن را انتخاب کنید."
          action={
            <Link href="/admin/quizzes/new" className="btn-primary btn-sm mt-1">
              ساخت آزمون
            </Link>
          }
        />
      ) : (
        <div className="space-y-2">
          {rows.map((quiz) => (
            <Card key={quiz.id} className="flex flex-wrap items-center gap-4 p-4">
              <PublishToggle quizId={quiz.id} published={quiz.published} />
              <div className="min-w-0 flex-1">
                <Link
                  href={`/admin/quizzes/${quiz.id}`}
                  className="font-extrabold text-stone-900 hover:text-indigo-700"
                >
                  {quiz.title}
                </Link>
                <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-stone-400">
                  {quiz.categoryName ? <Badge tone="sky">{quiz.categoryName}</Badge> : null}
                  <Badge tone={quiz.gradingMode === "ai" ? "violet" : "amber"}>
                    {GRADING_MODE_LABEL[quiz.gradingMode]}
                  </Badge>
                  <span className="inline-flex items-center gap-1">
                    <Timer className="size-3" />
                    {faDuration(quiz.timeLimitMinutes)}
                  </span>
                  <span>{faDigits(quiz.questionCount)} سؤال</span>
                  <span>{faDigits(quiz.attemptCount)} شرکت</span>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <Link href={`/admin/quizzes/${quiz.id}`} className="btn-ghost" title="مدیریت">
                  <Pencil className="size-4" />
                </Link>
                <form action={deleteQuizAction.bind(null, quiz.id)}>
                  <button type="submit" className="btn-ghost text-rose-600 hover:bg-rose-50" title="حذف آزمون">
                    <Trash2 className="size-4" />
                  </button>
                </form>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
