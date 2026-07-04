export const dynamic = "force-dynamic";

import { db } from "@/lib/db";
import { PageHeader } from "@/components/ui/Page";
import { DataTable } from "@/components/ui/Table";
import { StatusBadge } from "@/components/ui/Badge";
import { ContractTabs } from "@/components/ContractTabs";
import { formatDate } from "@/lib/format";
import Link from "next/link";

export default async function PoliciesPage() {
  const policies = await db.platformPolicy.findMany({ orderBy: { createdAt: "desc" } });

  return (
    <div>
      <PageHeader
        title="Contracts"
        description="Terms & Conditions, Privacy Policy, Creator Terms, and other platform policies."
        actions={<Link href="/contracts/policies/new" className="btn-primary">+ Add policy</Link>}
      />
      <ContractTabs active="policies" />
      <DataTable
        rows={policies}
        href={(p) => `/contracts/policies/${p.id}`}
        emptyMessage="No policies yet."
        columns={[
          { header: "Policy", render: (p) => p.policyName },
          { header: "Version", render: (p) => p.versionNumber ?? "-" },
          { header: "Effective date", render: (p) => formatDate(p.effectiveDate) },
          { header: "Review date", render: (p) => formatDate(p.reviewDate) },
          { header: "Status", render: (p) => <StatusBadge status={p.status} /> },
        ]}
      />
    </div>
  );
}
