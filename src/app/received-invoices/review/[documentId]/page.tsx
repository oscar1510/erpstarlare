export const dynamic = "force-dynamic";

import { db } from "@/lib/db";
import { SubmitButton } from "@/components/SubmitButton";
import { notFound } from "next/navigation";
import { PageHeader, Section } from "@/components/ui/Page";
import { Field, FormGrid, Select, TextArea, TextInput } from "@/components/ui/Field";
import { ConfidenceBadge } from "@/components/ui/Badge";
import { CURRENCIES, EXPENSE_CATEGORIES, RECEIVED_INVOICE_STATUSES, labelize } from "@/lib/constants";
import { formatDateInput } from "@/lib/format";
import { confirmReceivedInvoice } from "../../actions";

export default async function ReviewReceivedInvoicePage({ params }: { params: Promise<{ documentId: string }> }) {
  const { documentId } = await params;
  const document = await db.document.findUnique({ where: { id: documentId } });
  if (!document) notFound();

  const fields: Record<string, { value: any; confidence: number }> = document.extractedFields
    ? JSON.parse(document.extractedFields)
    : {};
  const action = confirmReceivedInvoice.bind(null, documentId);

  function conf(key: string) {
    return fields[key] ? <ConfidenceBadge confidence={fields[key].confidence} /> : null;
  }

  return (
    <div className="max-w-3xl space-y-6">
      <PageHeader
        title="Review supplier invoice"
        description="Correct anything OCR got wrong before saving. Low-confidence fields are flagged."
      />
      <Section title="Original document">
        <a href={`/api/files/${document.id}`} target="_blank" className="btn-secondary">
          🔍 View uploaded document
        </a>
        {document.ocrStatus === "FAILED" && (
          <p className="text-sm text-red-600 mt-2">OCR could not read this file — please fill in the fields manually.</p>
        )}
      </Section>

      <form action={action} className="card p-5 space-y-4">
        <FormGrid>
          <Field label="Vendor name">
            <div className="flex items-center gap-2">
              <TextInput name="vendorName" defaultValue={fields.vendorName?.value ?? ""} className="flex-1" />
              {conf("vendorName")}
            </div>
          </Field>
          <Field label="Vendor category">
            <Select name="vendorCategory" options={["Supplier", "Freelancer", "Software provider", "Consultant", "Landlord", "Agency", "Other"].map((c) => ({ value: c, label: c }))} placeholder="Select..." />
          </Field>
          <Field label="Invoice number">
            <div className="flex items-center gap-2">
              <TextInput name="invoiceNumber" defaultValue={fields.invoiceNumber?.value ?? ""} className="flex-1" />
              {conf("invoiceNumber")}
            </div>
          </Field>
          <Field label="Tax registration number">
            <TextInput name="taxRegNumber" defaultValue={fields.taxRegNumber?.value ?? ""} />
          </Field>
          <Field label="Invoice date">
            <div className="flex items-center gap-2">
              <TextInput type="date" name="invoiceDate" defaultValue={formatDateInput(fields.invoiceDate?.value)} className="flex-1" />
              {conf("invoiceDate")}
            </div>
          </Field>
          <Field label="Due date">
            <div className="flex items-center gap-2">
              <TextInput type="date" name="dueDate" defaultValue={formatDateInput(fields.dueDate?.value)} className="flex-1" />
              {conf("dueDate")}
            </div>
          </Field>
          <Field label="Amount">
            <div className="flex items-center gap-2">
              <TextInput type="number" step="0.01" name="amount" defaultValue={fields.amount?.value ?? ""} className="flex-1" />
              {conf("amount")}
            </div>
          </Field>
          <Field label="VAT">
            <div className="flex items-center gap-2">
              <TextInput type="number" step="0.01" name="vat" defaultValue={fields.vat?.value ?? ""} className="flex-1" />
              {conf("vat")}
            </div>
          </Field>
          <Field label="Currency">
            <Select name="currency" options={CURRENCIES.map((c) => ({ value: c, label: c }))} defaultValue={fields.currency?.value ?? "AED"} />
          </Field>
          <Field label="Expense category">
            <Select name="expenseCategory" options={EXPENSE_CATEGORIES.map((c) => ({ value: c, label: c }))} defaultValue={fields.categorySuggestion?.value ?? undefined} placeholder="Select..." />
          </Field>
          <Field label="Payment status">
            <Select name="paymentStatus" options={RECEIVED_INVOICE_STATUSES.map((s) => ({ value: s, label: labelize(s) }))} defaultValue="RECEIVED" />
          </Field>
          <Field label="Recurring expense?">
            <label className="flex items-center gap-2 mt-2 text-sm">
              <input type="checkbox" name="recurring" /> Yes, this recurs
            </label>
          </Field>
        </FormGrid>
        <Field label="Description">
          <TextArea name="description" defaultValue={fields.description?.value ?? ""} rows={2} />
        </Field>
        <Field label="Notes">
          <TextArea name="notes" rows={2} />
        </Field>
        <div className="flex justify-end">
          <SubmitButton>Save supplier invoice</SubmitButton>
        </div>
      </form>
    </div>
  );
}
