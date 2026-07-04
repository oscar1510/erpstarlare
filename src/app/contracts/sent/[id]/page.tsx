import { db } from "@/lib/db";
import { notFound } from "next/navigation";
import { PageHeader, Section } from "@/components/ui/Page";
import { StatusBadge } from "@/components/ui/Badge";
import { Select } from "@/components/ui/Field";
import { DocumentList } from "@/components/DocumentList";
import { formatDate, formatMoney } from "@/lib/format";
import { CONTRACT_STATUSES, labelize } from "@/lib/constants";
import { updateContractStatus } from "../../actions";

export default async function SentContractDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const contract = await db.sentContract.findUnique({ where: { id } });
  if (!contract) notFound();

  const documents = contract.documentId ? await db.document.findMany({ where: { id: contract.documentId } }) : [];

  async function changeStatus(fd: FormData) {
    "use server";
    await updateContractStatus("sent", id, fd.get("status") as string);
  }

  return (
    <div className="max-w-3xl space-y-6">
      <PageHeader title={contract.partnerName ?? "Contract"} description={contract.packageName ?? undefined} actions={<StatusBadge status={contract.status} />} />

      <Section title="Details">
        <div className="card p-5 grid grid-cols-2 gap-4 text-sm">
          <div><div className="text-slate-500">Price</div><div className="font-medium">{formatMoney(contract.price, contract.currency)}</div></div>
          <div><div className="text-slate-500">Duration</div><div className="font-medium">{contract.duration ?? "-"}</div></div>
          <div><div className="text-slate-500">Payment terms</div><div className="font-medium">{contract.paymentTerms ?? "-"}</div></div>
          <div><div className="text-slate-500">Signature date</div><div className="font-medium">{formatDate(contract.signatureDate)}</div></div>
          <div><div className="text-slate-500">Start date</div><div className="font-medium">{formatDate(contract.startDate)}</div></div>
          <div><div className="text-slate-500">End date</div><div className="font-medium">{formatDate(contract.endDate)}</div></div>
          <div><div className="text-slate-500">Renewal date</div><div className="font-medium">{formatDate(contract.renewalDate)}</div></div>
        </div>
      </Section>

      <Section title="Status">
        <form action={changeStatus} className="card p-4 flex items-center gap-3">
          <Select name="status" options={CONTRACT_STATUSES.map((s) => ({ value: s, label: labelize(s) }))} defaultValue={contract.status} className="w-56" />
          <button className="btn-secondary" type="submit">Update status</button>
        </form>
      </Section>

      <Section title="Document">
        <DocumentList documents={documents} />
      </Section>
    </div>
  );
}
