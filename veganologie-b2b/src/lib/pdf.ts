import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import type { Order } from "../types";
import { computeProfitability, finalUnitPrice, lineTotal } from "./calc";
import { num, formatDate } from "./format";

const GREEN = "#14442e";
const GREEN_LIGHT = "#eef4f0";
const GREY = "#6b7c72";

// Draw a small vector leaf + V mark, matching the on-screen logo.
function drawMark(doc: jsPDF, x: number, y: number) {
  doc.setDrawColor(GREEN);
  doc.setLineWidth(0.7);
  // V
  doc.lines([[3, 9], [1, 0]], x, y, [1, 1], "S");
  // leaf (simple rounded shape)
  doc.setLineWidth(0.6);
  doc.ellipse(x + 6.5, y + 4, 3.2, 4.4, "S");
}

/** Generate and download the customer-facing quotation PDF. Internal cost /
 *  profit figures are deliberately never included. */
export function generateQuotationPdf(order: Order) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const margin = 16;
  const contentW = pageW - margin * 2;
  const p = computeProfitability(order.lines, order.options);
  const { customer, details } = order;

  // ---- header ----
  drawMark(doc, margin, 14);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  doc.setTextColor(GREEN);
  doc.text("VEGANOLOGIE", margin + 12, 21, { charSpace: 1.2 });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(GREY);
  doc.text("CORPORATE PARTNERSHIP PROPOSAL", pageW - margin, 16, { align: "right" });
  doc.text(`Ref: ${order.quotationNumber}`, pageW - margin, 21, { align: "right" });
  doc.text(`Date: ${formatDate(order.createdAt)}`, pageW - margin, 26, { align: "right" });
  doc.text(`Valid for: ${details.validForDays} days`, pageW - margin, 31, { align: "right" });

  doc.setDrawColor("#d6e5db");
  doc.setLineWidth(0.4);
  doc.line(margin, 36, pageW - margin, 36);

  // ---- prepared for ----
  let y = 44;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(GREEN);
  doc.text("PREPARED FOR", margin, y);
  doc.setFont("helvetica", "normal");
  doc.setTextColor("#333333");
  doc.setFontSize(10);
  y += 6;
  const lines: string[] = [];
  if (customer.customerName) lines.push(customer.customerName);
  if (customer.companyName) lines.push(customer.companyName);
  if (customer.address) lines.push(customer.address);
  const contact = [customer.phone, customer.email].filter(Boolean).join("  ·  ");
  if (contact) lines.push(contact);
  lines.forEach((l) => {
    doc.text(l, margin, y);
    y += 5;
  });

  // ---- product table ----
  const body = order.lines.map((l) => [
    l.name,
    String(l.quantity),
    `AED ${num(l.retail)}`,
    l.discountPct ? `${l.discountPct}%` : "—",
    `AED ${num(finalUnitPrice(l.retail, l.discountPct))}`,
    `AED ${num(lineTotal(l))}`,
  ]);

  // charged extras appear as commercial line items
  if (order.options.packaging.kind === "custom" && order.options.packaging.charged) {
    const boxes = order.options.packaging.numBoxes || 0;
    const total = order.options.packaging.sellingPrice || 0;
    const unit = boxes > 0 ? total / boxes : total;
    body.push([
      order.options.packaging.label,
      boxes ? String(boxes) : "—",
      "—",
      "—",
      boxes ? `AED ${num(unit)}` : "—",
      `AED ${num(total)}`,
    ]);
  }
  if (order.options.logo.kind === "custom" && order.options.logo.charged) {
    const total = order.options.logo.sellingPrice || 0;
    body.push([order.options.logo.label, "—", "—", "—", "—", `AED ${num(total)}`]);
  }

  autoTable(doc, {
    startY: y + 4,
    head: [["Product", "Qty", "Retail Price", "Discount", "Final Unit Price", "Total"]],
    body,
    theme: "grid",
    styles: { fontSize: 9, cellPadding: 2.5, textColor: "#333333", lineColor: "#e2e8e4" },
    headStyles: { fillColor: GREEN, textColor: "#ffffff", fontStyle: "bold", halign: "left" },
    columnStyles: {
      0: { cellWidth: "auto" },
      1: { halign: "right", cellWidth: 16 },
      2: { halign: "right", cellWidth: 26 },
      3: { halign: "right", cellWidth: 20 },
      4: { halign: "right", cellWidth: 28 },
      5: { halign: "right", cellWidth: 28 },
    },
    margin: { left: margin, right: margin },
  });

  // ---- totals ----
  // @ts-expect-error lastAutoTable is injected by the autotable plugin
  let ty = doc.lastAutoTable.finalY + 8;
  const totalsX = pageW - margin - 70;
  const totalRow = (label: string, value: string, bold = false, fill = false) => {
    if (fill) {
      doc.setFillColor(GREEN_LIGHT);
      doc.rect(totalsX - 2, ty - 4.5, 72, 7, "F");
    }
    doc.setFont("helvetica", bold ? "bold" : "normal");
    doc.setFontSize(bold ? 10.5 : 9.5);
    doc.setTextColor(bold ? GREEN : "#444444");
    doc.text(label, totalsX, ty);
    doc.text(value, pageW - margin, ty, { align: "right" });
    ty += bold ? 7.5 : 6;
  };
  totalRow("Subtotal (excl. VAT)", `AED ${num(p.totalRevenue)}`);
  totalRow("VAT 5%", `AED ${num(p.vat)}`);
  totalRow("TOTAL (incl. VAT)", `AED ${num(p.totalWithVat)}`, true, true);

  doc.setFont("helvetica", "italic");
  doc.setFontSize(8);
  doc.setTextColor(GREY);
  doc.text("Prices are exclusive of VAT. VAT is applied at 5% as shown above.", margin, ty + 1);

  // ---- narrative sections ----
  ty += 10;

  const section = (title: string, bodyLines: string[], bullet = false) => {
    const filtered = bodyLines.filter((l) => l.trim());
    if (!filtered.length) return;
    // page break if near bottom
    if (ty > 262) {
      doc.addPage();
      ty = 20;
    }
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(GREEN);
    doc.text(title, margin, ty);
    ty += 5;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor("#444444");
    filtered.forEach((l) => {
      const prefix = bullet ? "•  " : "";
      const wrapped = doc.splitTextToSize(prefix + l, contentW - (bullet ? 3 : 0));
      wrapped.forEach((w: string, i: number) => {
        if (ty > 285) {
          doc.addPage();
          ty = 20;
        }
        doc.text(w, margin + (bullet && i > 0 ? 3 : 0), ty);
        ty += 4.6;
      });
    });
    ty += 4;
  };

  const meta: string[] = [];
  if (details.colourNote) meta.push("Colour: " + details.colourNote);
  if (details.packagingNote) meta.push("Packaging: " + details.packagingNote);
  section("ORDER DETAILS", meta);
  section("WHAT'S INCLUDED", details.whatsIncluded.split("\n"), true);
  section("MATERIALS & CERTIFICATIONS", [
    ...details.materials.split("\n"),
    details.certifications ? "Certified: " + details.certifications : "",
  ]);
  section("LEAD TIMES", details.leadTimes.split("\n"), true);
  section("TERMS & CONDITIONS", details.terms.split("\n"), true);

  // ---- footer on every page ----
  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setDrawColor("#d6e5db");
    doc.setLineWidth(0.3);
    doc.line(margin, 289, pageW - margin, 289);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(GREY);
    doc.text("Veganologie · Sustainable Vegan Accessories · Dubai, UAE", margin, 293);
    doc.text(`${order.quotationNumber}   ·   Page ${i} of ${pages}`, pageW - margin, 293, {
      align: "right",
    });
  }

  doc.save(`${order.quotationNumber}.pdf`);
}
