import { db } from "@/lib/db";
import { notFound } from "next/navigation";
import { PageHeader, Section } from "@/components/ui/Page";
import { Field, FormGrid, Select, TextArea, TextInput } from "@/components/ui/Field";
import { ConfidenceBadge } from "@/components/ui/Badge";
import { CURRENCIES } from "@/lib/constants";
import { confirmStripeInvoice } from "../../../actions";
import { formatDateInput } from "@/lib/format";

export default async function ReviewStripeInvoicePage({ params }: { params: Promise<{ documentId: string }> }) {
  const { documentId } = await params;
  const document = await db.document.findUnique({ where: { id: documentId } });
  if (!document) notFound();

  const fields: Record<string, { value: any; confidence: number }> = document.extractedFields
    ? JSON.parse(document.extractedFields)
    : {};

  const clients = await db.client.findMany({ orderBy: { name: "asc" } });
  const guessedName = (fields.clientName?.value as string) || "";
  const suggestedClient = clients.find(
    (c) => guessedName && (c.name.toLowerCase().includes(guessedName.toLowerCase()) || guessedName.toLowerCase().includes(c.name.toLowerCase()))
  );

  const action = confirmStripeInvoice.bind(null, documentId);

  return (
    <div className="max-w-3xl space-y-6">
      <PageHeader
        title="Review Stripe invoice"
        description="Confirm or correct the OCR-extracted data before Starflare's invoice is created. Nothing is saved to billing until you confirm."
      />

      <Section title="Original document">
        <a href={`/api/files/${document.id}`} target="_blank" className="btn-secondary">
          🔍 View uploaded Stripe invoice
        </a>
        {document.ocrStatus === "FAILED" && (
          <p className="text-sm text-red-600 mt-2">OCR could not read this file — please fill in the fields manually below.</p>
        )}
      </Section>

      <Section title="Extracted data (edit anything that looks wrong)">
        <form action={action} className="card p-5 space-y-4">
          <FormGrid>
            <Field label="Match to existing client">
              <Select
                name="clientId"
                options={clients.map((c) => ({ value: c.id, label: c.name }))}
                placeholder="No match — leave unlinked"
                defaultValue={suggestedClient?.id}
              />
            </Field>
            <Field
              label="Client name (from Stripe)"
              hint={fields.clientName ? undefined : "Not detected by OCR"}
            >
              <div className="flex items-center gap-2">
                <TextInput name="clientName" defaultValue={guessedName} className="flex-1" />
                {fields.clientName && <ConfidenceBadge confidence={fields.clientName.confidence} />}
              </div>
            </Field>
            <Field label="Client email">
              <TextInput name="clientEmail" type="email" defaultValue={fields.clientEmail?.value ?? ""} />
            </Field>
            <Field label="Invoice date">
              <div className="flex items-center gap-2">
                <TextInput type="date" name="invoiceDate" defaultValue={formatDateInput(fields.invoiceDate?.value)} className="flex-1" />
                {fields.invoiceDate && <ConfidenceBadge confidence={fields.invoiceDate.confidence} />}
              </div>
            </Field>
            <Field label="Due date">
              <TextInput type="date" name="dueDate" defaultValue={formatDateInput(fields.dueDate?.value)} />
            </Field>
            <Field label="Amount">
              <div className="flex items-center gap-2">
                <TextInput type="number" step="0.01" name="amount" defaultValue={fields.amount?.value ?? ""} required className="flex-1" />
                {fields.amount && <ConfidenceBadge confidence={fields.amount.confidence} />}
              </div>
            </Field>
            <Field label="Currency">
              <Select name="currency" options={CURRENCIES.map((c) => ({ value: c, label: c }))} defaultValue={fields.currency?.value ?? "AED"} />
            </Field>
            <Field label="Already paid?">
              <Select
                name="isPaid"
                options={[{ value: "yes", label: "Yes — mark invoice as paid" }, { value: "no", label: "No — mark as sent" }]}
                defaultValue={fields.isPaid?.value ? "yes" : "no"}
              />
            </Field>
          </FormGrid>
          <Field label="Description">
            <TextArea name="description" defaultValue={fields.description?.value ?? ""} rows={2} />
          </Field>
          <div className="flex justify-end">
            <button className="btn-primary" type="submit">
              Confirm & create Starflare invoice
            </button>
          </div>
        </form>
      </Section>
    </div>
  );
}
