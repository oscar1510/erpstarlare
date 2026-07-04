import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { NextResponse } from "next/server";

/**
 * Authorizes direct-from-browser uploads to Vercel Blob. This exists because
 * Vercel serverless functions reject any request body over 4.5MB
 * (FUNCTION_PAYLOAD_TOO_LARGE, a hard platform limit — not configurable via
 * next.config's bodySizeLimit, which only governs Next.js's own limit and
 * can't raise the platform ceiling). Real receipt photos and scanned PDFs
 * routinely exceed that, so the browser uploads the bytes straight to Blob
 * storage using a short-lived client token issued here, and only the
 * resulting URL — a tiny string — ever passes through a server action.
 */
export async function POST(request: Request) {
  const body = (await request.json()) as HandleUploadBody;

  try {
    const jsonResponse = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async () => ({
        allowedContentTypes: ["image/*", "application/pdf"],
        addRandomSuffix: true,
        maximumSizeInBytes: 25 * 1024 * 1024,
      }),
      onUploadCompleted: async () => {
        // No-op: the browser already has the blob URL and passes it to the
        // relevant server action as part of the same form submission.
      },
    });

    return NextResponse.json(jsonResponse);
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 400 });
  }
}
