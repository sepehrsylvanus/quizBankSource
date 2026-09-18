# بانک سؤال — Quiz Bank

A production-ready quiz platform with a Persian (RTL) UI, three question types
(4-option multiple choice, true/false, written), an **AI grading agent** for
written answers (score 0–100 + Persian feedback), a creator-chosen **grading
mode per quiz** (AI / manual), a full **admin panel** (question bank, quiz
builder, grading queue, request management, analytics) and a user **request
workflow** (pending / approved / rejected).

## Tech Stack

- **Next.js 16** (App Router, React Server Components, Server Actions)
- **PostgreSQL** via **Drizzle ORM** (Supabase-compatible — see below)
- **TypeScript + Tailwind CSS 4**, Vazirmatn font, `dir="rtl"`
- **Zod** for input validation • **server-only** session auth (scrypt + httpOnly cookie)
- Provider-agnostic **AI service** (`src/lib/ai`): `mock` (offline), **OpenAI** or **Anthropic**

## Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Configure the environment
cp .env.example .env
#    → set DATABASE_URL (PostgreSQL connection string)
#    → optionally set AI_PROVIDER=openai|anthropic + the provider API key

# 3. Create the database schema
npm run db:push        # drizzle-kit push

# 4. Seed demo data (admin + demo user + sample quizzes/questions)
npm run seed
#    → Admin: admin / Admin123456   (override via ADMIN_USERNAME/ADMIN_PASSWORD)
#    → User : demo  / User12345

# 5. Run
npm run dev            # development
npm run build && npm start   # production
```

## Supabase

The app talks to PostgreSQL through `DATABASE_URL`, so it works with any
Postgres — including Supabase. To deploy on Supabase:

1. Create a Supabase project.
2. Open the SQL editor and run **`supabase/schema.sql`** (creates tables,
   triggers, **Row Level Security policies**, the `submit_quiz` SECURITY
   DEFINER function and the `options_public` view that hides `is_correct`).
3. Copy the pooled connection string (Settings → Database → Connection
   string → Transaction pooler) into `.env` as `DATABASE_URL`.
4. Run `npm run seed`, then promote the admin row in `profiles`
   (`update profiles set role='admin' where id='<your user id>'`).

## AI Provider Configuration

| Var | Values | Notes |
|---|---|---|
| `AI_PROVIDER` | `mock` (default), `openai`, `anthropic` | `mock` = deterministic offline grader |
| `OPENAI_API_KEY` / `OPENAI_MODEL` | key / `gpt-4o-mini` | when `AI_PROVIDER=openai` |
| `ANTHROPIC_API_KEY` / `ANTHROPIC_MODEL` | key / `claude-3-5-haiku-20241022` | when `AI_PROVIDER=anthropic` |

If the configured provider fails at runtime, the service automatically falls
back to the offline grader so a submission is never blocked. MCQ and
true/false questions are always graded deterministically (no AI).

## Feature Map

| Area | Where |
|---|---|
| Question bank CRUD (3 types, category, difficulty, explanation) | `/admin/questions` |
| Quiz builder (add/reorder/points, time limit, grading mode, publish) | `/admin/quizzes` |
| Manual grading queue (user answer ↔ reference ↔ AI output) | `/admin/grading` |
| Request management (approve/reject with note) | `/admin/requests` |
| Analytics (KPIs, per-quiz, per-question) | `/admin` |
| User: browse/take quizzes, results, requests | `/quizzes`, `/results`, `/requests` |

## Performance Notes

- Server Components everywhere; client JS only for interactive widgets.
- `is_correct` is **never** sent to the quiz-taker client bundle.
- Server-side pagination/search/filter everywhere; debounced search input.
- `unstable_cache` + `revalidateTag` (`categories`, `quizzes`) for hot reads.
- Single aggregate SQL queries for KPIs (no N+1), `IN`-batched lookups,
  selected columns only (never `select *`).
- DB indexes on all hot paths (see `src/db/schema.ts`).
