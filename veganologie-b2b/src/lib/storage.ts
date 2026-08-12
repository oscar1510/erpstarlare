import type { Order, Product, OrderOptions, QuotationDetails, Customer } from "../types";

// Everything persists to localStorage — no server, no database.
const K_CATALOG = "vg_catalog_v1";
const K_ORDERS = "vg_orders_v1";
const K_COUNTER = "vg_quote_counter_v1";

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}
function write(key: string, value: unknown) {
  localStorage.setItem(key, JSON.stringify(value));
}

// --- catalog ---
export function loadCatalog(): Product[] {
  return read<Product[]>(K_CATALOG, []);
}
export function saveCatalog(products: Product[]) {
  write(K_CATALOG, products);
}

// --- orders ---
export function loadOrders(): Order[] {
  return read<Order[]>(K_ORDERS, []).sort((a, b) =>
    b.updatedAt.localeCompare(a.updatedAt),
  );
}
export function saveOrder(order: Order) {
  const all = read<Order[]>(K_ORDERS, []);
  const idx = all.findIndex((o) => o.id === order.id);
  if (idx >= 0) all[idx] = order;
  else all.push(order);
  write(K_ORDERS, all);
}
export function deleteOrder(id: string) {
  write(
    K_ORDERS,
    read<Order[]>(K_ORDERS, []).filter((o) => o.id !== id),
  );
}

// --- quotation numbers: VG-CPP-<year>-#### ---
export function nextQuotationNumber(): string {
  const year = new Date().getFullYear();
  const counter = read<Record<string, number>>(K_COUNTER, {});
  const next = (counter[year] || 0) + 1;
  counter[year] = next;
  write(K_COUNTER, counter);
  return `VG-CPP-${year}-${String(next).padStart(3, "0")}`;
}

// --- factories ---
export function newId(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

export function emptyCustomer(): Customer {
  return { customerName: "", companyName: "", address: "", phone: "", email: "" };
}

export function defaultOptions(): OrderOptions {
  return {
    packaging: {
      kind: "veganologie",
      costPerBox: 0,
      numBoxes: 0,
      charged: false,
      sellingPrice: 0,
      label: "Custom Branded Gift Box",
    },
    logo: {
      kind: "veganologie",
      cost: 0,
      charged: false,
      sellingPrice: 0,
      label: "Custom Logo Branding",
    },
    shipping: { kind: "included", cost: 0 },
  };
}

// Sensible Veganologie defaults, pre-filled from the sample proposal. All
// editable before the quotation is generated.
export function defaultDetails(): QuotationDetails {
  return {
    leadTimes: "Standard stock items: 1 – 2 weeks\nCustom gift boxes & branding: 4 – 6 weeks",
    validForDays: 7,
    colourNote: "All units in Veganologie signature forest green.",
    packagingNote: "Veganologie signature packaging.",
    whatsIncluded: [
      "All products in Veganologie's signature forest green with existing branding",
      "Co-branded story card in every box",
      "ESG Impact Certificate — CO₂ avoided, water conserved, trees planted — formatted for CSR reporting",
      "Mangrove tree planting on the UAE coastline (1 tree per 10 units) via Goumbook",
      "Delivery included",
    ].join("\n"),
    materials: "USDA-certified biobased bamboo fibre and Italian apple leather, depending on line.",
    certifications: "GRS | PETA-Approved Vegan | USDA Certified Biobased | OEKO-TEX",
    terms: [
      "50% deposit upon confirmation; balance due before delivery",
      "All prices in AED",
      "Lead times commence from deposit receipt and approval of all designs",
    ].join("\n"),
  };
}
