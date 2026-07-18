import {
  FieldGuess,
  OcrWord,
  findBankMerchant,
  findBilledToDetails,
  findCurrency,
  findDateForLabel,
  parseMrzDates,
  findTransactionAmount,
  findEmail,
  findEmiratesId,
  findIBAN,
  findInvoiceNumber,
  findLabeledAmount,
  findLabeledDate,
  findLabeledText,
  findLargestAmount,
  findLineItemDescription,
  findLatestDate,
  findPassportNumber,
  findTRN,
  findVAT,
  findVendorName,
  parseDateLoose,
  suggestExpenseCategory,
} from "./parse-helpers";

export type ExtractedFields = Record<string, FieldGuess<any>>;

/** Average confidence across all extracted fields that actually found a value. */
export function averageConfidence(fields: ExtractedFields): number {
  const withValues = Object.values(fields).filter((f) => f.value !== null && f.value !== undefined);
  if (withValues.length === 0) return 0;
  return withValues.reduce((sum, f) => sum + f.confidence, 0) / withValues.length;
}

export function serializeFields(fields: ExtractedFields) {
  const out: Record<string, { value: any; confidence: number; raw?: string }> = {};
  for (const [k, v] of Object.entries(fields)) {
    out[k] = {
      value: v.value instanceof Date ? v.value.toISOString() : v.value,
      confidence: v.confidence,
      raw: v.raw,
    };
  }
  return JSON.stringify(out);
}

export function extractReceiptFields(text: string): ExtractedFields {
  // Amount priority: a labeled total (incl. Italian "Totale", French "Total"),
  // then a bank/POS "Purchase of X" pattern (which also avoids grabbing the
  // account balance), then the largest non-balance number on the page.
  const labeledAmount = findLabeledAmount(text, [
    "Total\\s*Amount",
    "Grand Total",
    "Totale\\s*Complessivo",
    "Total",
    "Totale",
    "Importo\\s*Pagato",
    "Importo",
    "Amount Due",
    "Amount",
    "Montant",
  ]);
  const txnAmount = findTransactionAmount(text);
  const amount = labeledAmount.value !== null ? labeledAmount : txnAmount.value !== null ? txnAmount : findLargestAmount(text);

  // Vendor: a bank alert names the merchant after "at ..."; otherwise the
  // merchant is a header line.
  const merchant = findBankMerchant(text);
  const vendor = merchant.value ? merchant : findVendorName(text);

  return {
    vendor,
    date: findLabeledDate(text, ["Date", "Transaction Date", "Receipt Date", "Data"]),
    amount,
    currency: findCurrency(text),
    vat: findVAT(text),
    taxRegNumber: findTRN(text),
    paymentMethod: findLabeledText(text, ["Payment Method", "Paid By", "Card"], 20),
    receiptNumber: findInvoiceNumber(text),
    description: findLabeledText(text, ["Description", "Item"], 60),
    categorySuggestion: suggestExpenseCategory(text),
  };
}

export function extractReceivedInvoiceFields(text: string): ExtractedFields {
  const amount = findLabeledAmount(text, ["Total Due", "Balance Due", "Grand Total", "Total", "Amount Due"]);
  return {
    vendorName: findVendorName(text),
    invoiceNumber: findInvoiceNumber(text),
    invoiceDate: findLabeledDate(text, ["Invoice Date", "Date Issued", "Date"]),
    dueDate: findLabeledDate(text, ["Due Date", "Payment Due", "Due"]),
    amount: amount.value !== null ? amount : findLargestAmount(text),
    vat: findVAT(text),
    currency: findCurrency(text),
    description: findLabeledText(text, ["Description", "For", "Service"], 80),
    taxRegNumber: findTRN(text),
  };
}

