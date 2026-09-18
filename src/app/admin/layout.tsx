// Admin shell: enforces admin role and renders the sidebar layout.
import { sql } from "drizzle-orm";
import { db } from "@/db";
import { requireAdmin } from "@/lib/auth";
import AdminNav from "@/components/admin-nav";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireAdmin();

  // Sidebar badges (pending counts) — one round trip.
  const res = await db.execute(sql`
    select
      (select count(*)::int from answers where grading_status = 'pending') as pending_grading,
      (select count(*)::int from requests where status = 'pending') as pending_requests
  `);
  const counts = res.rows[0] as { pending_grading: number; pending_requests: number };

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
      <div className="grid gap-6 lg:grid-cols-[240px_1fr]">
        <aside className="rounded-3xl bg-gradient-to-b from-indigo-950 via-indigo-900 to-violet-950 p-4 shadow-xl shadow-indigo-950/20 lg:sticky lg:top-24 lg:h-[calc(100vh-8rem)]">
          <AdminNav
            pendingGrading={counts.pending_grading}
            pendingRequests={counts.pending_requests}
          />
        </aside>
        <section className="min-w-0">{children}</section>
      </div>
    </div>
  );
}
