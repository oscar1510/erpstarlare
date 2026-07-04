"use server";

import { db } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { ingestDocument, fieldValue, fieldDate } from "@/lib/documents";
import { parseFileRef } from "@/lib/file-refs";
import { extractBankTransactionLines } from "@/lib/ocr/extractors";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

function str(fd: FormData, key: string): string | undefined {
  const v = fd.get(key);
  return typeof v === "string" && v.trim() ? v.trim() : undefined;
}

export async function uploadBankStatement(formData: FormData) {
  const fileRef = parseFileRef(formData, "file");
  if (!fileRef) throw new Error("No file uploaded");

  const { document, fields } = await ingestDocument({
    fileRef,
    documentType: "BANK_STATEMENT",
    category: "Bank statement",
    uploadedByType: "OSCAR",
    uploadedByLabel: "Oscar",
  });

  const openingBalance = fieldValue<number>(fields, "openingBalance");

  const statement = await db.bankStatement.create({
    data: {
      bankName: fieldValue<string>(fields, "bankName"),
      accountName: fieldValue<string>(fields, "accountName"),
      iban: fieldValue<string>(fields, "iban"),
      periodStart: fieldDate(fields, "periodStart"),
      periodEnd: fieldDate(fields, "periodEnd"),
      openingBalance,
      closingBalance: fieldValue<number>(fields, "closingBalance"),
      documentId: document.id,
    },
  });

  await db.document.update({ where: { id: document.id }, data: { bankStatementId: statement.id } });

  // Re-run OCR text through the transaction-line parser (text already stored on the document).
  const text = document.ocrText ?? "";
  const lines = extractBankTransactionLines(text, openingBalance);
  for (const line of lines) {
    if (!line.date) continue;
    await db.bankTransaction.create({
      data: {
        bankStatementId: statement.id,
        date: line.date,
        description: line.description,
        moneyIn: line.moneyIn,
        moneyOut: line.moneyOut,
        balanceAfter: line.balanceAfter,
        reconciliation: "UNMATCHED",
      },
    });
  }

  await logAudit({
    action: "uploaded",
    section: "Bank",
    recordType: "BankStatement",
    recordId: statement.id,
    summary: `Uploaded bank statement (${lines.length} transaction${lines.length === 1 ? "" : "s"} detected)`,
    performedByType: "OSCAR",
    performedByLabel: "Oscar",
  });

  revalidatePath("/bank");
  redirect("/bank");
}

export async function classifyBankTransaction(id: string, formData: FormData) {
  await db.bankTransaction.update({
    where: { id },
    data: {
      category: str(formData, "category"),
      reconciliation: str(formData, "reconciliation") ?? "UNMATCHED",
      notes: str(formData, "notes"),
    },
  });
  revalidatePath("/bank");
}

export async function addBankTransactionManual(formData: FormData) {
  await db.bankTransaction.create({
    data: {
      date: new Date(formData.get("date") as string),
      description: str(formData, "description"),
      moneyIn: parseFloat((formData.get("moneyIn") as string) || "0") || 0,
      moneyOut: parseFloat((formData.get("moneyOut") as string) || "0") || 0,
      category: str(formData, "category"),
      reconciliation: "UNMATCHED",
    },
  });
  revalidatePath("/bank");
}

export async function uploadBankDocument(formData: FormData) {
  const fileRef = parseFileRef(formData, "file");
  if (!fileRef) throw new Error("No file uploaded");
  const type = str(formData, "type") ?? "OTHER";

  const { document } = await ingestDocument({
    fileRef,
    documentType: "BANK_DOCUMENT",
    category: type,
    uploadedByType: "OSCAR",
    uploadedByLabel: "Oscar",
  });

  const bankDoc = await db.bankDocument.create({
    data: { type, documentId: document.id, notes: str(formData, "notes") },
  });

  await db.document.update({ where: { id: document.id }, data: { status: "ACTIVE" } });

  await logAudit({
    action: "uploaded",
    section: "Bank",
    recordType: "BankDocument",
    recordId: bankDoc.id,
    summary: `Uploaded bank document (${type})`,
    performedByType: "OSCAR",
    performedByLabel: "Oscar",
  });

  revalidatePath("/bank");
  redirect("/bank");
}
