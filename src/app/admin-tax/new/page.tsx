export const dynamic = "force-dynamic";

import { PageHeader } from "@/components/ui/Page";
import { SubmitButton } from "@/components/SubmitButton";
import { Field, FormGrid, Select, TextArea, TextInput } from "@/components/ui/Field";
import { DocumentUploader } from "@/components/DocumentUploader";
import { TAX_DOC_TYPES, TAX_STATUSES, labelize } from "@/lib/constants";
import { createTaxRecord } from "../actions";

export default function NewTaxRecordPage() {
  return (
    <div className="max-w-2xl">
      <PageHeader title="Add tax / administration record" description="Upload the document and OCR will try to pre-fill dates and reference numbers." />
      <form action={createTaxRecord} className="card p-5 space-y-4">
        <FormGrid>
          <Field label="Document type">
            <Select name="docType" options={TAX_DOC_TYPES.map((t) => ({ value: t, label: labelize(t) }))} defaultValue="ADGM_LICENSE" />
          </Field>
          <Field label="Status">
            <Select name="status" options={TAX_STATUSES.map((s) => ({ value: s, label: labelize(s) }))} defaultValue="PENDING" />
          </Field>
          <Field label="Tax reference number">
            <TextInput name="taxRefNumber" />
          </Field>
          <Field label="Issuing authority">
            <TextInput name="authority" placeholder="e.g. Federal Tax Authority" />
          </Field>
          <Field label="Fiscal period">
            <TextInput name="fiscalPeriod" placeholder="e.g. FY2026" />
          </Field>
          <Field label="Issue date">
            <TextInput type="date" name="issueDate" />
          </Field>
          <Field label="Submission date">
            <TextInput type="date" name="submissionDate" />
          </Field>
          <Field label="Next due date">
            <TextInput type="date" name="nextDueDate" />
          </Field>
        </FormGrid>
        <DocumentUploader />
        <Field label="Notes">
          <TextArea name="notes" rows={2} />
        </Field>
        <div className="flex justify-end">
          <SubmitButton>Save record</SubmitButton>
        </div>
      </form>
    </div>
  );
}
