import { createHash } from "crypto";
import { db } from "./db";
import { saveUploadedFile } from "./storage";
import { runOcr } from "./ocr/engine";
import { ClientFileRef } from "./file-refs";
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
  /** Preferred path: a file the browser already uploaded directly to Blob storage (see DocumentUploader). */
  fileRef?: ClientFileRef;
  /** Legacy path: a raw File, uploaded to storage here. Only safe for small files — a Server Action's
   *  request body is capped at 4.5MB on Vercel regardless of any app-level config. */
  file?: File;
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

interface ResolvedFile {
  fileName: string;
  mimeType: string;
  storedPath: string;
  fileSize: number;
  checksum: string;
  buffer: Buffer;
}

async function resolveFile(opts: IngestOptions): Promise<ResolvedFile> {
  if (opts.fileRef) {
    const { url, fileName, mimeType, size } = opts.fileRef;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Could not fetch uploaded file from storage (${res.status})`);
    const buffer = Buffer.from(await res.arrayBuffer());
    const checksum = createHash("sha256").update(buffer).digest("hex");
    return {
      fileName: fileName || "upload",
      mimeType: mimeType || "application/octet-stream",
      storedPath: url,
      fileSize: size || buffer.length,
      checksum,
      buffer,
    };
  }

  if (opts.file) {
    const saved = await saveUploadedFile(opts.file);
    return {
      fileName: opts.file.name || "upload",
      mimeType: opts.file.type || "application/octet-stream",
      storedPath: saved.storedPath,
      fileSize: saved.fileSize,
      checksum: saved.checksum,
      buffer: saved.buffer,
    };
  }

  throw new Error("ingestDocument requires either fileRef or file");
}

export async function ingestDocument(opts: IngestOptions): Promise<IngestResult> {
  const resolved = await resolveFile(opts);

  const duplicateDocuments = await db.document.findMany({
    where: { checksum: resolved.checksum },
    select: { id: true, fileName: true, documentType: true, createdAt: true },
    orderBy: { createdAt: "desc" },
    take: 5,
  });

  const ocr = await runOcr(resolved.buffer, resolved.mimeType);

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
      fileName: resolved.fileName,
      storedPath: resolved.storedPath,
      mimeType: resolved.mimeType,
      fileSize: resolved.fileSize,
      checksum: resolved.checksum,
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
