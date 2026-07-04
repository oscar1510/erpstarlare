import { db } from "@/lib/db";
import { PageHeader } from "@/components/ui/Page";
import { DataTable } from "@/components/ui/Table";
import { StatusBadge } from "@/components/ui/Badge";
import Link from "next/link";

export default async function ClientsPage() {
  const clients = await db.client.findMany({ orderBy: { createdAt: "desc" } });

  return (
    <div>
      <PageHeader
        title="Clients / Purchases / Subscriptions"
        description="Client profiles and their purchase history. Live credit balances are not tracked here."
        actions={
          <Link href="/clients/new" className="btn-primary">
            + Add client
          </Link>
        }
      />
      <DataTable
        rows={clients}
        href={(c) => `/clients/${c.id}`}
        emptyMessage="No clients yet."
        columns={[
          { header: "Name", render: (c) => c.name },
          { header: "Company", render: (c) => c.companyName ?? "-" },
          { header: "Contact", render: (c) => c.mainContact ?? "-" },
          { header: "Status", render: (c) => <StatusBadge status={c.status} /> },
        ]}
      />
    </div>
  );
}
