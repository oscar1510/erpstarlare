"use server";

import { db } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { nextInvoiceNumber, nextQuotationNumber } from "@/lib/numbering";
import { computeTotals } from "@/lib/quote-doc";
import { parseFormDate, parseFormNumber } from "@/lib/format";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

function str(fd: FormData, key: string): string | undefined {
  const v = fd.get(key);
  return typeof v === "string" && v.trim() ? v.trim() : undefined;
}
function int(fd: FormData, key: string): number | undefined {
  const n = parseFormNumber(fd.get(key));
  return n === null || n === undefined ? undefined : Math.round(n);
}
function bool(fd: FormData, key: string): boolean {
  return fd.get(key) === "on";
}

/**
 * Parse the optional repeated extra-line-item rows (description[], qty[], rate[])
 * into the JSON we store, dropping empty rows.
 */
function parseExtraItems(fd: FormData): string | undefined {
  const descriptions = fd.getAll("itemDescription").map((v) => String(v));
  const qtys = fd.getAll("itemQty").map((v) => String(v));
  const rates = fd.getAll("itemRate").map((v) => String(v));
  const items = descriptions
    .map((description, i) => ({
      description: description.trim(),
      qty: Number(qtys[i]) || 0,
      rate: Number(rates[i]) || 0,
    }))
    .filter((it) => it.description.length > 0);
  return items.length ? JSON.stringify(items) : undefined;
}

export async function createGeneratedDocument(formData: FormData) {
  const kind = str(formData, "kind") === "INVOICE" ? "INVOICE" : "QUOTATION";
  const docDate = parseFormDate(formData.get("docDate")) ?? new Date();
  const number = kind === "INVOICE" ? await nextInvoiceNumber(docDate) : await nextQuotationNumber(docDate);

  const clientId = str(formData, "clientId");

  const data = {
    kind,
    number,
    clientId,
    companyName: str(formData, "companyName"),
    brandName: str(formData, "brandName"),
    contactPerson: str(formData, "contactPerson"),
    clientTrn: str(formData, "clientTrn"),
    clientEmail: str(formData, "clientEmail"),
    clientPhone: str(formData, "clientPhone"),
    clientAddress: str(formData, "clientAddress"),

    packageType: str(formData, "packageType") ?? "Monthly Subscription",
    packageName: str(formData, "packageName"),
    venues: int(formData, "venues"),
    coverage: str(formData, "coverage"),
    campaigns: int(formData, "campaigns"),
    creators: int(formData, "creators"),
    creatorType: str(formData, "creatorType"),
    subjectLine: str(formData, "subjectLine"),
    includePackageList: formData.get("includePackageList") !== null ? bool(formData, "includePackageList") : true,
    // The generator always renders these checkboxes, so an empty selection is a
    // deliberate "show none" — store it as [] rather than falling back to all.
    packageAccessItems: JSON.stringify(formData.getAll("accessItem").map((v) => String(v))),

    price: parseFormNumber(formData.get("price")) ?? 0,
    currency: str(formData, "currency") ?? "AED",
    vatMode: str(formData, "vatMode") ?? "EXCLUDED",
    vatPercent: parseFormNumber(formData.get("vatPercent")) ?? 5,
    paymentMethod: str(formData, "paymentMethod"),
    paymentFrequency: str(formData, "paymentFrequency"),
    paymentTerms: str(formData, "paymentTerms"),
    extraLineItems: parseExtraItems(formData),

    initialTerm: str(formData, "initialTerm"),
    startDate: parseFormDate(formData.get("startDate")),
    autoRenewal: formData.get("autoRenewal") !== null ? bool(formData, "autoRenewal") : true,
    cancellationViaPlatform: formData.get("cancellationViaPlatform") !== null ? bool(formData, "cancellationViaPlatform") : true,

    refundPolicy: str(formData, "refundPolicy"),

    discount: str(formData, "discount"),
    exclusivity: str(formData, "exclusivity"),
    paidMediaIncluded: bool(formData, "paidMediaIncluded"),
    extraUsageRights: bool(formData, "extraUsageRights"),
    otherNotes: str(formData, "otherNotes"),
    starflareSignatory: str(formData, "starflareSignatory"),
    signatoryTitle: str(formData, "signatoryTitle"),
    clientSignatory: str(formData, "clientSignatory"),

    docDate,
    validUntil: parseFormDate(formData.get("validUntil")),
    status: "DRAFT",
  };

  const quotation = await db.quotation.create({ data });

  // An Invoice document also creates a tracked billing invoice so it counts in
  // revenue / KPI / payments. Quotations stay document-only (not revenue yet).
  if (kind === "INVOICE") {
    const totals = computeTotals(quotation);
    const invoice = await db.invoice.create({
      data: {
        number,
        clientId,
        clientNameSnapshot: quotation.contactPerson ?? quotation.companyName,
        clientCompanySnapshot: quotation.companyName,
        clientEmailSnapshot: quotation.clientEmail,
        clientAddressSnapshot: quotation.clientAddress,
        clientTRNSnapshot: quotation.clientTrn,
        invoiceDate: docDate,
        dueDate: quotation.validUntil,
        description: [quotation.packageType, quotation.subjectLine].filter(Boolean).join(" — ") || "Starflare services",
        quantity: 1,
        unitPrice: totals.subtotal,
        vat: totals.vat,
        total: totals.total,
        currency: quotation.currency,
        paymentMethod: quotation.paymentMethod,
        status: "DRAFT",
        source: "MANUAL",
      },
    });
    await db.quotation.update({ where: { id: quotation.id }, data: { invoiceId: invoice.id } });
  }

  await logAudit({
    action: "created",
    section: "Billing",
    recordType: kind === "INVOICE" ? "Invoice" : "Quotation",
    recordId: quotation.id,
    summary: `Generated ${kind === "INVOICE" ? "invoice" : "quotation"} ${number}${quotation.companyName ? ` for ${quotation.companyName}` : ""}`,
    performedByType: "OSCAR",
    performedByLabel: "Oscar",
  });

  revalidatePath("/billing");
  redirect(`/billing/documents/${quotation.id}`);
}
