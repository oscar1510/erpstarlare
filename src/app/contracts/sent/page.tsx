import { db } from "@/lib/db";
import { PageHeader } from "@/components/ui/Page";
import { DataTable } from "@/components/ui/Table";
import { StatusBadge } from "@/components/ui/Badge";
import { ContractTabs } from "@/components/ContractTabs";
import { formatDate, formatMoney } from "@/lib/format";
import Link from "next/link";

export default async function SentContractsPage() {
  const contracts = await db.sentContract.findMany({ orderBy: { createdAt: "desc" } });

  return (
    <div>
      <PageHeader
        title="Contracts"
        description="Contracts sent by Starflare to clients, partners, or creators."
        actions={<Link href="/contracts/sent/new" className="btn-primary">+ Add sent contract</Link>}
      />
      <ContractTabs active="sent" />
      <DataTable
        rows={contracts}
        href={(c) => `/contracts/sent/${c.id}`}
        emptyMessage="No sent contracts yet."
        columns={[
          { header: "Partner / client", render: (c) => c.partnerName ?? "-" },
          { header: "Package", render: (c) => c.packageName ?? "-" },
          { header: "Price", render: (c) => formatMoney(c.price, c.currency) },
          { header: "End date", render: (c) => formatDate(c.endDate) },
          { header: "Status", render: (c) => <StatusBadge status={c.status} /> },
        ]}
      />
    </div>
  );
}
