import { createHash } from "crypto";
import { mkdir, writeFile, readFile, unlink } from "fs/promises";
import path from "path";
import { existsSync } from "fs";

export const STORAGE_ROOT = path.join(process.cwd(), "storage", "uploads");

export interface SavedFile {
  storedPath: string; // relative path from STORAGE_ROOT, stored in DB
  absolutePath: string;
  checksum: string;
  fileSize: number;
}

function sanitizeFileName(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-180);
}

export async function saveUploadedFile(file: File): Promise<SavedFile> {
  const buffer = Buffer.from(await file.arrayBuffer());
  const checksum = createHash("sha256").update(buffer).digest("hex");

  const now = new Date();
  const subDir = path.join(
    String(now.getFullYear()),
    String(now.getMonth() + 1).padStart(2, "0")
  );
  const dir = path.join(STORAGE_ROOT, subDir);
  if (!existsSync(dir)) {
    await mkdir(dir, { recursive: true });
  }

  const safeName = sanitizeFileName(file.name || "upload");
  const uniqueName = `${checksum.slice(0, 12)}-${safeName}`;
  const absolutePath = path.join(dir, uniqueName);
  const storedPath = path.join(subDir, uniqueName);

  if (!existsSync(absolutePath)) {
    await writeFile(absolutePath, buffer);
  }

  return { storedPath, absolutePath, checksum, fileSize: buffer.length };
}

export function absolutePathFor(storedPath: string) {
  return path.join(STORAGE_ROOT, storedPath);
}

export async function readStoredFile(storedPath: string) {
  return readFile(absolutePathFor(storedPath));
}

export async function deleteStoredFile(storedPath: string) {
  const p = absolutePathFor(storedPath);
  if (existsSync(p)) {
    await unlink(p);
  }
}
