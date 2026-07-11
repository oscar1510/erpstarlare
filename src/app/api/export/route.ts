import { exportAll } from "@/lib/backup";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Downloads a full JSON snapshot of the whole database as an attachment. */
export async function GET() {
  const payload = await exportAll();
  const date = new Date().toISOString().slice(0, 10);
  const body = JSON.stringify(payload, null, 2);
  return new Response(body, {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="starflare-backup-${date}.json"`,
      "Cache-Control": "no-store",
    },
  });
}
