"use client";

// Admin question create/edit form. Switches the answer editor based on the
// selected question type (4-option / true-false / written) and submits the
// raw FormData to the server action for Zod validation.
import { useState, useTransition } from "react";
import { AlertTriangle, Loader2, Save } from "lucide-react";
import { createQuestionAction, updateQuestionAction } from "@/actions/admin";
import { DIFFICULTY_LABEL, QUESTION_TYPE_LABEL } from "@/lib/constants";

type QuestionType = "mcq" | "true_false" | "written";

export type QuestionFormInitial = {
  type: QuestionType;
  categoryId: number;
  text: string;
  difficulty: "easy" | "medium" | "hard";
  explanation: string;
  referenceAnswer: string;
  options: string[]; // mcq: 4 texts
  correctIndex: number; // mcq index or tf: 0 = صحیح, 1 = غلط
};

export default function QuestionForm({
  categories,
  initial,
  questionId,
}: {
  categories: { id: number; name: string }[];
  initial?: QuestionFormInitial;
  questionId?: string;
}) {
  const [type, setType] = useState<QuestionType>(initial?.type ?? "mcq");
  const [correctIndex, setCorrectIndex] = useState(initial?.correctIndex ?? 0);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    fd.set("type", type);
    fd.set("correctIndex", String(correctIndex));
    if (type === "true_false") {
      fd.set("tfCorrect", correctIndex === 0 ? "true" : "false");
    }
    startTransition(async () => {
      const res = questionId
        ? await updateQuestionAction(questionId, fd)
        : await createQuestionAction(fd);
      if (res?.error) setError(res.error);
    });
  }

  const typeOptions: QuestionType[] = ["mcq", "true_false", "written"];

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      {error ? (
        <div className="flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">
          <AlertTriangle className="size-4 shrink-0" />
          {error}
        </div>
      ) : null}

      {/* Type selector */}
      <div>
        <label className="label">نوع سؤال</label>
        <div className="grid grid-cols-3 gap-2">
          {typeOptions.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setType(t)}
              className={`rounded-xl border px-3 py-2.5 text-sm font-bold transition-all ${
                type === t
                  ? "border-indigo-500 bg-indigo-50 text-indigo-700 shadow-sm"
                  : "border-stone-200 bg-white text-stone-500 hover:border-stone-300"
              }`}
              aria-pressed={type === t}
            >
              {QUESTION_TYPE_LABEL[t]}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="categoryId">دسته‌بندی</label>
          <select
            id="categoryId"
            name="categoryId"
            defaultValue={initial?.categoryId ?? categories[0]?.id}
            className="input"
            required
          >
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="difficulty">درجهٔ سختی</label>
          <select
            id="difficulty"
            name="difficulty"
            defaultValue={initial?.difficulty ?? "medium"}
            className="input"
          >
            {Object.entries(DIFFICULTY_LABEL).map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label className="label" htmlFor="text">صورت سؤال</label>
        <textarea
          id="text"
          name="text"
          rows={3}
          required
          defaultValue={initial?.text}
          className="input leading-7"
          placeholder="متن سؤال را بنویسید…"
        />
      </div>

      {type === "mcq" ? (
        <div>
          <label className="label">گزینه‌ها (گزینهٔ درست را انتخاب کنید)</label>
          <div className="space-y-2">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="flex items-center gap-2">
                <input
                  type="radio"
                  name="correctRadio"
                  checked={correctIndex === i}
                  onChange={() => setCorrectIndex(i)}
                  className="size-4 accent-indigo-600"
                  aria-label={`گزینهٔ درست ${i + 1}`}
                />
                <input
                  name={`option${i + 1}`}
                  defaultValue={initial?.options[i]}
                  required
                  className="input"
                  placeholder={`گزینهٔ ${i + 1}`}
                />
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {type === "true_false" ? (
        <div>
          <label className="label">پاسخ درست</label>
          <div className="grid grid-cols-2 gap-2">
            {["صحیح", "غلط"].map((l, i) => (
              <button
                key={l}
                type="button"
                onClick={() => setCorrectIndex(i)}
                className={`rounded-xl border px-3 py-2.5 text-sm font-bold transition-all ${
                  correctIndex === i
                    ? "border-emerald-500 bg-emerald-50 text-emerald-700"
                    : "border-stone-200 bg-white text-stone-500 hover:border-stone-300"
                }`}
                aria-pressed={correctIndex === i}
              >
                {l}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {type === "written" ? (
        <div>
          <label className="label" htmlFor="referenceAnswer">پاسخ مرجع</label>
          <textarea
            id="referenceAnswer"
            name="referenceAnswer"
            rows={4}
            required
            defaultValue={initial?.referenceAnswer}
            className="input leading-7"
            placeholder="پاسخ نمونه برای تصحیح هوش مصنوعی / دستی…"
          />
        </div>
      ) : null}

      <div>
        <label className="label" htmlFor="explanation">توضیح پاسخ (اختیاری)</label>
        <textarea
          id="explanation"
          name="explanation"
          rows={2}
          defaultValue={initial?.explanation}
          className="input leading-7"
          placeholder="توضیحی که کاربر پس از تصحیح می‌بیند…"
        />
      </div>

      <div className="flex justify-end">
        <button type="submit" disabled={pending} className="btn-primary">
          {pending ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Save className="size-4" />
          )}
          {questionId ? "ذخیرهٔ تغییرات" : "ایجاد سؤال"}
        </button>
      </div>
    </form>
  );
}
