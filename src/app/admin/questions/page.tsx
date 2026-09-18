// Admin question bank: server-side search/filter/pagination + category creation.
import Link from "next/link";
import { and, desc, eq, ilike, sql } from "drizzle-orm";
import { FileQuestion, Pencil, Plus, FolderPlus } from "lucide-react";
import { db } from "@/db";
import { categories, questions } from "@/db/schema";
import { createCategoryAction } from "@/actions/admin";
import { getCategories, buildQuery, first, pageOf, type SearchParams } from "@/lib/queries";
import { Badge, Card, EmptyState, Flash, PageHeader } from "@/components/ui";
import SearchInput from "@/components/search-input";
import Pagination from "@/components/pagination";
import { DeleteQuestionButton } from "@/components/admin-widgets";
import { faDigits } from "@/lib/format";
import {
  DIFFICULTY_LABEL,
  PAGE_SIZE,
  QUESTION_TYPE_ICON,
  QUESTION_TYPE_LABEL,
} from "@/lib/constants";

export const metadata = { title: "بانک سؤالات" };
export const dynamic = "force-dynamic";

const diffTone = { easy: "emerald" as const, medium: "amber" as const, hard: "rose" as const };

export default async function AdminQuestionsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const sp = await searchParams;
  const q = first(sp.q)?.trim();
  const cat = Number(first(sp.cat)) || undefined;
  const type = first(sp.type) as "mcq" | "true_false" | "written" | undefined;
  const diff = first(sp.diff) as "easy" | "medium" | "hard" | undefined;
  const page = pageOf(first(sp.page));

  const where = and(
    q ? ilike(questions.text, `%${q}%`) : undefined,
    cat ? eq(questions.categoryId, cat) : undefined,
    type ? eq(questions.type, type) : undefined,
    diff ? eq(questions.difficulty, diff) : undefined,
  );

  const [rows, countRows, cats] = await Promise.all([
    db
      .select({
        id: questions.id,
        text: questions.text,
        type: questions.type,
        difficulty: questions.difficulty,
        categoryName: categories.name,
        usageCount: sql<number>`(select count(*)::int from quiz_questions where question_id = ${questions.id})`,
      })
      .from(questions)
      .innerJoin(categories, eq(categories.id, questions.categoryId))
      .where(where)
      .orderBy(desc(questions.updatedAt))
      .limit(PAGE_SIZE)
      .offset((page - 1) * PAGE_SIZE),
    db.select({ count: sql<number>`count(*)::int` }).from(questions).where(where),
    getCategories(),
  ]);

  const total = countRows[0]?.count ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const params: Record<string, string | undefined> = {
    q,
    cat: cat ? String(cat) : undefined,
    type,
    diff,
  };

  const filterLink = (
    overrides: Record<string, string | number | undefined>,
    active: boolean,
    label: string,
  ) => (
    <Link
      key={label}
      href={buildQuery(params, { ...overrides, page: undefined })}
      className={`badge border ${active ? "border-indigo-300 bg-indigo-50 text-indigo-700" : "border-stone-200 bg-white text-stone-500 hover:bg-stone-50"}`}
    >
      {label}
    </Link>
  );

  return (
    <div>
      <PageHeader
        icon={FileQuestion}
        title="بانک سؤالات"
        subtitle={`${faDigits(total)} سؤال`}
        actions={
          <Link href="/admin/questions/new" className="btn-primary btn-sm">
            <Plus className="size-4" />
            سؤال جدید
          </Link>
        }
      />

      <Flash
        error={first(sp.error)}
        ok={first(sp.ok) !== undefined}
        okText="عملیات با موفقیت انجام شد."
      />

      {/* Filters */}
      <div className="mb-4 space-y-2">
        <SearchInput placeholder="جستجو در متن سؤال…" className="max-w-md" />
        <div className="flex flex-wrap gap-1.5">
          {filterLink({ cat: undefined }, !cat, "همهٔ دسته‌ها")}
          {cats.map((c) => filterLink({ cat: c.id }, cat === c.id, c.name))}
        </div>
        <div className="flex flex-wrap gap-1.5">
          {filterLink({ type: undefined }, !type, "همهٔ انواع")}
          {Object.entries(QUESTION_TYPE_LABEL).map(([v, l]) =>
            filterLink({ type: v }, type === v, l),
          )}
          <span className="mx-1 w-px bg-stone-200" />
          {filterLink({ diff: undefined }, !diff, "همهٔ سختی‌ها")}
          {Object.entries(DIFFICULTY_LABEL).map(([v, l]) =>
            filterLink({ diff: v }, diff === v, l),
          )}
        </div>
      </div>

      {/* Quick category creation */}
      <Card className="mb-4 p-3">
        <form action={createCategoryAction} className="flex items-center gap-2">
          <FolderPlus className="size-4 shrink-0 text-stone-400" />
          <input
            name="name"
            placeholder="نام دسته‌بندی جدید…"
            className="input max-w-56 border-0 bg-transparent py-1.5 shadow-none focus:ring-0"
            required
            minLength={2}
          />
          <button type="submit" className="btn-secondary btn-sm">
            افزودن دسته
          </button>
        </form>
      </Card>

      {rows.length === 0 ? (
        <EmptyState
          icon={FileQuestion}
          title="سؤالی پیدا نشد"
          hint="فیلترها را تغییر دهید یا سؤال جدیدی بسازید."
        />
      ) : (
        <div className="space-y-2">
          {rows.map((row) => {
            const TypeIcon = QUESTION_TYPE_ICON[row.type];
            return (
              <Card key={row.id} className="flex items-center gap-4 p-4">
                <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-indigo-600/10 text-indigo-600">
                  <TypeIcon className="size-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="line-clamp-1 font-bold text-stone-800">{row.text}</p>
                  <div className="mt-1 flex flex-wrap items-center gap-1.5">
                    <Badge tone="stone">{QUESTION_TYPE_LABEL[row.type]}</Badge>
                    <Badge tone={diffTone[row.difficulty]}>{DIFFICULTY_LABEL[row.difficulty]}</Badge>
                    <Badge tone="sky">{row.categoryName}</Badge>
                    {row.usageCount > 0 ? (
                      <span className="text-[10px] text-stone-400">
                        در {faDigits(row.usageCount)} آزمون
                      </span>
                    ) : null}
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <Link href={`/admin/questions/${row.id}`} className="btn-ghost" title="ویرایش">
                    <Pencil className="size-4" />
                  </Link>
                  <DeleteQuestionButton questionId={row.id} />
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <Pagination page={page} totalPages={totalPages} params={params} />
    </div>
  );
}
