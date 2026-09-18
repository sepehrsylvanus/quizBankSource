// User requests page: submit a new topic/quiz request and track its status.
import { desc, eq } from "drizzle-orm";
import { Inbox, Lightbulb, Send } from "lucide-react";
import { db } from "@/db";
import { requests } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { createRequestAction } from "@/actions/requests";
import { Badge, Card, EmptyState, Flash, PageHeader } from "@/components/ui";
import { faDate } from "@/lib/format";
import { first, type SearchParams } from "@/lib/queries";
import {
  REQUEST_STATUS_ICON,
  REQUEST_STATUS_LABEL,
  REQUEST_TYPE_LABEL,
} from "@/lib/constants";

export const metadata = { title: "درخواست‌های من" };

const statusTone = {
  pending: "amber" as const,
  approved: "emerald" as const,
  rejected: "rose" as const,
};

export default async function RequestsPage({ searchParams }: { searchParams: SearchParams }) {
  const user = await requireUser();
  const sp = await searchParams;
  const error = first(sp.error);
  const ok = first(sp.ok) === "1";

  const rows = await db
    .select({
      id: requests.id,
      type: requests.type,
      title: requests.title,
      body: requests.body,
      status: requests.status,
      adminNote: requests.adminNote,
      createdAt: requests.createdAt,
    })
    .from(requests)
    .where(eq(requests.userId, user.id))
    .orderBy(desc(requests.createdAt))
    .limit(50);

  return (
    <main className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
      <PageHeader
        icon={Lightbulb}
        title="درخواست‌های من"
        subtitle="موضوع یا آزمون جدید پیشنهاد دهید؛ ادمین آن را بررسی می‌کند."
      />

      <Flash error={error} ok={ok} okText="درخواست شما ثبت شد و در صف بررسی ادمین قرار گرفت." />

      <div className="grid gap-6 lg:grid-cols-[2fr_3fr]">
        {/* New request form */}
        <Card className="h-fit p-5 sm:p-6">
          <h2 className="mb-4 font-extrabold text-stone-900">درخواست جدید</h2>
          <form action={createRequestAction} className="space-y-4">
            <div>
              <label className="label" htmlFor="type">نوع درخواست</label>
              <select id="type" name="type" className="input">
                <option value="topic">موضوع جدید</option>
                <option value="quiz">آزمون جدید</option>
              </select>
            </div>
            <div>
              <label className="label" htmlFor="title">عنوان</label>
              <input
                id="title"
                name="title"
                className="input"
                required
                minLength={3}
                maxLength={200}
                placeholder="مثلاً آزمون جامع ادبیات فارسی"
              />
            </div>
            <div>
              <label className="label" htmlFor="body">توضیحات</label>
              <textarea
                id="body"
                name="body"
                rows={4}
                className="input leading-7"
                required
                minLength={10}
                placeholder="چرا این موضوع/آزمون لازم است؟ چه سرفصل‌هایی پیشنهاد می‌دهید؟"
              />
            </div>
            <button type="submit" className="btn-primary w-full">
              <Send className="size-4" />
              ارسال درخواست
            </button>
          </form>
        </Card>

        {/* My requests */}
        <div className="space-y-3">
          {rows.length === 0 ? (
            <EmptyState
              icon={Inbox}
              title="هنوز درخواستی ثبت نکرده‌اید"
              hint="از فرم کنار، اولین پیشنهاد خود را ارسال کنید."
            />
          ) : (
            rows.map((r) => {
              const StatusIcon = REQUEST_STATUS_ICON[r.status];
              return (
                <Card key={r.id} className="p-4 sm:p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge tone="stone">{REQUEST_TYPE_LABEL[r.type]}</Badge>
                        <span className="text-[11px] text-stone-400">{faDate(r.createdAt)}</span>
                      </div>
                      <h3 className="mt-1.5 font-extrabold text-stone-900">{r.title}</h3>
                      <p className="mt-1 line-clamp-3 text-sm leading-7 text-stone-500">{r.body}</p>
                    </div>
                    <Badge tone={statusTone[r.status]}>
                      <StatusIcon className="size-3.5" />
                      {REQUEST_STATUS_LABEL[r.status]}
                    </Badge>
                  </div>
                  {r.adminNote ? (
                    <div className="mt-3 rounded-xl bg-stone-50 px-4 py-2.5 text-xs leading-6 text-stone-600">
                      <span className="font-extrabold">پاسخ ادمین: </span>
                      {r.adminNote}
                    </div>
                  ) : null}
                </Card>
              );
            })
          )}
        </div>
      </div>
    </main>
  );
}
