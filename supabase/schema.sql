-- =============================================================================
-- Quiz Bank — complete Supabase (PostgreSQL) setup script
-- =============================================================================
-- Run this file in the Supabase SQL Editor (or via `supabase db push`).
-- It creates:
--   1. All enums + tables (profiles, categories, questions, options, quizzes,
--      quiz_questions, submissions, answers, ai_reviews, requests)
--   2. Indexes + updated_at triggers
--   3. Row Level Security policies for every table
--   4. A SECURITY DEFINER `submit_quiz` function (deterministic grading path)
--   5. Handy views (options without isCorrect, quiz statistics)
--
-- Auth model: uses Supabase `auth.users`; the public profile (role, name)
-- lives in `public.profiles` and is auto-created by a trigger.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 0. Extensions
-- ---------------------------------------------------------------------------
create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- 1. Enums
-- ---------------------------------------------------------------------------
do $$ begin
  create type user_role as enum ('admin', 'user');
exception when duplicate_object then null; end $$;

do $$ begin
  create type question_type as enum ('mcq', 'true_false', 'written');
exception when duplicate_object then null; end $$;

do $$ begin
  create type difficulty as enum ('easy', 'medium', 'hard');
exception when duplicate_object then null; end $$;

do $$ begin
  create type grading_mode as enum ('ai', 'manual');
exception when duplicate_object then null; end $$;

do $$ begin
  create type submission_status as enum ('in_progress', 'awaiting_grading', 'graded');
exception when duplicate_object then null; end $$;

do $$ begin
  create type answer_grading_status as enum ('auto', 'pending', 'ai_scored', 'graded');
exception when duplicate_object then null; end $$;

do $$ begin
  create type request_type as enum ('topic', 'quiz');
exception when duplicate_object then null; end $$;

do $$ begin
  create type request_status as enum ('pending', 'approved', 'rejected');
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------------
-- 2. Tables
-- ---------------------------------------------------------------------------

-- Public profile mirroring auth.users (role lives here — never trust client)
create table if not exists public.profiles (
  id         uuid primary key references auth.users (id) on delete cascade,
  full_name  varchar(120) not null default '',
  role       user_role    not null default 'user',
  created_at timestamptz  not null default now()
);

create table if not exists public.categories (
  id         serial primary key,
  name       varchar(80) not null unique,
  created_at timestamptz not null default now()
);

create table if not exists public.questions (
  id               uuid primary key default gen_random_uuid(),
  category_id      integer       not null references public.categories (id) on delete restrict,
  type             question_type not null,
  text             text          not null,
  difficulty       difficulty    not null default 'medium',
  explanation      text          not null default '',
  reference_answer text          not null default '',
  created_by       uuid          references public.profiles (id) on delete set null,
  created_at       timestamptz   not null default now(),
  updated_at       timestamptz   not null default now()
);
create index if not exists questions_category_idx on public.questions (category_id);
create index if not exists questions_type_idx     on public.questions (type);

create table if not exists public.options (
  id           uuid primary key default gen_random_uuid(),
  question_id  uuid    not null references public.questions (id) on delete cascade,
  text         text    not null,
  is_correct   boolean not null default false,
  order_index  smallint not null default 0
);
create index if not exists options_question_idx on public.options (question_id);

create table if not exists public.quizzes (
  id                 uuid primary key default gen_random_uuid(),
  title              varchar(200) not null,
  description        text         not null default '',
  category_id        integer      references public.categories (id) on delete set null,
  grading_mode       grading_mode not null default 'ai',
  time_limit_minutes integer,
  published          boolean      not null default false,
  created_by         uuid         references public.profiles (id) on delete set null,
  created_at         timestamptz  not null default now(),
  updated_at         timestamptz  not null default now()
);
create index if not exists quizzes_published_idx on public.quizzes (published);

create table if not exists public.quiz_questions (
  quiz_id     uuid    not null references public.quizzes (id) on delete cascade,
  question_id uuid    not null references public.questions (id) on delete cascade,
  order_index smallint not null default 0,
  points      smallint not null default 1,
  primary key (quiz_id, question_id)
);
create index if not exists quiz_questions_quiz_idx on public.quiz_questions (quiz_id);

