export const dynamic = "force-dynamic";

import { db } from "@/lib/db";
import { renderQuoteDocFullHtml } from "@/lib/quote-doc";

/**
 * Serves the branded document as a Word file. Word opens a styled HTML
 * document natively, so we hand it the same HTML the on-screen view uses with
 * a .doc filename and Word's content type — one layout, no extra dependency,
 * and the file stays fully editable in Word.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const quotation = await db.quotation.findUnique({ where: { id } });
  if (!quotation) return new Response("Not found", { status: 404 });

  const html = renderQuoteDocFullHtml(quotation);
  const label = quotation.kind === "INVOICE" ? "Invoice" : "Quotation";
  const filename = `${label}-${quotation.number}.doc`;

  return new Response(html, {
    headers: {
      "Content-Type": "application/msword",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
