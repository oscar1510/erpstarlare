"use server";

import { db } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { upsertAutoDeadline, removeAutoDeadline } from "@/lib/deadlines";
import { ingestDocument, fieldValue, fieldDate } from "@/lib/documents";
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

/**
 * Alternative to filling the person form by hand: upload a passport or
 * Emirates ID and let OCR pre-fill the profile. Creates the person as PENDING
 * with whatever the ID yielded (name, visa/ID expiry, etc.) and drops the user
 * on the edit page to review and complete — passport/EID numbers, which the
 * Person model has no dedicated fields for, are preserved in the notes so
 * nothing extracted is lost.
 */
export async function createPersonFromDocument(formData: FormData) {
  const fileRef = parseFileRef(formData, "file");
  if (!fileRef) throw new Error("No document uploaded");

  const { document, fields } = await ingestDocument({
    fileRef,
    documentType: "HR_DOCUMENT",
    category: "Identity document",
    uploadedByType: "OSCAR",
    uploadedByLabel: "Oscar",
  });

  const fullName = fieldValue<string>(fields, "name")?.trim();
  let firstName = "New";
  let lastName = "person";
  if (fullName) {
    const parts = fullName.split(/\s+/);
    firstName = parts[0];
    lastName = parts.slice(1).join(" ");
  }

  const nationality = fieldValue<string>(fields, "nationality");
  const passport = fieldValue<string>(fields, "passportNumber");
  const emiratesId = fieldValue<string>(fields, "emiratesId");
  const noteParts = [
    nationality ? `Nationality: ${nationality}` : null,
    passport ? `Passport: ${passport}` : null,
    emiratesId ? `Emirates ID: ${emiratesId}` : null,
    "(auto-filled from uploaded ID — please review)",
  ].filter(Boolean) as string[];

  const person = await db.person.create({
    data: {
      firstName,
      lastName,
      type: "OTHER",
      status: "PENDING",
      visaPermitDate: fieldDate(fields, "visaExpiry") ?? fieldDate(fields, "expiryDate"),
      contractStart: fieldDate(fields, "contractStart"),
      contractEnd: fieldDate(fields, "contractEnd"),
      compensationAmount: fieldValue<number>(fields, "compensation") ?? undefined,
      notes: noteParts.join(" · "),
    },
  });

  await db.document.update({ where: { id: document.id }, data: { personId: person.id } });
  await syncPersonDeadlines(person);
  await logAudit({
    action: "created",
    section: "HR",
    recordType: "Person",
    recordId: person.id,
    summary: `Created ${firstName} ${lastName} from uploaded ID (needs review)`,
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
  const visaExpiry = fieldDate(fields, "visaExpiry") ?? fieldDate(fields, "expiryDate");
  if (visaExpiry) {
    const person = await db.person.findUnique({ where: { id: personId } });
    if (person && !person.visaPermitDate) {
      const updated = await db.person.update({
        where: { id: personId },
        data: { visaPermitDate: visaExpiry },
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
  const before = await db.reimbursement.findUniqueOrThrow({ where: { id } });
  const person = await db.person.findUnique({ where: { id: before.personId } });
  const name = person ? `${person.firstName} ${person.lastName}` : "person";
  const updated = await db.reimbursement.update({ where: { id }, data: { status } });

  // Marking PAID is what actually books the expense into the ledger (and
  // therefore into KPI totals). Creating it PAID up front already does this in
  // addReimbursement; doing it here covers the far more common flow of adding
  // it as SUBMITTED and flipping the status later.
  if (status === "PAID" && !before.ledgerEntryId) {
    const ledgerEntry = await db.ledgerEntry.create({
      data: {
        date: updated.expenseDate ?? new Date(),
        type: "EXPENSE",
        category: updated.category ?? "Reimbursement",
        amount: updated.amount,
        currency: updated.currency,
        personId: updated.personId,
        sourceModule: "Reimbursement",
        sourceId: updated.id,
        notes: `Reimbursement for ${name}`,
      },
    });
    await db.reimbursement.update({ where: { id }, data: { ledgerEntryId: ledgerEntry.id } });
    await removeAutoDeadline("Reimbursement", id, "Reimbursement Due");
  } else if (status !== "PAID" && before.ledgerEntryId) {
    // Reversing out of PAID must also pull the expense back out of the ledger,
    // otherwise KPI keeps counting money that's no longer considered paid.
    await db.reimbursement.update({ where: { id }, data: { ledgerEntryId: null } });
    await db.ledgerEntry.delete({ where: { id: before.ledgerEntryId } }).catch(() => {});
  }

  await logAudit({
    action: "updated",
    section: "HR",
    recordType: "Reimbursement",
    recordId: id,
    summary: `Reimbursement for ${name}: ${before.status} → ${status}`,
    performedByType: "OSCAR",
    performedByLabel: "Oscar",
  });

  revalidatePath(`/hr/${before.personId}`);
  revalidatePath("/ledger");
  revalidatePath("/");
}

export async function updateCompensationStatus(id: string, status: string) {
  const before = await db.compensationPayment.findUniqueOrThrow({ where: { id } });
  const person = await db.person.findUnique({ where: { id: before.personId } });
  const name = person ? `${person.firstName} ${person.lastName}` : "person";
  const updated = await db.compensationPayment.update({ where: { id }, data: { status } });

  if (status === "PAID" && !before.ledgerEntryId) {
    const ledgerEntry = await db.ledgerEntry.create({
      data: {
        date: updated.paymentDate ?? new Date(),
        type: "EXPENSE",
        category: "HR Compensation",
        amount: updated.amount,
        currency: updated.currency,
        personId: updated.personId,
        paymentMethod: updated.paymentMethod,
        sourceModule: "CompensationPayment",
        sourceId: updated.id,
        notes: `Compensation payment for ${name}`,
      },
    });
    await db.compensationPayment.update({ where: { id }, data: { ledgerEntryId: ledgerEntry.id } });
    await removeAutoDeadline("CompensationPayment", id, "HR Compensation Due");
  } else if (status !== "PAID" && before.ledgerEntryId) {
    await db.compensationPayment.update({ where: { id }, data: { ledgerEntryId: null } });
    await db.ledgerEntry.delete({ where: { id: before.ledgerEntryId } }).catch(() => {});
  }

  await logAudit({
    action: "updated",
    section: "HR",
    recordType: "CompensationPayment",
    recordId: id,
    summary: `Compensation for ${name}: ${before.status} → ${status}`,
    performedByType: "OSCAR",
    performedByLabel: "Oscar",
  });

  revalidatePath(`/hr/${before.personId}`);
  revalidatePath("/ledger");
  revalidatePath("/");
}
