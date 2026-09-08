import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import type { Order } from "../types";
import { computeProfitability, finalUnitPrice, lineTotalExcl } from "./calc";
import { num, formatDate } from "./format";
import { LOGO_PNG } from "../data/logo";

const GREEN = "#14442e";
const GREEN_LIGHT = "#eef4f0";
const GREY = "#6b7c72";

// jsPDF's built-in Helvetica only covers WinAnsi. Characters outside it (the ₂
// in CO₂, em/en dashes, smart quotes) make it fall back to a broken, letter-
// spaced rendering — so map everything down to safe ASCII before drawing.
function T(s: string): string {
  return (s || "")
    .replace(/[₀-₉]/g, (d) => String("₀₁₂₃₄₅₆₇₈₉".indexOf(d)))
    .replace(/[²]/g, "2")
    .replace(/[–—]/g, "-") // – —
    .replace(/[‘’‚]/g, "'") // ' ' ‚
    .replace(/[“”„]/g, '"') // " " „
    .replace(/[×]/g, "x")
    .replace(/[→]/g, "->")
    .replace(/[•]/g, "-") // • -> - (bullets are added explicitly)
    .replace(/[^\x09\x0A\x0D\x20-\x7E -ÿ]/g, ""); // drop anything else exotic
}

/** Generate and download the customer-facing quotation PDF. Internal cost /
 *  profit figures are deliberately never included. All prices shown are the
 *  B2B (excl-VAT) figures; VAT is optional (order.details.showVat). */
export function generateQuotationPdf(order: Order, logo?: { url: string; aspect: number }) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const margin = 16;
  const contentW = pageW - margin * 2;
  const p = computeProfitability(order.lines, order.options);
  const { customer, details } = order;

  // ---- header ----
  if (logo?.url) {
    // Custom uploaded logo (includes the wordmark) — fit within a height and
    // width cap without distortion.
    const aspect = logo.aspect || 4;
    const maxH = 18;
    const maxW = 95;
    let w = maxH * aspect;
    let h = maxH;
    if (w > maxW) {
      w = maxW;
      h = maxW / aspect;
    }
    try {
      doc.addImage(logo.url, "PNG", margin, 10, w, h);
    } catch {
      // fall through to the built-in mark if the image can't be drawn
    }
  } else {
    // built-in leaf-in-V mark (0.75 aspect) + wordmark
    doc.addImage(LOGO_PNG, "PNG", margin, 10, 9, 12);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.setTextColor(GREEN);
    doc.text("VEGANOLOGIE", margin + 13, 20, { charSpace: 1.4 });
  }

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(GREY);
  doc.text("CORPORATE PARTNERSHIP PROPOSAL", pageW - margin, 16, { align: "right" });
  doc.text(`Ref: ${T(order.quotationNumber)}`, pageW - margin, 21, { align: "right" });
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
    doc.text(T(l), margin, y);
    y += 5;
  });

  // ---- product table (all prices excl. VAT) ----
  const body = order.lines.map((l) => [
    T(l.name),
    String(l.quantity),
    `AED ${num(l.priceExcl)}`,
    l.discountPct ? `${l.discountPct}%` : "-",
    `AED ${num(finalUnitPrice(l.priceExcl, l.discountPct))}`,
    `AED ${num(lineTotalExcl(l))}`,
  ]);

  if (order.options.packaging.kind === "custom" && order.options.packaging.charged) {
    const boxes = order.options.packaging.numBoxes || 0;
    const total = order.options.packaging.sellingPrice || 0;
    const unit = boxes > 0 ? total / boxes : total;
    body.push([
      T(order.options.packaging.label),
      boxes ? String(boxes) : "-",
      "-",
      "-",
      boxes ? `AED ${num(unit)}` : "-",
      `AED ${num(total)}`,
    ]);
  }
  if (order.options.logo.kind === "custom" && order.options.logo.charged) {
    body.push([T(order.options.logo.label), "-", "-", "-", "-", `AED ${num(order.options.logo.sellingPrice || 0)}`]);
  }

  autoTable(doc, {
    startY: y + 4,
    head: [["Product", "Qty", "Price", "Discount", "Final Unit Price", "Total"]],
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
  // @ts-expect-error injected by the autotable plugin
  let ty = doc.lastAutoTable.finalY + 8;
  const totalsX = pageW - margin - 70;
  const row = (label: string, value: string, bold = false, fill = false) => {
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
  // Headline is the excl-VAT subtotal (the B2B figure). VAT is optional.
  row("Subtotal (excl. VAT)", `AED ${num(p.totalRevenue)}`, true, true);
  if (details.showVat) {
    row("VAT 5%", `AED ${num(p.vat)}`);
    row("Total (incl. VAT)", `AED ${num(p.totalWithVat)}`);
  }

  doc.setFont("helvetica", "italic");
  doc.setFontSize(8);
  doc.setTextColor(GREY);
  doc.text(
    details.showVat
      ? "Prices are exclusive of VAT. VAT is applied at 5% as shown above."
      : "All prices are exclusive of VAT (5% VAT applies where chargeable).",
    margin,
    ty + 1,
  );

  // ---- narrative sections ----
  ty += 10;
  const section = (title: string, bodyLines: string[], bullet = false) => {
    const filtered = bodyLines.filter((l) => l.trim());
    if (!filtered.length) return;
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
      const prefix = bullet ? "-  " : "";
      const wrapped = doc.splitTextToSize(T(prefix + l), contentW - (bullet ? 3 : 0)) as string[];
      wrapped.forEach((w, i) => {
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

  // ---- footer ----
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
    doc.text(`${T(order.quotationNumber)}   ·   Page ${i} of ${pages}`, pageW - margin, 293, {
      align: "right",
    });
  }

  doc.save(`${T(order.quotationNumber)}.pdf`);
}
