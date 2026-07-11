export const dynamic = "force-dynamic";

import { db } from "@/lib/db";
import { PageHeader } from "@/components/ui/Page";
import { DataTable } from "@/components/ui/Table";
import { StatusBadge } from "@/components/ui/Badge";
import { formatDate, formatMoney } from "@/lib/format";
import { ACTOR_LABELS } from "@/lib/constants";
import Link from "next/link";

export default async function ExpensesPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const { status } = await searchParams;
  const expenses = await db.expense.findMany({
    where: status ? { status } : undefined,
    orderBy: { createdAt: "desc" },
  });

  const statusCounts = await db.expense.groupBy({ by: ["status"], _count: true });

  return (
    <div>
      <PageHeader
        title="Expenses"
        description="All scanned and recorded expenses."
        actions={
          <div className="flex items-center gap-2">
            <Link href="/expenses/new" className="btn-secondary">
              ＋ Add new
            </Link>
            <Link href="/expenses/scan" className="btn-primary">
              🧾 Scan expense
            </Link>
          </div>
        }
      />
      <div className="flex flex-wrap gap-2 mb-4">
        <Link href="/expenses" className={!status ? "btn-primary !py-1 !text-xs" : "btn-secondary !py-1 !text-xs"}>
          All ({expenses.length && statusCounts.reduce((s, c) => s + c._count, 0)})
        </Link>
        {statusCounts.map((c) => (
          <Link
            key={c.status}
            href={`/expenses?status=${c.status}`}
            className={status === c.status ? "btn-primary !py-1 !text-xs" : "btn-secondary !py-1 !text-xs"}
          >
            {c.status.replace(/_/g, " ")} ({c._count})
          </Link>
        ))}
      </div>
      <DataTable
        rows={expenses}
        href={(e) => `/expenses/${e.id}`}
        emptyMessage="No expenses recorded yet."
        columns={[
          { header: "Vendor", render: (e) => e.vendor ?? "(unknown)" },
          { header: "Date", render: (e) => formatDate(e.expenseDate) },
          { header: "Amount", render: (e) => formatMoney(e.amount, e.currency) },
          { header: "Category", render: (e) => e.category ?? "-" },
          { header: "Paid from", render: (e) => e.account ?? "-" },
          { header: "Who", render: (e) => ACTOR_LABELS[e.actorType] ?? e.actorLabel },
          {
            header: "Status",
            render: (e) => (
              <div className="flex items-center gap-1.5">
                <StatusBadge status={e.status} />
                {e.possibleDuplicate && <StatusBadge status="NEEDS_REVIEW" />}
              </div>
            ),
          },
        ]}
      />
    </div>
  );
}
