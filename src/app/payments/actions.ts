"use server";

import { db } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { ingestDocument } from "@/lib/documents";
import { parseFormDate, parseFormNumber } from "@/lib/format";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

function str(fd: FormData, key: string): string | undefined {
  const v = fd.get(key);
  return typeof v === "string" && v.trim() ? v.trim() : undefined;
}

export async function createPayment(formData: FormData) {
  let proofDocumentId: string | undefined;
  const proofFile = formData.get("proof") as File | null;
  if (proofFile && proofFile.size > 0) {
    const { document } = await ingestDocument({
      file: proofFile,
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
