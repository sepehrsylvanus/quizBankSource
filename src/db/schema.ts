import {
  pgTable,
  pgEnum,
  uuid,
  varchar,
  text,
  boolean,
  smallint,
  integer,
  numeric,
  timestamp,
  serial,
  primaryKey,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------

export const userRoleEnum = pgEnum("user_role", ["admin", "user"]);
export const questionTypeEnum = pgEnum("question_type", [
  "mcq",
  "true_false",
  "written",
]);
export const difficultyEnum = pgEnum("difficulty", ["easy", "medium", "hard"]);
export const gradingModeEnum = pgEnum("grading_mode", ["ai", "manual"]);
export const submissionStatusEnum = pgEnum("submission_status", [
  "in_progress",
  "awaiting_grading",
  "graded",
]);
export const answerGradingStatusEnum = pgEnum("answer_grading_status", [
  "auto", // graded deterministically (mcq / true-false / empty written answer)
  "pending", // waiting for manual review
  "ai_scored", // graded by the AI provider (final score)
  "graded", // graded manually by an admin
]);
export const requestTypeEnum = pgEnum("request_type", ["topic", "quiz"]);
export const requestStatusEnum = pgEnum("request_status", [
  "pending",
  "approved",
  "rejected",
]);

// ---------------------------------------------------------------------------
// Users & sessions (credential-based auth; a Supabase variant with RLS lives
// in supabase/schema.sql)
// ---------------------------------------------------------------------------

export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  username: varchar("username", { length: 64 }).notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  fullName: varchar("full_name", { length: 120 }).notNull().default(""),
  role: userRoleEnum("role").notNull().default("user"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const sessions = pgTable(
  "sessions",
  {
    token: varchar("token", { length: 128 }).primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  },
  (t) => [index("sessions_user_idx").on(t.userId)],
);

// ---------------------------------------------------------------------------
// Question bank
// ---------------------------------------------------------------------------

export const categories = pgTable(
  "categories",
  {
    id: serial("id").primaryKey(),
    name: varchar("name", { length: 80 }).notNull().unique(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [uniqueIndex("categories_name_uq").on(t.name)],
);

export const questions = pgTable(
  "questions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    categoryId: integer("category_id")
      .notNull()
      .references(() => categories.id, { onDelete: "restrict" }),
    type: questionTypeEnum("type").notNull(),
    text: text("text").notNull(),
    difficulty: difficultyEnum("difficulty").notNull().default("medium"),
    explanation: text("explanation").notNull().default(""),
    // Reference answer used by the AI agent / manual graders for written questions
    referenceAnswer: text("reference_answer").notNull().default(""),
    createdById: uuid("created_by_id").references(() => users.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("questions_category_idx").on(t.categoryId),
    index("questions_type_idx").on(t.type),
  ],
);

export const options = pgTable(
  "options",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    questionId: uuid("question_id")
      .notNull()
      .references(() => questions.id, { onDelete: "cascade" }),
    text: text("text").notNull(),
    isCorrect: boolean("is_correct").notNull().default(false),
    orderIndex: smallint("order_index").notNull().default(0),
  },
  (t) => [index("options_question_idx").on(t.questionId)],
);

// ---------------------------------------------------------------------------
// Quizzes
// ---------------------------------------------------------------------------

export const quizzes = pgTable(
  "quizzes",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    title: varchar("title", { length: 200 }).notNull(),
    description: text("description").notNull().default(""),
    categoryId: integer("category_id").references(() => categories.id, {
      onDelete: "set null",
    }),
    // Creator-chosen grading mode for written answers
    gradingMode: gradingModeEnum("grading_mode").notNull().default("ai"),
    timeLimitMinutes: integer("time_limit_minutes"),
    published: boolean("published").notNull().default(false),
    createdById: uuid("created_by_id").references(() => users.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("quizzes_published_idx").on(t.published)],
);

export const quizQuestions = pgTable(
  "quiz_questions",
  {
    quizId: uuid("quiz_id")
      .notNull()
      .references(() => quizzes.id, { onDelete: "cascade" }),
    questionId: uuid("question_id")
      .notNull()
      .references(() => questions.id, { onDelete: "cascade" }),
    orderIndex: smallint("order_index").notNull().default(0),
    points: smallint("points").notNull().default(1),
  },
  (t) => [
    primaryKey({ columns: [t.quizId, t.questionId] }),
    index("quiz_questions_quiz_idx").on(t.quizId),
  ],
);

// ---------------------------------------------------------------------------
// Submissions & answers
// ---------------------------------------------------------------------------

export const submissions = pgTable(
  "submissions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    quizId: uuid("quiz_id")
      .notNull()
      .references(() => quizzes.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    status: submissionStatusEnum("status").notNull().default("in_progress"),
    totalScore: numeric("total_score", {
      precision: 8,
      scale: 2,
      mode: "number",
    })
      .notNull()
      .default(0),
    maxScore: integer("max_score").notNull().default(0),
    startedAt: timestamp("started_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    submittedAt: timestamp("submitted_at", { withTimezone: true }),
    gradedAt: timestamp("graded_at", { withTimezone: true }),
  },
  (t) => [
    index("submissions_user_idx").on(t.userId),
    index("submissions_quiz_idx").on(t.quizId),
    index("submissions_status_idx").on(t.status),
  ],
);

export const answers = pgTable(
  "answers",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    submissionId: uuid("submission_id")
      .notNull()
      .references(() => submissions.id, { onDelete: "cascade" }),
    questionId: uuid("question_id")
      .notNull()
      .references(() => questions.id, { onDelete: "restrict" }),
    selectedOptionId: uuid("selected_option_id").references(() => options.id, {
      onDelete: "set null",
    }),
    answerText: text("answer_text"),
    isCorrect: boolean("is_correct"),
    score: numeric("score", { precision: 8, scale: 2, mode: "number" }),
    maxPoints: smallint("max_points").notNull().default(1),
    gradingStatus: answerGradingStatusEnum("grading_status").notNull(),
    // 0-100 percentage produced by the AI agent (kept separate from final score)
    aiScore: smallint("ai_score"),
    feedback: text("feedback"),
    gradedById: uuid("graded_by_id").references(() => users.id, {
      onDelete: "set null",
    }),
    gradedAt: timestamp("graded_at", { withTimezone: true }),
  },
  (t) => [
    uniqueIndex("answers_submission_question_uq").on(
      t.submissionId,
      t.questionId,
    ),
    index("answers_submission_idx").on(t.submissionId),
    index("answers_grading_status_idx").on(t.gradingStatus),
    index("answers_question_idx").on(t.questionId),
  ],
);

// Raw output of the AI grading agent, kept for transparency & manual overrides
export const aiReviews = pgTable(
  "ai_reviews",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    answerId: uuid("answer_id")
      .notNull()
      .references(() => answers.id, { onDelete: "cascade" }),
    provider: varchar("provider", { length: 32 }).notNull(),
    model: varchar("model", { length: 80 }).notNull().default(""),
    score: smallint("score").notNull(),
    feedback: text("feedback").notNull(),
    latencyMs: integer("latency_ms"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [uniqueIndex("ai_reviews_answer_uq").on(t.answerId)],
);

// ---------------------------------------------------------------------------
// User requests (topic / quiz requests with an admin approval workflow)
// ---------------------------------------------------------------------------

export const requests = pgTable(
  "requests",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: requestTypeEnum("type").notNull(),
    title: varchar("title", { length: 200 }).notNull(),
    body: text("body").notNull(),
    status: requestStatusEnum("status").notNull().default("pending"),
    adminNote: text("admin_note"),
    reviewedById: uuid("reviewed_by_id").references(() => users.id, {
      onDelete: "set null",
    }),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("requests_user_idx").on(t.userId),
    index("requests_status_idx").on(t.status),
  ],
);

// Inferred row types used across the app
export type User = typeof users.$inferSelect;
export type Question = typeof questions.$inferSelect;
export type Quiz = typeof quizzes.$inferSelect;
export type Submission = typeof submissions.$inferSelect;
export type Answer = typeof answers.$inferSelect;
export type Request = typeof requests.$inferSelect;
