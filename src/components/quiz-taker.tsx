"use client";

// Interactive quiz runner: live countdown, answer state, progress bar and a
// single server-side submit. The client NEVER receives which option is
// correct — grading happens exclusively on the server.
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, CheckCircle2, CircleHelp, Loader2, PenLine, Send, Timer } from "lucide-react";
import { submitQuizAction } from "@/actions/quiz";
import { faClock, faDigits } from "@/lib/format";
import { QUESTION_TYPE_LABEL } from "@/lib/constants";

export type TakerOption = { id: string; text: string };
export type TakerQuestion = {
  id: string;
  type: "mcq" | "true_false" | "written";
  text: string;
  points: number;
  options: TakerOption[];
};

export default function QuizTaker({
  submissionId,
  quizTitle,
  questions,
  initialSeconds,
}: {
  submissionId: string;
  quizTitle: string;
  questions: TakerQuestion[];
  /** Remaining seconds; null when the quiz has no time limit. */
  initialSeconds: number | null;
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<Record<string, string>>({});
  const [written, setWritten] = useState<Record<string, string>>({});
  const [secondsLeft, setSecondsLeft] = useState(initialSeconds);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const submittedRef = useRef(false);

  const answeredCount = useMemo(
    () =>
      questions.filter((q) =>
        q.type === "written"
          ? (written[q.id] ?? "").trim().length > 0
          : !!selected[q.id],
      ).length,
    [questions, selected, written],
  );
  const pct = questions.length
    ? Math.round((answeredCount / questions.length) * 100)
    : 0;

  function doSubmit() {
    if (submittedRef.current) return;
    submittedRef.current = true;
    const payload = {
      submissionId,
      answers: questions.map((q) => ({
        questionId: q.id,
        selectedOptionId: selected[q.id] ?? null,
        answerText: written[q.id] ?? "",
      })),
    };
    startTransition(async () => {
      const res = await submitQuizAction(payload);
      if (res?.ok) {
        router.replace(`/results/${submissionId}`);
      } else {
        submittedRef.current = false;
        setError(res?.error ?? "خطا در ثبت پاسخ‌ها. دوباره تلاش کنید.");
      }
    });
  }

  // Countdown timer + auto submit on expiry.
  useEffect(() => {
    if (secondsLeft === null) return;
    if (secondsLeft <= 0) {
      doSubmit();
      return;
    }
    const t = setInterval(() => setSecondsLeft((s) => (s ?? 0) - 1), 1000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [secondsLeft === null, secondsLeft !== null && secondsLeft <= 0]);

  const timeCritical = secondsLeft !== null && secondsLeft <= 60;

  return (
    <div>
      {/* Sticky status bar */}
      <div className="sticky top-16 z-20 mb-6 rounded-2xl border border-stone-200 bg-white/90 p-3 shadow-sm backdrop-blur">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="text-sm font-bold text-stone-800">{quizTitle}</div>
          <div className="flex items-center gap-3 text-sm">
            <span className="text-stone-500">
              {faDigits(answeredCount)} از {faDigits(questions.length)} پاسخ داده شده
            </span>
            {secondsLeft !== null ? (
              <span
                className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-bold tabular-nums ${
                  timeCritical
                    ? "animate-pulse bg-rose-100 text-rose-700"
                    : "bg-indigo-50 text-indigo-700"
                }`}
              >
                <Timer className="size-4" />
                {faClock(secondsLeft)}
              </span>
            ) : null}
          </div>
        </div>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-stone-100">
          <div
            className="h-full rounded-full bg-gradient-to-l from-indigo-500 to-violet-500 transition-all duration-500"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      {error ? (
        <div className="mb-4 flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">
          <AlertTriangle className="size-4 shrink-0" />
          {error}
        </div>
      ) : null}

      {/* Questions */}
      <ol className="space-y-5">
        {questions.map((q, i) => {
          const TypeIcon =
            q.type === "written" ? PenLine : q.type === "mcq" ? CircleHelp : CheckCircle2;
          return (
            <li key={q.id} className="card p-5 sm:p-6">
              <div className="mb-3 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-xs text-stone-400">
                  <span className="inline-flex items-center gap-1 rounded-full bg-stone-100 px-2.5 py-1 font-medium text-stone-600">
                    <TypeIcon className="size-3.5" />
                    {QUESTION_TYPE_LABEL[q.type]}
                  </span>
                  <span>{faDigits(q.points)} امتیاز</span>
                </div>
                <span className="text-xs font-bold text-stone-300">
                  سؤال {faDigits(i + 1)}
                </span>
              </div>
              <p className="mb-4 font-bold leading-8 text-stone-900">{q.text}</p>

              {q.type !== "written" ? (
                <div className="grid gap-2">
                  {q.options.map((opt) => {
                    const checked = selected[q.id] === opt.id;
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        disabled={pending}
                        onClick={() =>
                          setSelected((s) => ({ ...s, [q.id]: opt.id }))
                        }
                        className={`flex items-center gap-3 rounded-xl border px-4 py-3 text-right text-sm transition-all ${
                          checked
                            ? "border-indigo-500 bg-indigo-50 font-bold text-indigo-900 shadow-sm"
                            : "border-stone-200 bg-white text-stone-700 hover:border-indigo-300 hover:bg-indigo-50/40"
                        }`}
                        aria-pressed={checked}
                      >
                        <span
                          className={`grid size-5 shrink-0 place-items-center rounded-full border-2 transition-colors ${
                            checked ? "border-indigo-600 bg-indigo-600" : "border-stone-300"
                          }`}
                        >
                          {checked ? <span className="size-1.5 rounded-full bg-white" /> : null}
                        </span>
                        {opt.text}
                      </button>
                    );
                  })}
                </div>
              ) : (
                <textarea
                  value={written[q.id] ?? ""}
                  disabled={pending}
                  onChange={(e) =>
                    setWritten((s) => ({ ...s, [q.id]: e.target.value }))
                  }
                  rows={5}
                  placeholder="پاسخ خود را اینجا بنویسید…"
                  className="input min-h-32 leading-7"
                />
              )}
            </li>
          );
        })}
      </ol>

      <div className="mt-8 flex justify-center">
        <button
          type="button"
          onClick={doSubmit}
          disabled={pending}
          className="btn-primary min-w-56 text-base"
        >
          {pending ? (
            <>
              <Loader2 className="size-5 animate-spin" />
              در حال ثبت و تصحیح…
            </>
          ) : (
            <>
              <Send className="size-5" />
              ثبت نهایی پاسخ‌ها
            </>
          )}
        </button>
      </div>
      <p className="mt-3 text-center text-xs text-stone-400">
        پس از ثبت نهایی امکان ویرایش پاسخ‌ها وجود ندارد.
      </p>
    </div>
  );
}
