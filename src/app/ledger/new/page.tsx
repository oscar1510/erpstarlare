export const dynamic = "force-dynamic";

import { db } from "@/lib/db";
import { SubmitButton } from "@/components/SubmitButton";
import { PageHeader } from "@/components/ui/Page";
import { Field, FormGrid, Select, TextArea, TextInput } from "@/components/ui/Field";
import { CURRENCIES, LEDGER_TYPES, PAYMENT_METHODS, labelize } from "@/lib/constants";
import { createLedgerEntry } from "../actions";

export default async function NewLedgerEntryPage() {
  const clients = await db.client.findMany({ orderBy: { name: "asc" } });

  return (
    <div className="max-w-2xl">
      <PageHeader title="Manual ledger entry" description="For anything not automatically generated elsewhere (adjustments, one-off transfers, etc)." />
      <form action={createLedgerEntry} className="card p-5 space-y-4">
        <FormGrid>
          <Field label="Date">
            <TextInput type="date" name="date" defaultValue={new Date().toISOString().slice(0, 10)} />
          </Field>
          <Field label="Type">
            <Select name="type" options={LEDGER_TYPES.map((t) => ({ value: t, label: labelize(t) }))} defaultValue="ADJUSTMENT" />
          </Field>
          <Field label="Category">
            <TextInput name="category" placeholder="e.g. Bank fee" />
          </Field>
          <Field label="Amount">
            <div className="flex gap-2">
              <TextInput type="number" step="0.01" name="amount" required className="flex-1" />
              <Select name="currency" options={CURRENCIES.map((c) => ({ value: c, label: c }))} defaultValue="AED" className="w-24" />
            </div>
          </Field>
          <Field label="VAT">
            <TextInput type="number" step="0.01" name="vat" />
          </Field>
          <Field label="Client">
            <Select name="clientId" options={clients.map((c) => ({ value: c.id, label: c.name }))} placeholder="None" />
          </Field>
          <Field label="Vendor">
            <TextInput name="vendorName" />
          </Field>
          <Field label="Payment method">
            <Select name="paymentMethod" options={PAYMENT_METHODS.map((m) => ({ value: m, label: m }))} placeholder="Select..." />
          </Field>
        </FormGrid>
        <Field label="Notes">
          <TextArea name="notes" rows={2} />
        </Field>
        <div className="flex justify-end">
          <SubmitButton>Save entry</SubmitButton>
        </div>
      </form>
    </div>
  );
}
