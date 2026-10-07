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

/** The next invoice number WITHOUT consuming it — used to pre-fill the editable field. */
export async function peekNextInvoiceNumber(date = new Date()): Promise<string> {
  const year = date.getFullYear();
  const c = await db.counter.findUnique({ where: { id: `invoice-${year}` } });
  return `SF-${year}-${String((c?.value ?? 0) + 1).padStart(4, "0")}`;
}

/** The next quotation number WITHOUT consuming it. */
export async function peekNextQuotationNumber(date = new Date()): Promise<string> {
  const year = date.getFullYear();
  const c = await db.counter.findUnique({ where: { id: `quotation-${year}` } });
  return `SF-QT-${year}-${String((c?.value ?? 0) + 1).padStart(4, "0")}`;
}

/**
 * When a document is saved with a hand-edited number like "SF-2026-0050", keep
 * the auto-numbering progressive: bump that year's counter so the next generated
 * number continues from there (0051), never going backwards.
 */
export async function syncCounterToNumber(num: string): Promise<void> {
  const qt = num.match(/^SF-QT-(\d{4})-0*(\d+)$/i);
  const inv = num.match(/^SF-(\d{4})-0*(\d+)$/i);
  const m = qt ?? inv;
  if (!m) return;
  const key = `${qt ? "quotation" : "invoice"}-${m[1]}`;
  const value = Number(m[2]);
  if (!Number.isFinite(value) || value <= 0) return;
  const existing = await db.counter.findUnique({ where: { id: key } });
  if (!existing) {
    await db.counter.create({ data: { id: key, value } });
  } else if (value > existing.value) {
    await db.counter.update({ where: { id: key }, data: { value } });
  }
}

