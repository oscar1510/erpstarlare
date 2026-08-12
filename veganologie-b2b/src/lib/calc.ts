import type { LineItem, OrderOptions, Profitability } from "../types";

export const VAT_RATE = 0.05; // UAE VAT 5%

/** Final unit price after the line's discount. */
export function finalUnitPrice(retail: number, discountPct: number): number {
  return retail * (1 - (discountPct || 0) / 100);
}

/** Line total charged to the customer (excl. VAT). */
export function lineTotal(line: LineItem): number {
  return finalUnitPrice(line.retail, line.discountPct) * (line.quantity || 0);
}

/**
 * The heart of the tool: compute the REAL profit margin of the whole order.
 * All figures exclude VAT. Production costs are internal only.
 */
export function computeProfitability(
  lines: LineItem[],
  options: OrderOptions,
): Profitability {
  let retailValue = 0;
  let productRevenue = 0;
  let productCost = 0;

  for (const l of lines) {
    const qty = l.quantity || 0;
    retailValue += l.retail * qty;
    productRevenue += lineTotal(l);
    productCost += l.cost * qty;
  }

  // --- extra costs (internal) ---
  const packagingCost =
    options.packaging.kind === "custom"
      ? (options.packaging.costPerBox || 0) * (options.packaging.numBoxes || 0)
      : 0;
  const logoCost = options.logo.kind === "custom" ? options.logo.cost || 0 : 0;
  const shippingCost =
    options.shipping.kind === "included" ? options.shipping.cost || 0 : 0;

  // --- extra revenue (only what we actually charge the customer) ---
  const packagingCharge =
    options.packaging.kind === "custom" && options.packaging.charged
      ? options.packaging.sellingPrice || 0
      : 0;
  const logoCharge =
    options.logo.kind === "custom" && options.logo.charged
      ? options.logo.sellingPrice || 0
      : 0;
  const extraRevenue = packagingCharge + logoCharge;

  const totalRevenue = productRevenue + extraRevenue;
  const totalCost = productCost + packagingCost + logoCost + shippingCost;
  const profit = totalRevenue - totalCost;
  const marginPct = totalRevenue > 0 ? (profit / totalRevenue) * 100 : 0;
  const totalDiscount = retailValue - productRevenue;

  const vat = totalRevenue * VAT_RATE;

  return {
    retailValue,
    totalDiscount,
    productRevenue,
    extraRevenue,
    totalRevenue,
    productCost,
    packagingCost,
    logoCost,
    shippingCost,
    totalCost,
    profit,
    marginPct,
    vat,
    totalWithVat: totalRevenue + vat,
  };
}

// ---------------------------------------------------------------------------
// Profitability bands for the gauge. Simple, defined here in code.
// ---------------------------------------------------------------------------
export interface Band {
  label: string;
  min: number; // inclusive lower bound (margin %)
  color: string; // hex for the gauge arc + needle
}

export const BANDS: Band[] = [
  { label: "POOR", min: -Infinity, color: "#d64545" },
  { label: "ACCEPTABLE", min: 20, color: "#e8833a" },
  { label: "GOOD", min: 30, color: "#e0b020" },
  { label: "VERY GOOD", min: 40, color: "#6cae3e" },
  { label: "EXCELLENT", min: 50, color: "#2f9e44" },
];

export function bandFor(marginPct: number): Band {
  let current = BANDS[0];
  for (const b of BANDS) {
    if (marginPct >= b.min) current = b;
  }
  return current;
}