export function extractStripeInvoiceFields(text: string, words?: OcrWord[]): ExtractedFields {
  const amount = findLabeledAmount(text, ["Amount Due", "Amount Paid", "Total", "Total Due"]);
  const paidMatch = /\bpaid\b/i.test(text) && !/\bnot\s+paid\b/i.test(text);
  // Prefer column-aware extraction from word boxes (handles Stripe's two-column
  // "Bill to" block — name, address, phone, TRN); fall back to flat-text label
  // matches when boxes aren't available (a born-digital PDF read via its text layer).
  const billed = findBilledToDetails(words);
  const g = <T,>(value: T | null, confidence: number): FieldGuess<T> => ({ value, confidence });
  return {
    clientName: billed.name
      ? g(billed.name, 0.75)
      : findLabeledText(text, ["Bill to", "Customer", "Billed to"], 60),
    clientEmail: billed.email ? g(billed.email, 0.75) : findEmail(text),
    clientPhone: g(billed.phone, billed.phone ? 0.7 : 0),
    clientAddress: g(billed.address, billed.address ? 0.65 : 0),
    clientTrn: g(billed.trn, billed.trn ? 0.7 : 0),
    amount: amount.value !== null ? amount : findLargestAmount(text),
    currency: findCurrency(text),
    invoiceDate: findLabeledDate(text, ["Date of issue", "Invoice date", "Date"]),
    dueDate: findLabeledDate(text, ["Due date", "Date due"]),
    invoiceNumber: findInvoiceNumber(text),
    description: (() => {
      const lineItem = findLineItemDescription(text);
      return lineItem.value !== null ? lineItem : findLabeledText(text, ["Description"], 100);
    })(),
    isPaid: { value: paidMatch, confidence: paidMatch ? 0.7 : 0.4 } as FieldGuess<boolean>,
  };
}

// Common UAE / international banks, matched to a clean display name so the
// bank column doesn't end up showing a fragment of the legal disclaimer.
const KNOWN_BANKS: [RegExp, string][] = [
  [/RAKBANK|Ras Al Khaimah/i, "RAKBANK"],
  [/Emirates NBD/i, "Emirates NBD"],
  [/\bADCB\b|Abu Dhabi Commercial/i, "ADCB"],
  [/\bFAB\b|First Abu Dhabi/i, "First Abu Dhabi Bank"],
  [/Mashreq/i, "Mashreq"],
  [/\bADIB\b|Abu Dhabi Islamic/i, "ADIB"],
  [/Dubai Islamic|\bDIB\b/i, "Dubai Islamic Bank"],
  [/Emirates Islamic/i, "Emirates Islamic"],
  [/\bHSBC\b/i, "HSBC"],
  [/Standard Chartered/i, "Standard Chartered"],
  [/\bWIO\b/i, "Wio Bank"],
  [/Commercial Bank of Dubai|\bCBD\b/i, "Commercial Bank of Dubai"],
];

export function extractBankStatementFields(text: string): ExtractedFields {
  let bankName = findLabeledText(text, ["Bank Name"], 40);
  if (!bankName.value) {
    const hit = KNOWN_BANKS.find(([re]) => re.test(text));
    if (hit) bankName = { value: hit[1], confidence: 0.8 };
  }

  // Statements usually give the period on one line ("... 30-Nov-2025 to
  // 31-Dec-2025"), not as separate From/To labels — parse both ends at once.
  let periodStart = findLabeledDate(text, ["Statement Period From", "Period From"]);
  let periodEnd = findLabeledDate(text, ["Statement Period To", "Period To"]);
  const span = text.match(/(?:Statement\s*Period|Period)[:\s]+([0-9A-Za-z][0-9A-Za-z/.\- ]{4,20}?)\s+(?:to|-|–|—)\s+([0-9A-Za-z][0-9A-Za-z/.\- ]{4,20})/i);
  if (span) {
    const s = parseDateLoose(span[1]);
    const e = parseDateLoose(span[2]);
    if (s) periodStart = { value: s, confidence: 0.85, raw: span[1].trim() };
    if (e) periodEnd = { value: e, confidence: 0.85, raw: span[2].trim() };
  }

  return {
    bankName,
    accountName: findLabeledText(text, ["Account Name", "Account Holder", "Account Title"], 40),
    accountNumber: findLabeledText(text, ["Account Number", "Account No", "A/C No"], 30),
    iban: findIBAN(text),
    periodStart,
    periodEnd,
    openingBalance: findLabeledAmount(text, ["Opening Balance", "Balance Brought Forward"]),
    closingBalance: findLabeledAmount(text, ["Closing Balance", "Balance Carried Forward", "Ending Balance"]),
  };
}

export interface ParsedTransactionLine {
  date: Date | null;
  description: string;
  moneyIn: number;
  moneyOut: number;
  balanceAfter: number | null;
  confidence: number;
}

