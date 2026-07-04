import { unlink } from "fs/promises";
import { existsSync } from "fs";
import path from "path";

function blobConfigured() {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN);
}

const LOCAL_STORAGE_ROOT = path.join(process.cwd(), "storage", "uploads");

export async function deleteStoredFile(storedPath: string) {
  if (blobConfigured() && storedPath.startsWith("http")) {
    const { del } = await import("@vercel/blob");
    await del(storedPath).catch((err) => {
      console.error("[storage] Failed to delete Blob file:", storedPath, err);
    });
    return;
  }
  const local = storedPath.replace(/^\/api\/local-files\//, "");
  const absolutePath = path.join(LOCAL_STORAGE_ROOT, local);
  if (existsSync(absolutePath)) await unlink(absolutePath);
}

export { LOCAL_STORAGE_ROOT };
