export const dynamic = "force-dynamic";

import { db } from "@/lib/db";
import { PageHeader } from "@/components/ui/Page";
import { DataTable } from "@/components/ui/Table";
import { StatusBadge } from "@/components/ui/Badge";
import { formatDate, formatMoney } from "@/lib/format";
import { labelize } from "@/lib/constants";
import Link from "next/link";

export default async function BillingPage() {
  const invoices = await db.invoice.findMany({ orderBy: { invoiceDate: "desc" } });

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
            <Link href="/billing/documents/new?kind=QUOTATION" className="btn-secondary">
              📝 Create quotation
            </Link>
            <Link href="/billing/documents/new?kind=INVOICE" className="btn-primary">
              🧾 Generate invoice
            </Link>
          </>
        }
      />
      <DataTable
        rows={invoices}
        href={(i) => `/billing/${i.id}`}
        emptyMessage="No invoices yet."
        columns={[
          { header: "Number", render: (i) => i.number },
          { header: "Client", render: (i) => i.clientNameSnapshot ?? "-" },
          { header: "Date", render: (i) => formatDate(i.invoiceDate) },
          { header: "Due", render: (i) => formatDate(i.dueDate) },
          { header: "Total", render: (i) => formatMoney(i.total, i.currency) },
          { header: "Source", render: (i) => labelize(i.source) },
          { header: "Status", render: (i) => <StatusBadge status={i.status} /> },
        ]}
      />
    </div>
  );
}