create table if not exists public.submissions (
  id           uuid primary key default gen_random_uuid(),
  quiz_id      uuid   not null references public.quizzes (id) on delete cascade,
  user_id      uuid   not null references public.profiles (id) on delete cascade,
  status       submission_status not null default 'in_progress',
  total_score  numeric(8,2) not null default 0,
  max_score    integer      not null default 0,
  started_at   timestamptz  not null default now(),
  submitted_at timestamptz,
  graded_at    timestamptz
);
create index if not exists submissions_user_idx   on public.submissions (user_id);
create index if not exists submissions_quiz_idx   on public.submissions (quiz_id);
create index if not exists submissions_status_idx on public.submissions (status);

create table if not exists public.answers (
  id                 uuid primary key default gen_random_uuid(),
  submission_id      uuid   not null references public.submissions (id) on delete cascade,
  question_id        uuid   not null references public.questions (id) on delete restrict,
  selected_option_id uuid   references public.options (id) on delete set null,
  answer_text        text,
  is_correct         boolean,
  score              numeric(8,2),
  max_points         smallint not null default 1,
  grading_status     answer_grading_status not null,
  ai_score           smallint,
  feedback           text,
  graded_by          uuid   references public.profiles (id) on delete set null,
  graded_at          timestamptz,
  unique (submission_id, question_id)
);
create index if not exists answers_submission_idx     on public.answers (submission_id);
create index if not exists answers_grading_status_idx on public.answers (grading_status);
create index if not exists answers_question_idx       on public.answers (question_id);

create table if not exists public.ai_reviews (
  id         uuid primary key default gen_random_uuid(),
  answer_id  uuid not null unique references public.answers (id) on delete cascade,
  provider   varchar(32) not null,
  model      varchar(80) not null default '',
  score      smallint    not null,
  feedback   text        not null,
  latency_ms integer,
  created_at timestamptz not null default now()
);

create table if not exists public.requests (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid   not null references public.profiles (id) on delete cascade,
  type         request_type   not null,
  title        varchar(200)   not null,
  body         text           not null,
  status       request_status not null default 'pending',
  admin_note   text,
  reviewed_by  uuid   references public.profiles (id) on delete set null,
  reviewed_at  timestamptz,
  created_at   timestamptz not null default now()
);
create index if not exists requests_user_idx   on public.requests (user_id);
create index if not exists requests_status_idx on public.requests (status);

-- ---------------------------------------------------------------------------
-- 3. Triggers: auto-create profile on signup, touch updated_at
-- ---------------------------------------------------------------------------

create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', ''))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists questions_touch on public.questions;
create trigger questions_touch before update on public.questions
  for each row execute function public.touch_updated_at();

drop trigger if exists quizzes_touch on public.quizzes;
create trigger quizzes_touch before update on public.quizzes
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- 4. RLS: enable on every table
-- ---------------------------------------------------------------------------

alter table public.profiles       enable row level security;
alter table public.categories     enable row level security;
alter table public.questions      enable row level security;
alter table public.options        enable row level security;
alter table public.quizzes        enable row level security;
alter table public.quiz_questions enable row level security;
alter table public.submissions    enable row level security;
alter table public.answers        enable row level security;
alter table public.ai_reviews     enable row level security;
alter table public.requests       enable row level security;

-- Helper: is the current user an admin? (SECURITY DEFINER to avoid RLS recursion)
create or replace function public.is_admin()
returns boolean
language sql security definer stable set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

-- profiles: users read/update only their own row (role change only by admin)
drop policy if exists profiles_select_own on public.profiles;
create policy profiles_select_own on public.profiles
  for select using (auth.uid() = id or public.is_admin());

drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own on public.profiles
  for update using (auth.uid() = id) with check (
    -- regular users cannot escalate their own role
    auth.uid() = id and (public.is_admin() or role = (select role from public.profiles where id = auth.uid()))
  );

-- categories: readable by everyone (public content), writable only by admins
drop policy if exists categories_select_all on public.categories;
create policy categories_select_all on public.categories
  for select using (true);

drop policy if exists categories_admin_write on public.categories;
create policy categories_admin_write on public.categories
  for insert with check (public.is_admin());

drop policy if exists categories_admin_update on public.categories;
create policy categories_admin_update on public.categories
  for update using (public.is_admin());

drop policy if exists categories_admin_delete on public.categories;
create policy categories_admin_delete on public.categories
  for delete using (public.is_admin());

-- questions: admins full access; users may read questions that belong to a
-- published quiz (via quiz_questions) — reference answers are read only here;
-- if you want to hide them, create a SECURITY DEFINER view like options below.
drop policy if exists questions_admin_all on public.questions;
create policy questions_admin_all on public.questions
  for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists questions_read_published on public.questions;
