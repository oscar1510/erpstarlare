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

export async function createReceivedContract(formData: FormData) {
  let documentId: string | undefined;
  let fields: Record<string, any> = {};
  const fileRef = parseFileRef(formData, "file");
  if (fileRef) {
    const result = await ingestDocument({ fileRef, documentType: "RECEIVED_CONTRACT", category: "Received contract", uploadedByType: "OSCAR", uploadedByLabel: "Oscar" });
    documentId = result.document.id;
    fields = result.fields;
  }

  const contract = await db.receivedContract.create({
    data: {
      counterpartyName: str(formData, "counterpartyName") ?? fieldValue<string>(fields, "counterpartyName"),
      contractType: str(formData, "contractType"),
      signatureDate: parseFormDate(formData.get("signatureDate")) ?? fieldDate(fields, "signatureDate"),
      startDate: parseFormDate(formData.get("startDate")) ?? fieldDate(fields, "startDate"),
      endDate: parseFormDate(formData.get("endDate")) ?? fieldDate(fields, "endDate"),
      renewalDate: parseFormDate(formData.get("renewalDate")) ?? fieldDate(fields, "renewalDate"),
      noticePeriod: str(formData, "noticePeriod") ?? fieldValue<string>(fields, "noticePeriod"),
      contractValue: parseFormNumber(formData.get("contractValue")) ?? fieldValue<number>(fields, "contractValue"),
      mainObligations: str(formData, "mainObligations"),
      status: str(formData, "status") ?? "ACTIVE",
      documentId,
      notes: str(formData, "notes"),
    },
  });

  if (documentId) await db.document.update({ where: { id: documentId }, data: { receivedContractId: contract.id } });

  if (contract.endDate) {
    await upsertAutoDeadline({
      sourceModule: "ReceivedContract",
      sourceId: contract.id,
      category: "Contract End",
      title: `Contract ends – ${contract.counterpartyName ?? "counterparty"}`,
      date: contract.endDate,
      relatedVendor: contract.counterpartyName ?? undefined,
      documentId,
    });
  }

  await logAudit({ action: "created", section: "Contracts", recordType: "ReceivedContract", recordId: contract.id, summary: `Added received contract from ${contract.counterpartyName ?? "counterparty"}`, performedByType: "OSCAR", performedByLabel: "Oscar" });

  revalidatePath("/contracts/received");
  redirect(`/contracts/received/${contract.id}`);
}

export async function createSentContract(formData: FormData) {
  let documentId: string | undefined;
  const fileRef = parseFileRef(formData, "file");
  if (fileRef) {
    const result = await ingestDocument({ fileRef, documentType: "SENT_CONTRACT", category: "Sent contract", uploadedByType: "OSCAR", uploadedByLabel: "Oscar" });
    documentId = result.document.id;
  }

  const clientId = str(formData, "clientId");

  const contract = await db.sentContract.create({
    data: {
      clientId,
      partnerName: str(formData, "partnerName"),
      contractType: str(formData, "contractType"),
      packageName: str(formData, "packageName"),
      price: parseFormNumber(formData.get("price")),
      duration: str(formData, "duration"),
      paymentTerms: str(formData, "paymentTerms"),
      signatureDate: parseFormDate(formData.get("signatureDate")),
      startDate: parseFormDate(formData.get("startDate")),
      endDate: parseFormDate(formData.get("endDate")),
      renewalDate: parseFormDate(formData.get("renewalDate")),
      documentId,
      status: str(formData, "status") ?? "ACTIVE",
      notes: str(formData, "notes"),
    },
  });

  if (documentId) await db.document.update({ where: { id: documentId }, data: { sentContractId: contract.id } });

  if (contract.endDate) {
    await upsertAutoDeadline({
      sourceModule: "SentContract",
      sourceId: contract.id,
      category: "Contract End",
      title: `Contract ends – ${contract.partnerName ?? "partner"}`,
      date: contract.endDate,
      relatedClientId: clientId,
      documentId,
    });
  }

  await logAudit({ action: "created", section: "Contracts", recordType: "SentContract", recordId: contract.id, summary: `Added sent contract to ${contract.partnerName ?? "partner"}`, performedByType: "OSCAR", performedByLabel: "Oscar" });

  revalidatePath("/contracts/sent");
  redirect(`/contracts/sent/${contract.id}`);
}

export async function createPolicy(formData: FormData) {
  let documentId: string | undefined;
  const fileRef = parseFileRef(formData, "file");
  if (fileRef) {
    const result = await ingestDocument({ fileRef, documentType: "POLICY", category: "Platform policy", uploadedByType: "OSCAR", uploadedByLabel: "Oscar" });
    documentId = result.document.id;
  }

  const policy = await db.platformPolicy.create({
    data: {
      policyName: str(formData, "policyName") ?? "Untitled policy",
      versionNumber: str(formData, "versionNumber"),
      approvalDate: parseFormDate(formData.get("approvalDate")),
      effectiveDate: parseFormDate(formData.get("effectiveDate")),
      reviewDate: parseFormDate(formData.get("reviewDate")),
      documentId,
      status: str(formData, "status") ?? "DRAFT",
      notes: str(formData, "notes"),
    },
  });

  if (documentId) await db.document.update({ where: { id: documentId }, data: { policyId: policy.id } });

  if (policy.versionNumber) {
    await db.policyVersion.create({
      data: { policyId: policy.id, versionNumber: policy.versionNumber, documentId, changeNotes: "Initial version" },
    });
  }

  if (policy.reviewDate) {
    await upsertAutoDeadline({
      sourceModule: "PlatformPolicy",
      sourceId: policy.id,
      category: "Policy Review",
      title: `Review policy – ${policy.policyName}`,
      date: policy.reviewDate,
      documentId,
    });
  }

  await logAudit({ action: "created", section: "Contracts", recordType: "PlatformPolicy", recordId: policy.id, summary: `Added platform policy ${policy.policyName}`, performedByType: "OSCAR", performedByLabel: "Oscar" });

  revalidatePath("/contracts/policies");
  redirect(`/contracts/policies/${policy.id}`);
}

export async function updateContractStatus(kind: "received" | "sent", id: string, status: string) {
  if (kind === "received") await db.receivedContract.update({ where: { id }, data: { status } });
  else await db.sentContract.update({ where: { id }, data: { status } });
  revalidatePath(`/contracts/${kind}`);
}

export async function updatePolicyStatus(id: string, status: string) {
  await db.platformPolicy.update({ where: { id }, data: { status } });
  revalidatePath("/contracts/policies");
}
