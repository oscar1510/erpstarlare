"use server";

import { db } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { nextInvoiceNumber } from "@/lib/numbering";
import { ingestDocument, fieldValue } from "@/lib/documents";
import { parseFileRef } from "@/lib/file-refs";
import { sendMail } from "@/lib/mail";
import { renderInvoicePdf } from "@/lib/pdf/invoice";
import { parseFormDate, parseFormNumber } from "@/lib/format";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

function str(fd: FormData, key: string): string | undefined {
  const v = fd.get(key);
  return typeof v === "string" && v.trim() ? v.trim() : undefined;
}

export async function createInvoice(formData: FormData) {
  const clientId = str(formData, "clientId");
  const client = clientId ? await db.client.findUnique({ where: { id: clientId } }) : null;

  const quantity = parseFormNumber(formData.get("quantity")) ?? 1;
  const unitPrice = parseFormNumber(formData.get("unitPrice")) ?? 0;
  const vat = parseFormNumber(formData.get("vat")) ?? 0;
  const total = quantity * unitPrice + vat;
  const invoiceDate = parseFormDate(formData.get("invoiceDate")) ?? new Date();

  const invoice = await db.invoice.create({
    data: {
      number: await nextInvoiceNumber(invoiceDate),
      clientId,
      clientNameSnapshot: client?.name ?? str(formData, "clientNameSnapshot"),
      clientCompanySnapshot: client?.companyName ?? str(formData, "clientCompanySnapshot"),
      clientEmailSnapshot: client?.billingEmail ?? client?.mainEmail ?? str(formData, "clientEmailSnapshot"),
      clientAddressSnapshot: client?.address ?? str(formData, "clientAddressSnapshot"),
      clientTRNSnapshot: client?.trn ?? str(formData, "clientTRNSnapshot"),
      invoiceDate,
      dueDate: parseFormDate(formData.get("dueDate")),
      description: str(formData, "description"),
      quantity,
      unitPrice,
      vat,
      total,
      currency: str(formData, "currency") ?? "AED",
      paymentMethod: str(formData, "paymentMethod"),
      status: str(formData, "status") ?? "DRAFT",
      notes: str(formData, "notes"),
      source: "MANUAL",
    },
  });

  if (invoice.dueDate) {
    const { upsertAutoDeadline } = await import("@/lib/deadlines");
    await upsertAutoDeadline({
      sourceModule: "Invoice",
      sourceId: invoice.id,
      category: "Invoice Due",
      title: `Invoice ${invoice.number} due`,
      date: invoice.dueDate,
      relatedClientId: clientId ?? undefined,
      documentId: undefined,
    });
  }

  await logAudit({
    action: "created",
    section: "Billing",
    recordType: "Invoice",
    recordId: invoice.id,
    summary: `Created invoice ${invoice.number}`,
    performedByType: "OSCAR",
    performedByLabel: "Oscar",
  });

  revalidatePath("/billing");
  redirect(`/billing/${invoice.id}`);
}

