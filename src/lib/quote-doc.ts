import { formatMoney, formatDate } from "@/lib/format";

/** Starflare's registered company details, shown as the issuer on every document. */
export const STARFLARE_COMPANY = {
  name: "Starflare Ltd",
  addressLines: [
    "3801-C2.D016, 38th Floor, Addax Port Office Tower,",
    "Tamouh, Abu Dhabi, Al Reem Island",
    "United Arab Emirates",
  ],
  tagline: "WHERE CREATOR ECONOMY MEETS AI",
};

/** Inline SVG wordmark (gradient STARFLARE) — self-contained so it renders in
 *  the print/PDF view and in the downloaded Word file without an external asset. */
function starflareLogo(): string {
  return `
    <svg width="230" height="42" viewBox="0 0 230 42" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Starflare">
      <defs>
        <linearGradient id="sfg" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stop-color="#ec4899"/>
          <stop offset="0.5" stop-color="#a21caf"/>
          <stop offset="1" stop-color="#2563eb"/>
        </linearGradient>
      </defs>
      <text x="26" y="32" font-family="'Helvetica Neue',Arial,sans-serif" font-size="34" font-weight="800" letter-spacing="1" fill="url(#sfg)">STARFLARE</text>
      <path d="M2 26 C10 14, 22 12, 30 18" stroke="#ec4899" stroke-width="3.5" fill="none" stroke-linecap="round"/>
      <path d="M20 6 l2 5 l5 2 l-5 2 l-2 5 l-2 -5 l-5 -2 l5 -2 z" fill="#ec4899"/>
    </svg>`;
}

/** The subset of Quotation fields the branded document needs. */
export interface QuoteDocData {
  kind: string; // QUOTATION or INVOICE
  number: string;
  companyName?: string | null;
  brandName?: string | null;
  contactPerson?: string | null;
  clientTrn?: string | null;
  clientEmail?: string | null;
  clientPhone?: string | null;
  clientAddress?: string | null;
  packageType?: string | null;
  packageName?: string | null;
  venues?: number | null;
  coverage?: string | null;
  campaigns?: number | null;
  creators?: number | null;
  creatorType?: string | null;
  subjectLine?: string | null;
  includePackageList: boolean;
  price: number;
  currency: string;
  vatMode: string;
  vatPercent: number;
  paymentMethod?: string | null;
  paymentFrequency?: string | null;
  paymentTerms?: string | null;
  extraLineItems?: string | null;
  initialTerm?: string | null;
  startDate?: Date | string | null;
  autoRenewal: boolean;
  cancellationViaPlatform: boolean;
  refundPolicy?: string | null;
  discount?: string | null;
  exclusivity?: string | null;
  paidMediaIncluded: boolean;
  extraUsageRights: boolean;
  otherNotes?: string | null;
  starflareSignatory?: string | null;
  signatoryTitle?: string | null;
  clientSignatory?: string | null;
  docDate: Date | string;
  validUntil?: Date | string | null;
}

export interface LineItem {
  description: string;
  qty: number;
  rate: number;
}

export function parseExtraLineItems(raw?: string | null): LineItem[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((it) => ({
        description: String(it.description ?? "").trim(),
        qty: Number(it.qty) || 0,
        rate: Number(it.rate) || 0,
      }))
      .filter((it) => it.description.length > 0);
  } catch {
    return [];
  }
}

/** The main package line's sub-description, e.g. "1 venue · 15 campaigns per month · up to 100 creators per month". */
export function packageSummaryLine(q: QuoteDocData): string {
  const parts: string[] = [];
  if (q.venues) parts.push(`${q.venues} venue${q.venues === 1 ? "" : "s"}`);
  if (q.campaigns) parts.push(`${q.campaigns} campaigns per month`);
  if (q.creators) parts.push(`up to ${q.creators} creators per month`);
  return parts.join(" · ");
}

