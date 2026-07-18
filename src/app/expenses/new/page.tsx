export const dynamic = "force-dynamic";

import { db } from "@/lib/db";
import { PageHeader, Section } from "@/components/ui/Page";
import { Field, FormGrid, Select, TextArea, TextInput } from "@/components/ui/Field";
import { ActorSelect } from "@/components/ActorSelect";
import { DocumentUploader } from "@/components/DocumentUploader";
import { SubmitButton } from "@/components/SubmitButton";
import { VatFields } from "@/components/VatFields";
import { CURRENCIES, EXPENSE_CATEGORIES, EXPENSE_STATUSES, PAYMENT_ACCOUNTS, PAYMENT_METHODS, labelize } from "@/lib/constants";
import { createExpense } from "../actions";

export default async function NewExpensePage({ searchParams }: { searchParams: Promise<{ personId?: string }> }) {
  const { personId } = await searchParams;
  const [people, clients] = await Promise.all([
    db.person.findMany({ orderBy: { firstName: "asc" } }),
    db.client.findMany({ orderBy: { name: "asc" } }),
  ]);
  const linkedPerson = personId ? people.find((p) => p.id === personId) : null;

  return (
    <div className="max-w-3xl space-y-6">
      <PageHeader title="Add expense" description="Record a cost manually. You can also attach a receipt to scan." />

      <form action={createExpense} className="card p-5 space-y-4">
        <ActorSelect
          people={people}
          namePrefix="actor"
          defaultType={linkedPerson ? "EMPLOYEE" : "OSCAR"}
          defaultLabel={linkedPerson ? `${linkedPerson.firstName} ${linkedPerson.lastName}` : "Oscar"}
          defaultPersonId={linkedPerson?.id}
          label="Who made this expense?"
        />

        <FormGrid>
          <Field label="Vendor / merchant">
            <TextInput name="vendor" />
          </Field>
          <Field label="Expense date">
            <TextInput type="date" name="expenseDate" />
          </Field>
          <Field label="Amount">
            <TextInput type="number" step="0.01" name="amount" id="expense-amount" />
          </Field>
          <Field label="Currency">
            <Select name="currency" options={CURRENCIES.map((c) => ({ value: c, label: c }))} defaultValue="AED" />
          </Field>
          <VatFields amountInputId="expense-amount" defaultIncluded />
          <div />
          <Field label="Paid from (account)">
            <Select name="account" options={PAYMENT_ACCOUNTS.map((a) => ({ value: a, label: a }))} placeholder="Select account..." />
          </Field>
          <Field label="Payment method">
            <Select name="paymentMethod" options={PAYMENT_METHODS.map((m) => ({ value: m, label: m }))} placeholder="Select..." />
          </Field>
          <Field label="Tax registration number">
            <TextInput name="taxRegNumber" />
          </Field>
          <Field label="Receipt / invoice number">
            <TextInput name="receiptNumber" />
          </Field>
          <Field label="Expense category">
            <Select name="category" options={EXPENSE_CATEGORIES.map((c) => ({ value: c, label: c }))} placeholder="Select..." />
          </Field>
          <Field label="Status">
            <Select name="status" options={EXPENSE_STATUSES.map((s) => ({ value: s, label: labelize(s) }))} defaultValue="RECORDED" />
          </Field>
          <Field label="Link to client">
            <Select name="clientId" options={clients.map((c) => ({ value: c.id, label: c.name }))} placeholder="None" />
          </Field>
          <Field label="Link to campaign">
            <TextInput name="campaignRef" placeholder="Campaign name / reference" />
          </Field>
        </FormGrid>

        <div className="border-t pt-4">
          <label className="flex items-center gap-2 text-sm font-medium mb-3">
            <input type="checkbox" name="reimbursable" /> Reimbursable
          </label>
          <FormGrid>
            <Field label="Person to reimburse">
              <Select name="reimbursePersonId" options={people.map((p) => ({ value: p.id, label: `${p.firstName} ${p.lastName}` }))} placeholder="Select..." />
            </Field>
            <Field label="Amount to reimburse">
              <TextInput type="number" step="0.01" name="reimburseAmount" />
            </Field>
          </FormGrid>
        </div>

        <Field label="Description">
          <TextArea name="description" rows={2} />
        </Field>
        <Field label="Notes">
          <TextArea name="notes" rows={2} />
        </Field>

        <Section title="Attach a receipt (optional)">
          <DocumentUploader name="file" label="Upload receipt" />
          <p className="mt-1 text-xs text-slate-400">If you attach a receipt it&apos;s stored with the expense. To auto-read a receipt instead, use Quick Expense Scanner.</p>
        </Section>

        <div className="flex justify-end">
          <SubmitButton pendingLabel="Saving…">Save expense</SubmitButton>
        </div>
      </form>
    </div>
  );
}
