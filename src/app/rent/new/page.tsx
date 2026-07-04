export const dynamic = "force-dynamic";

import { PageHeader } from "@/components/ui/Page";
import { Field, FormGrid, TextArea, TextInput } from "@/components/ui/Field";
import { DocumentUploader } from "@/components/DocumentUploader";
import { createRentRecord } from "../actions";

export default function NewRentRecordPage() {
  return (
    <div className="max-w-2xl">
      <PageHeader title="Add lease / office record" description="Upload the lease and OCR will try to pre-fill dates, rent, deposit, and notice period." />
      <form action={createRentRecord} className="card p-5 space-y-4">
        <FormGrid>
          <Field label="Landlord / provider name">
            <TextInput name="landlordName" />
          </Field>
          <Field label="Office name">
            <TextInput name="officeName" />
          </Field>
          <Field label="Location">
            <TextInput name="location" />
          </Field>
          <Field label="Monthly rent">
            <TextInput type="number" step="0.01" name="monthlyRent" />
          </Field>
          <Field label="Deposit">
            <TextInput type="number" step="0.01" name="deposit" />
          </Field>
          <Field label="Payment schedule">
            <TextInput name="paymentSchedule" placeholder="e.g. 4 cheques/year" />
          </Field>
          <Field label="Notice period">
            <TextInput name="noticePeriod" placeholder="e.g. 60 days" />
          </Field>
          <Field label="Start date">
            <TextInput type="date" name="startDate" />
          </Field>
          <Field label="End date">
            <TextInput type="date" name="endDate" />
          </Field>
          <Field label="Renewal date">
            <TextInput type="date" name="renewalDate" />
          </Field>
        </FormGrid>
        <DocumentUploader label="Upload lease contract" />
        <Field label="Notes">
          <TextArea name="notes" rows={2} />
        </Field>
        <div className="flex justify-end">
          <button className="btn-primary" type="submit">Save lease</button>
        </div>
      </form>
    </div>
  );
}
