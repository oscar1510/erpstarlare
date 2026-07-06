export const dynamic = "force-dynamic";

import { db } from "@/lib/db";
import { renderQuoteDocx } from "@/lib/quote-docx";

/** Serves the branded document as a genuine .docx (Open XML) Word file. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const quotation = await db.quotation.findUnique({ where: { id } });
  if (!quotation) return new Response("Not found", { status: 404 });

  const buffer = await renderQuoteDocx(quotation);
  const label = quotation.kind === "INVOICE" ? "Invoice" : "Quotation";
  const filename = `${label}-${quotation.number}.docx`;

  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
