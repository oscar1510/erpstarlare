export const dynamic = "force-dynamic";

import { db } from "@/lib/db";
import { PageHeader } from "@/components/ui/Page";
import { DataTable } from "@/components/ui/Table";
import { StatusBadge } from "@/components/ui/Badge";
import { formatDate, formatMoney } from "@/lib/format";
import { labelize } from "@/lib/constants";
import { ConfirmButton } from "@/components/ConfirmButton";
import { alignPaidDatesToInvoiceDates } from "./actions";
import Link from "next/link";

export default async function BillingPage() {
  const invoices = await db.invoice.findMany({ where: { deletedAt: null }, orderBy: { invoiceDate: "desc" } });

  return (
    <div>
      <PageHeader
        title="Billing / Client Invoices"
        description="Official Starflare invoices with sequential numbering, including invoices converted from Stripe."
        actions={
          <>
            <Link href="/billing/stripe/upload" className="btn-secondary">
              ⬆️ Upload Stripe invoice
            </Link>
            <Link href="/billing/documents" className="btn-secondary">
              📄 Quotations
            </Link>
            <Link href="/billing/trash" className="btn-secondary">
              🗑 Trash
            </Link>
            <Link href="/billing/documents/new?kind=QUOTATION" className="btn-secondary">
              📝 Create quotation
            </Link>
            <Link href="/billing/documents/new?kind=INVOICE" className="btn-primary">
              🧾 Generate invoice
            </Link>
          </>
        }
      />
      <div className="mb-4">
        <ConfirmButton
          action={alignPaidDatesToInvoiceDates}
          label="🔧 Fix paid dates (set = invoice date)"
          pendingLabel="Fixing…"
          confirm="Set the paid date equal to the invoice date for every paid invoice? Use this if paid invoices show up in the wrong month. You can still edit individual invoices afterwards."
          className="btn-secondary !py-1 !text-xs"
        />
      </div>
      <DataTable
        rows={invoices}
        href={(i) => `/billing/${i.id}`}
        emptyMessage="No invoices yet."
        columns={[
          { header: "Number", render: (i) => i.number },
          { header: "Client", render: (i) => i.clientNameSnapshot ?? "-" },
          { header: "Date", render: (i) => formatDate(i.invoiceDate) },
          { header: "Paid on", render: (i) => (i.paidDate ? formatDate(i.paidDate) : "-") },
          { header: "Total", render: (i) => formatMoney(i.total, i.currency) },
          { header: "Source", render: (i) => labelize(i.source) },
          { header: "Status", render: (i) => <StatusBadge status={i.status} /> },
        ]}
      />
    </div>
  );
}
