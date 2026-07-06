import {
  AlignmentType,
  BorderStyle,
  Document,
  Packer,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
} from "docx";
import { formatMoney, formatDate } from "@/lib/format";
import {
  QuoteDocData,
  STARFLARE_COMPANY,
  computeTotals,
  packageAccessList,
  packageSummaryLine,
  parseExtraLineItems,
} from "@/lib/quote-doc";

const PINK = "EC2D8F";
const INK = "0F172A";
const MUTED = "64748B";
const FAINT = "94A3B8";
const NO_BORDER = { style: BorderStyle.NONE, size: 0, color: "FFFFFF" } as const;
const NO_BORDERS = { top: NO_BORDER, bottom: NO_BORDER, left: NO_BORDER, right: NO_BORDER, insideHorizontal: NO_BORDER, insideVertical: NO_BORDER };

function run(text: string, opts: { bold?: boolean; size?: number; color?: string } = {}) {
  return new TextRun({ text, bold: opts.bold, size: (opts.size ?? 10) * 2, color: opts.color ?? INK });
}
function para(children: TextRun[], opts: { align?: (typeof AlignmentType)[keyof typeof AlignmentType]; spacingAfter?: number } = {}) {
  return new Paragraph({ children, alignment: opts.align, spacing: { after: opts.spacingAfter ?? 40 } });
}
function label(text: string) {
  return para([run(text, { bold: true, size: 8, color: FAINT })], { spacingAfter: 20 });
}
/** A borderless two-column row (left block | right block). */
function twoCol(left: Paragraph[], right: Paragraph[]) {
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: NO_BORDERS,
    rows: [
      new TableRow({
        children: [
          new TableCell({ width: { size: 55, type: WidthType.PERCENTAGE }, borders: NO_BORDERS, children: left }),
          new TableCell({ width: { size: 45, type: WidthType.PERCENTAGE }, borders: NO_BORDERS, children: right }),
        ],
      }),
    ],
  });
}

