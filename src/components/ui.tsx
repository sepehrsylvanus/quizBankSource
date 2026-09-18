// Reusable server-safe UI primitives.
import type { ReactNode } from "react";
import { Inbox, type LucideIcon } from "lucide-react";

export function Card({
  className = "",
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return <div className={`card ${className}`}>{children}</div>;
}

const badgeTones: Record<string, string> = {
  stone: "bg-stone-100 text-stone-600 border-stone-200",
  indigo: "bg-indigo-50 text-indigo-700 border-indigo-200",
  emerald: "bg-emerald-50 text-emerald-700 border-emerald-200",
  amber: "bg-amber-50 text-amber-700 border-amber-200",
  rose: "bg-rose-50 text-rose-700 border-rose-200",
  sky: "bg-sky-50 text-sky-700 border-sky-200",
  violet: "bg-violet-50 text-violet-700 border-violet-200",
};

export type BadgeTone = keyof typeof badgeTones;

export function Badge({
  tone = "stone",
  children,
  className = "",
}: {
  tone?: BadgeTone;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span className={`badge border ${badgeTones[tone]} ${className}`}>
      {children}
    </span>
  );
}

export function PageHeader({
  icon: Icon,
  title,
  subtitle,
  actions,
}: {
  icon?: LucideIcon;
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div className="flex items-center gap-3">
        {Icon ? (
          <span className="grid size-11 place-items-center rounded-2xl bg-indigo-600 text-white shadow-md shadow-indigo-600/25">
            <Icon className="size-5" />
          </span>
        ) : null}
        <div>
          <h1 className="text-xl font-extrabold text-stone-900 sm:text-2xl">
            {title}
          </h1>
          {subtitle ? (
            <p className="mt-1 text-sm text-stone-500">{subtitle}</p>
          ) : null}
        </div>
      </div>
      {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
    </div>
  );
}

export function StatCard({
  icon: Icon,
  label,
  value,
  hint,
  tone = "indigo",
}: {
  icon: LucideIcon;
  label: string;
  value: ReactNode;
  hint?: string;
  tone?: "indigo" | "emerald" | "amber" | "rose" | "sky" | "violet";
}) {
  const tones: Record<string, string> = {
    indigo: "bg-indigo-600/10 text-indigo-600",
    emerald: "bg-emerald-600/10 text-emerald-600",
    amber: "bg-amber-600/10 text-amber-600",
    rose: "bg-rose-600/10 text-rose-600",
    sky: "bg-sky-600/10 text-sky-600",
    violet: "bg-violet-600/10 text-violet-600",
  };
  return (
    <Card className="flex items-center gap-4 p-4 sm:p-5">
      <span className={`grid size-12 place-items-center rounded-2xl ${tones[tone]}`}>
        <Icon className="size-6" />
      </span>
      <div className="min-w-0">
        <div className="text-2xl font-extrabold tabular-nums text-stone-900">
          {value}
        </div>
        <div className="text-xs font-medium text-stone-500">{label}</div>
        {hint ? (
          <div className="mt-0.5 text-[11px] text-stone-400">{hint}</div>
        ) : null}
      </div>
    </Card>
  );
}

export function EmptyState({
  icon: Icon = Inbox,
  title,
  hint,
  action,
}: {
  icon?: LucideIcon;
  title: string;
  hint?: string;
  action?: ReactNode;
}) {
  return (
    <div className="card flex flex-col items-center justify-center gap-3 px-6 py-14 text-center">
      <span className="grid size-14 place-items-center rounded-full bg-stone-100 text-stone-400">
        <Icon className="size-7" />
      </span>
      <p className="font-bold text-stone-700">{title}</p>
      {hint ? <p className="max-w-md text-sm text-stone-400">{hint}</p> : null}
      {action}
    </div>
  );
}

/** Server-rendered banner for ?error= / ?ok= feedback after server actions. */
export function Flash({
  error,
  ok,
  okText = "عملیات با موفقیت انجام شد.",
}: {
  error?: string;
  ok?: boolean;
  okText?: string;
}) {
  if (error) {
    return (
      <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">
        {error}
      </div>
    );
  }
  if (ok) {
    return (
      <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">
        {okText}
      </div>
    );
  }
  return null;
}
