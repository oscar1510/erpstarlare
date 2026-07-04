export const dynamic = "force-dynamic";

import { PageHeader } from "@/components/ui/Page";
import { Field, FormGrid, Select, TextArea, TextInput } from "@/components/ui/Field";
import { DocumentUploader } from "@/components/DocumentUploader";
import { POLICY_STATUSES, labelize } from "@/lib/constants";
import { createPolicy } from "../../actions";

export default function NewPolicyPage() {
  return (
    <div className="max-w-2xl">
      <PageHeader title="Add platform policy" />
      <form action={createPolicy} className="card p-5 space-y-4">
        <FormGrid>
          <Field label="Policy name" required>
            <TextInput name="policyName" required placeholder="e.g. Creator Terms" />
          </Field>
          <Field label="Version number">
            <TextInput name="versionNumber" placeholder="e.g. 1.2" />
          </Field>
          <Field label="Approval date">
            <TextInput type="date" name="approvalDate" />
          </Field>
          <Field label="Effective date">
            <TextInput type="date" name="effectiveDate" />
          </Field>
          <Field label="Review date">
            <TextInput type="date" name="reviewDate" />
          </Field>
          <Field label="Status">
            <Select name="status" options={POLICY_STATUSES.map((s) => ({ value: s, label: labelize(s) }))} defaultValue="DRAFT" />
          </Field>
        </FormGrid>
        <DocumentUploader label="Upload policy document" />
        <Field label="Notes">
          <TextArea name="notes" rows={2} />
        </Field>
        <div className="flex justify-end">
          <button className="btn-primary" type="submit">Save policy</button>
        </div>
      </form>
    </div>
  );
}
