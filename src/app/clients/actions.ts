"use server";

import { db } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { parseFormDate, parseFormNumber } from "@/lib/format";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

function str(fd: FormData, key: string): string | undefined {
  const v = fd.get(key);
  return typeof v === "string" && v.trim() ? v.trim() : undefined;
}

export async function createClient(formData: FormData) {
  const client = await db.client.create({
    data: {
      name: str(formData, "name") ?? "Unnamed client",
      companyName: str(formData, "companyName"),
      tradeLicenseNumber: str(formData, "tradeLicenseNumber"),
      trn: str(formData, "trn"),
      mainContact: str(formData, "mainContact"),
      mainEmail: str(formData, "mainEmail"),
      billingEmail: str(formData, "billingEmail"),
      phone: str(formData, "phone"),
      address: str(formData, "address"),
      website: str(formData, "website"),
      status: str(formData, "status") ?? "LEAD",
      notes: str(formData, "notes"),
    },
  });

  await logAudit({
    action: "created",
    section: "Clients",
    recordType: "Client",
    recordId: client.id,
    summary: `Added client ${client.name}`,
    performedByType: "OSCAR",
    performedByLabel: "Oscar",
  });

  revalidatePath("/clients");
  redirect(`/clients/${client.id}`);
}

export async function updateClient(id: string, formData: FormData) {
  const before = await db.client.findUniqueOrThrow({ where: { id } });
  const client = await db.client.update({
    where: { id },
    data: {
      name: str(formData, "name") ?? before.name,
      companyName: str(formData, "companyName"),
      tradeLicenseNumber: str(formData, "tradeLicenseNumber"),
      trn: str(formData, "trn"),
      mainContact: str(formData, "mainContact"),
      mainEmail: str(formData, "mainEmail"),
      billingEmail: str(formData, "billingEmail"),
      phone: str(formData, "phone"),
      address: str(formData, "address"),
      website: str(formData, "website"),
      status: str(formData, "status") ?? before.status,
      notes: str(formData, "notes"),
    },
  });

  await logAudit({
    action: "updated",
    section: "Clients",
    recordType: "Client",
    recordId: client.id,
    summary: `Updated client ${client.name}`,
    previousValue: before,
    newValue: client,
    performedByType: "OSCAR",
    performedByLabel: "Oscar",
  });

  revalidatePath(`/clients/${id}`);
  revalidatePath("/clients");
}

export async function addPurchase(clientId: string, formData: FormData) {
  const purchase = await db.purchase.create({
    data: {
      clientId,
      type: str(formData, "type") ?? "OTHER",
      date: parseFormDate(formData.get("date")) ?? new Date(),
      amount: parseFormNumber(formData.get("amount")) ?? 0,
      currency: str(formData, "currency") ?? "AED",
      paymentMethod: str(formData, "paymentMethod"),
      notes: str(formData, "notes"),
    },
  });

  await logAudit({
    action: "created",
    section: "Clients",
    recordType: "Purchase",
    recordId: purchase.id,
    summary: `Recorded purchase for client`,
    performedByType: "OSCAR",
    performedByLabel: "Oscar",
  });

  revalidatePath(`/clients/${clientId}`);
}

export async function addSubscription(clientId: string, formData: FormData) {
  const sub = await db.subscription.create({
    data: {
      clientId,
      packageName: str(formData, "packageName") ?? "Package",
      startDate: parseFormDate(formData.get("startDate")) ?? new Date(),
      endDate: parseFormDate(formData.get("endDate")),
      renewalDate: parseFormDate(formData.get("renewalDate")),
      price: parseFormNumber(formData.get("price")) ?? 0,
      currency: str(formData, "currency") ?? "AED",
      status: str(formData, "status") ?? "ACTIVE",
      notes: str(formData, "notes"),
    },
  });

  if (sub.renewalDate) {
    const { upsertAutoDeadline } = await import("@/lib/deadlines");
    const client = await db.client.findUnique({ where: { id: clientId } });
    await upsertAutoDeadline({
      sourceModule: "Subscription",
      sourceId: sub.id,
      category: "Subscription Renewal",
      title: `Renewal due – ${sub.packageName} (${client?.name ?? "client"})`,
      date: sub.renewalDate,
      relatedClientId: clientId,
    });
  }

  revalidatePath(`/clients/${clientId}`);
}