/** The "Package & Platform Access includes" bullet list, derived from the package fields. */
export function packageAccessList(q: QuoteDocData): string[] {
  const list: string[] = [];
  if (q.venues) list.push(`Access for ${q.venues} venue${q.venues === 1 ? "" : "s"}`);
  if (q.campaigns) list.push(`Up to ${q.campaigns} influencer campaigns per month`);
  if (q.creators) list.push(`Collaboration with up to ${q.creators} creators per month`);
  if (q.coverage) list.push(`Creator database coverage: ${q.coverage}`);
  if (q.creatorType) list.push(`Creator tier: ${q.creatorType}`);
  list.push("Access to the Starflare platform");
  list.push("Access to Starflare's creator database");
  list.push("Campaign setup and launch support");
  list.push("Creator communication tools");
  list.push("Campaign management tools");
  list.push("Analytics and performance tracking");
  list.push("Dedicated Account Manager");
  list.push("Starflare team support");
  return list;
}

export interface DocTotals {
  subtotal: number;
  vat: number;
  total: number;
}

export function computeTotals(q: QuoteDocData): DocTotals {
  const extras = parseExtraLineItems(q.extraLineItems).reduce((s, it) => s + it.qty * it.rate, 0);
  const base = (q.price || 0) + extras;
  let subtotal = base;
  let vat = 0;
  const rate = (q.vatPercent || 0) / 100;
  if (q.vatMode === "EXCLUDED") {
    vat = base * rate;
  } else if (q.vatMode === "INCLUDED") {
    // price already includes VAT; split it back out for display
    subtotal = base / (1 + rate);
    vat = base - subtotal;
  }
  return { subtotal, vat, total: subtotal + vat };
}

function esc(s: unknown): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/**
 * Renders the full branded document body (Starflare quotation/invoice layout)
 * as a self-contained HTML string with inline styles. One source of truth used
 * both by the on-screen document view and the downloadable Word (.doc) route,
 * so the printed PDF and the Word file always match.
 */
