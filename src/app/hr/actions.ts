"use server";

import { db } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { upsertAutoDeadline, removeAutoDeadline } from "@/lib/deadlines";
import { ingestDocument, fieldValue } from "@/lib/documents";
import { parseFileRef } from "@/lib/file-refs";
import { parseFormDate, parseFormNumber } from "@/lib/format";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

function str(fd: FormData, key: string): string | undefined {
  const v = fd.get(key);
  return typeof v === "string" && v.trim() ? v.trim() : undefined;
}

async function syncPersonDeadlines(person: { id: string; firstName: string; lastName: string; contractEnd: Date | null; visaPermitDate: Date | null }) {
  const name = `${person.firstName} ${person.lastName}`;
  if (person.contractEnd) {
    await upsertAutoDeadline({
      sourceModule: "Person",
      sourceId: person.id,
      category: "HR Contract",
      title: `Contract end – ${name}`,
      date: person.contractEnd,
      relatedPersonId: person.id,
    });
  } else {
    await removeAutoDeadline("Person", person.id, "HR Contract");
  }

  if (person.visaPermitDate) {
    await upsertAutoDeadline({
      sourceModule: "Person",
      sourceId: person.id,
      category: "Visa / Permit",
      title: `Visa / permit expiry – ${name}`,
      date: person.visaPermitDate,
      relatedPersonId: person.id,
    });
  } else {
    await removeAutoDeadline("Person", person.id, "Visa / Permit");
  }
}

export async function createPerson(formData: FormData) {
  const person = await db.person.create({
    data: {
      firstName: str(formData, "firstName") ?? "Unnamed",
      lastName: str(formData, "lastName") ?? "",
      email: str(formData, "email"),
      phone: str(formData, "phone"),
      role: str(formData, "role"),
      type: str(formData, "type") ?? "OTHER",
      contractStart: parseFormDate(formData.get("contractStart")),
      contractEnd: parseFormDate(formData.get("contractEnd")),
      status: str(formData, "status") ?? "ACTIVE",
      visaPermitDate: parseFormDate(formData.get("visaPermitDate")),
      compensationAmount: parseFormNumber(formData.get("compensationAmount")),
      compensationCurrency: str(formData, "compensationCurrency") ?? "AED",
      notes: str(formData, "notes"),
    },
  });

  await syncPersonDeadlines(person);
  await logAudit({
    action: "created",
    section: "HR",
    recordType: "Person",
    recordId: person.id,
    summary: `Added HR profile for ${person.firstName} ${person.lastName}`,
    performedByType: "OSCAR",
    performedByLabel: "Oscar",
  });

  revalidatePath("/hr");
  redirect(`/hr/${person.id}`);
}

export async function updatePerson(id: string, formData: FormData) {
  const before = await db.person.findUniqueOrThrow({ where: { id } });
  const person = await db.person.update({
    where: { id },
    data: {
      firstName: str(formData, "firstName") ?? before.firstName,
      lastName: str(formData, "lastName") ?? before.lastName,
      email: str(formData, "email"),
      phone: str(formData, "phone"),
      role: str(formData, "role"),
      type: str(formData, "type") ?? before.type,
      contractStart: parseFormDate(formData.get("contractStart")),
      contractEnd: parseFormDate(formData.get("contractEnd")),
      endReason: str(formData, "endReason"),
      status: str(formData, "status") ?? before.status,
      visaPermitDate: parseFormDate(formData.get("visaPermitDate")),
      compensationAmount: parseFormNumber(formData.get("compensationAmount")),
      compensationCurrency: str(formData, "compensationCurrency") ?? before.compensationCurrency,
      notes: str(formData, "notes"),
    },
  });

  await syncPersonDeadlines(person);
  await logAudit({
    action: "updated",
    section: "HR",
    recordType: "Person",
    recordId: person.id,
    summary: `Updated HR profile for ${person.firstName} ${person.lastName}${before.status !== person.status ? ` (status: ${before.status} → ${person.status})` : ""}`,
    previousValue: before,
    newValue: person,
    performedByType: "OSCAR",
    performedByLabel: "Oscar",
  });

  revalidatePath(`/hr/${id}`);
  revalidatePath("/hr");
}

export async function uploadPersonDocument(personId: string, formData: FormData) {
  const fileRef = parseFileRef(formData, "file");
  if (!fileRef) return;

  const { document, fields } = await ingestDocument({
    fileRef,
    documentType: "HR_DOCUMENT",
    category: str(formData, "category") ?? "Other",
    uploadedByType: "OSCAR",
    uploadedByLabel: "Oscar",
    linkage: { personId },
  });

  // If the OCR found a visa/expiry date and the person doesn't have one yet, offer it up.
  const visaExpiry = fieldValue<string>(fields, "visaExpiry") ?? fieldValue<string>(fields, "expiryDate");
  if (visaExpiry) {
    const person = await db.person.findUnique({ where: { id: personId } });
    if (person && !person.visaPermitDate) {
      const updated = await db.person.update({
        where: { id: personId },
        data: { visaPermitDate: new Date(visaExpiry) },
      });
      await syncPersonDeadlines(updated);
    }
  }

  revalidatePath(`/hr/${personId}`);
}

