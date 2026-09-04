import type { LineItem, OrderOptions, Profitability, VatMode } from "../types";

export const VAT_RATE = 0.05; // UAE VAT 5%

/** Add 5% VAT to a net (excl-VAT) amount. */
export function withVat(net: number): number {
  return Math.round(net * (1 + VAT_RATE) * 100) / 100;
}

/** A line's unit price in the requested view (excl. or incl. VAT). */
export function unitPrice(line: LineItem, mode: VatMode): number {
  return mode === "incl" ? withVat(line.priceExcl) : line.priceExcl;
}

/** Final unit price after the line's discount, on a given base price. */
export function finalUnitPrice(base: number, discountPct: number): number {
  return base * (1 - (discountPct || 0) / 100);
}

/** Line total EXCLUDING VAT — the figure all profit maths are based on. */
export function lineTotalExcl(line: LineItem): number {
  return finalUnitPrice(line.priceExcl, line.discountPct) * (line.quantity || 0);
}

/** Line total in the requested view (excl. or incl. VAT). */
export function lineTotal(line: LineItem, mode: VatMode = "excl"): number {
  const excl = lineTotalExcl(line);
  return mode === "incl" ? withVat(excl) : excl;
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
    retailValue += l.priceExcl * qty; // full price excl. VAT, before discount
    productRevenue += lineTotalExcl(l);
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

  // Margin is measured against the PRODUCT revenue (the core goods), not the
  // grand total. This makes packaging/logo that you charge the customer at cost
  // a true pass-through: it changes neither the profit nor the margin. Only when
  // an extra actually loses or makes money does the margin move — which is the
  // behaviour a "deal profitability" gauge should have.
  const marginBase = productRevenue > 0 ? productRevenue : totalRevenue;
  const marginPct = marginBase > 0 ? (profit / marginBase) * 100 : 0;
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

// Bands are calibrated to Veganologie's real margins (products carry 60–85%
// base margins), so that discounting visibly moves the rating. On a typical
// item this maps roughly to: full price → Excellent, ~40% off → Good, ~50% off
// → Acceptable, ~70% off → Poor. Adjust these five thresholds to taste.
export const BANDS: Band[] = [
  { label: "POOR", min: -Infinity, color: "#d64545" },
  { label: "ACCEPTABLE", min: 45, color: "#e8833a" },
  { label: "GOOD", min: 60, color: "#e0b020" },
  { label: "VERY GOOD", min: 70, color: "#6cae3e" },
  { label: "EXCELLENT", min: 80, color: "#2f9e44" },
];

export function bandFor(marginPct: number): Band {
  let current = BANDS[0];
  for (const b of BANDS) {
    if (marginPct >= b.min) current = b;
  }
  return current;
}
