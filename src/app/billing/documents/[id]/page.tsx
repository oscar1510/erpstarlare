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

  return (
    <div className="-m-6 min-h-screen bg-white">
      <DocumentActionBar wordHref={`/billing/documents/${id}/word`} />
      <div dangerouslySetInnerHTML={{ __html: html }} />
    </div>
  );
}