export async function addCompensationPayment(personId: string, formData: FormData) {
  const person = await db.person.findUniqueOrThrow({ where: { id: personId } });
  let receiptDocumentId: string | undefined;
  let signedReceiptDocumentId: string | undefined;

  const receiptFileRef = parseFileRef(formData, "receipt");
  if (receiptFileRef) {
    const { document } = await ingestDocument({
      fileRef: receiptFileRef,
      documentType: "HR_DOCUMENT",
      category: "Payment receipt",
      uploadedByType: "OSCAR",
      uploadedByLabel: "Oscar",
      linkage: { personId },
    });
    receiptDocumentId = document.id;
  }

  const signedFileRef = parseFileRef(formData, "signedReceipt");
  if (signedFileRef) {
    const { document } = await ingestDocument({
      fileRef: signedFileRef,
      documentType: "HR_DOCUMENT",
      category: "Signed payment receipt",
      uploadedByType: "OSCAR",
      uploadedByLabel: "Oscar",
      linkage: { personId },
    });
    signedReceiptDocumentId = document.id;
  }

  const amount = parseFormNumber(formData.get("amount")) ?? 0;
  const status = str(formData, "status") ?? "DUE";

  const payment = await db.compensationPayment.create({
    data: {
      personId,
      amount,
      currency: str(formData, "currency") ?? person.compensationCurrency,
      referencePeriod: str(formData, "referencePeriod"),
      paymentDate: parseFormDate(formData.get("paymentDate")),
      paymentMethod: str(formData, "paymentMethod"),
      status,
      receiptDocumentId,
      signedReceiptDocumentId,
      notes: str(formData, "notes"),
    },
  });

  if (status === "PAID") {
    const ledgerEntry = await db.ledgerEntry.create({
      data: {
        date: payment.paymentDate ?? new Date(),
        type: "EXPENSE",
        category: "HR Compensation",
        amount,
        currency: payment.currency,
        personId,
        paymentMethod: payment.paymentMethod,
        sourceModule: "CompensationPayment",
        sourceId: payment.id,
        notes: `Compensation payment for ${person.firstName} ${person.lastName}`,
      },
    });
    await db.compensationPayment.update({ where: { id: payment.id }, data: { ledgerEntryId: ledgerEntry.id } });
  } else if (payment.paymentDate) {
    await upsertAutoDeadline({
      sourceModule: "CompensationPayment",
      sourceId: payment.id,
      category: "HR Compensation Due",
      title: `Compensation due – ${person.firstName} ${person.lastName}`,
      date: payment.paymentDate,
      relatedPersonId: personId,
    });
  }

  await logAudit({
    action: "created",
    section: "HR",
    recordType: "CompensationPayment",
    recordId: payment.id,
    summary: `Recorded compensation payment (${status}) for ${person.firstName} ${person.lastName}`,
    performedByType: "OSCAR",
    performedByLabel: "Oscar",
  });

  revalidatePath(`/hr/${personId}`);
}

export async function addReimbursement(personId: string, formData: FormData) {
  const person = await db.person.findUniqueOrThrow({ where: { id: personId } });
  let documentId: string | undefined;
  let fields: Record<string, any> = {};

  const receiptFileRef = parseFileRef(formData, "receipt");
  if (receiptFileRef) {
    const result = await ingestDocument({
      fileRef: receiptFileRef,
      documentType: "RECEIPT",
      category: "Reimbursement receipt",
      uploadedByType: "OSCAR",
      uploadedByLabel: "Oscar",
      linkage: { personId },
    });
    documentId = result.document.id;
    fields = result.fields;
  }

  const amount = parseFormNumber(formData.get("amount")) ?? fieldValue<number>(fields, "amount") ?? 0;

  const reimbursement = await db.reimbursement.create({
    data: {
      personId,
      documentId,
      amount,
      currency: str(formData, "currency") ?? "AED",
      category: str(formData, "category") ?? fieldValue<string>(fields, "categorySuggestion") ?? undefined,
      expenseDate: parseFormDate(formData.get("expenseDate")),
      status: str(formData, "status") ?? "SUBMITTED",
      notes: str(formData, "notes"),
    },
  });

  if (reimbursement.status === "PAID") {
    const ledgerEntry = await db.ledgerEntry.create({
      data: {
        date: reimbursement.expenseDate ?? new Date(),
        type: "EXPENSE",
        category: "Reimbursement",
        amount,
        currency: reimbursement.currency,
        personId,
        sourceModule: "Reimbursement",
        sourceId: reimbursement.id,
        notes: `Reimbursement for ${person.firstName} ${person.lastName}`,
      },
    });
    await db.reimbursement.update({ where: { id: reimbursement.id }, data: { ledgerEntryId: ledgerEntry.id } });
  } else {
    await upsertAutoDeadline({
      sourceModule: "Reimbursement",
      sourceId: reimbursement.id,
      category: "Reimbursement Due",
      title: `Reimbursement due – ${person.firstName} ${person.lastName}`,
      date: reimbursement.expenseDate ?? new Date(),
      relatedPersonId: personId,
    });
  }

  await logAudit({
    action: "created",
    section: "HR",
    recordType: "Reimbursement",
    recordId: reimbursement.id,
    summary: `Submitted reimbursement for ${person.firstName} ${person.lastName}`,
    performedByType: "OSCAR",
    performedByLabel: "Oscar",
  });

  revalidatePath(`/hr/${personId}`);
}

export async function updateReimbursementStatus(id: string, status: string) {
  const reimbursement = await db.reimbursement.update({ where: { id }, data: { status } });
  revalidatePath(`/hr/${reimbursement.personId}`);
}

export async function updateCompensationStatus(id: string, status: string) {
  const payment = await db.compensationPayment.update({ where: { id }, data: { status } });
  revalidatePath(`/hr/${payment.personId}`);
}
