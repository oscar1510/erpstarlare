export const dynamic = "force-dynamic";

import { PageHeader } from "@/components/ui/Page";
import { SubmitButton } from "@/components/SubmitButton";
import { Field, Select, TextArea } from "@/components/ui/Field";
import { DocumentUploader } from "@/components/DocumentUploader";
import { BANK_DOCUMENT_TYPES, labelize } from "@/lib/constants";
import { uploadBankDocument } from "../../actions";

export default function NewBankDocumentPage() {
  return (
    <div className="max-w-2xl">
      <PageHeader title="Upload bank document" description="IBAN letter, bank confirmation, KYC document, correspondence, etc." />
      <form action={uploadBankDocument} className="card p-5 space-y-4">
        <Field label="Document type">
          <Select name="type" options={BANK_DOCUMENT_TYPES.map((t) => ({ value: t, label: labelize(t) }))} defaultValue="OTHER" />
        </Field>
        <DocumentUploader required />
        <Field label="Notes">
          <TextArea name="notes" rows={2} />
        </Field>
        <div className="flex justify-end">
          <SubmitButton>Upload</SubmitButton>
        </div>
      </form>
    </div>
  );
}