create policy questions_read_published on public.questions
  for select using (
    exists (
      select 1 from public.quiz_questions qq
      join public.quizzes qz on qz.id = qq.quiz_id
      where qq.question_id = questions.id and qz.published
    )
  );

-- options: NO direct read for regular users (is_correct must never leak).
-- Admins get full access. Takers read via the public view further below.
drop policy if exists options_admin_all on public.options;
create policy options_admin_all on public.options
  for all using (public.is_admin()) with check (public.is_admin());

-- quizzes: public read only when published; admins full access
drop policy if exists quizzes_read_published on public.quizzes;
create policy quizzes_read_published on public.quizzes
  for select using (published or public.is_admin());

drop policy if exists quizzes_admin_write on public.quizzes;
create policy quizzes_admin_write on public.quizzes
  for insert with check (public.is_admin());

drop policy if exists quizzes_admin_update on public.quizzes;
create policy quizzes_admin_update on public.quizzes
  for update using (public.is_admin());

drop policy if exists quizzes_admin_delete on public.quizzes;
create policy quizzes_admin_delete on public.quizzes
  for delete using (public.is_admin());

-- quiz_questions: readable when the parent quiz is published (or admin)
drop policy if exists quiz_questions_read on public.quiz_questions;
create policy quiz_questions_read on public.quiz_questions
  for select using (
    public.is_admin() or exists (
      select 1 from public.quizzes qz
      where qz.id = quiz_questions.quiz_id and qz.published
    )
  );

drop policy if exists quiz_questions_admin_write on public.quiz_questions;
create policy quiz_questions_admin_write on public.quiz_questions
  for all using (public.is_admin()) with check (public.is_admin());

-- submissions: users create and read their own; admins read all.
-- Updates/deletes from clients are forbidden (grading happens server-side
-- via the service role / SECURITY DEFINER functions).
drop policy if exists submissions_select_own on public.submissions;
create policy submissions_select_own on public.submissions
  for select using (auth.uid() = user_id or public.is_admin());

drop policy if exists submissions_insert_own on public.submissions;
create policy submissions_insert_own on public.submissions
  for insert with check (auth.uid() = user_id);

-- answers: users read only answers of their own submissions; admins read/write
drop policy if exists answers_select_own on public.answers;
create policy answers_select_own on public.answers
  for select using (
    public.is_admin() or exists (
      select 1 from public.submissions s
      where s.id = answers.submission_id and s.user_id = auth.uid()
    )
  );

drop policy if exists answers_admin_update on public.answers;
create policy answers_admin_update on public.answers
  for update using (public.is_admin()) with check (public.is_admin());

-- ai_reviews: readable by admins and by the owner of the answer (transparency)
drop policy if exists ai_reviews_select on public.ai_reviews;
create policy ai_reviews_select on public.ai_reviews
  for select using (
    public.is_admin() or exists (
      select 1 from public.answers a
      join public.submissions s on s.id = a.submission_id
      where a.id = ai_reviews.answer_id and s.user_id = auth.uid()
    )
  );

-- requests: users create + read their own; admins read/update everything
drop policy if exists requests_select_own on public.requests;
create policy requests_select_own on public.requests
  for select using (auth.uid() = user_id or public.is_admin());

drop policy if exists requests_insert_own on public.requests;
create policy requests_insert_own on public.requests
  for insert with check (auth.uid() = user_id and status = 'pending');

drop policy if exists requests_admin_update on public.requests;
create policy requests_admin_update on public.requests
  for update using (public.is_admin()) with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- 5. Public view: options WITHOUT is_correct (SECURITY DEFINER)
--    Takers query this view so correct answers can never leak to the client.
-- ---------------------------------------------------------------------------
create or replace view public.options_public
with (security_invoker = false) as
  select id, question_id, text, order_index
  from public.options;
