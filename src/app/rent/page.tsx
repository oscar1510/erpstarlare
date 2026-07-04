import { db } from "@/lib/db";
import { PageHeader } from "@/components/ui/Page";
import { DataTable } from "@/components/ui/Table";
import { formatDate, formatMoney } from "@/lib/format";
import Link from "next/link";

export default async function RentPage() {
  const records = await db.rentRecord.findMany({ orderBy: { createdAt: "desc" } });

  return (
    <div>
      <PageHeader
        title="Rent / Office / Lease"
        description="Office rental contracts, lease agreements, rent schedules and landlord documents."
        actions={<Link href="/rent/new" className="btn-primary">+ Add lease</Link>}
      />
      <DataTable
        rows={records}
        href={(r) => `/rent/${r.id}`}
        emptyMessage="No lease records yet."
        columns={[
          { header: "Office", render: (r) => r.officeName ?? r.location ?? "-" },
          { header: "Landlord", render: (r) => r.landlordName ?? "-" },
          { header: "Monthly rent", render: (r) => formatMoney(r.monthlyRent, r.currency) },
          { header: "End date", render: (r) => formatDate(r.endDate) },
          { header: "Renewal date", render: (r) => formatDate(r.renewalDate) },
        ]}
      />
    </div>
  );
}
