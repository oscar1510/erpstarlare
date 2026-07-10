"use server";

import { db } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { ingestDocument, fieldValue, fieldDate } from "@/lib/documents";
import { parseFileRefs } from "@/lib/file-refs";
import { findPossibleDuplicateExpenses } from "@/lib/duplicates";
import { parseFormDate, parseFormNumber } from "@/lib/format";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

function str(fd: FormData, key: string): string | undefined {
  const v = fd.get(key);
  return typeof v === "string" && v.trim() ? v.trim() : undefined;
}

export async function uploadExpenseReceipts(formData: FormData) {
  const fileRefs = parseFileRefs(formData, "file");
  if (fileRefs.length === 0) throw new Error("No file uploaded");

  const createdIds: string[] = [];

  for (const fileRef of fileRefs) {
    const { document, fields } = await ingestDocument({
      fileRef,
      documentType: "RECEIPT",
      category: "Quick expense",
      uploadedByType: "OSCAR",
      uploadedByLabel: "Oscar",
    });

    const vendor = fieldValue<string>(fields, "vendor");
    const amount = fieldValue<number>(fields, "amount");
    const expenseDate = fieldDate(fields, "date");

    const duplicates = await findPossibleDuplicateExpenses({ vendor, amount, expenseDate });

    const lowConfidence = document.ocrStatus !== "DONE";

    const expense = await db.expense.create({
      data: {
        actorType: "OSCAR",
        actorLabel: "Oscar",
        vendor,
        expenseDate,
        amount,
        currency: fieldValue<string>(fields, "currency") ?? "AED",
        vat: fieldValue<number>(fields, "vat"),
        taxRegNumber: fieldValue<string>(fields, "taxRegNumber"),
        paymentMethod: fieldValue<string>(fields, "paymentMethod"),
        receiptNumber: fieldValue<string>(fields, "receiptNumber"),
        description: fieldValue<string>(fields, "description"),
        category: fieldValue<string>(fields, "categorySuggestion"),
        status: lowConfidence ? "NEEDS_REVIEW" : "DRAFT",
        documentId: document.id,
        possibleDuplicate: duplicates.length > 0,
        duplicateOfId: duplicates[0]?.id,
      },
    });

    await db.document.update({ where: { id: document.id }, data: { expenseId: expense.id } });
    createdIds.push(expense.id);
  }

  await logAudit({
    action: "created",
    section: "Quick Expense Scanner",
    recordType: "Expense",
    recordId: createdIds[0],
    summary: `Scanned ${fileRefs.length} expense receipt${fileRefs.length > 1 ? "s" : ""}`,
    performedByType: "OSCAR",
    performedByLabel: "Oscar",
  });

  revalidatePath("/expenses");
  const msg = encodeURIComponent(`${fileRefs.length} expense${fileRefs.length > 1 ? "s" : ""} scanned`);
  if (createdIds.length === 1) {
    redirect(`/expenses/${createdIds[0]}?saved=${msg}`);
  } else {
    redirect(`/expenses?highlight=${createdIds.join(",")}&saved=${msg}`);
  }
}

export async function updateExpense(id: string, formData: FormData) {
  const before = await db.expense.findUniqueOrThrow({ where: { id } });

  const vendor = str(formData, "vendor");
  const amount = parseFormNumber(formData.get("amount"));
  const expenseDate = parseFormDate(formData.get("expenseDate"));

  const duplicates = await findPossibleDuplicateExpenses({ vendor, amount, expenseDate, excludeId: id });

  const status = str(formData, "status") ?? before.status;

  const expense = await db.expense.update({
    where: { id },
    data: {
      actorType: str(formData, "actorType") ?? before.actorType,
      actorLabel: str(formData, "actorLabel") ?? before.actorLabel,
      personId: str(formData, "actorPersonId"),
      vendor,
      expenseDate,
      referenceDate: parseFormDate(formData.get("referenceDate")),
      amount,
      currency: str(formData, "currency") ?? before.currency,
      vat: parseFormNumber(formData.get("vat")),
      taxRegNumber: str(formData, "taxRegNumber"),
      paymentMethod: str(formData, "paymentMethod"),
      receiptNumber: str(formData, "receiptNumber"),
      description: str(formData, "description"),
      category: str(formData, "category"),
      reimbursable: formData.get("reimbursable") === "on",
      reimbursePersonId: str(formData, "reimbursePersonId"),
      reimburseAmount: parseFormNumber(formData.get("reimburseAmount")),
      status,
      notes: str(formData, "notes"),
      clientId: str(formData, "clientId"),
      campaignRef: str(formData, "campaignRef"),
      possibleDuplicate: duplicates.length > 0,
      duplicateOfId: duplicates[0]?.id,
    },
  });

  if (["RECORDED", "PAID", "REIMBURSED"].includes(status) && !expense.ledgerEntryId && expense.amount) {
    const ledgerEntry = await db.ledgerEntry.create({
      data: {
        date: expense.expenseDate ?? new Date(),
        type: "EXPENSE",
        category: expense.category ?? "Other",
        amount: expense.amount,
        currency: expense.currency,
        clientId: expense.clientId,
        vendorName: expense.vendor,
        personId: expense.personId,
        paymentMethod: expense.paymentMethod,
        vat: expense.vat,
        sourceDocumentId: expense.documentId,
        sourceModule: "Expense",
        sourceId: expense.id,
        notes: expense.description,
      },
    });
    await db.expense.update({ where: { id }, data: { ledgerEntryId: ledgerEntry.id } });
  }

  await logAudit({
    action: "updated",
    section: "Quick Expense Scanner",
    recordType: "Expense",
    recordId: id,
    summary: `Updated expense (${before.status} → ${status})`,
    previousValue: before,
    newValue: expense,
    performedByType: expense.actorType,
    performedByLabel: expense.actorLabel,
  });

  revalidatePath(`/expenses/${id}`);
  revalidatePath("/expenses");
}
