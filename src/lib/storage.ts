import { createHash } from "crypto";
import { mkdir, writeFile, unlink } from "fs/promises";
import { existsSync } from "fs";
import path from "path";

export interface SavedFile {
  storedPath: string; // a fetchable URL (Vercel Blob in production, /api/local-files locally)
  checksum: string;
  fileSize: number;
  buffer: Buffer;
}

function sanitizeFileName(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-180);
}

function blobConfigured() {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN);
}

// Vercel sets this in every deployed environment (production, preview, and
// `vercel dev`). Its filesystem is read-only outside /tmp, so the local-disk
// fallback below would crash there — better to fail with a clear message.
function runningOnVercel() {
  return Boolean(process.env.VERCEL);
}

const LOCAL_STORAGE_ROOT = path.join(process.cwd(), "storage", "uploads");

/**
 * Uploads to Vercel Blob storage when BLOB_READ_WRITE_TOKEN is configured
 * (production on Vercel — attach a Blob store to the project and the token
 * is injected automatically). Falls back to local disk otherwise, purely for
 * local development — that fallback does NOT persist across Vercel
 * deployments and must not be relied on in production.
 */
export async function saveUploadedFile(file: File): Promise<SavedFile> {
  const buffer = Buffer.from(await file.arrayBuffer());
  const checksum = createHash("sha256").update(buffer).digest("hex");
  const pathname = [
    String(new Date().getFullYear()),
    String(new Date().getMonth() + 1).padStart(2, "0"),
    `${checksum.slice(0, 16)}-${sanitizeFileName(file.name || "upload")}`,
  ].join("/");

  if (blobConfigured()) {
    const { put } = await import("@vercel/blob");
    const blob = await put(pathname, buffer, {
      access: "public",
      addRandomSuffix: false,
      contentType: file.type || "application/octet-stream",
    });
    return { storedPath: blob.url, checksum, fileSize: buffer.length, buffer };
  }

  if (runningOnVercel()) {
    throw new Error(
      "No Blob store connected: uploads need Vercel Blob storage in this deployment. " +
        "Go to your Vercel project's Storage tab, create a Blob store, and connect it to this project " +
        "(this injects BLOB_READ_WRITE_TOKEN automatically), then redeploy."
    );
  }

  const absoluteDir = path.join(LOCAL_STORAGE_ROOT, path.dirname(pathname));
  if (!existsSync(absoluteDir)) await mkdir(absoluteDir, { recursive: true });
  const absolutePath = path.join(LOCAL_STORAGE_ROOT, pathname);
  if (!existsSync(absolutePath)) await writeFile(absolutePath, buffer);

  return { storedPath: `/api/local-files/${pathname}`, checksum, fileSize: buffer.length, buffer };
}

export async function deleteStoredFile(storedPath: string) {
  if (blobConfigured() && storedPath.startsWith("http")) {
    const { del } = await import("@vercel/blob");
    await del(storedPath).catch(() => {});
    return;
  }
  const local = storedPath.replace(/^\/api\/local-files\//, "");
  const absolutePath = path.join(LOCAL_STORAGE_ROOT, local);
  if (existsSync(absolutePath)) await unlink(absolutePath);
}

export { LOCAL_STORAGE_ROOT };