export async function updateInvoiceStatus(id: string, status: string, paidDateInput?: Date | null, account?: string | null) {
  const before = await db.invoice.findUniqueOrThrow({ where: { id } });

  // When an invoice becomes PAID, record when it was actually paid so revenue
  // is attributed to that month — not the (possibly much later) issue date. Use
  // the date the user supplied, else keep any existing paid date, else today.
  const data: { status: string; paidDate?: Date | null; account?: string | null } = { status };
  if (status === "PAID") {
    // Default the paid date to the invoice's own date — NOT "today" — so an
    // invoice dated in January that you simply mark paid counts in January, not
    // in the current month. Only an explicit paid date overrides this.
    data.paidDate = paidDateInput ?? before.paidDate ?? before.invoiceDate;
  }
  if (account) data.account = account;
  const invoice = await db.invoice.update({ where: { id }, data });

  // Marking an invoice paid must also record the money as received, otherwise
  // "Cash in" (from Payment records) lags "Revenue" (from invoices). Create a
  // matching incoming payment once, if none exists yet for this invoice.
  if (status === "PAID") {
    const existingPayment = await db.payment.findFirst({ where: { invoiceId: id } });
    if (!existingPayment) {
      await db.payment.create({
        data: {
          type: "INCOMING",
          amount: invoice.total,
          currency: invoice.currency,
          date: invoice.paidDate ?? new Date(),
          method: invoice.paymentMethod,
          account: invoice.account,
          payer: invoice.clientNameSnapshot,
          payee: "Starflare",
          invoiceId: id,
          clientId: invoice.clientId,
          reconciliation: "PENDING_REVIEW",
          notes: `Payment for invoice ${invoice.number}`,
        },
      });
    }
  }

  if (status === "PAID" && !invoice.ledgerEntryId) {
    const ledgerEntry = await db.ledgerEntry.create({
      data: {
        date: invoice.paidDate ?? new Date(),
        type: "INCOME",
        account: invoice.account,
        category: "Client Revenue",
        amount: invoice.total,
        currency: invoice.currency,
        clientId: invoice.clientId,
        paymentMethod: invoice.paymentMethod,
        vat: invoice.vat,
        invoiceId: invoice.id,
        sourceModule: "Invoice",
        sourceId: invoice.id,
        notes: `Invoice ${invoice.number}`,
      },
    });
    await db.invoice.update({ where: { id }, data: { ledgerEntryId: ledgerEntry.id } });
  }

  await logAudit({
    action: "status_changed",
    section: "Billing",
    recordType: "Invoice",
    recordId: id,
    summary: `Invoice ${invoice.number} status: ${before.status} → ${status}`,
    previousValue: { status: before.status },
    newValue: { status },
    performedByType: "OSCAR",
    performedByLabel: "Oscar",
  });

  revalidatePath(`/billing/${id}`);
  revalidatePath("/billing");
}

/**
 * Edit an invoice's core details — including its number and dates — and keep the
 * linked ledger entry, payment and branded document in sync. Editing the paid
 * date here is what moves an invoice into the correct month on the dashboard.
 */
export async function updateInvoiceDetails(id: string, formData: FormData) {
  const before = await db.invoice.findUniqueOrThrow({ where: { id } });

  const number = str(formData, "number") ?? before.number;
  // Numbers are unique — block a change that collides with another invoice.
  if (number !== before.number) {
    const clash = await db.invoice.findFirst({ where: { number, id: { not: id } } });
    if (clash) {
      redirect(`/billing/${id}?saved=${encodeURIComponent(`Invoice number ${number} is already used`)}`);
    }
  }

  const quantity = parseFormNumber(formData.get("quantity")) ?? 1;
  const unitPrice = parseFormNumber(formData.get("unitPrice")) ?? 0;
  const vat = parseFormNumber(formData.get("vat")) ?? 0;
  const total = quantity * unitPrice + vat;
  const invoiceDate = parseFormDate(formData.get("invoiceDate")) ?? before.invoiceDate;
  const dueDate = parseFormDate(formData.get("dueDate"));
  const paidDate = parseFormDate(formData.get("paidDate"));
  const currency = str(formData, "currency") ?? before.currency;
  const account = str(formData, "account");
  const paymentMethod = str(formData, "paymentMethod");

  await db.invoice.update({
    where: { id },
    data: {
      number,
      invoiceDate,
      dueDate,
      paidDate,
      description: str(formData, "description"),
      clientNameSnapshot: str(formData, "clientNameSnapshot"),
      quantity,
      unitPrice,
      vat,
      total,
      currency,
      account,
      paymentMethod,
      notes: str(formData, "notes"),
    },
  });

  // Keep the linked money records consistent with the edited invoice.
  if (before.ledgerEntryId) {
    await db.ledgerEntry.update({
      where: { id: before.ledgerEntryId },
      data: { amount: total, currency, account, date: paidDate ?? invoiceDate },
    }).catch(() => {});
  }
  await db.payment.updateMany({
    where: { invoiceId: id },
    data: { amount: total, currency, account, date: paidDate ?? invoiceDate },
  });
  // Sync the branded document (number/date/price) — best effort (number unique).
  try {
    const quote = await db.quotation.findFirst({ where: { invoiceId: id } });
    if (quote) {
      await db.quotation.update({
        where: { id: quote.id },
        data: { number, docDate: invoiceDate, validUntil: dueDate, price: quantity * unitPrice, currency },
      });
    }
  } catch { /* ignore quotation sync issues */ }

  await logAudit({
    action: "updated",
    section: "Billing",
    recordType: "Invoice",
    recordId: id,
    summary: `Edited invoice ${number}`,
    performedByType: "OSCAR",
    performedByLabel: "Oscar",
  });

  revalidatePath(`/billing/${id}`);
  revalidatePath("/billing");
  revalidatePath("/");
  redirect(`/billing/${id}?saved=${encodeURIComponent("Invoice updated")}`);
}

