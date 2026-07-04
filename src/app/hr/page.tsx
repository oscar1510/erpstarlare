export const dynamic = "force-dynamic";

import { db } from "@/lib/db";
import { PageHeader } from "@/components/ui/Page";
import { DataTable } from "@/components/ui/Table";
import { StatusBadge } from "@/components/ui/Badge";
import { formatDate } from "@/lib/format";
import { labelize } from "@/lib/constants";
import Link from "next/link";

export default async function HRPage() {
  const people = await db.person.findMany({ orderBy: { createdAt: "desc" } });

  return (
    <div>
      <PageHeader
        title="HR / People"
        description="Employees, freelancers, interns, contractors and other people connected to Starflare."
        actions={
          <Link href="/hr/new" className="btn-primary">
            + Add person
          </Link>
        }
      />
      <DataTable
        rows={people}
        href={(p) => `/hr/${p.id}`}
        emptyMessage="No people added yet."
        columns={[
          { header: "Name", render: (p) => `${p.firstName} ${p.lastName}` },
          { header: "Role", render: (p) => p.role ?? "-" },
          { header: "Type", render: (p) => labelize(p.type) },
          { header: "Status", render: (p) => <StatusBadge status={p.status} /> },
          { header: "Contract end", render: (p) => formatDate(p.contractEnd) },
          { header: "Visa/permit date", render: (p) => formatDate(p.visaPermitDate) },
        ]}
      />
    </div>
  );
}
