"use server";

import { db } from "@/lib/db";
import { parseFileRef } from "@/lib/file-refs";
import { trimLogoWhitespace } from "@/lib/logo";
import { logAudit } from "@/lib/audit";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

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
  redirect("/settings?saved=Logo+updated");
}

export async function removeCompanyLogo() {
  await db.setting.upsert({
    where: { id: "singleton" },
    update: { companyLogoUrl: null },
    create: { id: "singleton", companyLogoUrl: null },
  });
  revalidatePath("/settings");
}

// ---------------------------------------------------------------------------
// Data management: wipe everything (fresh start) and restore from a backup.
// ---------------------------------------------------------------------------

/**
 * Permanently deletes every record so real data can be entered from scratch.
 * Guarded by a typed confirmation ("DELETE"). Keeps the company logo so it
 * doesn't have to be re-uploaded.
 */
export async function wipeAllData(formData: FormData) {
  const confirm = formData.get("confirm");
  if (typeof confirm !== "string" || confirm.trim().toUpperCase() !== "DELETE") {
    redirect("/settings?saved=" + encodeURIComponent("Type DELETE to confirm — nothing was deleted."));
  }

  const { wipeAll, purgeUploadedFiles } = await import("@/lib/backup");
  const deleted = await wipeAll({ keepSettings: true });
  const total = Object.values(deleted).reduce((s, n) => s + n, 0);
  // Also remove the uploaded files themselves (receipts, PDFs, ID photos),
  // keeping only the company logo and the JSON backups.
  const filesDeleted = await purgeUploadedFiles();

  await logAudit({
    action: "deleted",
    section: "Settings",
    recordType: "Database",
    recordId: "all",
    summary: `Wiped all data (${total} records, ${filesDeleted} files) for a fresh start`,
    performedByType: "OSCAR",
    performedByLabel: "Oscar",
  });

  // Everything changed — revalidate the whole app.
  revalidatePath("/", "layout");
  redirect("/settings?saved=" + encodeURIComponent(`All data deleted (${total} records, ${filesDeleted} files). You can now enter real data.`));
}

/** Restores a full snapshot produced by the "Download backup" export / daily backup. */
export async function restoreBackup(formData: FormData) {
  const fileRef = parseFileRef(formData, "file");
  if (!fileRef) redirect("/settings?saved=" + encodeURIComponent("No backup file selected."));

  const res = await fetch(fileRef!.url);
  if (!res.ok) throw new Error("Could not read the uploaded backup file.");
  const payload = await res.json();

  const { importAll } = await import("@/lib/backup");
  const inserted = await importAll(payload);
  const total = Object.values(inserted).reduce((s, n) => s + n, 0);

  await logAudit({
    action: "updated",
    section: "Settings",
    recordType: "Database",
    recordId: "all",
    summary: `Restored all data from a backup (${total} records)`,
    performedByType: "OSCAR",
    performedByLabel: "Oscar",
  });

  revalidatePath("/", "layout");
  redirect("/settings?saved=" + encodeURIComponent(`Backup restored (${total} records).`));
}
