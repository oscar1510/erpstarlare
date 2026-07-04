export const dynamic = "force-dynamic";

import { db } from "@/lib/db";
import { PageHeader } from "@/components/ui/Page";
import { Field, FormGrid, Select, TextArea, TextInput } from "@/components/ui/Field";
import { CURRENCIES, INVOICE_STATUSES, PAYMENT_METHODS, labelize } from "@/lib/constants";
import { createInvoice } from "../actions";

export default async function NewInvoicePage({ searchParams }: { searchParams: Promise<{ clientId?: string }> }) {
  const { clientId } = await searchParams;
  const clients = await db.client.findMany({ orderBy: { name: "asc" } });

  return (
    <div className="max-w-3xl">
      <PageHeader title="New invoice" description="Sequential Starflare invoice number is generated automatically." />
      <form action={createInvoice} className="card p-5 space-y-4">
        <FormGrid>
          <Field label="Client">
            <Select
              name="clientId"
              options={clients.map((c) => ({ value: c.id, label: c.name }))}
              placeholder="Select client..."
              defaultValue={clientId}
            />
          </Field>
          <Field label="Invoice date">
            <TextInput type="date" name="invoiceDate" defaultValue={new Date().toISOString().slice(0, 10)} />
          </Field>
          <Field label="Due date">
            <TextInput type="date" name="dueDate" />
          </Field>
          <Field label="Currency">
            <Select name="currency" options={CURRENCIES.map((c) => ({ value: c, label: c }))} defaultValue="AED" />
          </Field>
          <Field label="Quantity">
            <TextInput type="number" step="1" name="quantity" defaultValue="1" />
          </Field>
          <Field label="Unit price">
            <TextInput type="number" step="0.01" name="unitPrice" required />
          </Field>
          <Field label="VAT">
            <TextInput type="number" step="0.01" name="vat" defaultValue="0" />
          </Field>
          <Field label="Payment method">
            <Select name="paymentMethod" options={PAYMENT_METHODS.map((m) => ({ value: m, label: m }))} placeholder="Select..." />
          </Field>
          <Field label="Status">
            <Select name="status" options={INVOICE_STATUSES.map((s) => ({ value: s, label: labelize(s) }))} defaultValue="DRAFT" />
          </Field>
        </FormGrid>
        <Field label="Description of service / package">
          <TextArea name="description" rows={2} />
        </Field>
        <Field label="Notes">
          <TextArea name="notes" rows={2} />
        </Field>
        <div className="flex justify-end">
          <button className="btn-primary" type="submit">
            Create invoice
          </button>
        </div>
      </form>
    </div>
  );
}
