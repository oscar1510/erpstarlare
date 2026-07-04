export const dynamic = "force-dynamic";

import { PageHeader } from "@/components/ui/Page";
import { Field, FormGrid, Select, TextArea, TextInput } from "@/components/ui/Field";
import { CLIENT_STATUSES, labelize } from "@/lib/constants";
import { createClient } from "../actions";

export default function NewClientPage() {
  return (
    <div className="max-w-3xl">
      <PageHeader title="Add client" />
      <form action={createClient} className="card p-5 space-y-4">
        <FormGrid>
          <Field label="Client name" required>
            <TextInput name="name" required />
          </Field>
          <Field label="Company name">
            <TextInput name="companyName" />
          </Field>
          <Field label="Trade license number">
            <TextInput name="tradeLicenseNumber" />
          </Field>
          <Field label="TRN / VAT number">
            <TextInput name="trn" />
          </Field>
          <Field label="Main contact person">
            <TextInput name="mainContact" />
          </Field>
          <Field label="Main email">
            <TextInput type="email" name="mainEmail" />
          </Field>
          <Field label="Billing email">
            <TextInput type="email" name="billingEmail" />
          </Field>
          <Field label="Phone number">
            <TextInput name="phone" />
          </Field>
          <Field label="Website / Instagram">
            <TextInput name="website" />
          </Field>
          <Field label="Status">
            <Select name="status" options={CLIENT_STATUSES.map((s) => ({ value: s, label: labelize(s) }))} defaultValue="LEAD" />
          </Field>
        </FormGrid>
        <Field label="Address">
          <TextArea name="address" rows={2} />
        </Field>
        <Field label="Notes">
          <TextArea name="notes" />
        </Field>
        <div className="flex justify-end">
          <button type="submit" className="btn-primary">
            Save client
          </button>
        </div>
      </form>
    </div>
  );
}