// A statement row starts with a date. Supports numeric (DD/MM/YYYY),
// ISO (YYYY-MM-DD) and month-name (03-DEC-2025 / 04 Jul 2026) forms.
const ROW_DATE = /^(\d{1,2}[-/.]\d{1,2}[-/.](?:19|20)?\d{2}|(?:19|20)\d{2}[-/]\d{1,2}[-/]\d{1,2}|\d{1,2}[ -][A-Za-z]{3,9}\.?[ -](?:19|20)?\d{2})\b/;
const MONEY = /-?[0-9][0-9,]*\.[0-9]{2}/g;

/**
 * Parses statement transactions robustly across two common layouts:
 *   1. One row per line: `DATE  DESCRIPTION  AMOUNT  [BALANCE]`.
 *   2. Multi-line blocks (e.g. RAKBANK): the date on its own line, then a few
 *      description lines, then an `AMOUNT  BALANCECr` line — everything from
 *      one date line up to the next date line is one transaction.
 *
 * Debit vs credit is derived from the running-balance delta versus the
 * previous row (or the statement's opening balance for the first row), which
 * is reliable no matter whether the bank prints debits/credits as separate
 * columns or a single signed amount. The last money value in a block is taken
 * as the running balance and the one before it as the transaction amount.
 */
export function extractBankTransactionLines(text: string, openingBalance?: number | null): ParsedTransactionLine[] {
  const lines = text.split(/\n/).map((l) => l.trim());
  // Indices of lines that begin a transaction (start with a real date).
  const starts: number[] = [];
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(ROW_DATE);
    if (m && parseDateLoose(m[1])) starts.push(i);
  }

  const results: ParsedTransactionLine[] = [];
  let previousBalance: number | null = openingBalance ?? null;

  for (let s = 0; s < starts.length; s++) {
    const from = starts[s];
    const to = s + 1 < starts.length ? starts[s + 1] : lines.length;
    const block = lines.slice(from, to);
    const date = parseDateLoose(block[0].match(ROW_DATE)![1]);
    if (!date) continue;

    // All 2-decimal money values across the block, in reading order.
    const nums: number[] = [];
    for (const l of block) {
      for (const m of l.matchAll(MONEY)) {
        const n = parseFloat(m[0].replace(/,/g, ""));
        if (Number.isFinite(n)) nums.push(n);
      }
    }
    if (nums.length === 0) continue;

    const balanceAfter = nums[nums.length - 1];
    const amt = nums.length >= 2 ? nums[nums.length - 2] : nums[0];

    const round2 = (n: number) => Math.round(n * 100) / 100;
    let moneyIn = 0;
    let moneyOut = 0;
    let confidence: number;
    if (previousBalance !== null && nums.length >= 2) {
      const delta = round2(balanceAfter - previousBalance);
      if (delta < 0) moneyOut = Math.abs(delta);
      else moneyIn = delta;
      confidence = 0.6;
    } else {
      if (amt < 0) moneyOut = round2(Math.abs(amt));
      else moneyIn = round2(amt);
      confidence = 0.35;
    }
    previousBalance = nums.length >= 2 ? balanceAfter : previousBalance;

    // Description = the block's text lines minus the leading date and any
    // money/balance tokens, collapsed to something readable.
    const description = block
      .join(" ")
      .replace(ROW_DATE, "")
      .replace(MONEY, "")
      .replace(/\b(Cr|Dr)\b/g, "")
      .replace(/\s{2,}/g, " ")
      .trim()
      .slice(0, 120);

    results.push({
      date,
      description: description || "(unlabeled transaction)",
      moneyIn,
      moneyOut,
      balanceAfter: nums.length >= 2 ? balanceAfter : null,
      confidence,
    });
  }

  return results;
}

/**
 * Pull a holder name from a passport/ID. Tries the machine-readable zone
 * (the "P<COUNTRY SURNAME<<GIVEN NAMES" line) first — it's the most reliable
 * part of a passport for OCR — then falls back to the visual "Surname / Given
 * names / Name" labels.
 */
