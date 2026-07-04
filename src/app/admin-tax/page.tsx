export const dynamic = "force-dynamic";

import { db } from "@/lib/db";
import { PageHeader } from "@/components/ui/Page";
import { DataTable } from "@/components/ui/Table";
import { StatusBadge } from "@/components/ui/Badge";
import { formatDate } from "@/lib/format";
import { labelize } from "@/lib/constants";
import Link from "next/link";

export default async function AdminTaxPage() {
  const records = await db.taxRecord.findMany({ orderBy: { createdAt: "desc" } });

  return (
    <div>
      <PageHeader
        title="Administration & Tax"
        description="ADGM license, FTA/VAT registration, corporate tax submissions and related documents."
        actions={<Link href="/admin-tax/new" className="btn-primary">+ Add record</Link>}
      />
      <DataTable
        rows={records}
        href={(r) => `/admin-tax/${r.id}`}
        emptyMessage="No tax/admin records yet."
        columns={[
          { header: "Type", render: (r) => labelize(r.docType) },
          { header: "Reference #", render: (r) => r.taxRefNumber ?? "-" },
          { header: "Fiscal period", render: (r) => r.fiscalPeriod ?? "-" },
          { header: "Next due", render: (r) => formatDate(r.nextDueDate) },
          { header: "Status", render: (r) => <StatusBadge status={r.status} /> },
        ]}
      />
    </div>
  );
}
