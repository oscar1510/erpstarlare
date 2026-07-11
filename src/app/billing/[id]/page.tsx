export const dynamic = "force-dynamic";

import { db } from "@/lib/db";
import { SubmitButton } from "@/components/SubmitButton";
import { notFound } from "next/navigation";
import { PageHeader, Section } from "@/components/ui/Page";
import { StatusBadge } from "@/components/ui/Badge";
import { Field, FormGrid, Select, TextArea, TextInput } from "@/components/ui/Field";
import { formatDate, formatDateInput, formatMoney } from "@/lib/format";
import { CURRENCIES, INVOICE_STATUSES, PAYMENT_ACCOUNTS, PAYMENT_METHODS, labelize } from "@/lib/constants";
import { sendInvoiceEmail, updateInvoiceStatus, updateInvoiceDetails, trashInvoice } from "../actions";

export default async function InvoiceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const invoice = await db.invoice.findUnique({ where: { id } });
  if (!invoice) notFound();

  const stripeDoc = invoice.sourceStripeDocumentId
    ? await db.document.findUnique({ where: { id: invoice.sourceStripeDocumentId } })
    : null;

  // The branded Starflare document (new invoice layout) linked to this invoice, if any.
  const brandedDoc = await db.quotation.findFirst({ where: { invoiceId: id } });

  async function changeStatus(fd: FormData) {
    "use server";
    const raw = fd.get("paidDate");
    const paidDate = typeof raw === "string" && raw ? new Date(raw) : null;
    const account = (fd.get("account") as string) || null;
    await updateInvoiceStatus(id, fd.get("status") as string, paidDate, account);
  }

  async function emailInvoice() {
    "use server";
    await sendInvoiceEmail(id);
  }

  async function trash() {
    "use server";
    await trashInvoice(id);
  }

  const editDetails = updateInvoiceDetails.bind(null, id);

  return (
    <div className="max-w-3xl space-y-6">
      <PageHeader
        title={`Invoice ${invoice.number}`}
        description={invoice.clientNameSnapshot ?? undefined}
        actions={
          <>
            {brandedDoc ? (
              <a href={`/billing/documents/${brandedDoc.id}`} className="btn-secondary">
                📄 Branded document
              </a>
            ) : (
              <a href={`/billing/${id}/pdf`} target="_blank" className="btn-secondary">
                📄 Export PDF
              </a>
            )}
            <form action={emailInvoice}>
              <SubmitButton>✉️ Send to client</SubmitButton>
            </form>
            <form action={trash}>
              <SubmitButton className="btn-secondary text-red-600 border-red-200 hover:bg-red-50">🗑 Delete</SubmitButton>
            </form>
          </>
        }
      />

      {invoice.source === "STRIPE" && (
        <div className="card p-4 bg-indigo-50 border-indigo-200 text-sm text-indigo-900">
          This invoice was auto-created from an uploaded Stripe invoice.{" "}
          {stripeDoc && (
            <a href={`/api/files/${stripeDoc.id}`} target="_blank" className="underline font-medium">
              View original Stripe invoice
            </a>
          )}
        </div>
      )}

      <Section title="Details">
        <form action={editDetails} className="card p-5 space-y-4">
          <FormGrid>
            <Field label="Invoice number">
              <TextInput name="number" defaultValue={invoice.number} required />
            </Field>
            <Field label="Client name (shown on invoice)">
              <TextInput name="clientNameSnapshot" defaultValue={invoice.clientNameSnapshot ?? ""} />
            </Field>
            <Field label="Invoice date">
              <TextInput type="date" name="invoiceDate" defaultValue={formatDateInput(invoice.invoiceDate)} />
            </Field>
            <Field label="Due date">
              <TextInput type="date" name="dueDate" defaultValue={formatDateInput(invoice.dueDate)} />
            </Field>
            <Field label="Paid date (drives which month it counts in)">
              <TextInput type="date" name="paidDate" defaultValue={formatDateInput(invoice.paidDate)} />
            </Field>
            <Field label="Currency">
              <Select name="currency" options={CURRENCIES.map((c) => ({ value: c, label: c }))} defaultValue={invoice.currency} />
            </Field>
            <Field label="Quantity">
              <TextInput type="number" step="0.01" name="quantity" defaultValue={invoice.quantity} />
            </Field>
            <Field label="Unit price">
              <TextInput type="number" step="0.01" name="unitPrice" defaultValue={invoice.unitPrice} />
            </Field>
            <Field label="VAT">
              <TextInput type="number" step="0.01" name="vat" defaultValue={invoice.vat} />
            </Field>
            <Field label="Payment method">
              <Select name="paymentMethod" options={PAYMENT_METHODS.map((m) => ({ value: m, label: m }))} defaultValue={invoice.paymentMethod ?? ""} placeholder="Select..." />
            </Field>
            <Field label="Received into (account)">
              <Select name="account" options={PAYMENT_ACCOUNTS.map((a) => ({ value: a, label: a }))} defaultValue={invoice.account ?? ""} placeholder="Select account..." />
            </Field>
          </FormGrid>
          <Field label="Description">
            <TextInput name="description" defaultValue={invoice.description ?? ""} />
          </Field>
          <Field label="Notes">
            <TextArea name="notes" defaultValue={invoice.notes ?? ""} rows={2} />
          </Field>
          <div className="flex items-center justify-between">
            <div className="text-sm text-slate-500">
              Total: <span className="font-semibold text-slate-900">{formatMoney(invoice.total, invoice.currency)}</span>
              {invoice.sentAt && <span className="ml-3 text-xs">Sent to {invoice.sentToEmail} on {formatDate(invoice.sentAt)}</span>}
            </div>
            <SubmitButton>Save details</SubmitButton>
          </div>
        </form>
      </Section>

      <Section title="Status">
        <form action={changeStatus} className="card p-4 flex flex-wrap items-end gap-3">
          <div>
            <div className="mb-1 text-xs text-slate-500">Status</div>
            <div className="flex items-center gap-2">
              <StatusBadge status={invoice.status} />
              <Select name="status" options={INVOICE_STATUSES.map((s) => ({ value: s, label: labelize(s) }))} defaultValue={invoice.status} className="w-56" />
            </div>
          </div>
          <div>
            <div className="mb-1 text-xs text-slate-500">Payment date (when marking Paid)</div>
            <input type="date" name="paidDate" defaultValue={formatDateInput(invoice.paidDate)} className="form-input w-44" />
          </div>
          <div>
            <div className="mb-1 text-xs text-slate-500">Received into (account)</div>
            <Select name="account" options={PAYMENT_ACCOUNTS.map((a) => ({ value: a, label: a }))} defaultValue={invoice.account ?? ""} placeholder="Select account..." className="w-48" />
          </div>
          <SubmitButton className="btn-secondary">Update status</SubmitButton>
        </form>
        <p className="mt-2 text-xs text-slate-500">Revenue counts in the month of the payment date — so an invoice paid last year won&apos;t show up in this month&apos;s revenue.</p>
      </Section>
    </div>
  );
}