-- (Postgres views run with the owner's rights by default, bypassing RLS on
--  the base table while the view's own RLS is not needed here.)

-- ---------------------------------------------------------------------------
-- 6. submit_quiz(): deterministic grading for MCQ/TF; written answers go to
--    the AI pipeline (service role) or the manual queue depending on the
--    quiz's grading_mode. Callable by the answer owner only.
-- ---------------------------------------------------------------------------
create or replace function public.submit_quiz(
  p_submission_id uuid,
  p_answers jsonb -- [{"question_id": uuid, "selected_option_id": uuid|null, "answer_text": text|null}]
)
returns submission_status
language plpgsql security definer set search_path = public
as $$
declare
  v_sub public.submissions%rowtype;
  v_quiz public.quizzes%rowtype;
  v_q record;
  v_a jsonb;
  v_text text;
  v_selected uuid;
  v_correct_option uuid;
  v_ok boolean;
  v_pending int := 0;
  v_total numeric(8,2) := 0;
  v_status submission_status;
  v_answer_id uuid;
begin
  -- 1) Load + authorize the attempt
  select * into v_sub from public.submissions where id = p_submission_id;
  if not found or v_sub.user_id <> auth.uid() then
    raise exception 'Submission not found or not owned by caller';
  end if;
  if v_sub.status <> 'in_progress' then
    return v_sub.status; -- already submitted, idempotent
  end if;

  select * into v_quiz from public.quizzes where id = v_sub.quiz_id;

  -- 2) Grade each question of the quiz
  for v_q in
    select qz.question_id, qz.points, q.type
    from public.quiz_questions qz
    join public.questions q on q.id = qz.question_id
    where qz.quiz_id = v_quiz.id
    order by qz.order_index
  loop
    v_a := null;
    select value into v_a from jsonb_array_elements(p_answers)
      where (value->>'question_id')::uuid = v_q.question_id limit 1;

    v_text := nullif(btrim(coalesce(v_a->>'answer_text', '')), '');
    v_selected := case
      when v_a ? 'selected_option_id' and v_a->>'selected_option_id' is not null
        then (v_a->>'selected_option_id')::uuid
      else null end;

    if v_q.type <> 'written' then
      -- Deterministic grading (no AI needed)
      select id into v_correct_option from public.options
        where question_id = v_q.question_id and is_correct limit 1;
      v_ok := v_selected is not null and v_selected = v_correct_option;

      insert into public.answers
        (submission_id, question_id, selected_option_id, is_correct, score, max_points, grading_status)
      values
        (p_submission_id, v_q.question_id, v_selected, v_ok,
         case when v_ok then v_q.points else 0 end, v_q.points, 'auto')
      on conflict (submission_id, question_id) do nothing;

      v_total := v_total + case when v_ok then v_q.points else 0 end;
    else
      -- Written answers: AI grading is executed by the service-role backend
      -- (Edge Function / Route Handler) which then updates the answer row.
      -- Here we enqueue or, in AI mode, temporarily park the row as 'pending'
      -- for the AI worker; the worker flips it to 'ai_scored'.
      insert into public.answers
        (submission_id, question_id, answer_text, is_correct, score, max_points, grading_status, feedback)
      values
        (p_submission_id, v_q.question_id, v_text,
         case when v_text is null then false else null end,
         case when v_text is null then 0 else null end,
         v_q.points,
         case when v_text is null then 'auto'::answer_grading_status else 'pending'::answer_grading_status end,
         case when v_text is null then 'پاسخی ثبت نشده است.' else null end)
      on conflict (submission_id, question_id) do nothing
      returning id into v_answer_id;

      if v_text is null then
        null; -- scored 0 above
      else
        v_pending := v_pending + 1;
      end if;
    end if;
  end loop;

  -- 3) Finalize attempt state
  v_status := case when v_pending > 0 then 'awaiting_grading' else 'graded' end;

  update public.submissions set
    status = v_status,
    total_score = (select coalesce(sum(score), 0) from public.answers
                   where submission_id = p_submission_id),
    submitted_at = now(),
    graded_at = case when v_status = 'graded' then now() else null end
  where id = p_submission_id;

  return v_status;
end;
$$;

-- Only authenticated users may execute it, and the function self-checks ownership.
revoke all on function public.submit_quiz(uuid, jsonb) from public;
grant execute on function public.submit_quiz(uuid, jsonb) to authenticated;

-- ---------------------------------------------------------------------------
-- 7. Analytics view (per-quiz statistics)
-- ---------------------------------------------------------------------------
create or replace view public.quiz_stats as
  select
    qz.id,
    qz.title,
    qz.published,
    count(s.id)                                   as participants,
    avg(case when s.max_score > 0 then s.total_score / s.max_score end) as avg_score_ratio,
    count(*) filter (where s.status = 'awaiting_grading') as awaiting_grading
  from public.quizzes qz
  left join public.submissions s
    on s.quiz_id = qz.id and s.status <> 'in_progress'
  group by qz.id;

-- Done. Next steps:
--   1) Create your first admin: insert/update public.profiles set role='admin'
--      for your user id.
--   2) Point the app's DATABASE_URL at the Supabase pooled connection string.
