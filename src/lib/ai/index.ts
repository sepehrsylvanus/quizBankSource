// ---------------------------------------------------------------------------
// Provider-agnostic AI grading service.
//
// The `GradingProvider` interface abstracts the LLM provider so OpenAI,
// Anthropic (or any future vendor) can be swapped via the AI_PROVIDER env var
// without touching the rest of the codebase. All feedback is produced in
// Persian. A deterministic offline "mock" provider keeps the app fully
// functional when no API key is configured.
// ---------------------------------------------------------------------------

import { z } from "zod";

export interface GradingInput {
  questionText: string;
  referenceAnswer: string;
  userAnswer: string;
}

export interface GradingOutput {
  /** 0-100 */
  score: number;
  /** Feedback text written in Persian */
  feedback: string;
}

interface GradingProvider {
  readonly name: string;
  readonly model: string;
  grade(input: GradingInput): Promise<GradingOutput>;
}

// Validates the JSON payload we ask every provider to return.
const gradingResponseSchema = z.object({
  score: z.coerce.number().min(0).max(100),
  feedback: z.string().min(1).max(4000),
});

// Z.ai's free GLM tier can be slow (observed >60s); keep a generous ceiling.
const GRADING_TIMEOUT_MS = 120_000;

// ---------------------------------------------------------------------------
// Shared prompt (Persian)
// ---------------------------------------------------------------------------

function buildPrompt(input: GradingInput): string {
  return [
    "تو یک مصحح دقیق و منصف آزمون هستی. پاسخ دانش‌آموز به سؤال تشریحی زیر را با پاسخ مرجع مقایسه کن.",
    "معیارها: درستی محتوا نسبت به پاسخ مرجع، پوشش نکات کلیدی، و روانی متن. امتیاز باید عددی بین ۰ تا ۱۰۰ باشد.",
    "بازخورد باید حداکثر در ۴ جمله کوتاه، محترمانه، سازنده و کاملاً به زبان فارسی نوشته شود: ابتدا نکات درست پاسخ را بگو، سپس موارد جاافتاده یا نادرست را اشاره کن.",
    "",
    `سؤال: ${input.questionText}`,
    `پاسخ مرجع: ${input.referenceAnswer}`,
    `پاسخ دانش‌آموز: ${input.userAnswer}`,
    "",
    'خروجی را فقط به صورت یک آبجکت JSON معتبر برگردان بدون هیچ متن اضافه، با کلیدهای {"score": number, "feedback": string}',
  ].join("\n");
}

/** Extract the first JSON object from an LLM response that may include markdown fences. */
function extractJsonObject(raw: string): unknown {
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const cleaned = fenced ? fenced[1] : raw;
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) {
    throw new Error("No JSON object found in AI response");
  }
  return JSON.parse(cleaned.slice(start, end + 1));
}

// ---------------------------------------------------------------------------
// OpenAI provider (Chat Completions API, JSON mode)
// ---------------------------------------------------------------------------

class OpenAIProvider implements GradingProvider {
  readonly name = "openai";
  readonly model = process.env.OPENAI_MODEL ?? "gpt-4o-mini";

  constructor(private apiKey: string) {}

  async grade(input: GradingInput): Promise<GradingOutput> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), GRADING_TIMEOUT_MS);
    const baseUrl = process.env.OPENAI_BASE_URL ?? "https://api.openai.com/v1";
    try {
      const res = await fetch(`${baseUrl}/chat/completions`, {
        method: "POST",
        signal: controller.signal,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: this.model,
          temperature: 0.2,
          // Reasoning models (e.g. GLM-4.5) spend tokens thinking before the
          // JSON answer, so a small cap truncates the reply before content.
          max_tokens: 2000,
          response_format: { type: "json_object" },
          // Z.ai GLM models accept this to skip the reasoning phase; only sent
          // against custom gateways since OpenAI rejects unknown parameters.
          ...(process.env.OPENAI_BASE_URL
            ? { thinking: { type: "disabled" } }
            : {}),
          messages: [
            {
              role: "system",
              content:
                "تو یک مصحح آزمون هستی و فقط JSON معتبر به زبان فارسی برمی‌گردانی.",
            },
            { role: "user", content: buildPrompt(input) },
          ],
        }),
      });
      if (!res.ok) throw new Error(`OpenAI HTTP ${res.status}`);
      const data = (await res.json()) as {
        choices?: { message?: { content?: string; reasoning_content?: string } }[];
      };
      const message = data.choices?.[0]?.message;
      // Reasoning models may still put everything in reasoning_content with an
      // empty content field — fall back to it when content is blank.
      const content = message?.content?.trim() || message?.reasoning_content || "";
      const parsed = gradingResponseSchema.parse(extractJsonObject(content));
      return { score: Math.round(parsed.score), feedback: parsed.feedback };
    } finally {
      clearTimeout(timeout);
    }
  }
}

// ---------------------------------------------------------------------------
// Anthropic provider (Messages API)
// ---------------------------------------------------------------------------

class AnthropicProvider implements GradingProvider {
  readonly name = "anthropic";
  readonly model = process.env.ANTHROPIC_MODEL ?? "claude-3-5-haiku-20241022";

  constructor(private apiKey: string) {}

