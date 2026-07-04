export const dynamic = "force-dynamic";

import { db } from "@/lib/db";
import { PageHeader } from "@/components/ui/Page";
import { Field, FormGrid, Select, TextArea, TextInput } from "@/components/ui/Field";
import { CURRENCIES, PAYMENT_METHODS, RECONCILIATION_STATUSES, labelize } from "@/lib/constants";
import { createPayment } from "../actions";

export default async function NewPaymentPage() {
  const [clients, people, invoices, receivedInvoices, bankTransactions] = await Promise.all([
    db.client.findMany({ orderBy: { name: "asc" } }),
    db.person.findMany({ orderBy: { firstName: "asc" } }),
    db.invoice.findMany({ orderBy: { invoiceDate: "desc" }, take: 100 }),
    db.receivedInvoice.findMany({ orderBy: { createdAt: "desc" }, take: 100 }),
    db.bankTransaction.findMany({ where: { reconciliation: "UNMATCHED" }, orderBy: { date: "desc" }, take: 100 }),
  ]);

  return (
    <div className="max-w-3xl">
      <PageHeader title="Add payment" description="Incoming or outgoing payment, and what it's linked to." />
      <form action={createPayment} className="card p-5 space-y-4">
        <FormGrid>
          <Field label="Type">
            <Select name="type" options={[{ value: "INCOMING", label: "Incoming" }, { value: "OUTGOING", label: "Outgoing" }]} defaultValue="INCOMING" />
          </Field>
          <Field label="Date">
            <TextInput type="date" name="date" defaultValue={new Date().toISOString().slice(0, 10)} />
          </Field>
          <Field label="Amount">
            <div className="flex gap-2">
              <TextInput type="number" step="0.01" name="amount" required className="flex-1" />
              <Select name="currency" options={CURRENCIES.map((c) => ({ value: c, label: c }))} defaultValue="AED" className="w-24" />
            </div>
          </Field>
          <Field label="Payment method">
            <Select name="method" options={PAYMENT_METHODS.map((m) => ({ value: m, label: m }))} placeholder="Select..." />
          </Field>
          <Field label="Payer">
            <TextInput name="payer" />
          </Field>
          <Field label="Payee">
            <TextInput name="payee" />
          </Field>
          <Field label="Related client">
            <Select name="clientId" options={clients.map((c) => ({ value: c.id, label: c.name }))} placeholder="None" />
          </Field>
          <Field label="Related person">
            <Select name="personId" options={people.map((p) => ({ value: p.id, label: `${p.firstName} ${p.lastName}` }))} placeholder="None" />
          </Field>
          <Field label="Related vendor">
            <TextInput name="vendorName" />
          </Field>
          <Field label="Related issued invoice">
            <Select name="invoiceId" options={invoices.map((i) => ({ value: i.id, label: i.number }))} placeholder="None" />
          </Field>
          <Field label="Related received invoice">
            <Select name="receivedInvoiceId" options={receivedInvoices.map((i) => ({ value: i.id, label: `${i.vendorName ?? "Vendor"} · ${i.invoiceNumber ?? i.id.slice(0, 6)}` }))} placeholder="None" />
          </Field>
          <Field label="Match bank transaction">
            <Select
              name="bankTransactionId"
              options={bankTransactions.map((t) => ({ value: t.id, label: `${t.date.toISOString().slice(0, 10)} · ${t.description?.slice(0, 30) ?? ""}` }))}
              placeholder="Not matched yet"
            />
          </Field>
          <Field label="Reconciliation status">
            <Select name="reconciliation" options={RECONCILIATION_STATUSES.map((s) => ({ value: s, label: labelize(s) }))} defaultValue="UNMATCHED" />
          </Field>
        </FormGrid>
        <Field label="Proof of payment">
          <input type="file" name="proof" accept="image/*,application/pdf" className="text-sm" />
        </Field>
        <Field label="Notes">
          <TextArea name="notes" rows={2} />
        </Field>
        <div className="flex justify-end">
          <button className="btn-primary" type="submit">Save payment</button>
        </div>
      </form>
    </div>
  );
}
