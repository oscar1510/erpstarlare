export const dynamic = "force-dynamic";

import { db } from "@/lib/db";
import { notFound } from "next/navigation";
import { PageHeader, Section } from "@/components/ui/Page";
import { Field, FormGrid, Select, TextArea, TextInput } from "@/components/ui/Field";
import { StatusBadge } from "@/components/ui/Badge";
import { DocumentUploader } from "@/components/DocumentUploader";
import { DocumentList } from "@/components/DocumentList";
import { formatDate, formatDateInput, formatMoney } from "@/lib/format";
import { CURRENCIES, COMPENSATION_STATUSES, PAYMENT_METHODS, PERSON_STATUSES, PERSON_TYPES, REIMBURSEMENT_STATUSES, labelize } from "@/lib/constants";
import { DeleteButton } from "@/components/DeleteButton";
import {
  addCompensationPayment,
  addReimbursement,
  deletePerson,
  updateCompensationStatus,
  updatePerson,
  updateReimbursementStatus,
  uploadPersonDocument,
} from "../actions";

export default async function PersonDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const person = await db.person.findUnique({ where: { id } });
  if (!person) notFound();

  const [documents, compensations, reimbursements] = await Promise.all([
    db.document.findMany({ where: { personId: id }, orderBy: { createdAt: "desc" } }),
    db.compensationPayment.findMany({ where: { personId: id }, orderBy: { createdAt: "desc" } }),
    db.reimbursement.findMany({ where: { personId: id }, orderBy: { createdAt: "desc" } }),
  ]);

  const updateAction = updatePerson.bind(null, id);
  const uploadAction = uploadPersonDocument.bind(null, id);
  const compensationAction = addCompensationPayment.bind(null, id);
  const reimbursementAction = addReimbursement.bind(null, id);

  return (
    <div className="max-w-4xl space-y-8">
      <PageHeader
        title={`${person.firstName} ${person.lastName}`}
        description={person.role ?? undefined}
        actions={
          <div className="flex items-center gap-2">
            <StatusBadge status={person.status} />
            <DeleteButton action={deletePerson.bind(null, id)} confirm="Delete this person and all their HR records? This cannot be undone." />
          </div>
        }
      />

      <Section title="Profile">
        <form action={updateAction} className="card p-5 space-y-4">
          <FormGrid>
            <Field label="First name" required>
              <TextInput name="firstName" defaultValue={person.firstName} required />
            </Field>
            <Field label="Last name">
              <TextInput name="lastName" defaultValue={person.lastName} />
            </Field>
            <Field label="Email">
              <TextInput type="email" name="email" defaultValue={person.email ?? ""} />
            </Field>
            <Field label="Phone">
              <TextInput name="phone" defaultValue={person.phone ?? ""} />
            </Field>
            <Field label="Role">
              <TextInput name="role" defaultValue={person.role ?? ""} />
            </Field>
            <Field label="Type">
              <Select name="type" options={PERSON_TYPES.map((t) => ({ value: t, label: labelize(t) }))} defaultValue={person.type} />
            </Field>
            <Field label="Status">
              <Select name="status" options={PERSON_STATUSES.map((s) => ({ value: s, label: labelize(s) }))} defaultValue={person.status} />
            </Field>
            <Field label="Reason for contract end">
              <TextInput name="endReason" defaultValue={person.endReason ?? ""} />
            </Field>
            <Field label="Contract start date">
              <TextInput type="date" name="contractStart" defaultValue={formatDateInput(person.contractStart)} />
            </Field>
            <Field label="Contract end date">
              <TextInput type="date" name="contractEnd" defaultValue={formatDateInput(person.contractEnd)} />
            </Field>
            <Field label="Visa / permit date">
              <TextInput type="date" name="visaPermitDate" defaultValue={formatDateInput(person.visaPermitDate)} />
            </Field>
            <Field label="Agreed compensation">
              <div className="flex gap-2">
                <TextInput type="number" step="0.01" name="compensationAmount" defaultValue={person.compensationAmount ?? ""} className="flex-1" />
                <Select name="compensationCurrency" options={CURRENCIES.map((c) => ({ value: c, label: c }))} defaultValue={person.compensationCurrency} className="w-24" />
              </div>
            </Field>
          </FormGrid>
          <Field label="Notes">
            <TextArea name="notes" defaultValue={person.notes ?? ""} />
          </Field>
          <div className="flex justify-end">
            <button className="btn-primary" type="submit">
              Save changes
            </button>
          </div>
        </form>
      </Section>

      <Section title="Documents (passport, Emirates ID, visa, CV, contract, photo, receipts...)">
        <form action={uploadAction} className="card p-4 space-y-3 mb-4">
          <FormGrid>
            <Field label="Document category">
              <Select
                name="category"
                options={[
                  "Passport", "Emirates ID", "Visa", "CV", "Contract", "Photo",
                  "Signed payment receipt", "Manually signed document", "Other",
                ].map((c) => ({ value: c, label: c }))}
                defaultValue="Other"
              />
            </Field>
            <div />
          </FormGrid>
          <DocumentUploader />
          <div className="flex justify-end">
            <button className="btn-primary" type="submit">
              Upload & scan
            </button>
          </div>
        </form>
        <DocumentList documents={documents} />
      </Section>

      <Section title="Compensation tracker">
        <form action={compensationAction} className="card p-4 space-y-3 mb-4">
          <FormGrid>
            <Field label="Amount">
              <div className="flex gap-2">
                <TextInput type="number" step="0.01" name="amount" required className="flex-1" />
                <Select name="currency" options={CURRENCIES.map((c) => ({ value: c, label: c }))} defaultValue={person.compensationCurrency} className="w-24" />
              </div>
            </Field>
            <Field label="Reference period">
              <TextInput name="referencePeriod" placeholder="e.g. July 2026" />
            </Field>
            <Field label="Payment date">
              <TextInput type="date" name="paymentDate" />
            </Field>
            <Field label="Payment method">
              <Select name="paymentMethod" options={PAYMENT_METHODS.map((m) => ({ value: m, label: m }))} placeholder="Select..." />
            </Field>
            <Field label="Status">
              <Select name="status" options={COMPENSATION_STATUSES.map((s) => ({ value: s, label: labelize(s) }))} defaultValue="DUE" />
            </Field>
          </FormGrid>
          <FormGrid>
            <Field label="Payment receipt">
              <DocumentUploader name="receipt" label="Upload receipt" />
            </Field>
            <Field label="Manually signed receipt">
              <DocumentUploader name="signedReceipt" label="Upload signed receipt" />
            </Field>
          </FormGrid>
          <Field label="Notes">
            <TextArea name="notes" />
          </Field>
          <div className="flex justify-end">
            <button className="btn-primary" type="submit">
              Add payment
            </button>
          </div>
        </form>

        <div className="card divide-y divide-slate-100">
          {compensations.length === 0 && <p className="p-4 text-sm text-slate-500">No compensation payments recorded yet.</p>}
          {compensations.map((c) => (
            <div key={c.id} className="p-3 flex flex-wrap items-center justify-between gap-2">
              <div>
                <div className="font-medium">{formatMoney(c.amount, c.currency)} {c.referencePeriod ? `· ${c.referencePeriod}` : ""}</div>
                <div className="text-xs text-slate-500">{formatDate(c.paymentDate)} {c.paymentMethod ? `· ${c.paymentMethod}` : ""}</div>
              </div>
              <form action={async (fd: FormData) => {
                "use server";
                await updateCompensationStatus(c.id, fd.get("status") as string);
              }} className="flex items-center gap-2">
                <Select name="status" options={COMPENSATION_STATUSES.map((s) => ({ value: s, label: labelize(s) }))} defaultValue={c.status} className="!py-1 !text-xs" />
                <button className="btn-ghost !py-1 !text-xs" type="submit">Update</button>
              </form>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Expense reimbursements">
        <form action={reimbursementAction} className="card p-4 space-y-3 mb-4">
          <FormGrid>
            <Field label="Amount">
              <TextInput type="number" step="0.01" name="amount" />
              <p className="text-xs text-slate-400 mt-1">Leave blank to use the OCR-detected amount from the receipt.</p>
            </Field>
            <Field label="Currency">
              <Select name="currency" options={CURRENCIES.map((c) => ({ value: c, label: c }))} defaultValue="AED" />
            </Field>
            <Field label="Category">
              <TextInput name="category" placeholder="e.g. Travel" />
            </Field>
            <Field label="Expense date">
              <TextInput type="date" name="expenseDate" />
            </Field>
            <Field label="Status">
              <Select name="status" options={REIMBURSEMENT_STATUSES.map((s) => ({ value: s, label: labelize(s) }))} defaultValue="SUBMITTED" />
            </Field>
          </FormGrid>
          <Field label="Receipt (OCR will read it automatically)">
            <DocumentUploader name="receipt" label="Upload receipt" />
          </Field>
          <Field label="Notes">
            <TextArea name="notes" />
          </Field>
          <div className="flex justify-end">
            <button className="btn-primary" type="submit">
              Submit reimbursement
            </button>
          </div>
        </form>

        <div className="card divide-y divide-slate-100">
          {reimbursements.length === 0 && <p className="p-4 text-sm text-slate-500">No reimbursements yet.</p>}
          {reimbursements.map((r) => (
            <div key={r.id} className="p-3 flex flex-wrap items-center justify-between gap-2">
              <div>
                <div className="font-medium">{formatMoney(r.amount, r.currency)} {r.category ? `· ${r.category}` : ""}</div>
                <div className="text-xs text-slate-500">{formatDate(r.expenseDate)}</div>
              </div>
              <form action={async (fd: FormData) => {
                "use server";
                await updateReimbursementStatus(r.id, fd.get("status") as string);
              }} className="flex items-center gap-2">
                <Select name="status" options={REIMBURSEMENT_STATUSES.map((s) => ({ value: s, label: labelize(s) }))} defaultValue={r.status} className="!py-1 !text-xs" />
                <button className="btn-ghost !py-1 !text-xs" type="submit">Update</button>
              </form>
            </div>
          ))}
        </div>
      </Section>
    </div>
  );
}
