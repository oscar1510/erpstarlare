export const dynamic = "force-dynamic";

import { PageHeader } from "@/components/ui/Page";
import { Field, FormGrid, Select, TextArea, TextInput } from "@/components/ui/Field";
import { DocumentUploader } from "@/components/DocumentUploader";
import { PERSON_STATUSES, PERSON_TYPES, CURRENCIES, labelize } from "@/lib/constants";
import { createPerson, createPersonFromDocument } from "../actions";

export default function NewPersonPage() {
  return (
    <div className="max-w-3xl">
      <PageHeader title="Add person" description="Employee, freelancer, intern, contractor, or other." />

      <form action={createPersonFromDocument} className="card p-5 mb-5 border-brand-200 bg-brand-50/40">
        <h2 className="font-semibold text-slate-800">Autofill from passport / Emirates ID</h2>
        <p className="text-sm text-slate-500 mb-3">
          Upload an ID and we&apos;ll read the name and expiry dates for you, then open the profile so you can review and complete it. Or just fill the form below manually.
        </p>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="flex-1">
            <DocumentUploader name="file" label="Upload passport / ID" accept="image/*,application/pdf" required />
          </div>
          <button type="submit" className="btn-primary whitespace-nowrap">
            Scan &amp; create
          </button>
        </div>
      </form>

      <form action={createPerson} className="card p-5 space-y-4">
        <FormGrid>
          <Field label="First name" required>
            <TextInput name="firstName" required />
          </Field>
          <Field label="Last name">
            <TextInput name="lastName" />
          </Field>
          <Field label="Email">
            <TextInput type="email" name="email" />
          </Field>
          <Field label="Phone">
            <TextInput name="phone" />
          </Field>
          <Field label="Role">
            <TextInput name="role" placeholder="e.g. Account Manager" />
          </Field>
          <Field label="Type">
            <Select name="type" options={PERSON_TYPES.map((t) => ({ value: t, label: labelize(t) }))} defaultValue="FULL_TIME" />
          </Field>
          <Field label="Status">
            <Select name="status" options={PERSON_STATUSES.map((s) => ({ value: s, label: labelize(s) }))} defaultValue="ACTIVE" />
          </Field>
          <Field label="Date added">
            <TextInput type="date" name="dateAdded" disabled defaultValue={new Date().toISOString().slice(0, 10)} />
          </Field>
          <Field label="Contract start date">
            <TextInput type="date" name="contractStart" />
          </Field>
          <Field label="Contract end date">
            <TextInput type="date" name="contractEnd" />
          </Field>
          <Field label="Visa / permit date">
            <TextInput type="date" name="visaPermitDate" />
          </Field>
          <Field label="Agreed compensation">
            <div className="flex gap-2">
              <TextInput type="number" step="0.01" name="compensationAmount" className="flex-1" />
              <Select name="compensationCurrency" options={CURRENCIES.map((c) => ({ value: c, label: c }))} defaultValue="AED" className="w-24" />
            </div>
          </Field>
        </FormGrid>
        <Field label="Notes">
          <TextArea name="notes" />
        </Field>
        <div className="flex justify-end gap-2">
          <button type="submit" className="btn-primary">
            Save person
          </button>
        </div>
      </form>
    </div>
  );
}
