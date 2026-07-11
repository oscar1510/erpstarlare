import { exportAll } from "@/lib/backup";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const KEEP = 30; // keep the last 30 daily backups (each is a full snapshot)

/**
 * Daily automated backup. Vercel Cron calls this once a day (see vercel.json)
 * and, when CRON_SECRET is set, sends `Authorization: Bearer <CRON_SECRET>`.
 * We snapshot the whole database to a timestamped JSON file in Vercel Blob and
 * prune everything older than the most recent KEEP backups.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = request.headers.get("authorization");
    if (auth !== `Bearer ${secret}`) {
      return new Response("Unauthorized", { status: 401 });
    }
  }

  const { put, list, del } = await import("@vercel/blob");

  const payload = await exportAll();
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const blob = await put(`backups/starflare-backup-${stamp}.json`, JSON.stringify(payload), {
    access: "public",
    contentType: "application/json",
    addRandomSuffix: false,
  });

  // Prune old backups, keeping only the most recent KEEP.
  let pruned = 0;
  try {
    const { blobs } = await list({ prefix: "backups/" });
    const sorted = blobs.sort((a, b) => (a.uploadedAt < b.uploadedAt ? 1 : -1));
    const stale = sorted.slice(KEEP);
    if (stale.length) {
      await del(stale.map((b) => b.url));
      pruned = stale.length;
    }
  } catch (err) {
    console.error("[cron/backup] prune failed:", err);
  }

  return Response.json({
    ok: true,
    url: blob.url,
    counts: payload.meta.counts,
    total: Object.values(payload.meta.counts).reduce((s, n) => s + n, 0),
    pruned,
  });
}
