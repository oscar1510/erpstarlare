export const dynamic = "force-dynamic";

import { db } from "@/lib/db";
import { notFound } from "next/navigation";
import { PageHeader, Section } from "@/components/ui/Page";
import { StatusBadge } from "@/components/ui/Badge";
import { Select } from "@/components/ui/Field";
import { formatDate, formatMoney } from "@/lib/format";
import { INVOICE_STATUSES, labelize } from "@/lib/constants";
import { sendInvoiceEmail, updateInvoiceStatus, trashInvoice } from "../actions";

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
    await updateInvoiceStatus(id, fd.get("status") as string);
  }

  async function emailInvoice() {
    "use server";
    await sendInvoiceEmail(id);
  }

  async function trash() {
    "use server";
    await trashInvoice(id);
  }

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
              <button className="btn-primary" type="submit">✉️ Send to client</button>
            </form>
            <form action={trash}>
              <button className="btn-secondary text-red-600 border-red-200 hover:bg-red-50" type="submit">🗑 Delete</button>
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
        <div className="card p-5 grid grid-cols-2 gap-4 text-sm">
          <div>
            <div className="text-slate-500">Invoice date</div>
            <div className="font-medium">{formatDate(invoice.invoiceDate)}</div>
          </div>
          <div>
            <div className="text-slate-500">Due date</div>
            <div className="font-medium">{formatDate(invoice.dueDate)}</div>
          </div>
          <div>
            <div className="text-slate-500">Description</div>
            <div className="font-medium">{invoice.description ?? "-"}</div>
          </div>
          <div>
            <div className="text-slate-500">Payment method</div>
            <div className="font-medium">{invoice.paymentMethod ?? "-"}</div>
          </div>
          <div>
            <div className="text-slate-500">Quantity × Unit price</div>
            <div className="font-medium">
              {invoice.quantity} × {formatMoney(invoice.unitPrice, invoice.currency)}
            </div>
          </div>
          <div>
            <div className="text-slate-500">VAT</div>
            <div className="font-medium">{formatMoney(invoice.vat, invoice.currency)}</div>
          </div>
          <div>
            <div className="text-slate-500">Total</div>
            <div className="font-semibold text-lg">{formatMoney(invoice.total, invoice.currency)}</div>
          </div>
          <div>
            <div className="text-slate-500">Client TRN</div>
            <div className="font-medium">{invoice.clientTRNSnapshot ?? "-"}</div>
          </div>
          {invoice.sentAt && (
            <div className="col-span-2 text-xs text-slate-500">
              Sent to {invoice.sentToEmail} on {formatDate(invoice.sentAt)}
            </div>
          )}
          {invoice.notes && (
            <div className="col-span-2">
              <div className="text-slate-500">Notes</div>
              <div className="font-medium">{invoice.notes}</div>
            </div>
          )}
        </div>
      </Section>

      <Section title="Status">
        <form action={changeStatus} className="card p-4 flex items-center gap-3">
          <StatusBadge status={invoice.status} />
          <Select name="status" options={INVOICE_STATUSES.map((s) => ({ value: s, label: labelize(s) }))} defaultValue={invoice.status} className="w-56" />
          <button className="btn-secondary" type="submit">
            Update status
          </button>
        </form>
      </Section>
    </div>
  );
}
