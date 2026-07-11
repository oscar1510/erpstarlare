export const ACTOR_TYPES = [
  "OSCAR",
  "CRISTINA",
  "EMPLOYEE",
  "FREELANCER",
  "INTERN",
  "CONTRACTOR",
  "VENDOR",
  "CLIENT",
  "OTHER",
] as const;

export const ACTOR_LABELS: Record<string, string> = {
  OSCAR: "Oscar",
  CRISTINA: "Cristina",
  EMPLOYEE: "Employee",
  FREELANCER: "Freelancer",
  INTERN: "Intern",
  CONTRACTOR: "Contractor",
  VENDOR: "Vendor",
  CLIENT: "Client",
  OTHER: "Other",
};

export const EXPENSE_CATEGORIES = [
  "Office",
  "Travel",
  "Food & Beverage",
  "Software",
  "Marketing",
  "Transport",
  "Client meeting",
  "Creator / campaign cost",
  "Government / tax",
  "Bank fee",
  "Rent / office",
  "Legal / admin",
  "Other",
];

export const PAYMENT_METHODS = [
  "Company card",
  "Personal card",
  "Cash",
  "Bank transfer",
  "Stripe",
  "Other",
];

// The real accounts money is paid from / received into. Independent of who is
// paying — used on expenses, invoices, supplier invoices and payments so every
// movement is tied to an account.
export const PAYMENT_ACCOUNTS = [
  "Revolut Cristina",
  "Revolut Oscar",
  "NBD Oscar",
  "Company Rak",
  "Cash",
];

export const EXPENSE_STATUSES = [
  "DRAFT",
  "RECORDED",
  "REIMBURSABLE",
  "REIMBURSED",
  "PAID",
  "NOT_REIMBURSABLE",
  "NEEDS_REVIEW",
];

export const INVOICE_STATUSES = [
  "DRAFT",
  "SENT",
  "PAID",
  "PARTIALLY_PAID",
  "OVERDUE",
  "CANCELLED",
];

export const CLIENT_STATUSES = ["LEAD", "ACTIVE", "PAUSED", "CANCELLED", "INACTIVE"];

export const PURCHASE_TYPES = [
  "SUBSCRIPTION",
  "CREDIT_PACKAGE",
  "SINGLE_CAMPAIGN",
  "SETUP_FEE",
  "RENEWAL",
  "CUSTOM_PACKAGE",
  "OTHER",
];

export const SUBSCRIPTION_STATUSES = ["ACTIVE", "EXPIRED", "CANCELLED", "PENDING_RENEWAL"];

export const RECONCILIATION_STATUSES = [
  "MATCHED",
  "UNMATCHED",
  "PARTIALLY_MATCHED",
  "PENDING_REVIEW",
];

export const RECEIVED_INVOICE_STATUSES = [
  "RECEIVED",
  "PENDING_PAYMENT",
  "PAID",
  "OVERDUE",
  "CANCELLED",
];

export const BANK_TXN_CATEGORIES = [
  "Client payment",
  "Supplier payment",
  "HR payment",
  "Reimbursement",
  "Bank fee",
  "Tax / government",
  "Rent",
  "Software",
  "Marketing",
  "Other",
];

export const BANK_DOCUMENT_TYPES = [
  "IBAN_LETTER",
  "BANK_CONFIRMATION",
  "STATEMENT",
  "KYC",
  "CORRESPONDENCE",
  "OTHER",
];

export const LEDGER_TYPES = ["INCOME", "EXPENSE", "TRANSFER", "ADJUSTMENT"];

export const PERSON_TYPES = ["FULL_TIME", "PART_TIME", "FREELANCER", "INTERN", "CONTRACTOR", "OTHER"];

export const PERSON_STATUSES = ["ACTIVE", "PENDING", "COMPLETED", "TERMINATED"];

export const COMPENSATION_STATUSES = ["DUE", "PAID", "PARTIALLY_PAID", "OVERDUE"];

export const REIMBURSEMENT_STATUSES = ["SUBMITTED", "RECORDED", "PAID", "REJECTED"];

export const TAX_DOC_TYPES = [
  "ADGM_LICENSE",
  "BRANCH_LICENSE",
  "FTA_REGISTRATION",
  "CORPORATE_TAX_REG",
  "VAT_REGISTRATION",
  "CORPORATE_TAX_SUBMISSION",
  "OTHER",
];

export const TAX_STATUSES = ["PENDING", "SUBMITTED", "APPROVED", "OVERDUE"];

export const CONTRACT_STATUSES = ["ACTIVE", "EXPIRED", "TERMINATED", "DRAFT"];

export const POLICY_STATUSES = ["ACTIVE", "ARCHIVED", "DRAFT"];

export const DEADLINE_STATUSES = ["UPCOMING", "DUE_SOON", "OVERDUE", "COMPLETED", "CANCELLED"];

export const DOCUMENT_TYPES = [
  "RECEIPT",
  "CLIENT_INVOICE",
  "STRIPE_INVOICE",
  "RECEIVED_INVOICE",
  "BANK_STATEMENT",
  "BANK_DOCUMENT",
  "HR_DOCUMENT",
  "TAX_DOCUMENT",
  "RENT_CONTRACT",
  "RECEIVED_CONTRACT",
  "SENT_CONTRACT",
  "POLICY",
  "OTHER",
];

export const DOCUMENT_STATUSES = ["ACTIVE", "ARCHIVED", "EXPIRED", "MISSING_INFO", "NEEDS_REVIEW"];

export const CURRENCIES = ["AED", "USD", "EUR", "GBP"];

export function labelize(value?: string | null) {
  if (!value) return "";
  return value
    .toLowerCase()
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

export const STATUS_COLORS: Record<string, string> = {
  ACTIVE: "green",
  PAID: "green",
  MATCHED: "green",
  COMPLETED: "green",
  APPROVED: "green",
  DONE: "green",
  RECORDED: "green",
  RECEIVED: "blue",
  SENT: "blue",
  SUBMITTED: "blue",
  DRAFT: "gray",
  PENDING: "amber",
  PENDING_PAYMENT: "amber",
  PENDING_REVIEW: "amber",
  PARTIALLY_PAID: "amber",
  PARTIALLY_MATCHED: "amber",
  DUE: "amber",
  DUE_SOON: "amber",
  NEEDS_REVIEW: "amber",
  MISSING_INFO: "amber",
  UPCOMING: "blue",
  UNMATCHED: "red",
  OVERDUE: "red",
  CANCELLED: "red",
  TERMINATED: "red",
  REJECTED: "red",
  EXPIRED: "red",
  FAILED: "red",
  INACTIVE: "gray",
  PAUSED: "amber",
  LEAD: "gray",
  ARCHIVED: "gray",
  NOT_REIMBURSABLE: "gray",
  REIMBURSABLE: "amber",
  REIMBURSED: "green",
};
