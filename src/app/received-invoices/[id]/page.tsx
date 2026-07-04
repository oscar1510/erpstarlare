import { db } from "@/lib/db";
import { notFound } from "next/navigation";
import { PageHeader, Section } from "@/components/ui/Page";
import { StatusBadge } from "@/components/ui/Badge";
import { Select } from "@/components/ui/Field";
import { DocumentList } from "@/components/DocumentList";
import { formatDate, formatMoney } from "@/lib/format";
import { RECEIVED_INVOICE_STATUSES, labelize } from "@/lib/constants";
import { updateReceivedInvoiceStatus } from "../actions";

export default async function ReceivedInvoiceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ri = await db.receivedInvoice.findUnique({ where: { id } });
  if (!ri) notFound();

  const documents = ri.documentId ? await db.document.findMany({ where: { id: ri.documentId } }) : [];

  async function changeStatus(fd: FormData) {
    "use server";
    await updateReceivedInvoiceStatus(id, fd.get("status") as string);
  }

  return (
    <div className="max-w-3xl space-y-6">
      <PageHeader title={ri.vendorName ?? "Supplier invoice"} description={ri.invoiceNumber ?? undefined} actions={<StatusBadge status={ri.paymentStatus} />} />

      <Section title="Details">
        <div className="card p-5 grid grid-cols-2 gap-4 text-sm">
          <div><div className="text-slate-500">Vendor category</div><div className="font-medium">{ri.vendorCategory ?? "-"}</div></div>
          <div><div className="text-slate-500">Invoice date</div><div className="font-medium">{formatDate(ri.invoiceDate)}</div></div>
          <div><div className="text-slate-500">Due date</div><div className="font-medium">{formatDate(ri.dueDate)}</div></div>
          <div><div className="text-slate-500">Amount</div><div className="font-medium">{formatMoney(ri.amount, ri.currency)}</div></div>
          <div><div className="text-slate-500">VAT</div><div className="font-medium">{formatMoney(ri.vat, ri.currency)}</div></div>
          <div><div className="text-slate-500">Expense category</div><div className="font-medium">{ri.expenseCategory ?? "-"}</div></div>
          <div><div className="text-slate-500">Recurring</div><div className="font-medium">{ri.recurring ? "Yes" : "No"}</div></div>
          <div><div className="text-slate-500">Tax reg. number</div><div className="font-medium">{ri.taxRegNumber ?? "-"}</div></div>
          {ri.description && <div className="col-span-2"><div className="text-slate-500">Description</div><div className="font-medium">{ri.description}</div></div>}
        </div>
      </Section>

      <Section title="Status">
        <form action={changeStatus} className="card p-4 flex items-center gap-3">
          <Select name="status" options={RECEIVED_INVOICE_STATUSES.map((s) => ({ value: s, label: labelize(s) }))} defaultValue={ri.paymentStatus} className="w-56" />
          <button className="btn-secondary" type="submit">Update status</button>
        </form>
      </Section>

      <Section title="Document">
        <DocumentList documents={documents} />
      </Section>
    </div>
  );
}
