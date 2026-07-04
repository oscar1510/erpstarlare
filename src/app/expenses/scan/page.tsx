export const dynamic = "force-dynamic";

import { PageHeader } from "@/components/ui/Page";
import { DocumentUploader } from "@/components/DocumentUploader";
import { uploadExpenseReceipts } from "../actions";

export default function ScanExpensePage() {
  return (
    <div className="max-w-2xl">
      <PageHeader
        title="🧾 Quick Expense Scanner"
        description="Snap a photo of any receipt, cost, or payment proof. OCR reads it automatically — you just confirm the details after."
      />
      <form action={uploadExpenseReceipts} className="card p-6 space-y-4">
        <DocumentUploader multiple required label="Upload receipt(s)" />
        <div className="flex justify-end">
          <button className="btn-primary" type="submit">
            Scan expense
          </button>
        </div>
      </form>
    </div>
  );
}
