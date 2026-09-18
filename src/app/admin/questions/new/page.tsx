// Admin: create a new question.
import Link from "next/link";
import { ArrowRight, FilePlus2 } from "lucide-react";
import { getCategories } from "@/lib/queries";
import { Card, PageHeader } from "@/components/ui";
import QuestionForm from "@/components/question-form";

export const metadata = { title: "سؤال جدید" };

export default async function NewQuestionPage() {
  const cats = await getCategories();

  return (
    <div>
      <Link
        href="/admin/questions"
        className="mb-4 inline-flex items-center gap-1 text-sm font-bold text-stone-400 hover:text-indigo-600"
      >
        <ArrowRight className="size-4" />
        بازگشت به بانک سؤالات
      </Link>
      <PageHeader icon={FilePlus2} title="ایجاد سؤال جدید" />
      {cats.length === 0 ? (
        <Card className="p-6 text-sm text-stone-500">
          ابتدا از صفحهٔ بانک سؤالات یک دسته‌بندی بسازید.
        </Card>
      ) : (
        <Card className="p-5 sm:p-6">
          <QuestionForm categories={cats} />
        </Card>
      )}
    </div>
  );
}
