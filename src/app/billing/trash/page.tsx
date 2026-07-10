export const dynamic = "force-dynamic";

import { db } from "@/lib/db";
import { PageHeader, Section } from "@/components/ui/Page";
import { formatDate, formatMoney } from "@/lib/format";
import { computeTotals } from "@/lib/quote-doc";
import { restoreInvoice, deleteInvoiceForever, restoreQuotation, deleteQuotationForever } from "../actions";
import Link from "next/link";

export default async function TrashPage() {
  const [invoices, quotations] = await Promise.all([
    db.invoice.findMany({ where: { deletedAt: { not: null } }, orderBy: { deletedAt: "desc" } }),
    // standalone quotations only (invoice-linked ones are handled via their invoice)
    db.quotation.findMany({ where: { deletedAt: { not: null }, invoiceId: null }, orderBy: { deletedAt: "desc" } }),
  ]);

  return (
    <div className="space-y-8">
      <PageHeader
        title="Trash"
        description="Deleted invoices and quotations. Restore them, or delete permanently to remove them for good."
        actions={<Link href="/billing" className="btn-secondary">← Back to Billing</Link>}
      />

      <Section title={`Invoices (${invoices.length})`}>
        {invoices.length === 0 ? (
          <div className="card p-6 text-sm text-slate-500">No invoices in Trash.</div>
        ) : (
          <div className="card divide-y divide-slate-100">
            {invoices.map((i) => (
              <div key={i.id} className="p-4 flex items-center justify-between gap-3">
                <div className="text-sm">
                  <div className="font-medium">{i.number} · {formatMoney(i.total, i.currency)}</div>
                  <div className="text-slate-500">{i.clientNameSnapshot ?? "—"} · deleted {formatDate(i.deletedAt)}</div>
                </div>
                <div className="flex gap-2">
                  <form action={restoreInvoice.bind(null, i.id)}><button className="btn-secondary">Restore</button></form>
                  <form action={deleteInvoiceForever.bind(null, i.id)}>
                    <button className="btn-secondary text-red-600 border-red-200 hover:bg-red-50">Delete forever</button>
                  </form>
                </div>
              </div>
            ))}
          </div>
        )}
      </Section>

      <Section title={`Quotations (${quotations.length})`}>
        {quotations.length === 0 ? (
          <div className="card p-6 text-sm text-slate-500">No quotations in Trash.</div>
        ) : (
          <div className="card divide-y divide-slate-100">
            {quotations.map((q) => (
              <div key={q.id} className="p-4 flex items-center justify-between gap-3">
                <div className="text-sm">
                  <div className="font-medium">{q.number} · {formatMoney(computeTotals(q).total, q.currency)}</div>
                  <div className="text-slate-500">{q.companyName ?? "—"} · deleted {formatDate(q.deletedAt)}</div>
                </div>
                <div className="flex gap-2">
                  <form action={restoreQuotation.bind(null, q.id)}><button className="btn-secondary">Restore</button></form>
                  <form action={deleteQuotationForever.bind(null, q.id)}>
                    <button className="btn-secondary text-red-600 border-red-200 hover:bg-red-50">Delete forever</button>
                  </form>
                </div>
              </div>
            ))}
          </div>
        )}
      </Section>
    </div>
  );
}
