export const dynamic = "force-dynamic";

import { db } from "@/lib/db";
import { PageHeader } from "@/components/ui/Page";
import { DataTable } from "@/components/ui/Table";
import { formatDateTime } from "@/lib/format";
import { Prisma } from "@prisma/client";

export default async function AuditLogPage({
  searchParams,
}: {
  searchParams: Promise<{ section?: string; action?: string; q?: string }>;
}) {
  const { section, action, q } = await searchParams;

  const where: Prisma.AuditLogWhereInput = {
    ...(section ? { section } : {}),
    ...(action ? { action } : {}),
    ...(q ? { summary: { contains: q } } : {}),
  };

  const [logs, sections, actions] = await Promise.all([
    db.auditLog.findMany({ where, orderBy: { createdAt: "desc" }, take: 500 }),
    db.auditLog.groupBy({ by: ["section"], _count: true }),
    db.auditLog.groupBy({ by: ["action"], _count: true }),
  ]);

  return (
    <div>
      <PageHeader title="Audit Log" description="A record of activity across the ERP — not a permissions system, just a history." />

      <form className="mb-4 flex flex-wrap gap-2 items-center" action="/audit-log" method="get">
        <input type="search" name="q" defaultValue={q} placeholder="Search summaries..." className="form-input max-w-xs" />
        <select name="section" defaultValue={section ?? ""} className="form-input w-auto">
          <option value="">All sections</option>
          {sections.map((s) => (
            <option key={s.section} value={s.section}>{s.section} ({s._count})</option>
          ))}
        </select>
        <select name="action" defaultValue={action ?? ""} className="form-input w-auto">
          <option value="">All actions</option>
          {actions.map((a) => (
            <option key={a.action} value={a.action}>{a.action} ({a._count})</option>
          ))}
        </select>
        <button type="submit" className="btn-secondary">Filter</button>
      </form>

      <DataTable
        rows={logs}
        emptyMessage="No activity recorded yet."
        columns={[
          { header: "When", render: (l) => formatDateTime(l.createdAt) },
          { header: "Section", render: (l) => l.section },
          { header: "Action", render: (l) => l.action },
          { header: "Record type", render: (l) => l.recordType },
          { header: "Summary", render: (l) => l.summary },
          { header: "By", render: (l) => l.performedByLabel ?? "-" },
        ]}
      />
    </div>
  );
}
