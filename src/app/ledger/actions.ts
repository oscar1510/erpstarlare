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

export async function createLedgerEntry(formData: FormData) {
  const entry = await db.ledgerEntry.create({
    data: {
      date: parseFormDate(formData.get("date")) ?? new Date(),
      type: str(formData, "type") ?? "ADJUSTMENT",
      category: str(formData, "category"),
      amount: parseFormNumber(formData.get("amount")) ?? 0,
      currency: str(formData, "currency") ?? "AED",
      clientId: str(formData, "clientId"),
      vendorName: str(formData, "vendorName"),
      paymentMethod: str(formData, "paymentMethod"),
      vat: parseFormNumber(formData.get("vat")),
      notes: str(formData, "notes"),
      sourceModule: "Manual",
    },
  });

  await logAudit({
    action: "created",
    section: "General Ledger",
    recordType: "LedgerEntry",
    recordId: entry.id,
    summary: `Manual ledger entry: ${entry.type} ${entry.amount} ${entry.currency}`,
    performedByType: "OSCAR",
    performedByLabel: "Oscar",
  });

  revalidatePath("/ledger");
  redirect("/ledger");
}
