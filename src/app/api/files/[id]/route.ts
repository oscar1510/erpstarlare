import { db } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

// storedPath is a fetchable URL: a Vercel Blob public URL in production, or a
// same-origin /api/local-files/... path during local development. Redirect
// rather than proxy the bytes through a serverless function.
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const doc = await db.document.findUnique({ where: { id } });
  if (!doc) return new Response("Not found", { status: 404 });
  if (!doc.storedPath) return new Response("File missing", { status: 404 });

  const target = doc.storedPath.startsWith("http") ? doc.storedPath : new URL(doc.storedPath, req.url);
  return NextResponse.redirect(target);
}
