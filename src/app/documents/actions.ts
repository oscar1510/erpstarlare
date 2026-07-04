"use server";

import { db } from "@/lib/db";
import { ingestDocument } from "@/lib/documents";
import { parseFileRefs } from "@/lib/file-refs";
import { logAudit } from "@/lib/audit";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

function str(fd: FormData, key: string): string | undefined {
  const v = fd.get(key);
  return typeof v === "string" && v.trim() ? v.trim() : undefined;
}

export async function uploadGenericDocument(formData: FormData) {
  const fileRefs = parseFileRefs(formData, "file");
  if (fileRefs.length === 0) throw new Error("No file uploaded");

  let lastId = "";
  for (const fileRef of fileRefs) {
    const { document } = await ingestDocument({
      fileRef,
      documentType: str(formData, "documentType") ?? "OTHER",
      category: str(formData, "category"),
      uploadedByType: "OSCAR",
      uploadedByLabel: "Oscar",
      linkage: {
        clientId: str(formData, "clientId"),
        personId: str(formData, "personId"),
      },
    });
    lastId = document.id;
  }

  revalidatePath("/documents");
  redirect(`/documents?highlight=${lastId}`);
}

export async function updateDocumentStatus(id: string, status: string) {
  const before = await db.document.findUniqueOrThrow({ where: { id } });
  await db.document.update({ where: { id }, data: { status } });
  await logAudit({
    action: "status_changed",
    section: "Documents",
    recordType: "Document",
    recordId: id,
    summary: `Document status: ${before.status} → ${status}`,
    performedByType: "OSCAR",
    performedByLabel: "Oscar",
  });
  revalidatePath("/documents");
}
