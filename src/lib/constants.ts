// Shared domain labels (all user-facing copy is Persian) and app constants.
import {
  CheckCircle2,
  CircleHelp,
  PenLine,
  Sparkles,
  UserRoundPen,
  Inbox,
  CheckCheck,
  XCircle,
  Hourglass,
  type LucideIcon,
} from "lucide-react";

export const PAGE_SIZE = 10;

export const QUESTION_TYPE_LABEL = {
  mcq: "چهارگزینه‌ای",
  true_false: "صحیح / غلط",
  written: "تشریحی",
} as const;

export const QUESTION_TYPE_ICON: Record<
  keyof typeof QUESTION_TYPE_LABEL,
  LucideIcon
> = {
  mcq: CircleHelp,
  true_false: CheckCircle2,
  written: PenLine,
};

export const DIFFICULTY_LABEL = {
  easy: "آسان",
  medium: "متوسط",
  hard: "سخت",
} as const;

export const GRADING_MODE_LABEL = {
  ai: "تصحیح با هوش مصنوعی",
  manual: "تصحیح دستی توسط ادمین",
} as const;

export const GRADING_MODE_ICON: Record<
  keyof typeof GRADING_MODE_LABEL,
  LucideIcon
> = {
  ai: Sparkles,
  manual: UserRoundPen,
};

export const SUBMISSION_STATUS_LABEL = {
  in_progress: "در حال انجام",
  awaiting_grading: "در انتظار تکمیل تصحیح",
  graded: "تصحیح شده",
} as const;

export const ANSWER_STATUS_LABEL = {
  auto: "تصحیح خودکار",
  pending: "در انتظار بررسی",
  ai_scored: "امتیازدهی هوش مصنوعی",
  graded: "تصحیح دستی",
} as const;

export const REQUEST_TYPE_LABEL = {
  topic: "موضوع جدید",
  quiz: "آزمون جدید",
} as const;

export const REQUEST_STATUS_LABEL = {
  pending: "در انتظار بررسی",
  approved: "تأیید شده",
  rejected: "رد شده",
} as const;

export const REQUEST_STATUS_ICON: Record<
  keyof typeof REQUEST_STATUS_LABEL,
  LucideIcon
> = {
  pending: Hourglass,
  approved: CheckCheck,
  rejected: XCircle,
};

export const EMPTY_REQUESTS_ICON = Inbox;
