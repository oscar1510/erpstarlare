export const dynamic = "force-dynamic";

import { db } from "@/lib/db";
import { PageHeader } from "@/components/ui/Page";
import { DataTable } from "@/components/ui/Table";
import { StatusBadge } from "@/components/ui/Badge";
import { formatDate, formatMoney } from "@/lib/format";
import { ConfirmButton } from "@/components/ConfirmButton";
import { alignSupplierExpenseDates } from "./actions";
import Link from "next/link";

export default async function ReceivedInvoicesPage() {
  const invoices = await db.receivedInvoice.findMany({ orderBy: { createdAt: "desc" } });

  return (
    <div>
      <PageHeader
        title="Received Invoices / Supplier Expenses"
        description="Invoices from suppliers, vendors, freelancers, software providers, landlords and agencies."
        actions={
          <Link href="/received-invoices/new" className="btn-primary">
            + Upload supplier invoice
          </Link>
        }
      />
      <div className="mb-4">
        <ConfirmButton
          action={alignSupplierExpenseDates}
          label="🔧 Fix expense dates (set = invoice date)"
          pendingLabel="Fixing…"
          confirm="Realign every paid supplier invoice's expense date to its invoice date? Use this if a supplier expense shows up in the wrong month on the dashboard."
          className="btn-secondary !py-1 !text-xs"
        />
      </div>
      <DataTable
        rows={invoices}
        href={(i) => `/received-invoices/${i.id}`}
        emptyMessage="No received invoices yet."
        columns={[
          { header: "Vendor", render: (i) => i.vendorName ?? "-" },
          { header: "Invoice #", render: (i) => i.invoiceNumber ?? "-" },
          { header: "Due date", render: (i) => formatDate(i.dueDate) },
          { header: "Amount", render: (i) => formatMoney(i.amount, i.currency) },
          { header: "Recurring", render: (i) => (i.recurring ? "Yes" : "No") },
          { header: "Status", render: (i) => <StatusBadge status={i.paymentStatus} /> },
        ]}
      />
    </div>
  );
}
