import { PageHeader } from "@/components/ui/Page";
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
          <button className="btn-primary" type="submit">
            Upload & scan
          </button>
        </div>
      </form>
    </div>
  );
}
