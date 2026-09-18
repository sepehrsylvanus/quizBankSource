"use client";

// Quiz settings form (title, description, category, time limit, grading mode).
// Used for both creation and editing; the server action is passed as a prop.
import { useState, useTransition, type ReactNode } from "react";
import { Loader2, Save, Sparkles, UserRoundPen } from "lucide-react";
import { GRADING_MODE_LABEL } from "@/lib/constants";

export type QuizSettings = {
  title: string;
  description: string;
  categoryId: number | null;
  timeLimitMinutes: number | null;
  gradingMode: "ai" | "manual";
};

export default function QuizSettingsForm({
  categories,
  action,
  submitLabel,
  initial,
}: {
  categories: { id: number; name: string }[];
  // Server action injected from a server component
  action: (formData: FormData) => Promise<void>;
  submitLabel: ReactNode;
  initial?: QuizSettings;
}) {
  const [mode, setMode] = useState<"ai" | "manual">(initial?.gradingMode ?? "ai");
  const [pending, startTransition] = useTransition();

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    fd.set("gradingMode", mode);
    startTransition(() => action(fd));
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div>
        <label className="label" htmlFor="title">عنوان آزمون</label>
        <input
          id="title"
          name="title"
          className="input"
          required
          minLength={3}
          maxLength={200}
          defaultValue={initial?.title}
          placeholder="مثلاً آزمون جامع ریاضی دهم"
        />
      </div>
      <div>
        <label className="label" htmlFor="description">توضیحات</label>
        <textarea
          id="description"
          name="description"
          rows={3}
          className="input leading-7"
          defaultValue={initial?.description}
          placeholder="توضیح کوتاه دربارهٔ آزمون…"
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="categoryId">دسته‌بندی</label>
          <select
            id="categoryId"
            name="categoryId"
            className="input"
            defaultValue={initial?.categoryId ?? categories[0]?.id}
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
          <label className="label" htmlFor="timeLimitMinutes">
            محدودیت زمان (دقیقه — خالی یعنی بدون محدودیت)
          </label>
          <input
            id="timeLimitMinutes"
            name="timeLimitMinutes"
            type="number"
            min={1}
            max={600}
            className="input"
            dir="ltr"
            defaultValue={initial?.timeLimitMinutes ?? ""}
            placeholder="مثلاً ۳۰"
          />
        </div>
      </div>

      <div>
        <label className="label">حالت تصحیح پاسخ‌های تشریحی</label>
        <div className="grid gap-2 sm:grid-cols-2">
          {(["ai", "manual"] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              aria-pressed={mode === m}
              className={`flex items-center gap-3 rounded-xl border p-4 text-right transition-all ${
                mode === m
                  ? m === "ai"
                    ? "border-violet-400 bg-violet-50"
                    : "border-amber-400 bg-amber-50"
                  : "border-stone-200 bg-white hover:border-stone-300"
              }`}
            >
              <span
                className={`grid size-10 shrink-0 place-items-center rounded-xl ${
                  m === "ai"
                    ? "bg-violet-600/10 text-violet-600"
                    : "bg-amber-600/10 text-amber-600"
                }`}
              >
                {m === "ai" ? <Sparkles className="size-5" /> : <UserRoundPen className="size-5" />}
              </span>
              <span>
                <span className="block text-sm font-extrabold text-stone-800">
                  {GRADING_MODE_LABEL[m]}
                </span>
                <span className="mt-0.5 block text-[11px] leading-5 text-stone-500">
                  {m === "ai"
                    ? "پاسخ‌های تشریحی بلافاصله نمره و بازخورد فارسی می‌گیرند."
                    : "پاسخ‌های تشریحی به صف بررسی ادمین می‌روند تا دستی نمره بگیرند."}
                </span>
              </span>
            </button>
          ))}
        </div>
      </div>

      <div className="flex justify-end">
        <button type="submit" disabled={pending} className="btn-primary">
          {pending ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
          {submitLabel}
        </button>
      </div>
    </form>
  );
}
