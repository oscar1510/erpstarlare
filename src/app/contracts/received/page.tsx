import { db } from "@/lib/db";
import { PageHeader } from "@/components/ui/Page";
import { DataTable } from "@/components/ui/Table";
import { StatusBadge } from "@/components/ui/Badge";
import { ContractTabs } from "@/components/ContractTabs";
import { formatDate, formatMoney } from "@/lib/format";
import Link from "next/link";

export default async function ReceivedContractsPage() {
  const contracts = await db.receivedContract.findMany({ orderBy: { createdAt: "desc" } });

  return (
    <div>
      <PageHeader
        title="Contracts"
        description="Partnership, vendor, landlord, consultant and other contracts received and signed by Starflare."
        actions={<Link href="/contracts/received/new" className="btn-primary">+ Add received contract</Link>}
      />
      <ContractTabs active="received" />
      <DataTable
        rows={contracts}
        href={(c) => `/contracts/received/${c.id}`}
        emptyMessage="No received contracts yet."
        columns={[
          { header: "Counterparty", render: (c) => c.counterpartyName ?? "-" },
          { header: "Type", render: (c) => c.contractType ?? "-" },
          { header: "End date", render: (c) => formatDate(c.endDate) },
          { header: "Value", render: (c) => formatMoney(c.contractValue, c.currency) },
          { header: "Status", render: (c) => <StatusBadge status={c.status} /> },
        ]}
      />
    </div>
  );
}
