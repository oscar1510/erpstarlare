import { readFile } from "fs/promises";
import path from "path";
import { NextRequest } from "next/server";
import { LOCAL_STORAGE_ROOT } from "@/lib/storage";

// Only used when BLOB_READ_WRITE_TOKEN isn't set — local development
// convenience so uploads work without a real Vercel Blob store. Not used in
// production on Vercel (storedPath there is a Blob URL, served directly).
export async function GET(_req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const { path: segments } = await params;
  const relative = segments.join("/");
  const absolutePath = path.join(LOCAL_STORAGE_ROOT, relative);

  if (!absolutePath.startsWith(LOCAL_STORAGE_ROOT)) {
    return new Response("Invalid path", { status: 400 });
  }

  try {
    const buffer = await readFile(absolutePath);
    return new Response(new Uint8Array(buffer), {
      headers: { "Cache-Control": "private, max-age=3600" },
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
