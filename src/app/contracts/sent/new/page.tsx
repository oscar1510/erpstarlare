import { db } from "@/lib/db";
import { PageHeader } from "@/components/ui/Page";
import { Field, FormGrid, Select, TextArea, TextInput } from "@/components/ui/Field";
import { DocumentUploader } from "@/components/DocumentUploader";
import { CONTRACT_STATUSES, labelize } from "@/lib/constants";
import { createSentContract } from "../../actions";

export default async function NewSentContractPage() {
  const clients = await db.client.findMany({ orderBy: { name: "asc" } });

  return (
    <div className="max-w-2xl">
      <PageHeader title="Add sent contract" description="Contract sent by Starflare to a client, partner, or creator." />
      <form action={createSentContract} className="card p-5 space-y-4">
        <FormGrid>
          <Field label="Client (if applicable)">
            <Select name="clientId" options={clients.map((c) => ({ value: c.id, label: c.name }))} placeholder="None" />
          </Field>
          <Field label="Partner / creator name">
            <TextInput name="partnerName" />
          </Field>
          <Field label="Contract type">
            <TextInput name="contractType" placeholder="e.g. Campaign agreement" />
          </Field>
          <Field label="Package">
            <TextInput name="packageName" />
          </Field>
          <Field label="Price">
            <TextInput type="number" step="0.01" name="price" />
          </Field>
          <Field label="Duration">
            <TextInput name="duration" placeholder="e.g. 3 months" />
          </Field>
          <Field label="Payment terms">
            <TextInput name="paymentTerms" />
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
        <DocumentUploader label="Upload signed contract" />
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
