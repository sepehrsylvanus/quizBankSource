// Admin: create a quiz (basic settings). Question selection happens on the
// manage page right after creation.
import Link from "next/link";
import { ArrowRight, Layers } from "lucide-react";
import { createQuizAction } from "@/actions/admin";
import { getCategories, first, type SearchParams } from "@/lib/queries";
import { Card, Flash, PageHeader } from "@/components/ui";
import QuizSettingsForm from "@/components/quiz-settings-form";

export const metadata = { title: "آزمون جدید" };

export default async function NewQuizPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const cats = await getCategories();
  const sp = await searchParams;

  return (
    <div>
      <Link
        href="/admin/quizzes"
        className="mb-4 inline-flex items-center gap-1 text-sm font-bold text-stone-400 hover:text-indigo-600"
      >
        <ArrowRight className="size-4" />
        بازگشت به آزمون‌ها
      </Link>
      <PageHeader icon={Layers} title="ساخت آزمون جدید" />
      <Flash error={first(sp.error)} />
      <Card className="p-5 sm:p-6">
        <QuizSettingsForm
          categories={cats}
          action={createQuizAction}
          submitLabel="ایجاد و ادامه"
        />
      </Card>
    </div>
  );
}
