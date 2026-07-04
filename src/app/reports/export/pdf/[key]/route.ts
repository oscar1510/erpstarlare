import { REPORTS } from "@/lib/reports";
import { renderTablePdf } from "@/lib/pdf/table";
import { NextRequest } from "next/server";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ key: string }> }) {
  const { key } = await params;
  const report = REPORTS[key];
  if (!report) return new Response("Not found", { status: 404 });

  const data = await report.fetch();
  const pdf = await renderTablePdf(data);
  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${key}.pdf"`,
    },
  });
}
