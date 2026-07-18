"use server";

import { db } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { ingestDocument } from "@/lib/documents";
import { parseFileRef } from "@/lib/file-refs";
import { upsertAutoDeadline, removeAutoDeadline } from "@/lib/deadlines";
import { parseFormDate, parseFormNumber } from "@/lib/format";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

function str(fd: FormData, key: string): string | undefined {
  const v = fd.get(key);
  return typeof v === "string" && v.trim() ? v.trim() : undefined;
}

export async function uploadReceivedInvoice(formData: FormData) {
  const fileRef = parseFileRef(formData, "file");
  if (!fileRef) throw new Error("No file uploaded");

  const { document } = await ingestDocument({
    fileRef,
    documentType: "RECEIVED_INVOICE",
    category: "Supplier invoice (pending review)",
    uploadedByType: "OSCAR",
    uploadedByLabel: "Oscar",
  });

  redirect(`/received-invoices/review/${document.id}`);
}

async function syncDueDeadline(ri: { id: string; vendorName: string | null; dueDate: Date | null }, documentId?: string | null) {
  if (ri.dueDate) {
    await upsertAutoDeadline({
      sourceModule: "ReceivedInvoice",
      sourceId: ri.id,
      category: "Supplier Invoice Due",
      title: `Pay ${ri.vendorName ?? "supplier"} invoice`,
      date: ri.dueDate,
      relatedVendor: ri.vendorName ?? undefined,
      documentId: documentId ?? undefined,
    });
  } else {
    await removeAutoDeadline("ReceivedInvoice", ri.id, "Supplier Invoice Due");
  }
}

export async function confirmReceivedInvoice(documentId: string, formData: FormData) {
  const ri = await db.receivedInvoice.create({
    data: {
      vendorName: str(formData, "vendorName"),
      vendorCategory: str(formData, "vendorCategory"),
      invoiceNumber: str(formData, "invoiceNumber"),
      invoiceDate: parseFormDate(formData.get("invoiceDate")),
      dueDate: parseFormDate(formData.get("dueDate")),
      amount: parseFormNumber(formData.get("amount")),
      vat: parseFormNumber(formData.get("vat")),
      currency: str(formData, "currency") ?? "AED",
      description: str(formData, "description"),
      expenseCategory: str(formData, "expenseCategory"),
      taxRegNumber: str(formData, "taxRegNumber"),
      paymentStatus: str(formData, "paymentStatus") ?? "RECEIVED",
      recurring: formData.get("recurring") === "on",
      notes: str(formData, "notes"),
      documentId,
    },
  });

  await db.document.update({ where: { id: documentId }, data: { receivedInvoiceId: ri.id, category: "Supplier invoice" } });
  await syncDueDeadline(ri, documentId);

  await logAudit({
    action: "created",
    section: "Received Invoices",
    recordType: "ReceivedInvoice",
    recordId: ri.id,
    summary: `Recorded supplier invoice from ${ri.vendorName ?? "unknown vendor"}`,
    performedByType: "OSCAR",
    performedByLabel: "Oscar",
  });

  revalidatePath("/received-invoices");
  redirect(`/received-invoices/${ri.id}`);
}

export async function deleteReceivedInvoice(id: string) {
  const ri = await db.receivedInvoice.findUnique({ where: { id } });
  if (ri?.ledgerEntryId) await db.ledgerEntry.delete({ where: { id: ri.ledgerEntryId } }).catch(() => {});
  if (ri?.documentId) await db.document.delete({ where: { id: ri.documentId } }).catch(() => {});
  await removeAutoDeadline("ReceivedInvoice", id, "Supplier Invoice Due");
  await db.receivedInvoice.delete({ where: { id } });
  revalidatePath("/received-invoices");
  revalidatePath("/");
  redirect("/received-invoices?saved=Received+invoice+deleted");
}

export async function updateReceivedInvoiceStatus(id: string, status: string, account?: string | null) {
  const ri = await db.receivedInvoice.update({
    where: { id },
    data: { paymentStatus: status, ...(account ? { account } : {}) },
  });

  if (status === "PAID" && !ri.ledgerEntryId) {
    const ledgerEntry = await db.ledgerEntry.create({
      data: {
        // Attribute the expense to the invoice's own date (when the cost was
        // incurred), not "today" — otherwise a June invoice paid in July shows
        // up as a July expense on the dashboard.
        date: ri.invoiceDate ?? ri.dueDate ?? new Date(),
        type: "EXPENSE",
        category: ri.expenseCategory ?? "Supplier expense",
        amount: ri.amount ?? 0,
        currency: ri.currency,
        vendorName: ri.vendorName,
        account: ri.account,
        vat: ri.vat,
        sourceModule: "ReceivedInvoice",
        sourceId: ri.id,
        notes: `Supplier invoice ${ri.invoiceNumber ?? ""}`.trim(),
      },
    });
    await db.receivedInvoice.update({ where: { id }, data: { ledgerEntryId: ledgerEntry.id } });
  } else if (status === "PAID" && ri.ledgerEntryId) {
    // Repair an existing entry that may have been dated "today": realign it (and
    // the account) to the invoice date so the dashboard month is correct.
    await db.ledgerEntry
      .update({ where: { id: ri.ledgerEntryId }, data: { date: ri.invoiceDate ?? ri.dueDate ?? new Date(), account: ri.account } })
      .catch(() => {});
  }

  revalidatePath(`/received-invoices/${id}`);
  revalidatePath("/received-invoices");
}
