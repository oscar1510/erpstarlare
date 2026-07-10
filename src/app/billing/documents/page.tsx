export const dynamic = "force-dynamic";

import { db } from "@/lib/db";
import { PageHeader } from "@/components/ui/Page";
import { DataTable } from "@/components/ui/Table";
import { StatusBadge } from "@/components/ui/Badge";
import { formatDate, formatMoney } from "@/lib/format";
import { computeTotals } from "@/lib/quote-doc";
import Link from "next/link";

export default async function GeneratedDocumentsPage() {
  const docs = await db.quotation.findMany({ where: { deletedAt: null }, orderBy: { createdAt: "desc" } });

  return (
    <div>
      <PageHeader
        title="Quotations & generated documents"
        description="Branded quotations and invoices created with the document builder."
        actions={
          <>
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
        rows={docs}
        href={(d) => `/billing/documents/${d.id}`}
        emptyMessage="No documents generated yet."
        columns={[
          { header: "Number", render: (d) => d.number },
          { header: "Type", render: (d) => (d.kind === "INVOICE" ? "Invoice" : "Quotation") },
          { header: "Client", render: (d) => d.companyName ?? d.contactPerson ?? "-" },
          { header: "Date", render: (d) => formatDate(d.docDate) },
          { header: "Total", render: (d) => formatMoney(computeTotals(d).total, d.currency) },
          { header: "Status", render: (d) => <StatusBadge status={d.status} /> },
        ]}
      />
    </div>
  );
}
