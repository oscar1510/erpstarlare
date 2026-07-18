export const dynamic = "force-dynamic";

import { db } from "@/lib/db";
import { notFound } from "next/navigation";
import { PageHeader, Section } from "@/components/ui/Page";
import { Field, FormGrid, Select, TextArea, TextInput } from "@/components/ui/Field";
import { DocumentUploader } from "@/components/DocumentUploader";
import { SubmitButton } from "@/components/SubmitButton";
import { DeleteButton } from "@/components/DeleteButton";
import { formatDateInput } from "@/lib/format";
import { CURRENCIES, PAYMENT_ACCOUNTS, PAYMENT_METHODS, RECONCILIATION_STATUSES, labelize } from "@/lib/constants";
import { updatePayment, deletePayment } from "../actions";

export default async function PaymentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const payment = await db.payment.findUnique({ where: { id } });
  if (!payment) notFound();

  const [clients, people, invoices, receivedInvoices, proofDoc] = await Promise.all([
    db.client.findMany({ orderBy: { name: "asc" } }),
    db.person.findMany({ orderBy: { firstName: "asc" } }),
    db.invoice.findMany({ orderBy: { invoiceDate: "desc" }, take: 100 }),
    db.receivedInvoice.findMany({ orderBy: { createdAt: "desc" }, take: 100 }),
    payment.proofDocumentId ? db.document.findUnique({ where: { id: payment.proofDocumentId } }) : null,
  ]);

  const action = updatePayment.bind(null, id);

  return (
    <div className="max-w-3xl space-y-6">
      <PageHeader
        title="Edit payment"
        description="Change any detail, attach a receipt, and link it to an invoice."
        actions={<DeleteButton action={deletePayment.bind(null, id)} confirm="Delete this payment? This cannot be undone." />}
      />

      <form action={action} className="card p-5 space-y-4">
        <FormGrid>
          <Field label="Type">
            <Select name="type" options={[{ value: "INCOMING", label: "Incoming" }, { value: "OUTGOING", label: "Outgoing" }]} defaultValue={payment.type} />
          </Field>
          <Field label="Date">
            <TextInput type="date" name="date" defaultValue={formatDateInput(payment.date)} />
          </Field>
          <Field label="Amount">
            <div className="flex gap-2">
              <TextInput type="number" step="0.01" name="amount" defaultValue={payment.amount} required className="flex-1" />
              <Select name="currency" options={CURRENCIES.map((c) => ({ value: c, label: c }))} defaultValue={payment.currency} className="w-24" />
            </div>
          </Field>
          <Field label="Payment method">
            <Select name="method" options={PAYMENT_METHODS.map((m) => ({ value: m, label: m }))} defaultValue={payment.method ?? ""} placeholder="Select..." />
          </Field>
          <Field label="Account (from / into)">
            <Select name="account" options={PAYMENT_ACCOUNTS.map((a) => ({ value: a, label: a }))} defaultValue={payment.account ?? ""} placeholder="Select account..." />
          </Field>
          <Field label="Payer">
            <TextInput name="payer" defaultValue={payment.payer ?? ""} />
          </Field>
          <Field label="Payee">
            <TextInput name="payee" defaultValue={payment.payee ?? ""} />
          </Field>
          <Field label="Related client">
            <Select name="clientId" options={clients.map((c) => ({ value: c.id, label: c.name }))} defaultValue={payment.clientId ?? ""} placeholder="None" />
          </Field>
          <Field label="Related person">
            <Select name="personId" options={people.map((p) => ({ value: p.id, label: `${p.firstName} ${p.lastName}` }))} defaultValue={payment.personId ?? ""} placeholder="None" />
          </Field>
          <Field label="Related vendor">
            <TextInput name="vendorName" defaultValue={payment.vendorName ?? ""} />
          </Field>
          <Field label="Related issued invoice">
            <Select name="invoiceId" options={invoices.map((i) => ({ value: i.id, label: i.number }))} defaultValue={payment.invoiceId ?? ""} placeholder="None" />
          </Field>
          <Field label="Related received invoice">
            <Select name="receivedInvoiceId" options={receivedInvoices.map((i) => ({ value: i.id, label: `${i.vendorName ?? "Vendor"} · ${i.invoiceNumber ?? i.id.slice(0, 6)}` }))} defaultValue={payment.receivedInvoiceId ?? ""} placeholder="None" />
          </Field>
          <Field label="Reconciliation status">
            <Select name="reconciliation" options={RECONCILIATION_STATUSES.map((s) => ({ value: s, label: labelize(s) }))} defaultValue={payment.reconciliation} />
          </Field>
        </FormGrid>

        <Field label="Proof of payment">
          {proofDoc && (
            <a href={`/api/files/${proofDoc.id}`} target="_blank" className="btn-secondary !py-1 !text-xs mb-2 inline-flex">🔍 View current receipt</a>
          )}
          <DocumentUploader name="proof" label={proofDoc ? "Replace receipt" : "Upload receipt"} />
        </Field>
        <Field label="Notes">
          <TextArea name="notes" defaultValue={payment.notes ?? ""} rows={2} />
        </Field>

        <div className="flex justify-end">
          <SubmitButton>Save payment</SubmitButton>
        </div>
      </form>
    </div>
  );
}
