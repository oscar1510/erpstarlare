import {
  FieldGuess,
  OcrWord,
  findBilledToClient,
  findCurrency,
  findEmail,
  findEmiratesId,
  findIBAN,
  findInvoiceNumber,
  findLabeledAmount,
  findLabeledDate,
  findLabeledText,
  findLargestAmount,
  findLineItemDescription,
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
  const amount = findLabeledAmount(text, ["Total\\s*Amount", "Grand Total", "Total", "Amount Due", "Amount"]);
  return {
    vendor: findVendorName(text),
    date: findLabeledDate(text, ["Date", "Transaction Date", "Receipt Date"]),
    amount: amount.value !== null ? amount : findLargestAmount(text),
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
  // "Bill to" block); fall back to the flat-text label match when boxes aren't
  // available (e.g. a born-digital PDF read via its text layer).
  const clientFromColumn = findBilledToClient(words);
  return {
    clientName:
      clientFromColumn.value !== null
        ? clientFromColumn
        : findLabeledText(text, ["Bill to", "Customer", "Billed to"], 60),
    clientEmail: findEmail(text),
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

export function extractBankStatementFields(text: string): ExtractedFields {
  return {
    bankName: findLabeledText(text, ["Bank Name", "Bank"], 40),
    accountName: findLabeledText(text, ["Account Name", "Account Holder"], 40),
    iban: findIBAN(text),
    periodStart: findLabeledDate(text, ["Statement Period From", "Period From", "From"]),
    periodEnd: findLabeledDate(text, ["Statement Period To", "Period To", "To"]),
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

/**
 * Very deliberately conservative: only lines that look like
 * `DATE   DESCRIPTION   AMOUNT   [AMOUNT]   [BALANCE]` are treated as
 * transactions. Anything ambiguous is skipped rather than guessed, since a
 * mis-parsed bank line is worse than a missing one (user can add manually).
 *
 * Most bank exports print debits/credits as unsigned numbers in separate
 * columns rather than a single signed amount, so a plain "is this number
 * negative?" check mislabels debits as credits on those statements. When a
 * running balance column is present, the direction is instead derived from
 * the balance delta versus the previous transaction (or the statement's
 * opening balance for the first line), which is reliable regardless of
 * column layout. The sign-based heuristic is only used as a last resort when
 * there's no balance to diff against.
 */
export function extractBankTransactionLines(text: string, openingBalance?: number | null): ParsedTransactionLine[] {
  const lines = text.split(/\n/);
  const results: ParsedTransactionLine[] = [];
  // Accept the date formats banks actually use at the start of a statement
  // row: numeric DD/MM/YYYY (or with - .), ISO YYYY-MM-DD, and month-name
  // "DD Mon YYYY" (e.g. "04 Jul 2026") — matching only numeric dates made
  // month-name statements parse to zero transactions.
  const dateAtStart = /^\s*(\d{1,2}[-/.]\d{1,2}[-/.](?:19|20)?\d{2}|(?:19|20)\d{2}[-/]\d{1,2}[-/]\d{1,2}|\d{1,2}[ -][A-Za-z]{3,9}\.?[ -](?:19|20)?\d{2})/;
  let previousBalance: number | null = openingBalance ?? null;

  for (const line of lines) {
    const dateMatch = line.match(dateAtStart);
    if (!dateMatch) continue;
    const date = parseDateLoose(dateMatch[1]);
    if (!date) continue;

    const numbers = [...line.matchAll(/-?[0-9][0-9,]*\.[0-9]{2}/g)].map((m) =>
      parseFloat(m[0].replace(/,/g, ""))
    );
    if (numbers.length === 0) continue;

    const description = line
      .slice(dateMatch[0].length)
      .replace(/-?[0-9][0-9,]*\.[0-9]{2}/g, "")
      .trim()
      .slice(0, 120);

    let moneyIn = 0;
    let moneyOut = 0;
    let balanceAfter: number | null = null;
    let confidence: number;

    if (numbers.length >= 2) {
      // Last number is the running balance; whichever earlier number the
      // line carries, the balance delta tells the true direction/magnitude.
      const amt = numbers[0];
      const bal = numbers[numbers.length - 1];
      balanceAfter = bal;

      if (previousBalance !== null) {
        const delta = bal - previousBalance;
        if (delta < 0) moneyOut = Math.abs(delta);
        else moneyIn = delta;
        confidence = 0.6;
      } else {
        if (amt < 0) moneyOut = Math.abs(amt);
        else moneyIn = amt;
        confidence = 0.4;
      }
      previousBalance = bal;
    } else {
      const amt = numbers[0];
      if (amt < 0) moneyOut = Math.abs(amt);
      else moneyIn = amt;
      confidence = 0.3;
      previousBalance = null; // no balance column on this line to keep chaining from
    }

    results.push({
      date,
      description: description || "(unlabeled transaction)",
      moneyIn,
      moneyOut,
      balanceAfter,
      confidence,
    });
  }

  return results;
}

export function extractPersonDocumentFields(text: string): ExtractedFields {
  return {
    name: findLabeledText(text, ["Name", "Full Name", "Holder"], 50),
    nationality: findLabeledText(text, ["Nationality"], 30),
    passportNumber: findPassportNumber(text),
    emiratesId: findEmiratesId(text),
    visaExpiry: findLabeledDate(text, ["Visa Expiry", "Expiry Date", "Date of Expiry"]),
    issueDate: findLabeledDate(text, ["Issue Date", "Date of Issue"]),
    expiryDate: findLabeledDate(text, ["Expiry Date", "Date of Expiry", "Expiry"]),
    contractStart: findLabeledDate(text, ["Contract Start", "Start Date", "Effective Date"]),
    contractEnd: findLabeledDate(text, ["Contract End", "End Date", "Termination Date"]),
    compensation: findLabeledAmount(text, ["Salary", "Compensation", "Monthly Salary", "Remuneration"]),
    signatureDate: findLabeledDate(text, ["Signed on", "Signature Date", "Date Signed"]),
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

export function extractTaxDocumentFields(text: string): ExtractedFields {
  return {
    companyName: findLabeledText(text, ["Company Name", "Legal Name", "Entity Name"], 60),
    licenseNumber: findLabeledText(text, ["License Number", "License No", "Licence No"], 30),
    taxRefNumber: findTRN(text),
    authority: findLabeledText(text, ["Issuing Authority", "Authority"], 40),
    issueDate: findLabeledDate(text, ["Issue Date", "Date of Issue"]),
    expiryDate: findLabeledDate(text, ["Expiry Date", "Valid Until", "Date of Expiry"]),
    submissionDate: findLabeledDate(text, ["Submission Date", "Filed on", "Date Filed"]),
    dueDate: findLabeledDate(text, ["Due Date", "Next Due Date", "Deadline"]),
    fiscalPeriod: findLabeledText(text, ["Fiscal Period", "Tax Period", "Period"], 30),
  };
}
