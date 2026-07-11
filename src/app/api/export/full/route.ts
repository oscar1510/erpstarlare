import { exportAll } from "@/lib/backup";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * Downloads a COMPLETE backup as a single ZIP: the full database as data.json
 * plus every uploaded file (receipts, PDFs, ID photos, logo) under files/. This
 * is the off-site archive to keep on your own computer / Drive — unlike the JSON
 * export, it also contains the actual file bytes, so it can rebuild everything
 * even if the Blob storage is lost.
 */
export async function GET() {
  const { default: JSZip } = await import("jszip");
  const zip = new JSZip();

  const payload = await exportAll();
  zip.file("data.json", JSON.stringify(payload, null, 2));

  const filesFolder = zip.folder("files")!;
  let fileCount = 0;
  let failed = 0;

  try {
    const { list } = await import("@vercel/blob");
    let cursor: string | undefined;
    do {
      const page = await list({ cursor, limit: 1000 });
      for (const blob of page.blobs) {
        // Don't nest previous JSON backups inside this archive.
        if (blob.pathname.startsWith("backups/")) continue;
        try {
          const res = await fetch(blob.url);
          if (!res.ok) {
            failed++;
            continue;
          }
          const buf = Buffer.from(await res.arrayBuffer());
          filesFolder.file(blob.pathname, buf);
          fileCount++;
        } catch {
          failed++;
        }
      }
      cursor = page.hasMore ? page.cursor : undefined;
    } while (cursor);
  } catch {
    // Blob not configured — the data.json alone is still a valid backup.
  }

  const readme =
    `Starflare ERP — complete backup\n` +
    `Created: ${payload.meta.createdAt}\n\n` +
    `data.json  — every record in the database (restore it from Settings → Restore).\n` +
    `files/     — ${fileCount} uploaded files (receipts, PDFs, IDs, logo)` +
    (failed ? `; ${failed} could not be downloaded` : ``) +
    `.\n`;
  zip.file("README.txt", readme);

  const body = await zip.generateAsync({ type: "nodebuffer", compression: "STORE" });
  const date = new Date().toISOString().slice(0, 10);
  return new Response(new Uint8Array(body), {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="starflare-complete-backup-${date}.zip"`,
      "Cache-Control": "no-store",
    },
  });
}
