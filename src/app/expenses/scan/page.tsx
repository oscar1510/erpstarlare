export const dynamic = "force-dynamic";

import { PageHeader } from "@/components/ui/Page";
import { DocumentUploader } from "@/components/DocumentUploader";
import { SubmitButton } from "@/components/SubmitButton";
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
        <p className="text-xs text-slate-400">Reading a receipt with OCR takes a few seconds — you&apos;ll be taken to the details once it&apos;s done.</p>
        <div className="flex justify-end">
          <SubmitButton pendingLabel="Reading receipt…">Scan expense</SubmitButton>
        </div>
      </form>
    </div>
  );
}