/**
 * One-click cleanup: set every paid invoice's paid date equal to its invoice
 * date, and align the linked ledger/payment dates. Fixes historical invoices
 * whose paid date was accidentally recorded as "today" (so they showed up in the
 * wrong month on the dashboard). Individual invoices can still be edited after.
 */
export async function alignPaidDatesToInvoiceDates() {
  const invoices = await db.invoice.findMany({ where: { status: "PAID", deletedAt: null } });
  let fixed = 0;
  for (const inv of invoices) {
    const target = inv.invoiceDate;
    if (!inv.paidDate || inv.paidDate.getTime() !== target.getTime()) {
      await db.invoice.update({ where: { id: inv.id }, data: { paidDate: target } });
      if (inv.ledgerEntryId) {
        await db.ledgerEntry.update({ where: { id: inv.ledgerEntryId }, data: { date: target } }).catch(() => {});
      }
      await db.payment.updateMany({ where: { invoiceId: inv.id }, data: { date: target } });
      fixed++;
    }
  }
  revalidatePath("/billing");
  revalidatePath("/");
  redirect(`/billing?saved=${encodeURIComponent(`Aligned paid dates for ${fixed} invoice(s)`)}`);
}

export async function sendInvoiceEmail(id: string) {
  const invoice = await db.invoice.findUniqueOrThrow({ where: { id } });
  const to = invoice.clientEmailSnapshot;
  if (!to) return { sent: false, reason: "No client billing email on file." };

  const pdf = await renderInvoicePdf(invoice);
  const result = await sendMail({
    to,
    subject: `Starflare Invoice ${invoice.number}`,
    text: `Hi,\n\nPlease find attached invoice ${invoice.number} for ${invoice.total} ${invoice.currency}.\n\nThank you,\nStarflare`,
    attachments: [{ filename: `${invoice.number}.pdf`, content: pdf }],
  });

  await db.invoice.update({
    where: { id },
    data: {
      status: invoice.status === "DRAFT" ? "SENT" : invoice.status,
      sentAt: new Date(),
      sentToEmail: to,
    },
  });

  await logAudit({
    action: "updated",
    section: "Billing",
    recordType: "Invoice",
    recordId: id,
    summary: result.sent
      ? `Emailed invoice ${invoice.number} to ${to}`
      : `Marked invoice ${invoice.number} as sent to ${to} (email not delivered: ${result.reason})`,
    performedByType: "OSCAR",
    performedByLabel: "Oscar",
  });

  revalidatePath(`/billing/${id}`);
  return result;
}

// ---------------- Stripe invoice -> Starflare invoice conversion ----------------

export async function uploadStripeInvoice(formData: FormData) {
  const fileRef = parseFileRef(formData, "file");
  if (!fileRef) throw new Error("No file uploaded");

  const { document } = await ingestDocument({
    fileRef,
    documentType: "STRIPE_INVOICE",
    category: "Stripe invoice (pending conversion)",
    uploadedByType: "OSCAR",
    uploadedByLabel: "Oscar",
  });

  redirect(`/billing/stripe/${document.id}/review`);
}

