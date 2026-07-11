export const dynamic = "force-dynamic";

import { PageHeader } from "@/components/ui/Page";
import { SubmitButton } from "@/components/SubmitButton";
import { DocumentUploader } from "@/components/DocumentUploader";
import { uploadReceivedInvoice } from "../actions";

export default function NewReceivedInvoicePage() {
  return (
    <div className="max-w-2xl">
      <PageHeader
        title="Upload supplier invoice"
        description="PDF, photo, or scan. OCR will read vendor, invoice number, dates, amount and VAT, then you'll confirm the details."
      />
      <form action={uploadReceivedInvoice} className="card p-5 space-y-4">
        <DocumentUploader required />
        <div className="flex justify-end">
          <SubmitButton>Upload & scan</SubmitButton>
        </div>
      </form>
    </div>
  );
}
