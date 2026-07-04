import { PageHeader } from "@/components/ui/Page";
import { DocumentUploader } from "@/components/DocumentUploader";
import { uploadBankStatement } from "../../actions";

export default function NewBankStatementPage() {
  return (
    <div className="max-w-2xl">
      <PageHeader
        title="Upload bank statement"
        description="PDF or scan. OCR will attempt to read the account details and transaction lines automatically — review the parsed transactions afterwards, since bank layouts vary a lot."
      />
      <form action={uploadBankStatement} className="card p-5 space-y-4">
        <DocumentUploader accept="application/pdf,image/*" required />
        <div className="flex justify-end">
          <button className="btn-primary" type="submit">Upload & parse</button>
        </div>
      </form>
    </div>
  );
}
