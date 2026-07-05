import { db } from "./db";

/** Atomically issue the next sequential Starflare invoice number, e.g. SF-2026-0007. */
export async function nextInvoiceNumber(date = new Date()): Promise<string> {
  const year = date.getFullYear();
  const key = `invoice-${year}`;

  const counter = await db.$transaction(async (tx) => {
    const existing = await tx.counter.upsert({
      where: { id: key },
      update: { value: { increment: 1 } },
      create: { id: key, value: 1 },
    });
    return existing.value;
  });

  return `SF-${year}-${String(counter).padStart(4, "0")}`;
}

/** Issue the next sequential quotation number, e.g. SF-QT-2026-0007. */
export async function nextQuotationNumber(date = new Date()): Promise<string> {
  const year = date.getFullYear();
  const key = `quotation-${year}`;

  const counter = await db.$transaction(async (tx) => {
    const existing = await tx.counter.upsert({
      where: { id: key },
      update: { value: { increment: 1 } },
      create: { id: key, value: 1 },
    });
    return existing.value;
  });

  return `SF-QT-${year}-${String(counter).padStart(4, "0")}`;
}
