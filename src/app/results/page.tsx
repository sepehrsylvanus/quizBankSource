// "My results" — paginated list of the current user's attempts.
import Link from "next/link";
import { desc, eq, sql } from "drizzle-orm";
import {
  CheckCircle2,
  ChevronLeft,
  ClipboardList,
  Hourglass,
  Loader,
  Trophy,
} from "lucide-react";
import { db } from "@/db";
import { quizzes, submissions } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { first, pageOf, type SearchParams } from "@/lib/queries";
import { Badge, Card, EmptyState, PageHeader } from "@/components/ui";
import Pagination from "@/components/pagination";
import { faDate, faDigits, faPercent } from "@/lib/format";
import { PAGE_SIZE, SUBMISSION_STATUS_LABEL } from "@/lib/constants";

export const metadata = { title: "نتایج من" };

const statusMeta = {
  in_progress: { tone: "sky" as const, icon: Loader },
  awaiting_grading: { tone: "amber" as const, icon: Hourglass },
  graded: { tone: "emerald" as const, icon: CheckCircle2 },
};

export default async function ResultsPage({ searchParams }: { searchParams: SearchParams }) {
  const user = await requireUser();
  const sp = await searchParams;
  const page = pageOf(first(sp.page));

  const [rows, countRows] = await Promise.all([
    db
      .select({
        id: submissions.id,
        status: submissions.status,
        totalScore: submissions.totalScore,
        maxScore: submissions.maxScore,
        startedAt: submissions.startedAt,
        submittedAt: submissions.submittedAt,
        quizTitle: quizzes.title,
      })
      .from(submissions)
      .innerJoin(quizzes, eq(quizzes.id, submissions.quizId))
      .where(eq(submissions.userId, user.id))
      .orderBy(desc(submissions.startedAt))
      .limit(PAGE_SIZE)
      .offset((page - 1) * PAGE_SIZE),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(submissions)
      .where(eq(submissions.userId, user.id)),
  ]);

  const total = countRows[0]?.count ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <main className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
      <PageHeader
        icon={Trophy}
        title="نتایج من"
        subtitle={`${faDigits(total)} تلاش ثبت‌شده`}
      />

      {rows.length === 0 ? (
        <EmptyState
          icon={ClipboardList}
          title="هنوز در آزمونی شرکت نکرده‌اید"
          hint="از فهرست آزمون‌ها یکی را انتخاب کنید و شروع کنید."
          action={
            <Link href="/quizzes" className="btn-primary btn-sm mt-1">
              مشاهدهٔ آزمون‌ها
            </Link>
          }
        />
      ) : (
        <div className="space-y-3">
          {rows.map((r) => {
            const meta = statusMeta[r.status];
            const pct = r.maxScore > 0 ? r.totalScore / r.maxScore : 0;
            return (
              <Link key={r.id} href={`/results/${r.id}`}>
                <Card className="group flex flex-wrap items-center gap-4 p-4 transition-all hover:border-indigo-300 hover:shadow-md sm:p-5">
                  <span
                    className={`grid size-12 shrink-0 place-items-center rounded-2xl ${
                      r.status === "graded"
                        ? "bg-emerald-600/10 text-emerald-600"
                        : r.status === "awaiting_grading"
                          ? "bg-amber-600/10 text-amber-600"
                          : "bg-sky-600/10 text-sky-600"
                    }`}
                  >
                    <meta.icon className="size-6" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <h3 className="truncate font-extrabold text-stone-900 group-hover:text-indigo-700">
                      {r.quizTitle}
                    </h3>
                    <p className="mt-0.5 text-xs text-stone-400">
                      {faDate(r.startedAt)}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge tone={meta.tone}>{SUBMISSION_STATUS_LABEL[r.status]}</Badge>
                    <span className="text-lg font-black tabular-nums text-stone-900">
                      {r.status === "in_progress" ? "—" : faPercent(pct)}
                    </span>
                    <ChevronLeft className="size-4 text-stone-300 transition-transform group-hover:-translate-x-1" />
                  </div>
                </Card>
              </Link>
            );
          })}
        </div>
      )}

      <Pagination page={page} totalPages={totalPages} params={{}} />
    </main>
  );
}