export async function confirmStripeInvoice(documentId: string, formData: FormData) {
  const document = await db.document.findUniqueOrThrow({ where: { id: documentId } });

  let clientId = str(formData, "clientId");
  let client = clientId ? await db.client.findUnique({ where: { id: clientId } }) : null;

  // "Add as a new client": create a Client from the extracted/edited details and
  // link the invoice to it, so the customer is saved for next time.
  if (!clientId && str(formData, "createClient") === "on") {
    const name = str(formData, "clientName");
    if (name) {
      client = await db.client.create({
        data: {
          name,
          companyName: name,
          mainEmail: str(formData, "clientEmail"),
          billingEmail: str(formData, "clientEmail"),
          phone: str(formData, "clientPhone"),
          address: str(formData, "clientAddress"),
          trn: str(formData, "clientTrn"),
          status: "ACTIVE",
        },
      });
      clientId = client.id;
    }
  }

  const invoiceDate = parseFormDate(formData.get("invoiceDate")) ?? new Date();
  const total = parseFormNumber(formData.get("amount")) ?? 0;
  const isPaid = str(formData, "isPaid") === "yes";
  // When the invoice is already paid, attribute the revenue to the real payment
  // date (defaulting to the invoice date) rather than "today".
  const paidDate = isPaid ? parseFormDate(formData.get("paidDate")) ?? invoiceDate : null;
  const account = str(formData, "account");
  const paymentMethod = str(formData, "paymentMethod") ?? "Stripe";

  const number = await nextInvoiceNumber(invoiceDate);
  const dueDate = parseFormDate(formData.get("dueDate"));
  const currency = str(formData, "currency") ?? "AED";
  const description = str(formData, "description") ?? "Stripe subscription / purchase";
  // Prefer the linked client's saved details; otherwise use whatever was
  // extracted/edited on the review form (name, email, phone, TRN, address).
  const clientNameSnapshot = client?.name ?? str(formData, "clientName");
  const clientCompanySnapshot = client?.companyName ?? str(formData, "clientName");
  const clientEmailSnapshot = client?.billingEmail ?? client?.mainEmail ?? str(formData, "clientEmail");
  const clientAddressSnapshot = client?.address ?? str(formData, "clientAddress");
  const clientTRNSnapshot = client?.trn ?? str(formData, "clientTrn");
  const clientPhone = client?.phone ?? str(formData, "clientPhone");

  const invoice = await db.invoice.create({
    data: {
      number,
      clientId,
      clientNameSnapshot,
      clientCompanySnapshot,
      clientEmailSnapshot,
      clientAddressSnapshot,
      clientTRNSnapshot,
      invoiceDate,
      dueDate,
      paidDate,
      account,
      description,
      quantity: 1,
      unitPrice: total,
      vat: 0,
      total,
      currency,
      paymentMethod,
      status: isPaid ? "PAID" : "SENT",
      source: "STRIPE",
      sourceStripeDocumentId: documentId,
      notes: "Auto-created from an uploaded Stripe invoice. Review before relying on totals.",
    },
  });

  // Also create a branded Starflare document (the new invoice layout) linked to
  // this invoice, so the converted invoice looks like a Starflare invoice — not
  // a copy of the Stripe one.
  const brandedDoc = await db.quotation.create({
    data: {
      kind: "INVOICE",
      number,
      clientId,
      companyName: clientCompanySnapshot,
      contactPerson: clientNameSnapshot,
      clientEmail: clientEmailSnapshot,
      clientPhone,
      clientAddress: clientAddressSnapshot,
      clientTrn: clientTRNSnapshot,
      packageType: "Starflare Platform Subscription",
      subjectLine: description,
      includePackageList: false,
      price: total,
      currency,
      vatMode: "NONE",
      paymentMethod,
      docDate: invoiceDate,
      validUntil: dueDate,
      status: isPaid ? "PAID" : "SENT",
      invoiceId: invoice.id,
    },
  });

  await db.document.update({ where: { id: documentId }, data: { invoiceId: invoice.id, category: "Stripe invoice (converted)" } });

  if (clientId) {
    await db.purchase.create({
      data: {
        clientId,
        type: "SUBSCRIPTION",
        date: invoiceDate,
        amount: total,
        currency: invoice.currency,
        paymentMethod,
        invoiceId: invoice.id,
        notes: `Stripe invoice converted to ${invoice.number}`,
      },
    });
  }

  let ledgerEntryId: string | undefined;
  if (isPaid) {
    const ledgerEntry = await db.ledgerEntry.create({
      data: {
        date: paidDate ?? invoiceDate,
        type: "INCOME",
        category: "Stripe Revenue",
        amount: total,
        currency: invoice.currency,
        clientId,
        paymentMethod,
        account,
        invoiceId: invoice.id,
        sourceModule: "Invoice",
        sourceId: invoice.id,
        notes: `Stripe invoice ${invoice.number}`,
      },
    });
    ledgerEntryId = ledgerEntry.id;
    await db.invoice.update({ where: { id: invoice.id }, data: { ledgerEntryId: ledgerEntry.id } });

    await db.payment.create({
      data: {
        type: "INCOMING",
        amount: total,
        currency: invoice.currency,
        date: paidDate ?? invoiceDate,
        method: paymentMethod,
        account,
        payer: client?.name ?? str(formData, "clientName"),
        payee: "Starflare",
        invoiceId: invoice.id,
        clientId,
        proofDocumentId: documentId,
        reconciliation: "PENDING_REVIEW",
        notes: "Auto-created from Stripe invoice conversion",
      },
    });
  }

  await logAudit({
    action: "created",
    section: "Billing",
    recordType: "Invoice",
    recordId: invoice.id,
    summary: `Converted Stripe invoice into Starflare invoice ${invoice.number}`,
    performedByType: "OSCAR",
    performedByLabel: "Oscar",
  });

  revalidatePath("/billing");
  redirect(`/billing/documents/${brandedDoc.id}?saved=${encodeURIComponent(`Invoice ${number} created`)}`);
}

