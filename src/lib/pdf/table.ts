import PDFDocument from "pdfkit";
import { ReportData } from "@/lib/reports";

export async function renderTablePdf(data: ReportData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: 40, layout: "landscape" });
    const chunks: Buffer[] = [];
    doc.on("data", (c) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    doc.fontSize(16).fillColor("#1c2c6b").text(data.title);
    doc.moveDown(0.5);

    const colWidth = (doc.page.width - 80) / data.columns.length;
    let y = doc.y + 5;

    doc.fontSize(9).fillColor("#ffffff");
    doc.rect(40, y, doc.page.width - 80, 20).fill("#1c2c6b");
    data.columns.forEach((c, i) => {
      doc.fillColor("#ffffff").text(c.header, 40 + i * colWidth + 4, y + 5, { width: colWidth - 8 });
    });
    y += 22;

    doc.fontSize(8.5).fillColor("#0f172a");
    for (const row of data.rows) {
      if (y > doc.page.height - 50) {
        doc.addPage();
        y = 40;
      }
      data.columns.forEach((c, i) => {
        const val = row[c.key];
        doc.text(val !== null && val !== undefined ? String(val) : "-", 40 + i * colWidth + 4, y, { width: colWidth - 8 });
      });
      y += 18;
    }

    if (data.rows.length === 0) {
      doc.text("No data for this report yet.", 40, y);
    }

    doc.end();
  });
}
