"use server";

import { db } from "@/lib/db";
import { parseFileRef } from "@/lib/file-refs";
import { trimLogoWhitespace } from "@/lib/logo";
import { logAudit } from "@/lib/audit";
import { revalidatePath } from "next/cache";

export async function uploadCompanyLogo(formData: FormData) {
  const fileRef = parseFileRef(formData, "file");
  if (!fileRef) throw new Error("No logo uploaded");

  // Fetch the just-uploaded image, crop its empty margins so it fills the
  // header, and re-store the tight version. If anything fails we fall back to
  // the original uploaded URL.
  let logoUrl = fileRef.url;
  try {
    const res = await fetch(fileRef.url);
    if (res.ok) {
      const raw = Buffer.from(await res.arrayBuffer());
      const trimmed = await trimLogoWhitespace(raw);
      const { put } = await import("@vercel/blob");
      const blob = await put(`logos/starflare-logo-${Date.now()}.png`, trimmed, { access: "public", contentType: "image/png", addRandomSuffix: false });
      logoUrl = blob.url;
    }
  } catch (err) {
    console.error("[settings] logo trim/re-upload failed, using original:", err);
  }

  await db.setting.upsert({
    where: { id: "singleton" },
    update: { companyLogoUrl: logoUrl },
    create: { id: "singleton", companyLogoUrl: logoUrl },
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
