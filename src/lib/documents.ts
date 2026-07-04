import { db } from "./db";
import { saveUploadedFile } from "./storage";
import { runOcr } from "./ocr/engine";
import {
  averageConfidence,
  extractBankStatementFields,
  extractContractFields,
  extractLeaseFields,
  extractPersonDocumentFields,
  extractReceiptFields,
  extractReceivedInvoiceFields,
  extractStripeInvoiceFields,
  extractTaxDocumentFields,
  ExtractedFields,
  serializeFields,
} from "./ocr/extractors";
import { logAudit } from "./audit";

const LOW_CONFIDENCE_THRESHOLD = 0.5;

function extractorFor(documentType: string): ((text: string) => ExtractedFields) | null {
  switch (documentType) {
    case "RECEIPT":
      return extractReceiptFields;
    case "RECEIVED_INVOICE":
      return extractReceivedInvoiceFields;
    case "STRIPE_INVOICE":
      return extractStripeInvoiceFields;
    case "BANK_STATEMENT":
      return extractBankStatementFields;
    case "HR_DOCUMENT":
      return extractPersonDocumentFields;
    case "TAX_DOCUMENT":
      return extractTaxDocumentFields;
    case "RENT_CONTRACT":
      return extractLeaseFields;
    case "RECEIVED_CONTRACT":
    case "SENT_CONTRACT":
      return extractContractFields;
    default:
      return null;
  }
}

export interface IngestOptions {
  file: File;
  documentType: string;
  category?: string;
  uploadedByType?: string;
  uploadedByLabel?: string;
  linkage?: Partial<{
    personId: string;
    clientId: string;
    invoiceId: string;
    receivedInvoiceId: string;
    bankTransactionId: string;
    bankStatementId: string;
    taxRecordId: string;
    rentRecordId: string;
    receivedContractId: string;
    sentContractId: string;
    policyId: string;
    expenseId: string;
    reimbursementId: string;
    compensationPaymentId: string;
    paymentId: string;
    ledgerEntryId: string;
  }>;
}

export interface IngestResult {
  document: Awaited<ReturnType<typeof db.document.create>>;
  fields: ExtractedFields;
  duplicateDocuments: { id: string; fileName: string; documentType: string; createdAt: Date }[];
}

export async function ingestDocument(opts: IngestOptions): Promise<IngestResult> {
  const saved = await saveUploadedFile(opts.file);

  const duplicateDocuments = await db.document.findMany({
    where: { checksum: saved.checksum },
    select: { id: true, fileName: true, documentType: true, createdAt: true },
    orderBy: { createdAt: "desc" },
    take: 5,
  });

  const ocr = await runOcr(saved.buffer, opts.file.type || "application/octet-stream");

  const extractor = extractorFor(opts.documentType);
  const fields: ExtractedFields = ocr.ok && extractor ? extractor(ocr.text) : {};
  const fieldConfidence = averageConfidence(fields);
  const overallConfidence = ocr.ok ? Math.min(ocr.confidence, fieldConfidence || ocr.confidence) : 0;

  let ocrStatus = "DONE";
  let docStatus = "ACTIVE";
  if (!ocr.ok) {
    ocrStatus = "FAILED";
    docStatus = "NEEDS_REVIEW";
  } else if (extractor && (fieldConfidence === 0 || fieldConfidence < LOW_CONFIDENCE_THRESHOLD)) {
    ocrStatus = "NEEDS_REVIEW";
    docStatus = "NEEDS_REVIEW";
  }

  const document = await db.document.create({
    data: {
      fileName: opts.file.name || "upload",
      storedPath: saved.storedPath,
      mimeType: opts.file.type || "application/octet-stream",
      fileSize: saved.fileSize,
      checksum: saved.checksum,
      documentType: opts.documentType,
      category: opts.category,
      ocrStatus,
      ocrText: ocr.text || null,
      ocrConfidence: ocr.ok ? overallConfidence : null,
      extractedFields: Object.keys(fields).length ? serializeFields(fields) : null,
      status: docStatus,
      uploadedByType: opts.uploadedByType,
      uploadedByLabel: opts.uploadedByLabel,
      ...(opts.linkage ?? {}),
    },
  });

  await logAudit({
    action: "uploaded",
    section: "Documents",
    recordType: "Document",
    recordId: document.id,
    summary: `Uploaded "${document.fileName}" (${opts.documentType})${ocr.ok ? "" : " - OCR failed, needs review"}`,
    performedByType: opts.uploadedByType,
    performedByLabel: opts.uploadedByLabel,
  });

  return { document, fields, duplicateDocuments };
}

export function fieldValue<T = any>(fields: ExtractedFields, key: string): T | null {
  return (fields[key]?.value as T) ?? null;
}
