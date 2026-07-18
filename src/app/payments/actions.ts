"use server";

import { db } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { ingestDocument, fieldValue, fieldDate } from "@/lib/documents";
import { parseFileRef } from "@/lib/file-refs";
import { parseFormDate, parseFormNumber } from "@/lib/format";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

function str(fd: FormData, key: string): string | undefined {
  const v = fd.get(key);
  return typeof v === "string" && v.trim() ? v.trim() : undefined;
}

export async function createPayment(formData: FormData) {
  let proofDocumentId: string | undefined;
  const proofFileRef = parseFileRef(formData, "proof");
  if (proofFileRef) {
    const { document } = await ingestDocument({
      fileRef: proofFileRef,
      documentType: "OTHER",
      category: "Payment proof",
      uploadedByType: "OSCAR",
      uploadedByLabel: "Oscar",
    });
    proofDocumentId = document.id;
  }

  const bankTransactionId = str(formData, "bankTransactionId");

  const payment = await db.payment.create({
    data: {
      type: str(formData, "type") ?? "INCOMING",
      amount: parseFormNumber(formData.get("amount")) ?? 0,
      currency: str(formData, "currency") ?? "AED",
      date: parseFormDate(formData.get("date")) ?? new Date(),
      method: str(formData, "method"),
      account: str(formData, "account"),
      payer: str(formData, "payer"),
      payee: str(formData, "payee"),
      invoiceId: str(formData, "invoiceId"),
      receivedInvoiceId: str(formData, "receivedInvoiceId"),
      clientId: str(formData, "clientId"),
      vendorName: str(formData, "vendorName"),
      personId: str(formData, "personId"),
      proofDocumentId,
      bankTransactionId,
      reconciliation: bankTransactionId ? "MATCHED" : (str(formData, "reconciliation") ?? "UNMATCHED"),
      notes: str(formData, "notes"),
    },
  });

  if (bankTransactionId) {
    await db.bankTransaction.update({
      where: { id: bankTransactionId },
      data: { reconciliation: "MATCHED" },
    });
  }

  await logAudit({
    action: "created",
    section: "Payments",
    recordType: "Payment",
    recordId: payment.id,
    summary: `Recorded ${payment.type.toLowerCase()} payment of ${payment.amount} ${payment.currency}`,
    performedByType: "OSCAR",
    performedByLabel: "Oscar",
  });

  revalidatePath("/payments");
  redirect("/payments");
}

export async function updatePaymentReconciliation(id: string, reconciliation: string) {
  await db.payment.update({ where: { id }, data: { reconciliation } });
  revalidatePath("/payments");
}

/** Full edit of a payment. Optionally attach/replace the proof-of-payment file. */
export async function updatePayment(id: string, formData: FormData) {
  const before = await db.payment.findUniqueOrThrow({ where: { id } });

  let proofDocumentId = before.proofDocumentId ?? undefined;
  const proofFileRef = parseFileRef(formData, "proof");
  if (proofFileRef) {
    const { document } = await ingestDocument({
      fileRef: proofFileRef,
      documentType: "RECEIPT",
      category: "Payment proof",
      uploadedByType: "OSCAR",
      uploadedByLabel: "Oscar",
    });
    proofDocumentId = document.id;
  }

  const payment = await db.payment.update({
    where: { id },
    data: {
      type: str(formData, "type") ?? before.type,
      amount: parseFormNumber(formData.get("amount")) ?? before.amount,
      currency: str(formData, "currency") ?? before.currency,
      date: parseFormDate(formData.get("date")) ?? before.date,
      method: str(formData, "method") ?? null,
      account: str(formData, "account") ?? null,
      payer: str(formData, "payer") ?? null,
      payee: str(formData, "payee") ?? null,
      invoiceId: str(formData, "invoiceId") ?? null,
      receivedInvoiceId: str(formData, "receivedInvoiceId") ?? null,
      clientId: str(formData, "clientId") ?? null,
      personId: str(formData, "personId") ?? null,
      vendorName: str(formData, "vendorName") ?? null,
      reconciliation: str(formData, "reconciliation") ?? before.reconciliation,
      proofDocumentId,
      notes: str(formData, "notes") ?? null,
    },
  });

  await logAudit({
    action: "updated",
    section: "Payments",
    recordType: "Payment",
    recordId: id,
    summary: `Edited ${payment.type.toLowerCase()} payment of ${payment.amount} ${payment.currency}`,
    performedByType: "OSCAR",
    performedByLabel: "Oscar",
  });

  revalidatePath("/payments");
  revalidatePath(`/payments/${id}`);
  if (payment.invoiceId) revalidatePath(`/billing/${payment.invoiceId}`);
  if (payment.receivedInvoiceId) revalidatePath(`/received-invoices/${payment.receivedInvoiceId}`);
  redirect("/payments?saved=Payment+updated");
}

export async function deletePayment(id: string) {
  const p = await db.payment.findUnique({ where: { id } });
  if (p?.bankTransactionId) {
    await db.bankTransaction.update({ where: { id: p.bankTransactionId }, data: { reconciliation: "UNMATCHED" } }).catch(() => {});
  }
  await db.payment.delete({ where: { id } });
  revalidatePath("/payments");
  revalidatePath("/");
  redirect("/payments?saved=Payment+deleted");
}

/**
 * Scan a payment receipt: OCR the proof, then create a draft payment with the
 * amount/date the OCR found and open it for review/linking — mirroring the
 * expense scanner, but for payments.
 */
export async function uploadPaymentReceipt(formData: FormData) {
  const proofFileRef = parseFileRef(formData, "proof");
  if (!proofFileRef) throw new Error("No receipt uploaded");

  const { document, fields } = await ingestDocument({
    fileRef: proofFileRef,
    documentType: "RECEIPT",
    category: "Payment proof",
    uploadedByType: "OSCAR",
    uploadedByLabel: "Oscar",
  });

  const payment = await db.payment.create({
    data: {
      type: str(formData, "type") ?? "OUTGOING",
      amount: fieldValue<number>(fields, "amount") ?? 0,
      currency: fieldValue<string>(fields, "currency") ?? "AED",
      date: fieldDate(fields, "date") ?? new Date(),
      payee: fieldValue<string>(fields, "vendor") ?? undefined,
      proofDocumentId: document.id,
      reconciliation: "PENDING_REVIEW",
      notes: "Auto-created from a scanned payment receipt — review and link it.",
    },
  });

  await logAudit({
    action: "created",
    section: "Payments",
    recordType: "Payment",
    recordId: payment.id,
    summary: `Scanned a payment receipt (${payment.amount} ${payment.currency})`,
    performedByType: "OSCAR",
    performedByLabel: "Oscar",
  });

  revalidatePath("/payments");
  redirect(`/payments/${payment.id}?saved=${encodeURIComponent("Receipt scanned — review the details")}`);
}
