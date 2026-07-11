export const dynamic = "force-dynamic";

import { PageHeader } from "@/components/ui/Page";
import { SubmitButton } from "@/components/SubmitButton";
import { Field, FormGrid, TextArea, TextInput } from "@/components/ui/Field";
import { createManualDeadline } from "../actions";

export default function NewDeadlinePage() {
  return (
    <div className="max-w-xl">
      <PageHeader title="Add deadline" />
      <form action={createManualDeadline} className="card p-5 space-y-4">
        <FormGrid>
          <Field label="Title" required>
            <TextInput name="title" required />
          </Field>
          <Field label="Category">
            <TextInput name="category" placeholder="e.g. Other" />
          </Field>
          <Field label="Date" required>
            <TextInput type="date" name="date" required />
          </Field>
          <Field label="Related vendor / party">
            <TextInput name="relatedVendor" />
          </Field>
        </FormGrid>
        <Field label="Notes">
          <TextArea name="notes" rows={2} />
        </Field>
        <div className="flex justify-end">
          <SubmitButton>Save deadline</SubmitButton>
        </div>
      </form>
    </div>
  );
}
