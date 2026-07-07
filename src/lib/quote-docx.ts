import {
  AlignmentType,
  BorderStyle,
  Document,
  ImageRun,
  Packer,
  Paragraph,
  Table,
  TableCell,
  TableLayoutType,
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

// A4 (11906 twips wide) minus 720-twip margins each side = usable content width.
const PAGE_MARGIN = 720;
const CONTENT_W = 11906 - PAGE_MARGIN * 2; // 10466

const NO_BORDER = { style: BorderStyle.NONE, size: 0, color: "FFFFFF" } as const;
const NO_BORDERS = { top: NO_BORDER, bottom: NO_BORDER, left: NO_BORDER, right: NO_BORDER, insideHorizontal: NO_BORDER, insideVertical: NO_BORDER };
const CELL_MARGIN = { top: 40, bottom: 40, left: 60, right: 60 };
type Align = (typeof AlignmentType)[keyof typeof AlignmentType];

function run(text: string, opts: { bold?: boolean; size?: number; color?: string } = {}) {
  return new TextRun({ text, bold: opts.bold, size: (opts.size ?? 10) * 2, color: opts.color ?? INK });
}
function para(children: TextRun[], opts: { align?: Align; spacingAfter?: number } = {}) {
  return new Paragraph({ children, alignment: opts.align, spacing: { after: opts.spacingAfter ?? 40 } });
}
function label(text: string, align?: Align) {
  return para([run(text, { bold: true, size: 8, color: FAINT })], { align, spacingAfter: 20 });
}
function cellPara(children: Paragraph[], width: number, align?: Align) {
  return new TableCell({ width: { size: width, type: WidthType.DXA }, borders: NO_BORDERS, margins: CELL_MARGIN, children });
}

/** A borderless two-column band with fixed widths so Word/Pages can't collapse it. */
function twoCol(left: Paragraph[], right: Paragraph[]) {
  const lw = Math.round(CONTENT_W * 0.55);
  const rw = CONTENT_W - lw;
  return new Table({
    width: { size: CONTENT_W, type: WidthType.DXA },
    columnWidths: [lw, rw],
    layout: TableLayoutType.FIXED,
    borders: NO_BORDERS,
    rows: [new TableRow({ children: [cellPara(left, lw), cellPara(right, rw)] })],
  });
}

/** Builds a genuine .docx (Open XML) of the branded quotation/invoice. */
export async function renderQuoteDocx(q: QuoteDocData, logo?: { buffer: Buffer; mime: string } | null): Promise<Buffer> {
  const title = q.kind === "INVOICE" ? "INVOICE" : "QUOTATION";
  const totals = computeTotals(q);
  const extras = parseExtraLineItems(q.extraLineItems);
  const summary = packageSummaryLine(q);
  const showVat = q.vatMode !== "NONE" && totals.vat > 0;

  // Use the uploaded/official raster logo (PNG/JPG) if we have one, else a text mark.
  const logoType = logo?.mime.includes("png") ? "png" : logo?.mime.includes("jpeg") || logo?.mime.includes("jpg") ? "jpg" : null;
  const logoPara =
    logo && logoType
      ? new Paragraph({ children: [new ImageRun({ data: logo.buffer, type: logoType, transformation: { width: 190, height: 48 } })], spacing: { after: 40 } })
      : para([run("STARFLARE", { bold: true, size: 22, color: PINK })]);

  const header = twoCol(
    [
      logoPara,
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
      label("PACKAGE", AlignmentType.RIGHT),
      para([run(q.packageName || q.packageType || "—", { bold: true })], { align: AlignmentType.RIGHT }),
      ...(packageMeta ? [para([run(packageMeta, { size: 9, color: MUTED })], { align: AlignmentType.RIGHT })] : []),
    ]
  );

  // Items table with explicit fixed column widths.
  const COLS = [520, 5946, 900, 1550, 1550]; // sums to 10466
  const cell = (text: string, i: number, opts: { bold?: boolean; align?: Align; color?: string } = {}) =>
    cellPara([para([run(text, { bold: opts.bold, size: 9, color: opts.color })], { align: opts.align, spacingAfter: 0 })], COLS[i], opts.align);
  const headerCell = (text: string, i: number, align?: Align) =>
    new TableCell({ width: { size: COLS[i], type: WidthType.DXA }, shading: { fill: "F1F5F9" }, borders: NO_BORDERS, margins: CELL_MARGIN, children: [para([run(text, { bold: true, size: 8, color: MUTED })], { align, spacingAfter: 0 })] });

  const itemRows = [
    new TableRow({ children: [headerCell("#", 0), headerCell("ITEM & DESCRIPTION", 1), headerCell("QTY", 2, AlignmentType.RIGHT), headerCell("RATE", 3, AlignmentType.RIGHT), headerCell("AMOUNT", 4, AlignmentType.RIGHT)] }),
    new TableRow({
      children: [
        cell("1", 0),
        cellPara(
          [
            para([run(q.packageType || "Package", { bold: true, size: 9 })], { spacingAfter: summary ? 10 : 0 }),
            ...(summary ? [para([run(summary, { size: 8, color: MUTED })], { spacingAfter: 0 })] : []),
          ],
          COLS[1]
        ),
        cell("1", 2, { align: AlignmentType.RIGHT }),
        cell(formatMoney(q.price, q.currency), 3, { align: AlignmentType.RIGHT }),
        cell(formatMoney(q.price, q.currency), 4, { align: AlignmentType.RIGHT }),
      ],
    }),
    ...extras.map((it, i) =>
      new TableRow({ children: [cell(String(i + 2), 0), cell(it.description, 1), cell(String(it.qty), 2, { align: AlignmentType.RIGHT }), cell(formatMoney(it.rate, q.currency), 3, { align: AlignmentType.RIGHT }), cell(formatMoney(it.qty * it.rate, q.currency), 4, { align: AlignmentType.RIGHT })] })
    ),
  ];
  const itemsTable = new Table({ width: { size: CONTENT_W, type: WidthType.DXA }, columnWidths: COLS, layout: TableLayoutType.FIXED, borders: NO_BORDERS, rows: itemRows });

  const totalsParas: Paragraph[] = [];
  if (showVat) {
    totalsParas.push(para([run(`Subtotal    ${formatMoney(totals.subtotal, q.currency)}`, { size: 9, color: MUTED })], { align: AlignmentType.RIGHT }));
    totalsParas.push(para([run(`VAT (${q.vatPercent}%)    ${formatMoney(totals.vat, q.currency)}`, { size: 9, color: MUTED })], { align: AlignmentType.RIGHT }));
  }
  totalsParas.push(para([run(`Total    ${formatMoney(totals.total, q.currency)}`, { bold: true, size: 13 })], { align: AlignmentType.RIGHT }));

  const tail: Paragraph[] = [];
  if (q.subjectLine) tail.push(label("SUBJECT"), para([run(q.subjectLine, { bold: true })]));
  if (q.includePackageList) {
    tail.push(new Paragraph({ children: [run("Package & Platform Access includes:", { bold: true })], spacing: { before: 200, after: 60 } }));
    for (const b of packageAccessList(q)) tail.push(new Paragraph({ text: b, bullet: { level: 0 }, spacing: { after: 20 } }));
  }
  const paymentBits = [q.paymentMethod ? `Method: ${q.paymentMethod}` : null, q.paymentFrequency ? `Frequency: ${q.paymentFrequency}` : null].filter(Boolean).join(" · ");
  if (paymentBits || q.paymentTerms) {
    tail.push(new Paragraph({ children: [run("PAYMENT", { bold: true, size: 8, color: FAINT })], spacing: { before: 200, after: 40 } }));
    if (paymentBits) tail.push(para([run(paymentBits, { size: 9, color: "334155" })]));
    if (q.paymentTerms) tail.push(para([run(q.paymentTerms, { size: 9, color: "334155" })]));
  }
  tail.push(new Paragraph({ children: [run("TERM & RENEWAL", { bold: true, size: 8, color: FAINT })], spacing: { before: 200, after: 40 } }));
  tail.push(
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
        properties: { page: { size: { width: 11906, height: 16838 }, margin: { top: PAGE_MARGIN, bottom: PAGE_MARGIN, left: PAGE_MARGIN, right: PAGE_MARGIN } } },
        children: [
          header,
          new Paragraph({ border: { bottom: { style: BorderStyle.SINGLE, size: 12, color: PINK, space: 6 } }, spacing: { after: 160 } }),
          billTo,
          new Paragraph({ text: "", spacing: { after: 80 } }),
          ...(q.subjectLine ? [label("SUBJECT"), para([run(q.subjectLine, { bold: true })])] : []),
          new Paragraph({ text: "", spacing: { after: 40 } }),
          itemsTable,
          new Paragraph({ border: { top: { style: BorderStyle.SINGLE, size: 8, color: INK, space: 4 } }, spacing: { after: 80 } }),
          ...totalsParas,
          // subject already rendered above; render the rest of the tail (skip a leading duplicate subject)
          ...tail.filter((_, idx) => !(q.subjectLine && idx < 2)),
          new Paragraph({ children: [run("Generated by Starflare ERP", { size: 8, color: FAINT })], alignment: AlignmentType.CENTER, spacing: { before: 300 } }),
        ],
      },
    ],
  });

  return Buffer.from(await Packer.toBuffer(doc));
}
