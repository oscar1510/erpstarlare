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
export interface BilledToDetails {
  name: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  trn: string | null;
}

/**
 * Reconstruct the whole "Bill to" column from word boxes: the client's name
 * (first line), then the address/phone/email lines beneath it. Line-based OCR
 * merges this column with the sender's own address, so we anchor on the "Bill
 * to" label's x-position and keep only words in that column, grouped into
 * lines by their y-position.
 */
export function findBilledToDetails(words: OcrWord[] | undefined): BilledToDetails {
  const empty: BilledToDetails = { name: null, address: null, phone: null, email: null, trn: null };
  if (!words || words.length === 0) return empty;
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
  if (!header) return empty;

  const colLeft = header.x0 - 40; // tolerance for OCR jitter / left-edge alignment
  // Only the client column, and stop well before the totals/table area lower down.
  const colWords = words
    .filter((w) => w.x0 >= colLeft && w.y0 >= header.y0 + 12 && w.y0 < header.y0 + 220)
    .sort((a, b) => a.y0 - b.y0 || a.x0 - b.x0);
  if (colWords.length === 0) return empty;

  // Group column words into lines by y-cluster.
  const lines: string[] = [];
  let cur: OcrWord[] = [];
  let lastY = colWords[0].y0;
  for (const w of colWords) {
    if (Math.abs(w.y0 - lastY) > 18 && cur.length) {
      lines.push(cur.sort((a, b) => a.x0 - b.x0).map((x) => x.text).join(" ").trim());
      cur = [];
    }
    cur.push(w);
    lastY = w.y0;
  }
  if (cur.length) lines.push(cur.sort((a, b) => a.x0 - b.x0).map((x) => x.text).join(" ").trim());

  const cleaned = lines.map((l) => l.trim()).filter(Boolean);
  if (cleaned.length === 0) return empty;

  // First line is the name (unless it's obviously an address/phone/email).
  let name: string | null = cleaned[0];
  if (name.length < 2 || /^[+\d]/.test(name) || /@/.test(name)) name = null;
  const rest = name ? cleaned.slice(1) : cleaned;

  const email = rest.find((l) => /@/.test(l))?.match(/[^\s]+@[^\s]+/)?.[0] ?? null;
  const phone = rest.find((l) => /\+?\d[\d\s-]{6,}\d/.test(l))?.match(/\+?\d[\d\s-]{6,}\d/)?.[0]?.trim() ?? null;
  const columnText = cleaned.join("\n");
  const trn = findTRN(columnText).value;
  const address =
    rest
      .filter((l) => !/@/.test(l) && !/^\+?\d[\d\s-]{6,}\d$/.test(l.trim()))
      .join(", ")
      .slice(0, 160) || null;

  return { name: name ? name.slice(0, 60) : null, address, phone, email, trn };
}

