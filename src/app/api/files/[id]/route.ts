import { db } from "@/lib/db";
import { readStoredFile } from "@/lib/storage";
import { NextRequest } from "next/server";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const doc = await db.document.findUnique({ where: { id } });
  if (!doc) return new Response("Not found", { status: 404 });

  try {
    const buffer = await readStoredFile(doc.storedPath);
    return new Response(new Uint8Array(buffer), {
      headers: {
        "Content-Type": doc.mimeType,
        "Content-Disposition": `inline; filename="${doc.fileName.replace(/"/g, "")}"`,
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch {
    return new Response("File missing on disk", { status: 404 });
  }
}
