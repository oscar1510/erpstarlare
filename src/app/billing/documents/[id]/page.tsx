export const dynamic = "force-dynamic";

import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { renderQuoteDocBody } from "@/lib/quote-doc";
import { resolveLogo } from "@/lib/logo";
import { DocumentActionBar } from "@/components/DocumentActionBar";

export default async function GeneratedDocumentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const quotation = await db.quotation.findUnique({ where: { id } });
  if (!quotation) notFound();

  const logo = await resolveLogo();
  const html = renderQuoteDocBody(quotation, logo?.dataUri);

  // Print CSS: `@page { margin: 0 }` removes the browser's auto header/footer
  // (the page URL and the date/time). The zoom shrinks the document to fit a
  // single A4 page automatically — no more manually setting the print scale.
  const printCss = `
    @page { size: A4; margin: 0; }
    @media print {
      html, body { background: #fff !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      .doc-body > div { zoom: 0.8; padding: 30px 34px !important; margin: 0 auto !important; }
    }
  `;

  return (
    <div className="-m-6 min-h-screen bg-white">
      <style dangerouslySetInnerHTML={{ __html: printCss }} />
      <DocumentActionBar wordHref={`/billing/documents/${id}/word`} />
      <div className="doc-body" dangerouslySetInnerHTML={{ __html: html }} />
    </div>
  );
}
