import { PageHeader } from "@/components/ui/Page";
import { Field, FormGrid, Select, TextArea, TextInput } from "@/components/ui/Field";
import { DocumentUploader } from "@/components/DocumentUploader";
import { CONTRACT_STATUSES, labelize } from "@/lib/constants";
import { createReceivedContract } from "../../actions";

export default function NewReceivedContractPage() {
  return (
    <div className="max-w-2xl">
      <PageHeader title="Add received contract" description="Partnership, vendor, landlord, supplier, consultant, or bank agreement." />
      <form action={createReceivedContract} className="card p-5 space-y-4">
        <FormGrid>
          <Field label="Counterparty name">
            <TextInput name="counterpartyName" />
          </Field>
          <Field label="Contract type">
            <TextInput name="contractType" placeholder="e.g. Vendor agreement" />
          </Field>
          <Field label="Contract value">
            <TextInput type="number" step="0.01" name="contractValue" />
          </Field>
          <Field label="Notice period">
            <TextInput name="noticePeriod" placeholder="e.g. 30 days" />
          </Field>
          <Field label="Signature date">
            <TextInput type="date" name="signatureDate" />
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
          <Field label="Status">
            <Select name="status" options={CONTRACT_STATUSES.map((s) => ({ value: s, label: labelize(s) }))} defaultValue="ACTIVE" />
          </Field>
        </FormGrid>
        <Field label="Main obligations">
          <TextArea name="mainObligations" rows={2} />
        </Field>
        <DocumentUploader />
        <Field label="Notes">
          <TextArea name="notes" rows={2} />
        </Field>
        <div className="flex justify-end">
          <button className="btn-primary" type="submit">Save contract</button>
        </div>
      </form>
    </div>
  );
}
