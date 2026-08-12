// ---------------------------------------------------------------------------
// Core data model. Deliberately tiny — this is a calculator, not an ERP.
// Everything is persisted to the browser's localStorage; there is no backend.
// ---------------------------------------------------------------------------

/** A single sellable product in the catalog (built from the two uploaded files). */
export interface Product {
  id: string;
  sku: string; // real SKU if the file had one, otherwise a derived key
  name: string; // customer-facing display name (may include colour/fabric)
  retail: number; // retail price, AED, excl. VAT
  cost: number; // INTERNAL production/landing cost, AED — never shown to customers
  costMatched: boolean; // false if we couldn't match a cost and defaulted it
}

/** A product line inside an order. */
export interface LineItem {
  id: string;
  productId: string;
  name: string; // snapshot of product name (so edits survive catalog replacement)
  retail: number; // snapshot retail price
  cost: number; // snapshot internal cost
  quantity: number;
  discountPct: number;
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