// ---- Trash: invoices are soft-deleted (recoverable) rather than removed ----

export async function trashInvoice(id: string) {
  const now = new Date();
  await db.invoice.update({ where: { id }, data: { deletedAt: now } });
  await db.quotation.updateMany({ where: { invoiceId: id }, data: { deletedAt: now } });
  revalidatePath("/billing");
  revalidatePath("/");
  redirect("/billing?saved=Invoice+moved+to+Trash");
}

export async function restoreInvoice(id: string) {
  await db.invoice.update({ where: { id }, data: { deletedAt: null } });
  await db.quotation.updateMany({ where: { invoiceId: id }, data: { deletedAt: null } });
  revalidatePath("/billing");
  revalidatePath("/billing/trash");
  redirect("/billing?saved=Invoice+restored");
}

export async function deleteInvoiceForever(id: string) {
  const inv = await db.invoice.findUnique({ where: { id } });
  await db.quotation.deleteMany({ where: { invoiceId: id } });
  if (inv?.ledgerEntryId) await db.ledgerEntry.delete({ where: { id: inv.ledgerEntryId } }).catch(() => {});
  await db.payment.deleteMany({ where: { invoiceId: id } });
  await db.purchase.deleteMany({ where: { invoiceId: id } });
  await db.document.updateMany({ where: { invoiceId: id }, data: { invoiceId: null } });
  await db.invoice.delete({ where: { id } });
  revalidatePath("/billing/trash");
  redirect("/billing/trash?saved=Invoice+permanently+deleted");
}

/** Standalone quotations (not linked to an invoice) are also soft-deleted to Trash. */
export async function trashQuotation(id: string) {
  await db.quotation.update({ where: { id }, data: { deletedAt: new Date() } });
  revalidatePath("/billing/documents");
  redirect("/billing/documents?saved=Quotation+moved+to+Trash");
}

export async function restoreQuotation(id: string) {
  await db.quotation.update({ where: { id }, data: { deletedAt: null } });
  revalidatePath("/billing/trash");
  redirect("/billing/documents?saved=Quotation+restored");
}

export async function deleteQuotationForever(id: string) {
  await db.quotation.delete({ where: { id } });
  revalidatePath("/billing/trash");
  redirect("/billing/trash?saved=Quotation+permanently+deleted");
}
