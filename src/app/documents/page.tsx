export const dynamic = "force-dynamic";

import { db } from "@/lib/db";
import { PageHeader } from "@/components/ui/Page";
import { DataTable } from "@/components/ui/Table";
import { ConfidenceBadge, StatusBadge } from "@/components/ui/Badge";
import { formatDateTime } from "@/lib/format";
import { labelize } from "@/lib/constants";
import Link from "next/link";
import { Prisma } from "@prisma/client";

const FILTERS = [
  { key: "all", label: "All documents" },
  { key: "needs_review", label: "Needs review" },
  { key: "low_confidence", label: "Low confidence OCR" },
  { key: "missing_category", label: "Missing category" },
  { key: "unlinked", label: "Not linked to any record" },
  { key: "expiring", label: "Expiring soon" },
  { key: "expired", label: "Expired" },
];

export default async function DocumentsPage({ searchParams }: { searchParams: Promise<{ q?: string; filter?: string }> }) {
  const { q, filter = "all" } = await searchParams;

  const linkFields = [
    "personId", "clientId", "invoiceId", "receivedInvoiceId", "bankTransactionId", "bankStatementId",
    "taxRecordId", "rentRecordId", "receivedContractId", "sentContractId", "policyId", "expenseId",
    "reimbursementId", "compensationPaymentId", "paymentId", "ledgerEntryId",
  ] as const;

  let where: Prisma.DocumentWhereInput = {};
  if (filter === "needs_review") where = { OR: [{ status: "NEEDS_REVIEW" }, { ocrStatus: "FAILED" }] };
  else if (filter === "low_confidence") where = { ocrConfidence: { lt: 0.5 } };
  else if (filter === "missing_category") where = { category: null };
  else if (filter === "unlinked") where = { AND: linkFields.map((f) => ({ [f]: null })) };
  else if (filter === "expiring") {
    const in30 = new Date();
    in30.setDate(in30.getDate() + 30);
    where = { expiryDate: { gte: new Date(), lte: in30 } };
  } else if (filter === "expired") where = { expiryDate: { lt: new Date() } };

  if (q) {
    where = {
      ...where,
      OR: [
        { fileName: { contains: q } },
        { ocrText: { contains: q } },
        { category: { contains: q } },
        { documentType: { contains: q } },
      ],
    };
  }

  const documents = await db.document.findMany({ where, orderBy: { createdAt: "desc" }, take: 300 });

  return (
    <div>
      <PageHeader
        title="Document Archive"
        description="Master archive of every document uploaded anywhere in the ERP."
        actions={<Link href="/documents/upload" className="btn-primary">+ Upload document</Link>}
      />
      <form className="mb-4" action="/documents" method="get">
        <input type="hidden" name="filter" value={filter} />
        <input type="search" name="q" defaultValue={q} placeholder="Search by name, OCR text, category, type..." className="form-input max-w-md" />
      </form>
      <div className="flex flex-wrap gap-2 mb-4">
        {FILTERS.map((f) => (
          <Link key={f.key} href={`/documents?filter=${f.key}${q ? `&q=${encodeURIComponent(q)}` : ""}`} className={filter === f.key ? "btn-primary !py-1 !text-xs" : "btn-secondary !py-1 !text-xs"}>
            {f.label}
          </Link>
        ))}
      </div>
      <DataTable
        rows={documents}
        emptyMessage="No documents match this view."
        columns={[
          { header: "File", render: (d) => <a href={`/api/files/${d.id}`} target="_blank" className="text-brand-700 hover:underline">{d.fileName}</a> },
          { header: "Type", render: (d) => labelize(d.documentType) },
          { header: "Category", render: (d) => d.category ?? "-" },
          { header: "Uploaded", render: (d) => formatDateTime(d.createdAt) },
          { header: "OCR confidence", render: (d) => (d.ocrConfidence !== null ? <ConfidenceBadge confidence={d.ocrConfidence} /> : "-") },
          { header: "Status", render: (d) => <StatusBadge status={d.status} /> },
        ]}
      />
    </div>
  );
}
