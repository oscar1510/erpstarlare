export const dynamic = "force-dynamic";

import { PageHeader } from "@/components/ui/Page";
import { DocumentUploader } from "@/components/DocumentUploader";
import { uploadStripeInvoice } from "../../actions";

export default function UploadStripeInvoicePage() {
  return (
    <div className="max-w-2xl">
      <PageHeader
        title="Upload Stripe invoice"
        description="Upload a Stripe invoice PDF. The system will read it with OCR, then let you review and confirm before creating an official Starflare invoice with sequential numbering."
      />
      <form action={uploadStripeInvoice} className="card p-5 space-y-4">
        <DocumentUploader accept="application/pdf,image/*" required />
        <div className="flex justify-end">
          <button className="btn-primary" type="submit">
            Upload & scan
          </button>
        </div>
      </form>
    </div>
  );
}
