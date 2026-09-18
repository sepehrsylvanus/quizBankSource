"use client";

// Small interactive admin widgets with optimistic updates for instant UI feedback.
import {
  useOptimistic,
  useState,
  useTransition,
  type FormEvent,
} from "react";
import { useRouter } from "next/navigation";
import {
  Check,
  CheckCheck,
  Loader2,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import {
  aiGradeAnswerAction,
  deleteQuestionAction,
  gradeAnswerAction,
  reviewRequestAction,
  togglePublishAction,
} from "@/actions/admin";
import { faDigits } from "@/lib/format";
import { REQUEST_STATUS_LABEL } from "@/lib/constants";

// ---------------------------------------------------------------------------
// Publish/unpublish switch (optimistic)
// ---------------------------------------------------------------------------

export function PublishToggle({
  quizId,
  published,
}: {
  quizId: string;
  published: boolean;
}) {
  const [optimistic, setOptimistic] = useOptimistic(published);
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      role="switch"
      aria-checked={optimistic}
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          setOptimistic(!optimistic);
          await togglePublishAction(quizId);
        })
      }
      className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${
        optimistic ? "bg-emerald-500" : "bg-stone-300"
      } ${pending ? "opacity-70" : ""}`}
      title={optimistic ? "منتشر شده" : "پیش‌نویس"}
    >
      <span
        className={`inline-block size-4 transform rounded-full bg-white shadow transition-transform ${
          optimistic ? "-translate-x-6" : "-translate-x-1"
        }`}
      />
    </button>
  );
}

// ---------------------------------------------------------------------------
// Confirm-delete button (uses the native confirm dialog)
// ---------------------------------------------------------------------------

export function DeleteQuestionButton({ questionId }: { questionId: string }) {
  const [pending, startTransition] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => {
        if (window.confirm("این سؤال برای همیشه حذف شود؟")) {
          startTransition(() => deleteQuestionAction(questionId));
        }
      }}
      className="btn-ghost text-rose-600 hover:bg-rose-50"
      title="حذف سؤال"
    >
      {pending ? (
        <Loader2 className="size-4 animate-spin" />
      ) : (
        <Trash2 className="size-4" />
      )}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Request review card buttons (optimistic status switch)
// ---------------------------------------------------------------------------

type ReviewStatus = "pending" | "approved" | "rejected";

export function RequestReviewControls({
  requestId,
  initialStatus,
  initialNote,
}: {
  requestId: string;
  initialStatus: ReviewStatus;
  initialNote: string | null;
}) {
  const [status, setStatus] = useOptimistic(initialStatus);
  const [note, setNote] = useState(initialNote ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function decide(next: "approved" | "rejected") {
    setError(null);
    startTransition(async () => {
      setStatus(next);
      const res = await reviewRequestAction(requestId, next, note);
      if (!res.ok) {
        setError(res.error ?? "خطا در ثبت بررسی.");
        router.refresh();
      }
    });
  }

  const tone =
    status === "approved"
      ? "bg-emerald-50 text-emerald-700 border-emerald-200"
      : status === "rejected"
        ? "bg-rose-50 text-rose-700 border-rose-200"
        : "bg-amber-50 text-amber-700 border-amber-200";

  return (
    <div className="border-t border-stone-100 pt-3">
      <div className="mb-2 flex items-center gap-2">
        <span className={`badge border ${tone}`}>
          {REQUEST_STATUS_LABEL[status]}
          {pending && status !== "pending" ? (
            <Loader2 className="size-3 animate-spin" />
          ) : null}
        </span>
      </div>
      {status === "pending" ? (
        <>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={2}
            placeholder="یادداشت برای کاربر (اختیاری)…"
            className="input mb-2 text-xs"
            disabled={pending}
          />
          {error ? (
            <p className="mb-2 text-xs font-medium text-rose-600">{error}</p>
          ) : null}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => decide("approved")}
              disabled={pending}
              className="btn-secondary flex-1 border-emerald-300 text-emerald-700 hover:bg-emerald-50"
            >
              <CheckCheck className="size-4" />
              تأیید درخواست
            </button>
            <button
              type="button"
              onClick={() => decide("rejected")}
              disabled={pending}
              className="btn-secondary flex-1 border-rose-300 text-rose-700 hover:bg-rose-50"
            >
              <X className="size-4" />
              رد درخواست
            </button>
          </div>
        </>
      ) : (
        <p className="text-xs text-stone-400">
          این درخواست بررسی شده است.
          {note ? ` یادداشت: ${note}` : ""}
        </p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Manual grading form (score slider + feedback, optimistic removal)
// ---------------------------------------------------------------------------

export function GradeForm({
  answerId,
  aiScore,
  aiFeedback,
  aiProvider,
}: {
  answerId: string;
  aiScore: number | null;
  aiFeedback?: string;
  aiProvider?: string;
}) {
  const [score, setScore] = useState(aiScore ?? 50);
  const [feedback, setFeedback] = useState("");
  const [state, setState] = useState<"idle" | "saving" | "done">("idle");
  const [error, setError] = useState<string | null>(null);
  const [aiState, setAiState] = useState<
    "idle" | "grading" | { score: number; feedback: string; provider: string }
  >("idle");

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setState("saving");
    setError(null);
    const res = await gradeAnswerAction(answerId, Number(score), feedback);
    if (res.ok) setState("done");
    else {
      setState("idle");
      setError(res.error ?? "خطا در ثبت نمره.");
    }
  }

  async function runAiGrading() {
    setAiState("grading");
    const res = await aiGradeAnswerAction(answerId);
    if (res.ok && typeof res.score === "number") {
      setScore(res.score);
      setFeedback(res.feedback ?? "");
      setAiState({
        score: res.score,
        feedback: res.feedback ?? "",
        provider: `${res.provider ?? "ai"} (${res.model ?? "-"})`,
      });
    } else {
      setAiState("idle");
      setError(res.error ?? "تصحیح با هوش مصنوعی ناموفق بود.");
    }
  }

  if (state === "done") {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-700">
        <Check className="size-4" />
        نمره ثبت شد و از صف خارج می‌شود…
      </div>
    );
  }

  const aiRunning = aiState === "grading";
  const freshAi = aiState !== "idle" && aiState !== "grading" ? aiState : null;

  return (
    <form onSubmit={onSubmit} className="space-y-3 border-t border-stone-100 pt-4">
      <div className="flex items-center gap-3">
        <label className="label mb-0 shrink-0">نمره از ۱۰۰</label>
        <input
          type="range"
          min={0}
          max={100}
          step={5}
          value={score}
          onChange={(e) => setScore(Number(e.target.value))}
          className="w-full accent-indigo-600"
        />
        <span className="w-14 shrink-0 rounded-xl bg-indigo-600 px-2 py-1 text-center text-sm font-extrabold tabular-nums text-white">
          {faDigits(score)}
        </span>
      </div>
      {aiScore !== null && !freshAi ? (
        <p className="flex items-center gap-1.5 text-xs text-violet-600">
          <Sparkles className="size-3.5" />
          امتیاز پیشنهادی هوش مصنوعی: {faDigits(aiScore)} از ۱۰۰ — می‌توانید آن را تغییر دهید.
        </p>
      ) : null}
      {freshAi ? (
        <p className="flex items-center gap-1.5 text-xs font-bold text-violet-600">
          <Sparkles className="size-3.5" />
          تصحیح تازهٔ هوش مصنوعی ({freshAi.provider}) — امتیاز {faDigits(freshAi.score)} از ۱۰۰
          پیش‌فرض شد؛ می‌توانید تغییرش دهید.
        </p>
      ) : null}
      <textarea
        value={feedback}
        onChange={(e) => setFeedback(e.target.value)}
        rows={3}
        placeholder="بازخورد برای کاربر (به فارسی)…"
        className="input text-sm leading-7"
      />
      {error ? (
        <p className="text-xs font-medium text-rose-600">{error}</p>
      ) : null}
      <div className="flex flex-wrap justify-end gap-2">
        <button
          type="button"
          onClick={runAiGrading}
          disabled={aiRunning || state === "saving"}
          className="btn-primary bg-violet-600 hover:bg-violet-700 focus-visible:outline-violet-600"
        >
          {aiRunning ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Sparkles className="size-4" />
          )}
          {aiRunning ? "در حال تصحیح…" : "تصحیح با هوش مصنوعی"}
        </button>
        <button type="submit" disabled={state === "saving"} className="btn-primary">
          {state === "saving" ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Check className="size-4" />
          )}
          ثبت نمرهٔ نهایی
        </button>
      </div>
    </form>
  );
}
