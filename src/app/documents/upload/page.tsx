export const dynamic = "force-dynamic";

import { db } from "@/lib/db";
import { SubmitButton } from "@/components/SubmitButton";
import { PageHeader } from "@/components/ui/Page";
import { Field, FormGrid, Select } from "@/components/ui/Field";
import { DocumentUploader } from "@/components/DocumentUploader";
import { DOCUMENT_TYPES, labelize } from "@/lib/constants";
import { uploadGenericDocument } from "../actions";

export default async function UploadDocumentPage() {
  const [clients, people] = await Promise.all([
    db.client.findMany({ orderBy: { name: "asc" } }),
    db.person.findMany({ orderBy: { firstName: "asc" } }),
  ]);

  return (
    <div className="max-w-2xl">
      <PageHeader title="Upload document" description="Anything that doesn't fit a specific module yet — it'll still be OCR'd and searchable here." />
      <form action={uploadGenericDocument} className="card p-5 space-y-4">
        <FormGrid>
          <Field label="Document type">
            <Select name="documentType" options={DOCUMENT_TYPES.map((t) => ({ value: t, label: labelize(t) }))} defaultValue="OTHER" />
          </Field>
          <Field label="Category">
            <input name="category" className="form-input" placeholder="Free text category" />
          </Field>
          <Field label="Link to client">
            <Select name="clientId" options={clients.map((c) => ({ value: c.id, label: c.name }))} placeholder="None" />
          </Field>
          <Field label="Link to person">
            <Select name="personId" options={people.map((p) => ({ value: p.id, label: `${p.firstName} ${p.lastName}` }))} placeholder="None" />
          </Field>
        </FormGrid>
        <DocumentUploader multiple required />
        <div className="flex justify-end">
          <SubmitButton>Upload & scan</SubmitButton>
        </div>
      </form>
    </div>
  );
}
