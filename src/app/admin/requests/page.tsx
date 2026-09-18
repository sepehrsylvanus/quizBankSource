// Admin request management: filterable list with optimistic approve/reject.
import Link from "next/link";
import { and, desc, eq, sql } from "drizzle-orm";
import { Inbox } from "lucide-react";
import { db } from "@/db";
import { requests, users } from "@/db/schema";
import { buildQuery, first, pageOf, type SearchParams } from "@/lib/queries";
import { Badge, Card, EmptyState, PageHeader } from "@/components/ui";
import Pagination from "@/components/pagination";
import { RequestReviewControls } from "@/components/admin-widgets";
import { faDate, faDigits } from "@/lib/format";
import {
  PAGE_SIZE,
  REQUEST_STATUS_LABEL,
  REQUEST_TYPE_LABEL,
} from "@/lib/constants";

export const metadata = { title: "مدیریت درخواست‌ها" };
export const dynamic = "force-dynamic";

type StatusFilter = "pending" | "approved" | "rejected" | undefined;

export default async function AdminRequestsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const sp = await searchParams;
  const status = first(sp.status) as StatusFilter;
  const page = pageOf(first(sp.page));

  const where = status ? eq(requests.status, status) : undefined;

  const [rows, countRows] = await Promise.all([
    db
      .select({
        id: requests.id,
        type: requests.type,
        title: requests.title,
        body: requests.body,
        status: requests.status,
        adminNote: requests.adminNote,
        createdAt: requests.createdAt,
        userName: users.fullName,
        userUsername: users.username,
      })
      .from(requests)
      .innerJoin(users, eq(users.id, requests.userId))
      .where(where)
      .orderBy(desc(requests.createdAt))
      .limit(PAGE_SIZE)
      .offset((page - 1) * PAGE_SIZE),
    db.select({ count: sql<number>`count(*)::int` }).from(requests).where(where),
  ]);

  const total = countRows[0]?.count ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const params: Record<string, string | undefined> = { status };

  const tabs: { value: StatusFilter; label: string }[] = [
    { value: undefined, label: "همه" },
    { value: "pending", label: REQUEST_STATUS_LABEL.pending },
    { value: "approved", label: REQUEST_STATUS_LABEL.approved },
    { value: "rejected", label: REQUEST_STATUS_LABEL.rejected },
  ];

  return (
    <div>
      <PageHeader
        icon={Inbox}
        title="مدیریت درخواست‌ها"
        subtitle={`${faDigits(total)} درخواست`}
      />

      {/* Status tabs */}
      <div className="mb-4 flex flex-wrap gap-1.5">
        {tabs.map((t) => (
          <Link
            key={t.label}
            href={buildQuery(params, { status: t.value, page: undefined })}
            className={`badge border ${status === t.value ? "border-indigo-300 bg-indigo-50 text-indigo-700" : "border-stone-200 bg-white text-stone-500 hover:bg-stone-50"}`}
          >
            {t.label}
          </Link>
        ))}
      </div>

      {rows.length === 0 ? (
        <EmptyState
          icon={Inbox}
          title="درخواستی در این وضعیت نیست"
          hint="درخواست‌های کاربران اینجا نمایش داده می‌شوند."
        />
      ) : (
        <div className="space-y-3">
          {rows.map((r) => (
            <Card key={r.id} className="p-4 sm:p-5">
              <div className="flex flex-wrap items-center gap-2 text-[11px] text-stone-400">
                <Badge tone="stone">{REQUEST_TYPE_LABEL[r.type]}</Badge>
                <span>
                  از <span className="font-bold text-stone-600">{r.userName || r.userUsername}</span>
                </span>
                <span>{faDate(r.createdAt)}</span>
              </div>
              <h3 className="mt-2 font-extrabold text-stone-900">{r.title}</h3>
              <p className="mt-1 mb-3 whitespace-pre-line text-sm leading-7 text-stone-500">
                {r.body}
              </p>
              <RequestReviewControls
                requestId={r.id}
                initialStatus={r.status}
                initialNote={r.adminNote}
              />
            </Card>
          ))}
        </div>
      )}

      <Pagination page={page} totalPages={totalPages} params={params} />
    </div>
  );
}
