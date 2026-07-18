export const dynamic = "force-dynamic";

import { PageHeader } from "@/components/ui/Page";
import { Field, Select } from "@/components/ui/Field";
import { DocumentUploader } from "@/components/DocumentUploader";
import { SubmitButton } from "@/components/SubmitButton";
import { uploadPaymentReceipt } from "../actions";

export default function ScanPaymentPage() {
  return (
    <div className="max-w-2xl">
      <PageHeader
        title="🧾 Scan payment receipt"
        description="Upload a payment proof (bank transfer, card receipt, Stripe payout). OCR reads the amount and date, then you review and link it to an invoice."
      />
      <form action={uploadPaymentReceipt} className="card p-6 space-y-4">
        <Field label="Direction">
          <Select name="type" options={[{ value: "OUTGOING", label: "Outgoing (we paid)" }, { value: "INCOMING", label: "Incoming (we received)" }]} defaultValue="OUTGOING" />
        </Field>
        <DocumentUploader name="proof" required label="Upload receipt" />
        <p className="text-xs text-slate-400">After scanning you&apos;ll land on the payment where you can adjust details and link it to an invoice or received invoice.</p>
        <div className="flex justify-end">
          <SubmitButton pendingLabel="Reading receipt…">Scan receipt</SubmitButton>
        </div>
      </form>
    </div>
  );
}