function findIdName(text: string): FieldGuess<string> {
  const mrz = text.replace(/\s/g, "").match(/P[<K][A-Z]{3}([A-Z<]{6,})/);
  if (mrz) {
    const [surnameRaw, givenRaw] = mrz[1].split("<<");
    const surname = (surnameRaw ?? "").replace(/</g, " ").trim();
    const given = (givenRaw ?? "").replace(/</g, " ").trim();
    const name = [given, surname].filter(Boolean).join(" ").replace(/\s+/g, " ").trim();
    if (name.length >= 3) return { value: name, confidence: 0.7 };
  }
  const surname = findLabeledText(text, ["Surname", "Family Name"], 30).value;
  const given = findLabeledText(text, ["Given Name(?:s)?", "First Name", "Given"], 40).value;
  if (surname || given) {
    return { value: [given, surname].filter(Boolean).join(" ").trim(), confidence: 0.6 };
  }
  // ID cards (e.g. UAE Resident Identity Card): the "Name:" label is often
  // OCR-mangled ("Narde:", "AME:") and the name wraps to a second line, so a
  // strict label match fails. Instead score each line by how many Title-Case
  // words it holds after any label prefix, ignoring document boilerplate — the
  // person's name is the run of proper-case words that isn't a header.
  const STOP = /^(united|arab|emirates|federal|authority|identity|citizenship|customs|port|security|resident|card|number|date|birth|nationality|issuing|expiry|signature|sex|occupation|employer|place|student|holder|name|dubai|abu|dhabi|sharjah|ajman|fujairah|india|pakistan|philippines|nepal|egypt|jordan)$/i;
  let best: { score: number; name: string } | null = null;
  for (const rawLine of text.split(/\n/)) {
    const afterColon = rawLine.includes(":") ? rawLine.slice(rawLine.indexOf(":") + 1) : rawLine;
    const tokens = (afterColon.match(/[A-Z][a-z]{2,}/g) || []).filter((t) => !STOP.test(t));
    if (tokens.length >= 2 && (!best || tokens.length > best.score)) {
      best = { score: tokens.length, name: tokens.join(" ") };
    }
  }
  if (best) return { value: best.name, confidence: 0.6 };
  return findLabeledText(text, ["Full Name", "Name of Holder", "Holder", "Name"], 50);
}

export function extractPersonDocumentFields(text: string): ExtractedFields {
  // The MRZ (machine-readable strip) carries the expiry date reliably even when
  // the printed date is OCR-garbled ("07/10/2026" → "OT10/2026").
  const mrz = parseMrzDates(text);
  const mrzExpiry: FieldGuess<Date> | null = mrz.expiry ? { value: mrz.expiry, confidence: 0.8 } : null;

  // Nationality often trails OCR noise ("India RS") — keep only the country word.
  const natRaw = findLabeledText(text, ["Nationality"], 30);
  const natClean = natRaw.value ? (natRaw.value.match(/[A-Z][a-z]{2,}/)?.[0] ?? natRaw.value) : null;

  // Expiry: prefer the MRZ, fall back to a forward scan from the printed label.
  const expiry = mrzExpiry ?? findDateForLabel(text, ["Expiry Date", "Date of Expiry", "Expiry"]);
  const visaExpiry = mrzExpiry ?? findDateForLabel(text, ["Visa Expiry", "Expiry Date", "Date of Expiry", "Expiry"]);

  return {
    name: findIdName(text),
    nationality: { value: natClean, confidence: natClean ? natRaw.confidence : 0 },
    passportNumber: findPassportNumber(text),
    emiratesId: findEmiratesId(text),
    visaExpiry,
    issueDate: findDateForLabel(text, ["Issuing Date", "Issue Date", "Date of Issue"]),
    expiryDate: expiry,
    // An ID/passport carries no employment-contract dates — never fall back to a
    // stray date (that was pulling the birth date into these fields).
    contractStart: findLabeledDate(text, ["Contract Start", "Start Date", "Effective Date"], false),
    contractEnd: findLabeledDate(text, ["Contract End", "End Date", "Termination Date"], false),
    compensation: findLabeledAmount(text, ["Salary", "Compensation", "Monthly Salary", "Remuneration"]),
    signatureDate: findLabeledDate(text, ["Signed on", "Signature Date", "Date Signed"], false),
  };
}

