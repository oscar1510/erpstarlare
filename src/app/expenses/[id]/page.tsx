export const dynamic = "force-dynamic";

import { db } from "@/lib/db";
import { SubmitButton } from "@/components/SubmitButton";
import { notFound } from "next/navigation";
import { PageHeader, Section } from "@/components/ui/Page";
import { Field, FormGrid, Select, TextArea, TextInput } from "@/components/ui/Field";
import { ConfidenceBadge, StatusBadge } from "@/components/ui/Badge";
import { ActorSelect } from "@/components/ActorSelect";
import { formatDateInput, formatMoney } from "@/lib/format";
import { CURRENCIES, EXPENSE_CATEGORIES, EXPENSE_STATUSES, PAYMENT_ACCOUNTS, PAYMENT_METHODS, labelize } from "@/lib/constants";
import { DeleteButton } from "@/components/DeleteButton";
import { VatFields } from "@/components/VatFields";
import { updateExpense, deleteExpense } from "../actions";

export default async function ExpenseDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const expense = await db.expense.findUnique({ where: { id } });
  if (!expense) notFound();

  const [document, people, clients, duplicate] = await Promise.all([
    expense.documentId ? db.document.findUnique({ where: { id: expense.documentId } }) : null,
    db.person.findMany({ orderBy: { firstName: "asc" } }),
    db.client.findMany({ orderBy: { name: "asc" } }),
    expense.duplicateOfId ? db.expense.findUnique({ where: { id: expense.duplicateOfId } }) : null,
  ]);

  const fields: Record<string, { value: any; confidence: number }> = document?.extractedFields
    ? JSON.parse(document.extractedFields)
    : {};

  const action = updateExpense.bind(null, id);

  return (
    <div className="max-w-3xl space-y-6">
      <PageHeader
        title={expense.vendor ?? "Expense"}
        description={formatMoney(expense.amount, expense.currency)}
        actions={
          <div className="flex items-center gap-2">
            <StatusBadge status={expense.status} />
            <DeleteButton action={deleteExpense.bind(null, id)} confirm="Delete this expense? This cannot be undone." />
          </div>
        }
      />

      {expense.possibleDuplicate && (
        <div className="card p-4 bg-amber-50 border-amber-300 text-sm text-amber-900">
          ⚠️ This looks like it might be a duplicate of another expense
          {duplicate ? (
            <>
              {" "}
              — <a href={`/expenses/${duplicate.id}`} className="underline font-medium">
                {duplicate.vendor ?? "expense"} on {formatDateInput(duplicate.expenseDate)} for {formatMoney(duplicate.amount, duplicate.currency)}
              </a>
              . Check before recording it twice.
            </>
          ) : (
            "."
          )}
        </div>
      )}

      {document && (
        <Section title="Uploaded receipt">
          <a href={`/api/files/${document.id}`} target="_blank" className="btn-secondary">
            🔍 View receipt
          </a>
          {document.ocrStatus === "FAILED" && (
            <p className="text-sm text-red-600 mt-2">OCR could not read this file — please fill in the fields manually.</p>
          )}
        </Section>
      )}

      <form action={action} className="card p-5 space-y-4">
        <ActorSelect
          people={people}
          namePrefix="actor"
          defaultType={expense.actorType}
          defaultLabel={expense.actorLabel}
          defaultPersonId={expense.personId}
          label="Who made this expense?"
        />

        <FormGrid>
          <Field label="Vendor / merchant">
            <div className="flex items-center gap-2">
              <TextInput name="vendor" defaultValue={expense.vendor ?? ""} className="flex-1" />
              {fields.vendor && <ConfidenceBadge confidence={fields.vendor.confidence} />}
            </div>
          </Field>
          <Field label="Expense date">
            <div className="flex items-center gap-2">
              <TextInput type="date" name="expenseDate" defaultValue={formatDateInput(expense.expenseDate)} className="flex-1" />
              {fields.date && <ConfidenceBadge confidence={fields.date.confidence} />}
            </div>
          </Field>
          <Field label="Reference date">
            <TextInput type="date" name="referenceDate" defaultValue={formatDateInput(expense.referenceDate)} />
          </Field>
          <Field label="Amount">
            <div className="flex items-center gap-2">
              <TextInput type="number" step="0.01" name="amount" id="expense-amount" defaultValue={expense.amount ?? ""} className="flex-1" />
              {fields.amount && <ConfidenceBadge confidence={fields.amount.confidence} />}
            </div>
          </Field>
          <Field label="Currency">
            <Select name="currency" options={CURRENCIES.map((c) => ({ value: c, label: c }))} defaultValue={expense.currency} />
          </Field>
          <VatFields amountInputId="expense-amount" defaultIncluded={expense.vatIncluded} defaultVat={expense.vat} />
          <div />
          <Field label="Tax registration number">
            <TextInput name="taxRegNumber" defaultValue={expense.taxRegNumber ?? ""} />
          </Field>
          <Field label="Receipt / invoice number">
            <TextInput name="receiptNumber" defaultValue={expense.receiptNumber ?? ""} />
          </Field>
          <Field label="Payment method">
            <Select name="paymentMethod" options={PAYMENT_METHODS.map((m) => ({ value: m, label: m }))} defaultValue={expense.paymentMethod ?? ""} placeholder="Select..." />
          </Field>
          <Field label="Paid from (account)">
            <Select name="account" options={PAYMENT_ACCOUNTS.map((a) => ({ value: a, label: a }))} defaultValue={expense.account ?? ""} placeholder="Select account..." />
          </Field>
          <Field label="Expense category">
            <Select name="category" options={EXPENSE_CATEGORIES.map((c) => ({ value: c, label: c }))} defaultValue={expense.category ?? ""} placeholder="Select..." />
          </Field>
          <Field label="Status">
            <Select name="status" options={EXPENSE_STATUSES.map((s) => ({ value: s, label: labelize(s) }))} defaultValue={expense.status} />
          </Field>
          <Field label="Link to client">
            <Select name="clientId" options={clients.map((c) => ({ value: c.id, label: c.name }))} defaultValue={expense.clientId ?? ""} placeholder="None" />
          </Field>
          <Field label="Link to campaign">
            <TextInput name="campaignRef" defaultValue={expense.campaignRef ?? ""} placeholder="Campaign name / reference" />
          </Field>
        </FormGrid>

        <div className="border-t pt-4">
          <label className="flex items-center gap-2 text-sm font-medium mb-3">
            <input type="checkbox" name="reimbursable" defaultChecked={expense.reimbursable} /> Reimbursable
          </label>
          <FormGrid>
            <Field label="Person to reimburse">
              <Select name="reimbursePersonId" options={people.map((p) => ({ value: p.id, label: `${p.firstName} ${p.lastName}` }))} defaultValue={expense.reimbursePersonId ?? ""} placeholder="Select..." />
            </Field>
            <Field label="Amount to reimburse">
              <TextInput type="number" step="0.01" name="reimburseAmount" defaultValue={expense.reimburseAmount ?? ""} />
            </Field>
          </FormGrid>
        </div>

        <Field label="Description / short description">
          <TextArea name="description" defaultValue={expense.description ?? ""} rows={2} />
        </Field>
        <Field label="Notes">
          <TextArea name="notes" defaultValue={expense.notes ?? ""} rows={2} />
        </Field>

        <div className="flex justify-end">
          <SubmitButton>Save expense</SubmitButton>
        </div>
      </form>
    </div>
  );
}