/** Builds a genuine .docx (Open XML) of the branded quotation/invoice. */
export async function renderQuoteDocx(q: QuoteDocData): Promise<Buffer> {
  const title = q.kind === "INVOICE" ? "INVOICE" : "QUOTATION";
  const totals = computeTotals(q);
  const extras = parseExtraLineItems(q.extraLineItems);
  const summary = packageSummaryLine(q);
  const showVat = q.vatMode !== "NONE" && totals.vat > 0;

  // Header: logo/company (left) | doc meta (right)
  const header = twoCol(
    [
      para([run("STARFLARE", { bold: true, size: 22, color: PINK })]),
      para([run(STARFLARE_COMPANY.tagline, { bold: true, size: 7, color: FAINT })]),
      para([run(STARFLARE_COMPANY.name, { bold: true, size: 9 })], { spacingAfter: 10 }),
      ...STARFLARE_COMPANY.addressLines.map((l) => para([run(l, { size: 9, color: MUTED })], { spacingAfter: 10 })),
    ],
    [
      para([run(title, { bold: true, size: 20 })], { align: AlignmentType.RIGHT }),
      para([run(`No. ${q.number}`, { size: 9, color: MUTED })], { align: AlignmentType.RIGHT }),
      para([run(`Date: ${formatDate(q.docDate)}`, { size: 9, color: MUTED })], { align: AlignmentType.RIGHT }),
      ...(q.validUntil
        ? [para([run(`${q.kind === "INVOICE" ? "Due" : "Valid until"}: ${formatDate(q.validUntil)}`, { size: 9, color: MUTED })], { align: AlignmentType.RIGHT })]
        : []),
    ]
  );

  const clientLines = [q.contactPerson, q.clientEmail, q.clientPhone, q.clientAddress, q.clientTrn ? `TRN: ${q.clientTrn}` : null].filter(Boolean) as string[];
  const packageMeta = [q.initialTerm, q.startDate ? `from ${formatDate(q.startDate)}` : null].filter(Boolean).join(" · ");

  const billTo = twoCol(
    [
      label("BILL TO"),
      para([run(q.companyName || q.brandName || "—", { bold: true })]),
      ...clientLines.map((l) => para([run(l, { size: 9, color: "334155" })], { spacingAfter: 10 })),
    ],
    [
      para([run("PACKAGE", { bold: true, size: 8, color: FAINT })], { align: AlignmentType.RIGHT, spacingAfter: 20 }),
      para([run(q.packageName || q.packageType || "—", { bold: true })], { align: AlignmentType.RIGHT }),
      ...(packageMeta ? [para([run(packageMeta, { size: 9, color: MUTED })], { align: AlignmentType.RIGHT })] : []),
    ]
  );

  // Items table
  const cell = (text: string, opts: { bold?: boolean; align?: (typeof AlignmentType)[keyof typeof AlignmentType]; color?: string } = {}) =>
    new TableCell({ borders: NO_BORDERS, margins: { top: 60, bottom: 60, left: 60, right: 60 }, children: [para([run(text, { bold: opts.bold, size: 9, color: opts.color })], { align: opts.align, spacingAfter: 0 })] });
  const headerCell = (text: string, align?: (typeof AlignmentType)[keyof typeof AlignmentType]) =>
    new TableCell({ shading: { fill: "F1F5F9" }, borders: NO_BORDERS, margins: { top: 60, bottom: 60, left: 60, right: 60 }, children: [para([run(text, { bold: true, size: 8, color: MUTED })], { align, spacingAfter: 0 })] });

  const itemRows = [
    new TableRow({ children: [headerCell("#"), headerCell("ITEM & DESCRIPTION"), headerCell("QTY", AlignmentType.RIGHT), headerCell("RATE", AlignmentType.RIGHT), headerCell("AMOUNT", AlignmentType.RIGHT)] }),
    new TableRow({
      children: [
        cell("1"),
        new TableCell({ borders: NO_BORDERS, margins: { top: 60, bottom: 60, left: 60, right: 60 }, children: [
          para([run(q.packageType || "Package", { bold: true, size: 9 })], { spacingAfter: 10 }),
          ...(summary ? [para([run(summary, { size: 8, color: MUTED })], { spacingAfter: 0 })] : []),
        ] }),
        cell("1", { align: AlignmentType.RIGHT }),
        cell(formatMoney(q.price, q.currency), { align: AlignmentType.RIGHT }),
        cell(formatMoney(q.price, q.currency), { align: AlignmentType.RIGHT }),
      ],
    }),
    ...extras.map((it, i) =>
      new TableRow({ children: [cell(String(i + 2)), cell(it.description), cell(String(it.qty), { align: AlignmentType.RIGHT }), cell(formatMoney(it.rate, q.currency), { align: AlignmentType.RIGHT }), cell(formatMoney(it.qty * it.rate, q.currency), { align: AlignmentType.RIGHT })] })
    ),
  ];
  const itemsTable = new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, borders: NO_BORDERS, rows: itemRows });

  const totalsParas: Paragraph[] = [];
  if (showVat) {
    totalsParas.push(para([run(`Subtotal   ${formatMoney(totals.subtotal, q.currency)}`, { size: 9, color: MUTED })], { align: AlignmentType.RIGHT }));
    totalsParas.push(para([run(`VAT (${q.vatPercent}%)   ${formatMoney(totals.vat, q.currency)}`, { size: 9, color: MUTED })], { align: AlignmentType.RIGHT }));
  }
  totalsParas.push(para([run(`Total   ${formatMoney(totals.total, q.currency)}`, { bold: true, size: 13 })], { align: AlignmentType.RIGHT }));

  const sections: Paragraph[] = [];
  if (q.subjectLine) {
    sections.push(label("SUBJECT"), para([run(q.subjectLine, { bold: true })]));
  }
  if (q.includePackageList) {
    sections.push(new Paragraph({ children: [run("Package & Platform Access includes:", { bold: true })], spacing: { before: 200, after: 60 } }));
    for (const b of packageAccessList(q)) sections.push(new Paragraph({ text: b, bullet: { level: 0 }, spacing: { after: 20 } }));
  }
  const paymentBits = [q.paymentMethod ? `Method: ${q.paymentMethod}` : null, q.paymentFrequency ? `Frequency: ${q.paymentFrequency}` : null].filter(Boolean).join(" · ");
  if (paymentBits || q.paymentTerms) {
    sections.push(new Paragraph({ children: [run("PAYMENT", { bold: true, size: 8, color: FAINT })], spacing: { before: 200, after: 40 } }));
    if (paymentBits) sections.push(para([run(paymentBits, { size: 9, color: "334155" })]));
    if (q.paymentTerms) sections.push(para([run(q.paymentTerms, { size: 9, color: "334155" })]));
  }
  sections.push(new Paragraph({ children: [run("TERM & RENEWAL", { bold: true, size: 8, color: FAINT })], spacing: { before: 200, after: 40 } }));
  sections.push(
    para([
      run(
        [
          q.initialTerm ? `Initial term: ${q.initialTerm}` : null,
          q.startDate ? `Start / activation date: ${formatDate(q.startDate)}` : null,
          `Auto-renewal: ${q.autoRenewal ? "Yes" : "No"}`,
          `Cancellation via the Starflare platform: ${q.cancellationViaPlatform ? "Yes" : "No"}`,
        ].filter(Boolean).join(". ") + ".",
        { size: 9, color: "334155" }
      ),
    ])
  );

  const doc = new Document({
    styles: { default: { document: { run: { font: "Calibri" } } } },
    sections: [
      {
        properties: { page: { margin: { top: 720, bottom: 720, left: 720, right: 720 } } },
        children: [
          header,
          new Paragraph({ border: { bottom: { style: BorderStyle.SINGLE, size: 12, color: PINK, space: 6 } }, spacing: { after: 160 } }),
          billTo,
          new Paragraph({ text: "", spacing: { after: 80 } }),
          ...sections.slice(0, q.subjectLine ? 2 : 0),
          new Paragraph({ text: "", spacing: { after: 40 } }),
          itemsTable,
          new Paragraph({ border: { top: { style: BorderStyle.SINGLE, size: 8, color: INK, space: 4 } }, spacing: { after: 80 } }),
          ...totalsParas,
          ...sections.slice(q.subjectLine ? 2 : 0),
          new Paragraph({ children: [run("Generated by Starflare ERP", { size: 8, color: FAINT })], alignment: AlignmentType.CENTER, spacing: { before: 300 } }),
        ],
      },
    ],
  });

  return Buffer.from(await Packer.toBuffer(doc));
}
