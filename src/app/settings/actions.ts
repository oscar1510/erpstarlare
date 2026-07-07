"use server";

import { db } from "@/lib/db";
import { parseFileRef } from "@/lib/file-refs";
import { logAudit } from "@/lib/audit";
import { revalidatePath } from "next/cache";

export async function uploadCompanyLogo(formData: FormData) {
  const fileRef = parseFileRef(formData, "file");
  if (!fileRef) throw new Error("No logo uploaded");

  await db.setting.upsert({
    where: { id: "singleton" },
    update: { companyLogoUrl: fileRef.url },
    create: { id: "singleton", companyLogoUrl: fileRef.url },
  });

  await logAudit({
    action: "updated",
    section: "Settings",
    recordType: "Setting",
    recordId: "singleton",
    summary: "Updated company logo",
    performedByType: "OSCAR",
    performedByLabel: "Oscar",
  });

  revalidatePath("/settings");
  revalidatePath("/billing/documents");
}

export async function removeCompanyLogo() {
  await db.setting.upsert({
    where: { id: "singleton" },
    update: { companyLogoUrl: null },
    create: { id: "singleton", companyLogoUrl: null },
  });
  revalidatePath("/settings");
}
