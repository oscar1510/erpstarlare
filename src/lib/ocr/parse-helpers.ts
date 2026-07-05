// Small, dependency-free heuristics for pulling structured fields out of raw
// OCR text. Every extractor returns a value *and* a confidence score so the
// UI can flag anything shaky for manual review instead of silently trusting it.

export interface FieldGuess<T = string> {
  value: T | null;
  confidence: number; // 0..1
  raw?: string;
}

/** A single OCR'd word with its pixel bounding box, used for column-aware extraction. */
export interface OcrWord {
  text: string;
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

/**
 * Two-column invoice headers (Stripe puts the client's "Bill to" block in a
 * right-hand column right next to the sender's own address) get flattened by
 * line-based OCR: reading each row left-to-right glues the client's name onto
 * the end of the sender's address line, so plain text can't separate them
 * (this is exactly why "Bill to" came back empty/wrong before). Word bounding
 * boxes can: the "Bill to" label marks the left edge of the client column, and
 * the client name is the first text line below it that starts at that x.
 */
export function findBilledToClient(words: OcrWord[] | undefined): FieldGuess<string> {
  if (!words || words.length === 0) return { value: null, confidence: 0 };
  const norm = (s: string) => s.toLowerCase().replace(/[^a-z]/g, "");

  let header: OcrWord | null = null;
  for (let i = 0; i < words.length; i++) {
    const t = norm(words[i].text);
    if (t === "billto" || t === "billedto") {
      header = words[i];
      break;
    }
    if (t === "bill" || t === "billed") {
      const next = words[i + 1];
      if (next && norm(next.text) === "to" && Math.abs(next.y0 - words[i].y0) < 15) {
        header = words[i];
        break;
      }
    }
  }
  if (!header) return { value: null, confidence: 0 };

  // Everything in the client column (at/right of the label) and below its line.
  const colLeft = header.x0 - 40; // small tolerance for OCR jitter / left-edge alignment
  const belowY = header.y0 + 12;
  const colWords = words
    .filter((w) => w.x0 >= colLeft && w.y0 >= belowY)
    .sort((a, b) => a.y0 - b.y0 || a.x0 - b.x0);
  if (colWords.length === 0) return { value: null, confidence: 0 };

  // The first line below the header (a y-cluster) is the client name.
  const firstY = colWords[0].y0;
  const name = colWords
    .filter((w) => Math.abs(w.y0 - firstY) < 18)
    .sort((a, b) => a.x0 - b.x0)
    .map((w) => w.text)
    .join(" ")
    .trim();

  // Reject lines that are obviously an address/phone/email rather than a name.
  if (name.length < 2 || /^[+\d]/.test(name) || /@/.test(name)) return { value: null, confidence: 0 };
  return { value: name.slice(0, 60), confidence: 0.75 };
}

const MONTHS: Record<string, number> = {
  jan: 0, january: 0, feb: 1, february: 1, mar: 2, march: 2, apr: 3, april: 3,
  may: 4, jun: 5, june: 5, jul: 6, july: 6, aug: 7, august: 7, sep: 8, sept: 8,
  september: 8, oct: 9, october: 9, nov: 10, november: 10, dec: 11, december: 11,
};

function isValidYMD(y: number, m: number, d: number) {
  if (m < 0 || m > 11) return false;
  if (d < 1 || d > 31) return false;
  if (y < 1990 || y > 2100) return false;
  return true;
}

/** Try many common date formats and return a Date at UTC noon (avoids TZ off-by-one). */
export function parseDateLoose(text: string): Date | null {
  const t = text.trim();

  // YYYY-MM-DD or YYYY/MM/DD
  let m = t.match(/\b(19|20)\d{2}[-/](\d{1,2})[-/](\d{1,2})\b/);
  if (m) {
    const y = parseInt(m[0].slice(0, 4), 10);
    const parts = m[0].slice(4).split(/[-/]/).filter(Boolean).map(Number);
    const [mo, d] = parts;
    if (isValidYMD(y, mo - 1, d)) return new Date(Date.UTC(y, mo - 1, d, 12));
  }

  // DD Month YYYY  (e.g. 5 Jan 2026 / 05 January 2026 / 30 Jan, 2026 / 04-Jul-2026)
  m = t.match(/\b(\d{1,2})[\s-]+([A-Za-z]{3,9})\.?,?[\s-]+((?:19|20)\d{2})\b/);
  if (m) {
    const d = parseInt(m[1], 10);
    const mo = MONTHS[m[2].toLowerCase()];
    const y = parseInt(m[3], 10);
    if (mo !== undefined && isValidYMD(y, mo, d)) return new Date(Date.UTC(y, mo, d, 12));
  }

  // Month DD, YYYY (e.g. January 5, 2026 / Jan 5 2026)
  m = t.match(/\b([A-Za-z]{3,9})\s+(\d{1,2}),?\s+((?:19|20)\d{2})\b/);
  if (m) {
    const mo = MONTHS[m[1].toLowerCase()];
    const d = parseInt(m[2], 10);
    const y = parseInt(m[3], 10);
    if (mo !== undefined && isValidYMD(y, mo, d)) return new Date(Date.UTC(y, mo, d, 12));
  }

  // DD/MM/YYYY or DD-MM-YYYY (day-first, common in UAE) - also accept 2-digit year
  m = t.match(/\b(\d{1,2})[-/.](\d{1,2})[-/.]((?:19|20)?\d{2})\b/);
  if (m) {
    const d = parseInt(m[1], 10);
    const mo = parseInt(m[2], 10);
    let y = parseInt(m[3], 10);
    if (y < 100) y += 2000;
    if (isValidYMD(y, mo - 1, d)) return new Date(Date.UTC(y, mo - 1, d, 12));
    // fall back to month-first (US style) if day-first is invalid
    if (isValidYMD(y, d - 1, mo)) return new Date(Date.UTC(y, d - 1, mo, 12));
  }

  return null;
}

/**
 * Wraps a label so it only matches at a real word start — prevents "Total"
 * from matching inside "Subtotal", "Date" inside "Update", etc. (OCR text has
 * no HTML/markup to anchor on, so this is the main defense against grabbing
 * the wrong labeled value.)
 */
function labelBoundary(label: string): string {
  return "(?<![A-Za-z])(?:" + label + ")";
}

/**
 * The gap allowed between a label and its value: same-line spaces around an
 * optional colon, and at most *one* line break. `\s` alone matches newlines
 * too, so without this a label sitting alone at the end of a line (common
 * right before a blank line in two-column layouts, e.g. "Bill to" over a
 * name/address block) would happily skip a blank line and start capturing from
 * whatever unrelated text comes after it — confirmed against a real invoice
 * where "Bill to" ended up capturing the *other* party's address instead.
 *
 * The leading `[ \t]*` before the colon matters for terminal receipts that
 * write "Amount : 392.00" (space before the colon), not just "Amount:".
 */
const LABEL_GAP = "[ \\t]*:?[ \\t]*\\n?[ \\t]*";

/** Find the best-matching date near a label (e.g. "Invoice Date", "Due Date"). */
export function findLabeledDate(text: string, labels: string[]): FieldGuess<Date> {
  for (const label of labels) {
    const re = new RegExp(labelBoundary(label) + LABEL_GAP + "([^\\n]{4,30})", "i");
    const m = text.match(re);
    if (m) {
      const d = parseDateLoose(m[1]);
      if (d) return { value: d, confidence: 0.85, raw: m[1].trim() };
    }
  }
  // fallback: first date-looking token anywhere
  const lines = text.split(/\n/);
  for (const line of lines) {
    const d = parseDateLoose(line);
    if (d) return { value: d, confidence: 0.35, raw: line.trim() };
  }
  return { value: null, confidence: 0 };
}

const CURRENCY_SYMBOLS: Record<string, string> = {
  "$": "USD",
  "€": "EUR",
  "£": "GBP",
  "aed": "AED",
  "dhs": "AED",
  "dirhams": "AED",
  "د.إ": "AED",
};

export function findCurrency(text: string): FieldGuess<string> {
  const upper = text.toUpperCase();
  for (const code of ["AED", "USD", "EUR", "GBP", "SAR"]) {
    if (new RegExp(`\\b${code}\\b`).test(upper)) return { value: code, confidence: 0.8 };
  }
  const lower = text.toLowerCase();
  for (const [sym, code] of Object.entries(CURRENCY_SYMBOLS)) {
    if (lower.includes(sym)) return { value: code, confidence: 0.6 };
  }
  return { value: "AED", confidence: 0.2 };
}

function toNumber(raw: string): number | null {
  const cleaned = raw.replace(/,/g, "").trim();
  const n = parseFloat(cleaned);
  return Number.isFinite(n) ? n : null;
}

/**
 * Pick the most likely money amount out of a short span of text (a label's
 * line). Prefers numbers written with 2 decimals — real amounts on a receipt
 * ("392.00") — over bare integers, and among those takes the largest. This
 * avoids the classic failure where a stray leading glyph (the AED dirham
 * symbol OCRs as a "8"/"D") gets grabbed as the amount instead of the real
 * "392.00" further along the line.
 */
function bestAmountIn(span: string): number | null {
  // No trailing \b: bank balances are often written "7,928.59Cr" with the
  // Cr/Dr glued on, and a word boundary between "9" and "C" doesn't exist, so
  // \b would clip the cents. A negative lookahead just guards against eating
  // into a longer number.
  const decimals = [...span.matchAll(/[0-9][0-9,]*\.[0-9]{2}(?![0-9])/g)]
    .map((m) => toNumber(m[0]))
    .filter((n): n is number => n !== null);
  if (decimals.length) return Math.max(...decimals);
  const ints = [...span.matchAll(/[0-9][0-9,]*(?![0-9.])/g)]
    .map((m) => toNumber(m[0]))
    .filter((n): n is number => n !== null);
  if (ints.length) return Math.max(...ints);
  return null;
}

/** Look for an amount near a label, e.g. "Total", "Amount Due", "Grand Total". */
export function findLabeledAmount(text: string, labels: string[]): FieldGuess<number> {
  let zeroFallback: FieldGuess<number> | null = null;
  for (const label of labels) {
    // Capture each occurrence of the label together with the rest of its line,
    // then pick the best amount from that line rather than the first token.
    const re = new RegExp(labelBoundary(label) + LABEL_GAP + "([^\\n]{0,40})", "gi");
    const matches = [...text.matchAll(re)];
    if (matches.length === 0) continue;
    // Prefer the last occurrence: totals are conventionally the final labeled
    // line on a receipt/invoice (subtotal/tax lines come first).
    for (let i = matches.length - 1; i >= 0; i--) {
      const n = bestAmountIn(matches[i][1]);
      if (n === null) continue;
      if (n === 0) {
        // A labeled zero (e.g. "Amount due 0.00" on an already-paid invoice)
        // technically matches, but a later label like "Amount Paid"/"Total"
        // almost always carries the real figure — hold it and keep looking.
        zeroFallback ??= { value: 0, confidence: 0.85, raw: matches[i][0].trim() };
        continue;
      }
      return { value: n, confidence: 0.85, raw: matches[i][0].trim() };
    }
  }
  return zeroFallback ?? { value: null, confidence: 0 };
}

/** Fallback: largest currency-like number on the page (low confidence). */
export function findLargestAmount(text: string): FieldGuess<number> {
  const matches = [...text.matchAll(/(?:AED|USD|EUR|GBP|SAR|\$|€|£)\s*([0-9][0-9,]*\.?[0-9]{0,2})/gi)];
  let best: number | null = null;
  let raw = "";
  for (const m of matches) {
    const n = toNumber(m[1]);
    if (n !== null && (best === null || n > best)) {
      best = n;
      raw = m[0];
    }
  }
  if (best !== null) return { value: best, confidence: 0.4, raw };
  // last resort: any decimal number
  const anyNum = [...text.matchAll(/\b([0-9][0-9,]{1,9}\.[0-9]{2})\b/g)];
  for (const m of anyNum) {
    const n = toNumber(m[1]);
    if (n !== null && (best === null || n > best)) best = n;
  }
  return { value: best, confidence: best !== null ? 0.25 : 0 };
}

export function findVAT(text: string): FieldGuess<number> {
  const labeled = findLabeledAmount(text, ["VAT amount", "VAT Amt", "VAT", "Tax amount", "Tax"]);
  if (labeled.value !== null) return labeled;

  // Handle "VAT (5%): 1.48" / "VAT (5%) 1.48" where a percentage sits between the label and the amount.
  const withPct = text.match(
    /(?<![A-Za-z])VAT\s*\(\s*\d{1,2}(?:\.\d+)?\s*%\s*\)\s*[:\s]{0,5}(?:AED|USD|EUR|GBP|SAR|\$|€|£)?\s*([0-9][0-9,]*\.?[0-9]{0,2})/i
  );
  if (withPct) {
    const n = toNumber(withPct[1]);
    if (n !== null) return { value: n, confidence: 0.8, raw: withPct[0].trim() };
  }

  const pct = text.match(/VAT\s*\(?\s*(\d{1,2}(?:\.\d+)?)\s*%\)?/i);
  if (pct) return { value: null, confidence: 0, raw: `${pct[1]}% VAT rate found (no amount)` };
  return { value: null, confidence: 0 };
}

export function findTRN(text: string): FieldGuess<string> {
  let m = text.match(/\bTRN[:\s]*([0-9]{10,15})\b/i);
  if (m) return { value: m[1], confidence: 0.85 };
  m = text.match(/Tax\s*Registration\s*Number[:\s]*([0-9]{10,15})/i);
  if (m) return { value: m[1], confidence: 0.85 };
  m = text.match(/\b(1\d{14})\b/); // UAE TRNs are 15 digits starting with 1
  if (m) return { value: m[1], confidence: 0.5 };
  return { value: null, confidence: 0 };
}

/**
 * Invoices commonly render a "Description | Qty | Unit price | Amount" table
 * header immediately followed by the actual line item(s). A plain
 * findLabeledText(["Description"]) match grabs whatever sits right after the
 * word "Description" — which, when the header row is reconstructed onto a
 * single line (as it is here), is the *rest of the header* ("Qty Unit price
 * Amount"), not the item. This walks past that header row to the first real
 * item line and strips its trailing qty/price/amount columns.
 */
export function findLineItemDescription(text: string): FieldGuess<string> {
  const lines = text.split(/\n/).map((l) => l.trim()).filter(Boolean);
  const headerIdx = lines.findIndex(
    (l) => /^description\b/i.test(l) && /\bqty\b/i.test(l) && /\bamount\b/i.test(l)
  );
  if (headerIdx === -1) return { value: null, confidence: 0 };

  for (let i = headerIdx + 1; i < lines.length; i++) {
    const line = lines[i];
    if (/^(subtotal|total|amount due|tax|vat)\b/i.test(line)) break;
    const cleaned = line
      .replace(/(?:AED|USD|EUR|GBP|SAR|\$|€|£)\s*[0-9][0-9,]*\.?[0-9]{0,2}/gi, "")
      .replace(/\s+\d+(?:\.\d+)?\s*$/, "")
      .trim();
    if (cleaned.length > 1) return { value: cleaned, confidence: 0.6, raw: line };
  }
  return { value: null, confidence: 0 };
}

export function findLabeledText(text: string, labels: string[], maxLen = 60): FieldGuess<string> {
  for (const label of labels) {
    const re = new RegExp(labelBoundary(label) + LABEL_GAP + "([^\\n]{2," + maxLen + "})", "i");
    const m = text.match(re);
    if (m) return { value: m[1].trim(), confidence: 0.7 };
  }
  return { value: null, confidence: 0 };
}

export function findInvoiceNumber(text: string): FieldGuess<string> {
  return findLabeledText(text, [
    "Invoice\\s*(?:No\\.?|Number|#)",
    "Invoice #",
    "Receipt\\s*(?:No\\.?|Number|#)",
    "Ref(?:erence)?\\s*(?:No\\.?|#)",
  ], 30);
}

export function findEmail(text: string): FieldGuess<string> {
  const m = text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
  return m ? { value: m[0], confidence: 0.8 } : { value: null, confidence: 0 };
}

export function findIBAN(text: string): FieldGuess<string> {
  const m = text.match(/\b[A-Z]{2}\d{2}[A-Z0-9]{10,30}\b/);
  return m ? { value: m[0].replace(/\s/g, ""), confidence: 0.75 } : { value: null, confidence: 0 };
}

export function findPassportNumber(text: string): FieldGuess<string> {
  const labeled = findLabeledText(text, ["Passport\\s*(?:No\\.?|Number)"], 20);
  if (labeled.value) return { ...labeled, value: labeled.value.replace(/\s/g, "") };
  const m = text.match(/\b[A-PR-WY][0-9]{7,8}\b/); // rough MRZ-style passport number
  return m ? { value: m[0], confidence: 0.35 } : { value: null, confidence: 0 };
}

export function findEmiratesId(text: string): FieldGuess<string> {
  const m = text.match(/\b784[- ]?\d{4}[- ]?\d{7}[- ]?\d\b/);
  return m ? { value: m[0].replace(/\s/g, ""), confidence: 0.85 } : { value: null, confidence: 0 };
}

/** Suggest an expense category from free text using simple keyword buckets. */
export function suggestExpenseCategory(text: string): FieldGuess<string> {
  const lower = text.toLowerCase();
  const buckets: [string, string[]][] = [
    ["Software", ["subscription", "saas", "license", "software", "aws", "google cloud", "microsoft", "adobe", "notion", "slack", "zoom", "stripe fee"]],
    ["Travel", ["flight", "airline", "airways", "hotel", "booking.com", "airbnb", "taxi", "uber", "careem"]],
    ["Food & Beverage", ["restaurant", "cafe", "coffee", "food", "starbucks", "talabat", "deliveroo", "grocery"]],
    ["Transport", ["fuel", "petrol", "adnoc", "enoc", "parking", "salik", "rta"]],
    ["Bank fee", ["bank charge", "bank fee", "transfer fee", "processing fee"]],
    ["Rent / office", ["rent", "lease", "landlord", "office"]],
    ["Government / tax", ["federal tax authority", "fta", "ministry", "government", "immigration", "adgm", "visa fee", "tasheel"]],
    ["Marketing", ["facebook ads", "instagram", "meta ads", "google ads", "marketing"]],
    ["Legal / admin", ["notary", "legal", "attestation", "law firm"]],
  ];
  for (const [category, keywords] of buckets) {
    if (keywords.some((k) => lower.includes(k))) return { value: category, confidence: 0.55 };
  }
  return { value: "Other", confidence: 0.2 };
}

export function findVendorName(text: string): FieldGuess<string> {
  // Heuristic: the merchant name is almost always one of the first few lines of
  // a receipt — the first line that reads like a name rather than a header, an
  // amount, a contact detail, or OCR noise. We scan a bit deeper and reject
  // more junk than before, since the logo/name line is often preceded by
  // scanner artefacts (e.g. an mangled "network>" line captured verbatim).
  const startLabel = /^(invoice|receipt|tax invoice|simplified|date|time|total|sub[\s-]?total|amount|balance|vat|tax|trn|no\.?|ref|order|table|qty|cash|card|change|tel|phone|fax|mob|bill to|www\.|http)/i;
  const junk = /[<>@{}]|www\.|https?:|\.com|\.ae\b/i; // markup / OCR noise / URLs are never the merchant name
  const lines = text
    .split(/\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 1 && l.length <= 42);

  for (const line of lines.slice(0, 12)) {
    if (startLabel.test(line)) continue;
    if (junk.test(line)) continue;
    if (/^[0-9\s.,:/'"()#*+_=-]+$/.test(line)) continue; // no letters at all
    const letters = (line.match(/[A-Za-z]/g) || []).length;
    if (letters < 3 || letters / line.length < 0.4) continue; // too few letters to be a name
    return { value: line, confidence: 0.45 };
  }
  return { value: null, confidence: 0 };
}
