export const dynamic = "force-dynamic";

import { db } from "@/lib/db";
import { notFound } from "next/navigation";
import { PageHeader, Section } from "@/components/ui/Page";
import { DocumentList } from "@/components/DocumentList";
import { formatDate, formatMoney } from "@/lib/format";

export default async function RentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const record = await db.rentRecord.findUnique({ where: { id } });
  if (!record) notFound();

  const documents = record.contractDocumentId
    ? await db.document.findMany({ where: { id: record.contractDocumentId } })
    : [];

  return (
    <div className="max-w-3xl space-y-6">
      <PageHeader title={record.officeName ?? record.location ?? "Lease"} description={record.landlordName ?? undefined} />

      <Section title="Details">
        <div className="card p-5 grid grid-cols-2 gap-4 text-sm">
          <div><div className="text-slate-500">Location</div><div className="font-medium">{record.location ?? "-"}</div></div>
          <div><div className="text-slate-500">Monthly rent</div><div className="font-medium">{formatMoney(record.monthlyRent, record.currency)}</div></div>
          <div><div className="text-slate-500">Deposit</div><div className="font-medium">{formatMoney(record.deposit, record.currency)}</div></div>
          <div><div className="text-slate-500">Payment schedule</div><div className="font-medium">{record.paymentSchedule ?? "-"}</div></div>
          <div><div className="text-slate-500">Notice period</div><div className="font-medium">{record.noticePeriod ?? "-"}</div></div>
          <div><div className="text-slate-500">Start date</div><div className="font-medium">{formatDate(record.startDate)}</div></div>
          <div><div className="text-slate-500">End date</div><div className="font-medium">{formatDate(record.endDate)}</div></div>
          <div><div className="text-slate-500">Renewal date</div><div className="font-medium">{formatDate(record.renewalDate)}</div></div>
        </div>
      </Section>

      <Section title="Documents">
        <DocumentList documents={documents} />
      </Section>
    </div>
  );
}
