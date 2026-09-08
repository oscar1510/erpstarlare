// ---------------------------------------------------------------------------
// Core data model. Deliberately tiny — this is a calculator, not an ERP.
// Everything is persisted to the browser's localStorage; there is no backend.
// ---------------------------------------------------------------------------

/** A single sellable product in the catalog (built from the two uploaded files).
 *  `priceExcl` is the canonical price EXCLUDING VAT — all profit/margin maths use
 *  it. The VAT-inclusive price is always priceExcl × 1.05 (see lib/calc). */
export interface Product {
  id: string;
  sku: string; // real SKU if the file had one, otherwise a derived key
  name: string; // customer-facing display name (may include colour/fabric)
  priceExcl: number; // unit price EXCLUDING 5% VAT, AED
  cost: number; // INTERNAL production/landing cost, AED — never shown to customers
  costMatched: boolean; // false if we couldn't match a cost and defaulted it
}

/** A product line inside an order. */
export interface LineItem {
  id: string;
  productId: string;
  name: string; // snapshot of product name (so edits survive catalog replacement)
  priceExcl: number; // snapshot unit price excl. VAT
  cost: number; // snapshot internal cost
  quantity: number;
  discountPct: number;
}

/** Whether the user is viewing/entering prices with or without VAT. Internally
 *  everything is stored excl. VAT; this only changes what is displayed. */
export type VatMode = "excl" | "incl";

export interface AppSettings {
  vatMode: VatMode;
  /** Custom brand logo (PNG data URL) shown in the app header and on the PDF,
   *  replacing the built-in mark + wordmark. Uploaded by the user, stored in
   *  their browser. */
  logoDataUrl?: string;
  logoAspect?: number; // width / height, for sizing without distortion
}

export type PackagingKind = "veganologie" | "custom";
export type LogoKind = "veganologie" | "custom";
export type ShippingKind = "included" | "not";

export interface OrderOptions {
  packaging: {
    kind: PackagingKind;
    costPerBox: number;
    numBoxes: number;
    charged: boolean;
    sellingPrice: number; // total charged to customer (if charged)
    label: string; // line label on the quotation, e.g. "Custom Branded Gift Box"
  };
  logo: {
    kind: LogoKind;
    cost: number;
    charged: boolean;
    sellingPrice: number; // amount charged to customer (if charged)
    label: string;
  };
  shipping: {
    kind: ShippingKind;
    cost: number; // internal cost only, included in profitability, not charged
  };
}

export interface Customer {
  customerName: string;
  companyName: string;
  address: string;
  phone: string;
  email: string;
}

/** Editable commercial copy that appears on the customer quotation. */
export interface QuotationDetails {
  leadTimes: string;
  validForDays: number;
  colourNote: string;
  packagingNote: string;
  whatsIncluded: string; // one bullet per line
  materials: string; // one line per product/material note
  certifications: string; // e.g. "GRS | PETA-Approved Vegan | ..."
  terms: string; // one bullet per line
  showVat: boolean; // if true, add the VAT 5% + incl-VAT total lines on the PDF
}

export interface Order {
  id: string;
  quotationNumber: string;
  createdAt: string; // ISO
  updatedAt: string; // ISO
  customer: Customer;
  lines: LineItem[];
  options: OrderOptions;
  details: QuotationDetails;
}

/** Computed profitability figures (all INTERNAL except where noted). */
export interface Profitability {
  retailValue: number; // sum of retail * qty (before discount)
  totalDiscount: number; // retailValue - product revenue
  productRevenue: number; // sum of final line totals
  extraRevenue: number; // packaging/logo amounts charged to customer
  totalRevenue: number; // excl. VAT — the customer-facing subtotal
  productCost: number;
  packagingCost: number;
  logoCost: number;
  shippingCost: number;
  totalCost: number;
  profit: number;
  marginPct: number;
  vat: number; // 5% of totalRevenue
  totalWithVat: number;
}
