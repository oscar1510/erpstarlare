import { db } from "@/lib/db";
import { notFound } from "next/navigation";
import { PageHeader, Section } from "@/components/ui/Page";
import { StatusBadge } from "@/components/ui/Badge";
import { Select } from "@/components/ui/Field";
import { DocumentList } from "@/components/DocumentList";
import { formatDate } from "@/lib/format";
import { TAX_STATUSES, labelize } from "@/lib/constants";
import { updateTaxRecordStatus } from "../actions";

export default async function TaxRecordDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const record = await db.taxRecord.findUnique({ where: { id } });
  if (!record) notFound();

  const documents = record.documentId ? await db.document.findMany({ where: { id: record.documentId } }) : [];

  async function changeStatus(fd: FormData) {
    "use server";
    await updateTaxRecordStatus(id, fd.get("status") as string);
  }

  return (
    <div className="max-w-3xl space-y-6">
      <PageHeader title={labelize(record.docType)} description={record.taxRefNumber ?? undefined} actions={<StatusBadge status={record.status} />} />

      <Section title="Details">
        <div className="card p-5 grid grid-cols-2 gap-4 text-sm">
          <div><div className="text-slate-500">Authority</div><div className="font-medium">{record.authority ?? "-"}</div></div>
          <div><div className="text-slate-500">Fiscal period</div><div className="font-medium">{record.fiscalPeriod ?? "-"}</div></div>
          <div><div className="text-slate-500">Issue date</div><div className="font-medium">{formatDate(record.issueDate)}</div></div>
          <div><div className="text-slate-500">Submission date</div><div className="font-medium">{formatDate(record.submissionDate)}</div></div>
          <div><div className="text-slate-500">Next due date</div><div className="font-medium">{formatDate(record.nextDueDate)}</div></div>
        </div>
      </Section>

      <Section title="Status">
        <form action={changeStatus} className="card p-4 flex items-center gap-3">
          <Select name="status" options={TAX_STATUSES.map((s) => ({ value: s, label: labelize(s) }))} defaultValue={record.status} className="w-56" />
          <button className="btn-secondary" type="submit">Update status</button>
        </form>
      </Section>

      <Section title="Documents">
        <DocumentList documents={documents} />
      </Section>
    </div>
  );
}