export function extractContractFields(text: string): ExtractedFields {
  return {
    counterpartyName: findLabeledText(text, ["Between", "Party", "Vendor", "Supplier", "Counterparty"], 60),
    signatureDate: findLabeledDate(text, ["Signed on", "Signature Date", "Date Signed", "Executed on"]),
    startDate: findLabeledDate(text, ["Effective Date", "Start Date", "Commencement Date"]),
    endDate: findLabeledDate(text, ["End Date", "Expiry Date", "Termination Date"]),
    renewalDate: findLabeledDate(text, ["Renewal Date", "Renewal"]),
    noticePeriod: findLabeledText(text, ["Notice Period"], 40),
    contractValue: findLabeledAmount(text, ["Contract Value", "Total Value", "Fee", "Consideration"]),
    currency: findCurrency(text),
  };
}

export function extractLeaseFields(text: string): ExtractedFields {
  return {
    landlordName: findLabeledText(text, ["Landlord", "Lessor"], 60),
    tenantName: findLabeledText(text, ["Tenant", "Lessee"], 60),
    location: findLabeledText(text, ["Premises", "Location", "Address"], 80),
    startDate: findLabeledDate(text, ["Lease Start", "Commencement Date", "Start Date"]),
    endDate: findLabeledDate(text, ["Lease End", "Expiry Date", "End Date"]),
    rentAmount: findLabeledAmount(text, ["Annual Rent", "Monthly Rent", "Rent Amount", "Rent"]),
    paymentSchedule: findLabeledText(text, ["Payment Schedule", "Payment Terms", "Cheques"], 60),
    deposit: findLabeledAmount(text, ["Security Deposit", "Deposit"]),
    noticePeriod: findLabeledText(text, ["Notice Period"], 40),
    renewalDate: findLabeledDate(text, ["Renewal Date"]),
    signatureDate: findLabeledDate(text, ["Signed on", "Signature Date"]),
  };
}

// Common UAE licensing / tax authorities, matched to a clean display name so
// the field doesn't fill with a fragment of the surrounding legal prose.
const KNOWN_AUTHORITIES: [RegExp, string][] = [
  [/\bADGM\b|Abu Dhabi Global Market/i, "Abu Dhabi Global Market (ADGM)"],
  [/Federal Tax Authority|\bFTA\b/i, "Federal Tax Authority (FTA)"],
  [/\bDIFC\b|Dubai International Financial/i, "Dubai International Financial Centre (DIFC)"],
  [/Department of Economic Development|\bDED\b|\bDET\b/i, "Department of Economic Development"],
  [/\bDMCC\b/i, "DMCC"],
  [/\bJAFZA\b|Jebel Ali/i, "JAFZA"],
  [/Ministry of Economy/i, "Ministry of Economy"],
  [/\bRAKEZ\b|Ras Al Khaimah Economic/i, "RAKEZ"],
];

export function extractTaxDocumentFields(text: string): ExtractedFields {
  let authority = findLabeledText(text, ["Issuing Authority", "Registration Authority"], 50);
  // Prefer a recognised authority name; the generic "Authority" label matches
  // inside prose ("...accepted by the Authority...") and grabs junk.
  const known = KNOWN_AUTHORITIES.find(([re]) => re.test(text));
  if (known && (!authority.value || /^[a-z]|referred|accepted|was\b/.test(authority.value)))
    authority = { value: known[1], confidence: 0.8 };

  const issueDate = findLabeledDate(text, ["Issue Date", "Date of Issue", "Issued On", "Issued"]);
  let expiryDate = findLabeledDate(text, ["Expiry Date", "Date of Expiry", "Valid Until", "Valid To", "Licence Expiry", "License Expiry", "Expires On", "Expiry"]);
  // On a licence the expiry is always the furthest-future date; if the label
  // wording is unusual, fall back to the latest date in the document (as long
  // as it's actually later than the issue date).
  if (!expiryDate.value) {
    const latest = findLatestDate(text);
    if (latest && (!issueDate.value || latest > issueDate.value)) expiryDate = { value: latest, confidence: 0.5 };
  }

  return {
    companyName: findLabeledText(text, ["Company Name", "Legal Name", "Entity Name"], 60),
    licenseNumber: findLabeledText(text, ["License Number", "License No", "Licence No", "Registration No"], 30),
    taxRefNumber: findTRN(text),
    authority,
    issueDate,
    expiryDate,
    submissionDate: findLabeledDate(text, ["Submission Date", "Filed on", "Date Filed"]),
    dueDate: findLabeledDate(text, ["Due Date", "Next Due Date", "Deadline", "Renewal Date"]),
    fiscalPeriod: findLabeledText(text, ["Fiscal Period", "Tax Period"], 30),
  };
}
