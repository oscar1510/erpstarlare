export const dynamic = "force-dynamic";

import { db } from "@/lib/db";
import { SubmitButton } from "@/components/SubmitButton";
import { PageHeader } from "@/components/ui/Page";
import { DataTable } from "@/components/ui/Table";
import { StatusBadge } from "@/components/ui/Badge";
import { Select } from "@/components/ui/Field";
import { formatDate, formatMoney } from "@/lib/format";
import { RECONCILIATION_STATUSES, labelize } from "@/lib/constants";
import Link from "next/link";
import { updatePaymentReconciliation } from "./actions";

export default async function PaymentsPage({ searchParams }: { searchParams: Promise<{ filter?: string }> }) {
  const { filter } = await searchParams;
  const payments = await db.payment.findMany({
    where: filter === "unmatched" ? { reconciliation: { in: ["UNMATCHED", "PARTIALLY_MATCHED", "PENDING_REVIEW"] } } : undefined,
    orderBy: { date: "desc" },
  });

  return (
    <div>
      <PageHeader
        title="Payments & Reconciliation"
        description="Payments received and made, and whether they're correctly matched to invoices, bank transactions, or expenses."
        actions={
          <div className="flex items-center gap-2">
            <Link href="/payments/scan" className="btn-secondary">🧾 Scan receipt</Link>
            <Link href="/payments/new" className="btn-primary">+ Add payment</Link>
          </div>
        }
      />
      <div className="flex gap-2 mb-4">
        <Link href="/payments" className={!filter ? "btn-primary !py-1 !text-xs" : "btn-secondary !py-1 !text-xs"}>All</Link>
        <Link href="/payments?filter=unmatched" className={filter === "unmatched" ? "btn-primary !py-1 !text-xs" : "btn-secondary !py-1 !text-xs"}>
          Unmatched / needs review
        </Link>
      </div>
      <DataTable
        rows={payments}
        emptyMessage="No payments recorded yet."
        columns={[
          { header: "Date", render: (p) => formatDate(p.date) },
          { header: "Type", render: (p) => labelize(p.type) },
          { header: "Amount", render: (p) => formatMoney(p.amount, p.currency) },
          { header: "Method", render: (p) => p.method ?? "-" },
          { header: "Payer", render: (p) => p.payer ?? "-" },
          { header: "Payee", render: (p) => p.payee ?? "-" },
          {
            header: "Reconciliation",
            render: (p) => (
              <form
                action={async (fd: FormData) => {
                  "use server";
                  await updatePaymentReconciliation(p.id, fd.get("reconciliation") as string);
                }}
                className="flex items-center gap-1.5"
              >
                <StatusBadge status={p.reconciliation} />
                <Select
                  name="reconciliation"
                  options={RECONCILIATION_STATUSES.map((s) => ({ value: s, label: labelize(s) }))}
                  defaultValue={p.reconciliation}
                  className="!py-1 !text-xs w-40"
                />
                <SubmitButton className="btn-ghost !py-1 !text-xs">Save</SubmitButton>
              </form>
            ),
          },
          {
            header: "",
            render: (p) => (
              <Link href={`/payments/${p.id}`} className="btn-secondary !py-1 !text-xs whitespace-nowrap">Edit</Link>
            ),
          },
        ]}
      />
    </div>
  );
}
