"use server";

import { db } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { ingestDocument, fieldValue } from "@/lib/documents";
import { upsertAutoDeadline } from "@/lib/deadlines";
import { parseFormDate } from "@/lib/format";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

function str(fd: FormData, key: string): string | undefined {
  const v = fd.get(key);
  return typeof v === "string" && v.trim() ? v.trim() : undefined;
}

export async function createTaxRecord(formData: FormData) {
  let documentId: string | undefined;
  let fields: Record<string, any> = {};

  const file = formData.get("file") as File | null;
  if (file && file.size > 0) {
    const result = await ingestDocument({
      file,
      documentType: "TAX_DOCUMENT",
      category: str(formData, "docType"),
      uploadedByType: "OSCAR",
      uploadedByLabel: "Oscar",
    });
    documentId = result.document.id;
    fields = result.fields;
  }

  const record = await db.taxRecord.create({
    data: {
      docType: str(formData, "docType") ?? "OTHER",
      taxRefNumber: str(formData, "taxRefNumber") ?? fieldValue<string>(fields, "taxRefNumber"),
      authority: str(formData, "authority") ?? fieldValue<string>(fields, "authority"),
      submissionDate: parseFormDate(formData.get("submissionDate")) ?? (fieldValue<string>(fields, "submissionDate") ? new Date(fieldValue<string>(fields, "submissionDate")!) : null),
      fiscalPeriod: str(formData, "fiscalPeriod") ?? fieldValue<string>(fields, "fiscalPeriod"),
      issueDate: parseFormDate(formData.get("issueDate")) ?? (fieldValue<string>(fields, "issueDate") ? new Date(fieldValue<string>(fields, "issueDate")!) : null),
      nextDueDate: parseFormDate(formData.get("nextDueDate")) ?? (fieldValue<string>(fields, "dueDate") ? new Date(fieldValue<string>(fields, "dueDate")!) : null),
      status: str(formData, "status") ?? "PENDING",
      documentId,
      notes: str(formData, "notes"),
    },
  });

  if (documentId) await db.document.update({ where: { id: documentId }, data: { taxRecordId: record.id } });

  if (record.nextDueDate) {
    await upsertAutoDeadline({
      sourceModule: "TaxRecord",
      sourceId: record.id,
      category: "Tax / License",
      title: `${record.docType.replace(/_/g, " ")} due`,
      date: record.nextDueDate,
      documentId,
    });
  }

  await logAudit({
    action: "created",
    section: "Administration & Tax",
    recordType: "TaxRecord",
    recordId: record.id,
    summary: `Added tax/admin record (${record.docType})`,
    performedByType: "OSCAR",
    performedByLabel: "Oscar",
  });

  revalidatePath("/admin-tax");
  redirect(`/admin-tax/${record.id}`);
}

export async function updateTaxRecordStatus(id: string, status: string) {
  await db.taxRecord.update({ where: { id }, data: { status } });
  revalidatePath("/admin-tax");
}