export function renderQuoteDocBody(q: QuoteDocData): string {
  const title = q.kind === "INVOICE" ? "INVOICE" : "QUOTATION";
  const totals = computeTotals(q);
  const extras = parseExtraLineItems(q.extraLineItems);
  const summary = packageSummaryLine(q);
  const showVat = q.vatMode !== "NONE" && totals.vat > 0;

  const clientLines = [q.contactPerson, q.clientEmail, q.clientPhone, q.clientAddress].filter(Boolean) as string[];

  const startLabel = q.startDate ? formatDate(q.startDate) : null;
  const packageMeta = [q.initialTerm, startLabel ? `from ${startLabel}` : null].filter(Boolean).join(" · ");

  const itemRows: string[] = [];
  itemRows.push(`
    <tr>
      <td style="padding:12px 8px;vertical-align:top;color:#94a3b8;">1</td>
      <td style="padding:12px 8px;vertical-align:top;">
        <div style="font-weight:600;color:#0f172a;">${esc(q.packageType || "Package")}</div>
        ${summary ? `<div style="color:#64748b;font-size:13px;margin-top:2px;">${esc(summary)}</div>` : ""}
      </td>
      <td style="padding:12px 8px;vertical-align:top;text-align:right;">1</td>
      <td style="padding:12px 8px;vertical-align:top;text-align:right;white-space:nowrap;">${esc(formatMoney(q.price, q.currency))}</td>
      <td style="padding:12px 8px;vertical-align:top;text-align:right;white-space:nowrap;">${esc(formatMoney(q.price, q.currency))}</td>
    </tr>`);
  extras.forEach((it, i) => {
    itemRows.push(`
    <tr>
      <td style="padding:12px 8px;vertical-align:top;color:#94a3b8;">${i + 2}</td>
      <td style="padding:12px 8px;vertical-align:top;color:#0f172a;">${esc(it.description)}</td>
      <td style="padding:12px 8px;vertical-align:top;text-align:right;">${it.qty}</td>
      <td style="padding:12px 8px;vertical-align:top;text-align:right;white-space:nowrap;">${esc(formatMoney(it.rate, q.currency))}</td>
      <td style="padding:12px 8px;vertical-align:top;text-align:right;white-space:nowrap;">${esc(formatMoney(it.qty * it.rate, q.currency))}</td>
    </tr>`);
  });

  const accessBullets = q.includePackageList
    ? `<div style="margin-top:24px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:20px 24px;">
        <div style="font-weight:700;color:#0f172a;margin-bottom:10px;">Package &amp; Platform Access includes:</div>
        <ul style="margin:0;padding-left:20px;color:#334155;line-height:1.9;">
          ${packageAccessList(q).map((b) => `<li>${esc(b)}</li>`).join("")}
        </ul>
      </div>`
    : "";

  const payment = `
    <div style="margin-top:28px;">
      <div style="font-size:12px;letter-spacing:.08em;color:#94a3b8;font-weight:700;">PAYMENT</div>
      <div style="color:#334155;margin-top:6px;line-height:1.7;">
        ${[q.paymentMethod ? `Method: ${esc(q.paymentMethod)}` : null, q.paymentFrequency ? `Frequency: ${esc(q.paymentFrequency)}` : null]
          .filter(Boolean)
          .join(" · ")}
        ${q.paymentTerms ? `<div>${esc(q.paymentTerms)}</div>` : ""}
      </div>
    </div>`;

  const term = `
    <div style="margin-top:20px;">
      <div style="font-size:12px;letter-spacing:.08em;color:#94a3b8;font-weight:700;">TERM &amp; RENEWAL</div>
      <div style="color:#334155;margin-top:6px;line-height:1.7;">
        ${[
          q.initialTerm ? `Initial term: ${esc(q.initialTerm)}` : null,
          startLabel ? `Start / activation date: ${esc(startLabel)}` : null,
          `Auto-renewal: ${q.autoRenewal ? "Yes" : "No"}`,
          `Cancellation via the Starflare platform: ${q.cancellationViaPlatform ? "Yes" : "No"}`,
        ]
          .filter(Boolean)
          .join(". ")}.
      </div>
    </div>`;

  const refund =
    q.refundPolicy && q.refundPolicy !== "Not applicable"
      ? `<div style="margin-top:20px;">
          <div style="font-size:12px;letter-spacing:.08em;color:#94a3b8;font-weight:700;">REFUND</div>
          <div style="color:#334155;margin-top:6px;">${esc(q.refundPolicy)}</div>
        </div>`
      : "";

  const specialParts = [
    q.discount ? `Discount: ${esc(q.discount)}` : null,
    q.exclusivity ? `Exclusivity: ${esc(q.exclusivity)}` : null,
    q.paidMediaIncluded ? "Paid media / whitelisting included" : null,
    q.extraUsageRights ? "Extra usage rights included" : null,
    q.otherNotes ? esc(q.otherNotes) : null,
  ].filter(Boolean);
  const special = specialParts.length
    ? `<div style="margin-top:20px;">
        <div style="font-size:12px;letter-spacing:.08em;color:#94a3b8;font-weight:700;">SPECIAL CONDITIONS</div>
        <div style="color:#334155;margin-top:6px;line-height:1.7;">${specialParts.join("<br/>")}</div>
      </div>`
    : "";

  const signatories =
    q.starflareSignatory || q.clientSignatory
      ? `<div style="margin-top:40px;display:flex;justify-content:space-between;gap:40px;">
          <div style="flex:1;">
            <div style="border-top:1px solid #cbd5e1;padding-top:6px;color:#0f172a;">${esc(q.starflareSignatory || "")}</div>
            <div style="color:#94a3b8;font-size:12px;">${esc(q.signatoryTitle || "Starflare")}</div>
          </div>
          <div style="flex:1;">
            <div style="border-top:1px solid #cbd5e1;padding-top:6px;color:#0f172a;">${esc(q.clientSignatory || "")}</div>
            <div style="color:#94a3b8;font-size:12px;">Client</div>
          </div>
        </div>`
      : "";

  return `
  <div style="max-width:820px;margin:0 auto;padding:40px;font-family:'Helvetica Neue',Arial,sans-serif;color:#0f172a;">
    <div style="display:flex;justify-content:space-between;align-items:flex-start;">
      <div>
        ${starflareLogo()}
        <div style="font-size:10px;letter-spacing:.14em;color:#94a3b8;font-weight:700;margin-top:2px;">${STARFLARE_COMPANY.tagline}</div>
        <div style="color:#334155;font-size:12px;margin-top:12px;line-height:1.5;">
          <div style="font-weight:700;color:#0f172a;">${STARFLARE_COMPANY.name}</div>
          ${STARFLARE_COMPANY.addressLines.map((l) => `<div>${esc(l)}</div>`).join("")}
        </div>
      </div>
      <div style="text-align:right;">
        <div style="font-size:26px;font-weight:800;color:#0f172a;">${title}</div>
        <div style="color:#64748b;font-size:13px;margin-top:8px;">No. ${esc(q.number)}</div>
        <div style="color:#64748b;font-size:13px;">Date: ${esc(formatDate(q.docDate))}</div>
        ${q.validUntil ? `<div style="color:#64748b;font-size:13px;">${q.kind === "INVOICE" ? "Due" : "Valid until"}: ${esc(formatDate(q.validUntil))}</div>` : ""}
      </div>
    </div>

    <div style="height:3px;border-radius:3px;background:linear-gradient(90deg,#7c3aed,#ec4899);margin:20px 0 28px;"></div>

    <div style="display:flex;justify-content:space-between;gap:40px;">
      <div style="flex:1;">
        <div style="font-size:12px;letter-spacing:.08em;color:#94a3b8;font-weight:700;">BILL TO</div>
        <div style="font-weight:700;color:#0f172a;margin-top:6px;">${esc(q.companyName || q.brandName || "—")}</div>
        ${clientLines.map((l) => `<div style="color:#334155;">${esc(l)}</div>`).join("")}
        ${q.clientTrn ? `<div style="color:#334155;">TRN: ${esc(q.clientTrn)}</div>` : ""}
      </div>
      <div style="flex:1;text-align:right;">
        <div style="font-size:12px;letter-spacing:.08em;color:#94a3b8;font-weight:700;">PACKAGE</div>
        <div style="font-weight:700;color:#0f172a;margin-top:6px;">${esc(q.packageName || q.packageType || "—")}</div>
        ${packageMeta ? `<div style="color:#64748b;">${esc(packageMeta)}</div>` : ""}
      </div>
    </div>

    ${
      q.subjectLine
        ? `<div style="margin-top:24px;">
            <div style="font-size:12px;letter-spacing:.08em;color:#94a3b8;font-weight:700;">SUBJECT</div>
            <div style="font-weight:700;color:#0f172a;margin-top:4px;">${esc(q.subjectLine)}</div>
          </div>`
        : ""
    }

    <table style="width:100%;border-collapse:collapse;margin-top:24px;font-size:14px;">
      <thead>
        <tr style="background:#f1f5f9;color:#64748b;font-size:12px;letter-spacing:.04em;">
          <th style="padding:10px 8px;text-align:left;font-weight:700;">#</th>
          <th style="padding:10px 8px;text-align:left;font-weight:700;">ITEM &amp; DESCRIPTION</th>
          <th style="padding:10px 8px;text-align:right;font-weight:700;">QTY</th>
          <th style="padding:10px 8px;text-align:right;font-weight:700;">RATE</th>
          <th style="padding:10px 8px;text-align:right;font-weight:700;">AMOUNT</th>
        </tr>
      </thead>
      <tbody>${itemRows.join("")}</tbody>
    </table>

    <div style="margin-top:6px;border-top:2px solid #0f172a;padding-top:14px;display:flex;justify-content:flex-end;">
      <table style="font-size:14px;">
        ${
          showVat
            ? `<tr><td style="padding:4px 24px 4px 0;color:#64748b;">Subtotal</td><td style="padding:4px 0;text-align:right;">${esc(formatMoney(totals.subtotal, q.currency))}</td></tr>
               <tr><td style="padding:4px 24px 4px 0;color:#64748b;">VAT (${q.vatPercent}%)</td><td style="padding:4px 0;text-align:right;">${esc(formatMoney(totals.vat, q.currency))}</td></tr>`
            : ""
        }
        <tr><td style="padding:8px 24px 4px 0;font-weight:800;font-size:16px;">Total</td><td style="padding:8px 0 4px;text-align:right;font-weight:800;font-size:16px;">${esc(formatMoney(totals.total, q.currency))}</td></tr>
      </table>
    </div>

    ${accessBullets}
    ${payment}
    ${term}
    ${refund}
    ${special}
    ${signatories}

    <div style="margin-top:40px;text-align:center;color:#cbd5e1;font-size:11px;">Generated by Starflare ERP</div>
  </div>`;
}

/** A complete standalone HTML document — used by the Word (.doc) download route. */
export function renderQuoteDocFullHtml(q: QuoteDocData): string {
  const title = `${q.kind === "INVOICE" ? "Invoice" : "Quotation"} ${q.number}`;
  return `<!doctype html><html><head><meta charset="utf-8"><title>${esc(title)}</title></head><body style="margin:0;background:#fff;">${renderQuoteDocBody(q)}</body></html>`;
}