  async grade(input: GradingInput): Promise<GradingOutput> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), GRADING_TIMEOUT_MS);
    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        signal: controller.signal,
        headers: {
          "Content-Type": "application/json",
          "x-api-key": this.apiKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: this.model,
          max_tokens: 600,
          temperature: 0.2,
          system:
            "تو یک مصحح آزمون هستی و فقط JSON معتبر به زبان فارسی برمی‌گردانی.",
          messages: [{ role: "user", content: buildPrompt(input) }],
        }),
      });
      if (!res.ok) throw new Error(`Anthropic HTTP ${res.status}`);
      const data = (await res.json()) as {
        content?: { type: string; text?: string }[];
      };
      const text = data.content?.find((b) => b.type === "text")?.text ?? "";
      const parsed = gradingResponseSchema.parse(extractJsonObject(text));
      return { score: Math.round(parsed.score), feedback: parsed.feedback };
    } finally {
      clearTimeout(timeout);
    }
  }
}

// ---------------------------------------------------------------------------
// Mock provider — deterministic keyword-overlap grader (offline friendly).
// Used by default and as a fallback when the configured provider fails.
// ---------------------------------------------------------------------------

/** Normalize Persian/Arabic variants so keyword matching is robust. */
function normalizeFa(text: string): string {
  return text
    .replace(/[ي]/g, "ی")
    .replace(/[ك]/g, "ک")
    .replace(/[۰-۹]/g, (d) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d)))
    .replace(/[‌\u200c]/g, " ")
    .toLowerCase();
}

const STOP_WORDS = new Set([
  "است",
  "هست",
  "بود",
  "می",
  "را",
  "به",
  "از",
  "در",
  "و",
  "با",
  "که",
  "این",
  "آن",
  "برای",
  "یک",
  "یا",
  "هم",
  "نیز",
  "های",
  "هایی",
  "شد",
  "شود",
  "کرد",
  "کنند",
  "بین",
  "بر",
  "تا",
  "اگر",
  "چون",
  "اما",
]);

function keywordsOf(text: string): Map<string, number> {
  const map = new Map<string, number>();
  for (const raw of normalizeFa(text).split(/[^؀-ۿa-z0-9]+/i)) {
    const w = raw.trim();
    if (w.length < 3 || STOP_WORDS.has(w)) continue;
    map.set(w, (map.get(w) ?? 0) + 1);
  }
  return map;
}

class MockProvider implements GradingProvider {
  readonly name = "mock";
  readonly model = "heuristic-fa-v1";

  async grade(input: GradingInput): Promise<GradingOutput> {
    const refKw = keywordsOf(input.referenceAnswer);
    const userKw = keywordsOf(input.userAnswer);

    const matched: string[] = [];
    for (const key of refKw.keys()) {
      if (userKw.has(key)) matched.push(key);
    }
    const coverage = refKw.size === 0 ? 0 : matched.length / refKw.size;
    const precision =
      userKw.size === 0 ? 0 : Math.min(1, matched.length / userKw.size + 0.5);
    const f = coverage * Math.min(1, precision);
    const score = Math.min(100, Math.round(100 * Math.pow(f, 0.8)));

    const missing = [...refKw.keys()].filter((k) => !userKw.has(k));
    const parts: string[] = [];
    if (matched.length > 0) {
      parts.push(
        `به خوبی به «${matched.slice(0, 5).join("»، «")}» اشاره کرده‌اید.`,
      );
    }
    if (missing.length > 0 && score < 100) {
      parts.push(
        `برای کامل‌تر شدن پاسخ، به «${missing.slice(0, 5).join("»، «")}» هم می‌توانستید بپردازید.`,
      );
    }
    if (userKw.size === 0) {
      parts.push("پاسخ ثبت‌شده فاقد محتوای قابل ارزیابی است.");
    }
    parts.push(
      score >= 80
        ? "در مجموع پاسخ قوی و نزدیک به پاسخ مرجع است."
        : score >= 50
          ? "پاسخ بخشی از نکات مرجع را پوشش می‌دهد اما نیاز به تکمیل دارد."
          : "پاسخ با پاسخ مرجع فاصله قابل توجهی دارد؛ لطفاً نکات کلیدی را مرور کنید.",
    );

    return { score, feedback: parts.join(" ") };
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

function resolveProvider(): GradingProvider {
  const wanted = (process.env.AI_PROVIDER ?? "mock").toLowerCase();
  if (wanted === "openai" && process.env.OPENAI_API_KEY) {
    return new OpenAIProvider(process.env.OPENAI_API_KEY);
  }
  if (wanted === "anthropic" && process.env.ANTHROPIC_API_KEY) {
    return new AnthropicProvider(process.env.ANTHROPIC_API_KEY);
  }
  return new MockProvider();
}

export type GradeResult = GradingOutput & {
  provider: string;
  model: string;
  latencyMs: number;
};

/**
 * Grade a written answer with the configured provider (0-100 + Persian
 * feedback). On provider failure we transparently fall back to the offline
 * mock grader so a submission is never blocked by an AI outage.
 */
export async function gradeWrittenAnswer(
  input: GradingInput,
): Promise<GradeResult> {
  const primary = resolveProvider();
  const started = Date.now();
  try {
    const out = await primary.grade(input);
    return {
      ...out,
      provider: primary.name,
      model: primary.model,
      latencyMs: Date.now() - started,
    };
  } catch (err) {
    console.error("[ai] primary provider failed, falling back to mock:", err);
    const fallback = new MockProvider();
    const out = await fallback.grade(input);
    return {
      score: out.score,
      feedback: `تصحیح خودکار موقت (سرویس هوش مصنوعی در دسترس نبود). ${out.feedback}`,
      provider: fallback.name,
      model: fallback.model,
      latencyMs: Date.now() - started,
    };
  }
}

/** Human-readable label of the currently configured provider (for admin UI). */
export function currentProviderLabel(): string {
  const p = resolveProvider();
  return `${p.name}${p.name === "mock" ? " (حالت آفلاین)" : ""}`;
}
