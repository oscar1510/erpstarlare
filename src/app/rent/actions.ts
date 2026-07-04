"use server";

import { db } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { ingestDocument, fieldValue, fieldDate } from "@/lib/documents";
import { parseFileRef } from "@/lib/file-refs";
import { upsertAutoDeadline } from "@/lib/deadlines";
import { parseFormDate, parseFormNumber } from "@/lib/format";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

function str(fd: FormData, key: string): string | undefined {
  const v = fd.get(key);
  return typeof v === "string" && v.trim() ? v.trim() : undefined;
}

export async function createRentRecord(formData: FormData) {
  let documentId: string | undefined;
  let fields: Record<string, any> = {};

  const fileRef = parseFileRef(formData, "file");
  if (fileRef) {
    const result = await ingestDocument({
      fileRef,
      documentType: "RENT_CONTRACT",
      category: "Lease agreement",
      uploadedByType: "OSCAR",
      uploadedByLabel: "Oscar",
    });
    documentId = result.document.id;
    fields = result.fields;
  }

  const record = await db.rentRecord.create({
    data: {
      landlordName: str(formData, "landlordName") ?? fieldValue<string>(fields, "landlordName"),
      location: str(formData, "location") ?? fieldValue<string>(fields, "location"),
      officeName: str(formData, "officeName"),
      startDate: parseFormDate(formData.get("startDate")) ?? fieldDate(fields, "startDate"),
      endDate: parseFormDate(formData.get("endDate")) ?? fieldDate(fields, "endDate"),
      monthlyRent: parseFormNumber(formData.get("monthlyRent")) ?? fieldValue<number>(fields, "rentAmount"),
      paymentSchedule: str(formData, "paymentSchedule") ?? fieldValue<string>(fields, "paymentSchedule"),
      deposit: parseFormNumber(formData.get("deposit")) ?? fieldValue<number>(fields, "deposit"),
      noticePeriod: str(formData, "noticePeriod") ?? fieldValue<string>(fields, "noticePeriod"),
      renewalDate: parseFormDate(formData.get("renewalDate")) ?? fieldDate(fields, "renewalDate"),
      contractDocumentId: documentId,
      notes: str(formData, "notes"),
    },
  });

  if (documentId) await db.document.update({ where: { id: documentId }, data: { rentRecordId: record.id } });

  if (record.endDate) {
    await upsertAutoDeadline({
      sourceModule: "RentRecord",
      sourceId: record.id,
      category: "Lease End",
      title: `Lease ends – ${record.officeName ?? record.location ?? "office"}`,
      date: record.endDate,
      documentId,
    });
  }
  if (record.renewalDate) {
    await upsertAutoDeadline({
      sourceModule: "RentRecord",
      sourceId: `${record.id}-renewal`,
      category: "Lease Renewal",
      title: `Lease renewal decision – ${record.officeName ?? record.location ?? "office"}`,
      date: record.renewalDate,
      documentId,
    });
  }

  await logAudit({
    action: "created",
    section: "Rent / Office / Lease",
    recordType: "RentRecord",
    recordId: record.id,
    summary: `Added lease record for ${record.officeName ?? record.location ?? "office"}`,
    performedByType: "OSCAR",
    performedByLabel: "Oscar",
  });

  revalidatePath("/rent");
  redirect(`/rent/${record.id}`);
}