/** Back-compat helper: just the "Bill to" client name from word boxes. */
export function findBilledToClient(words: OcrWord[] | undefined): FieldGuess<string> {
  const d = findBilledToDetails(words);
  return d.name ? { value: d.name, confidence: 0.75 } : { value: null, confidence: 0 };
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
  let m = t.match(/\b(19|20)\d{2}[-/](\d{1,2})[-/](\d{1,2})(?![0-9])/);
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

  // DD/MM/YYYY or DD-MM-YYYY (day-first, common in UAE) - also accept 2-digit year.
  // Trailing (?![0-9]) instead of \b so a date glued to the next token (e.g.
  // "04-07-2026Time" on a thermal receipt) still parses.
  m = t.match(/\b(\d{1,2})[-/.](\d{1,2})[-/.]((?:19|20)?\d{2})(?![0-9])/);
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
 * The latest valid date anywhere in the text. Useful for licenses/registrations
 * where the expiry is always the furthest-future date on the document — handy
 * when the "Expiry" label itself is worded unpredictably.
 */
export function findLatestDate(text: string): Date | null {
  let latest: Date | null = null;
  for (const line of text.split(/\n/)) {
    // scan each whitespace-separated token window so multiple dates on a line are seen
    const d = parseDateLoose(line);
    if (d && (!latest || d > latest)) latest = d;
  }
  return latest;
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

// A single date token in the common written forms.
const DATE_TOKEN_RE =
  /\b(\d{1,2}[/.\-]\d{1,2}[/.\-](?:19|20)\d{2}|(?:19|20)\d{2}[/.\-]\d{1,2}[/.\-]\d{1,2}|\d{1,2}[ -][A-Za-z]{3,9}\.?[ -](?:19|20)\d{2})\b/;

/**
 * Finds the first date that appears *after* a label, scanning across newlines
 * and non-Latin text. UAE/GCC ID cards and licences print bilingual labels
 * where the date sits after Arabic text and/or on the next line
 * ("Expiry Date / تاريخ الانتهاء\n07/10/2026") — findLabeledDate can't reach it
 * because it stops at the newline, so this dedicated scan is used for IDs.
 */
export function findDateForLabel(text: string, labels: string[]): FieldGuess<Date> {
  for (const label of labels) {
    const re = new RegExp(labelBoundary(label), "i");
    const m = re.exec(text);
    if (!m) continue;
    const window = text.slice(m.index + m[0].length, m.index + m[0].length + 90);
    const dm = window.match(DATE_TOKEN_RE);
    if (dm) {
      const d = parseDateLoose(dm[1]);
      if (d) return { value: d, confidence: 0.8, raw: dm[1] };
    }
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

/**
 * Parse a single money token in either US ("9,940.98", "135.00") or European
 * ("9.940,98", "135,00") notation. When both separators are present the last
 * one is the decimal point; when only a comma is present it's a decimal point
 * if it's followed by 1–2 digits (135,00) and a thousands separator otherwise
 * (1,234). This is what lets Italian/EU receipts and UAE receipts both parse.
 */
export function parseMoneyToken(tok: string): number | null {
  let t = tok.replace(/[^\d.,]/g, "");
  if (!/\d/.test(t)) return null;
  const lastDot = t.lastIndexOf(".");
  const lastComma = t.lastIndexOf(",");
  if (lastDot >= 0 && lastComma >= 0) {
    if (lastComma > lastDot) t = t.replace(/\./g, "").replace(",", "."); // 9.940,98 → 9940.98
    else t = t.replace(/,/g, ""); // 9,940.98 → 9940.98
  } else if (lastComma >= 0) {
    const after = t.length - lastComma - 1;
    t = after >= 1 && after <= 2 ? t.replace(",", ".") : t.replace(/,/g, "");
  } else if (lastDot >= 0) {
    const after = t.length - lastDot - 1;
    if (after === 3 && /^\d{1,3}\.\d{3}$/.test(t)) t = t.replace(/\./g, ""); // 1.234 thousands
  }
  const n = parseFloat(t);
  return Number.isFinite(n) ? n : null;
}

function toNumber(raw: string): number | null {
  return parseMoneyToken(raw);
}

// A run of digits with optional thousands/decimal separators, e.g. 9,940.98 or 135,00.
const MONEY_TOKEN_RE = /\d[\d.,]*\d|\d/g;
// Lines that carry a *balance*, not a transaction amount — never the amount we want.
const BALANCE_LINE_RE = /balance|available|avl\b|saldo|disponibile|closing|opening/i;

/**
 * Pick the most likely money amount out of a short span of text (a label's
 * line). Prefers tokens written with 2 decimals (real amounts like "392.00" /
 * "135,00") over bare integers, and among those takes the largest — so a stray
 * leading glyph (the dirham symbol OCRs as "8"/"D") never wins over the real
 * total further along the line.
 */
function bestAmountIn(span: string): number | null {
  const toks = [...span.matchAll(MONEY_TOKEN_RE)].map((m) => m[0]);
  const withDecimals = toks.filter((t) => /[.,]\d{2}$/.test(t)).map(parseMoneyToken).filter((n): n is number => n !== null);
  if (withDecimals.length) return Math.max(...withDecimals);
  const all = toks.map(parseMoneyToken).filter((n): n is number => n !== null);
  return all.length ? Math.max(...all) : null;
}

/** Look for an amount near a label, e.g. "Total", "Amount Due", "Grand Total". */
export function findLabeledAmount(text: string, labels: string[]): FieldGuess<number> {
  let zeroFallback: FieldGuess<number> | null = null;
  for (const label of labels) {
    // When searching for the *total*, a bare "Amount"/"Total" must not match the
    // VAT/tax line ("VAT Amount: 9.05", "Tax Total"): that would report the tax
    // as the amount. Skip a match whose label is immediately preceded by a
    // VAT/tax word — unless we're deliberately looking for the VAT itself.
    const isVatLabel = /vat|tax|iva|tva|gst/i.test(label);
    // Capture each occurrence of the label together with the rest of its line,
    // then pick the best amount from that line rather than the first token.
    const re = new RegExp(labelBoundary(label) + LABEL_GAP + "([^\\n]{0,40})", "gi");
    const matches = [...text.matchAll(re)];
    if (matches.length === 0) continue;
    // Prefer the last occurrence: totals are conventionally the final labeled
    // line on a receipt/invoice (subtotal/tax lines come first).
    for (let i = matches.length - 1; i >= 0; i--) {
      if (!isVatLabel) {
        const before = text.slice(Math.max(0, (matches[i].index ?? 0) - 8), matches[i].index ?? 0);
        if (/(?:VAT|Tax|GST|IVA|TVA|Serv(?:ice)?)\s*$/i.test(before)) continue; // this is the tax line, not the total
      }
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

const CURRENCY_PREFIX_RE = "(?:AED|USD|EUR|GBP|SAR|Dhs?|DH|Rs|₹|\\$|€|£)";

/**
 * Bank/POS transaction alerts and card receipts state the amount right after a
 * keyword ("Purchase of AED 39.07", "You spent USD 5", "Payment of €12,50").
 * This grabs that amount specifically, which matters because the same message
 * usually also prints the account balance ("Avl Balance AED 9,940.98") — a much
 * larger number that a naive "largest amount" would wrongly pick as the spend.
 */
export function findTransactionAmount(text: string): FieldGuess<number> {
  const re = new RegExp(
    "(?:purchase|payment|paid|spent|debited|charged|withdrawn|withdrawal|transaction|txn|amount)\\b[^\\d\\n]{0,15}" +
      CURRENCY_PREFIX_RE +
      "?\\s*([0-9][0-9.,]*[0-9]|[0-9])",
    "i"
  );
  const m = text.match(re);
  if (m) {
    const n = parseMoneyToken(m[1]);
    if (n !== null && n > 0) return { value: n, confidence: 0.85, raw: m[0].trim() };
  }
  return { value: null, confidence: 0 };
}

/** The merchant in a bank alert / card receipt: the name after "at". */
export function findBankMerchant(text: string): FieldGuess<string> {
  const m = text.match(/\bat\s+([A-Z0-9][A-Za-z0-9 &'.\-]{2,40}?)(?:\s*[,.]|\s+(?:Abu Dhabi|Dubai|Sharjah|UAE)\b|\n|$)/);
  if (m) {
    const name = m[1].trim().replace(/\s+/g, " ");
    if (name.length >= 3) return { value: name, confidence: 0.7 };
  }
  return { value: null, confidence: 0 };
}

/** Fallback: largest currency-like number on the page, ignoring balance lines. */
export function findLargestAmount(text: string): FieldGuess<number> {
  let best: number | null = null;
  let raw = "";
  for (const line of text.split(/\n/)) {
    if (BALANCE_LINE_RE.test(line)) continue; // a running/available balance is not the spend
    const withCur = [...line.matchAll(new RegExp(CURRENCY_PREFIX_RE + "\\s*([0-9][0-9.,]*[0-9])", "gi"))];
    const pool = withCur.length ? withCur.map((m) => m[1]) : [...line.matchAll(/[0-9][0-9.,]*[.,][0-9]{2}(?![0-9])/g)].map((m) => m[0]);
    for (const tok of pool) {
      const n = parseMoneyToken(tok);
      if (n !== null && (best === null || n > best)) {
        best = n;
        raw = tok;
      }
    }
  }
  return { value: best, confidence: best !== null ? 0.4 : 0, raw };
}

export function findVAT(text: string): FieldGuess<number> {
  // "di cui IVA" (Italian), "TVA" (French), "VAT"/"Tax" (English).
  const labeled = findLabeledAmount(text, ["VAT amount", "VAT Amt", "VAT", "di cui IVA", "IVA", "TVA", "Tax amount", "Tax"]);
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

// Company/legal-form suffixes — a line with one of these is almost certainly the
// merchant's registered name (strongest signal).
const COMPANY_SUFFIX_RE = /\b(?:L\.?L\.?C|LTD|LIMITED|INC|LLP|PLC|FZE|FZCO|FZ-?LLC|EST|W\.?L\.?L|RETAIL|TRADING|GROUP|COMPANY|CO|ENTERPRISES?|INDUSTRIES|HOLDINGS?)\b/i;
// Merchant-type / well-known-brand words (second-strongest signal).
const MERCHANT_HINT_RE = /\b(?:RESTAURANT|CAFE|COFFEE|SUPERMARKET|HYPERMARKET|PHARMACY|STATION|STORES?|MARKET|BAKERY|GRILL|KITCHEN|ENOC|ADNOC|EPPCO|CARREFOUR|LULU|SPINNEYS|CHOITHRAMS|TALABAT|NOON|AMAZON|APPLE|IKEA|SALON|CLINIC|HOSPITAL)\b/i;

/** A cleaned-up line that plausibly reads as a real business name. */
function looksLikeVendorLine(line: string): boolean {
  // Reject headers / labels / totals / contact lines.
  if (/^(invoice|receipt|tax invoice|simplified|date|time|total|sub[\s-]?total|amount|balance|vat|tax|trn|no\.?|ref|order|table|qty|cash|card|change|tel|phone|fax|mob|bill to|www\.|http|purchase|approved|approval|merchant|terminal|batch|source|pump|site id|stan|aid|label)/i.test(line)) return false;
  // Reject markup / URL / OCR-symbol noise (=, |, \, etc. never appear in real names).
  if (/[<>@{}=|\\~^`]|www\.|https?:|\.com|\.ae\b/i.test(line)) return false;
  // Must contain a real word: a run of ≥3 letters (kills logo garbage like "c=lgil", "lIgiI").
  if (!/[A-Za-z]{3,}/.test(line)) return false;
  const letters = (line.match(/[A-Za-z]/g) || []).length;
  if (letters / line.length < 0.45) return false; // mostly symbols/digits → not a name
  return true;
}

export function findVendorName(text: string): FieldGuess<string> {
  // The merchant name sits in the first several lines of a receipt, but the very
  // top is often a logo that OCRs to garbage. So we gather the first clean,
  // name-like lines and prefer the one that looks most like a registered
  // business (a legal suffix like LLC/RETAIL, then a merchant/brand word),
  // falling back to the first clean line otherwise.
  const candidates = text
    .split(/\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 1 && l.length <= 42)
    .slice(0, 14)
    .filter(looksLikeVendorLine);

  if (candidates.length === 0) return { value: null, confidence: 0 };

  const withSuffix = candidates.find((l) => COMPANY_SUFFIX_RE.test(l));
  if (withSuffix) return { value: withSuffix.replace(/\s+/g, " "), confidence: 0.7 };

  const withHint = candidates.find((l) => MERCHANT_HINT_RE.test(l));
  if (withHint) return { value: withHint.replace(/\s+/g, " "), confidence: 0.6 };

  return { value: candidates[0].replace(/\s+/g, " "), confidence: 0.45 };
}
