import { db } from "./db";

export interface ReportColumn {
  header: string;
  key: string;
}

export interface ReportData {
  title: string;
  columns: ReportColumn[];
  rows: Record<string, any>[];
}

function fmt(d: Date | null | undefined) {
  return d ? d.toISOString().slice(0, 10) : "";
}

export const REPORTS: Record<string, { label: string; fetch: () => Promise<ReportData> }> = {
  monthly_revenue: {
    label: "Monthly revenue",
    fetch: async () => {
      const invoices = await db.invoice.findMany({ where: { status: "PAID" }, orderBy: { invoiceDate: "desc" } });
      const byMonth = new Map<string, number>();
      for (const i of invoices) {
        const key = i.invoiceDate.toISOString().slice(0, 7);
        byMonth.set(key, (byMonth.get(key) ?? 0) + i.total);
      }
      return {
        title: "Monthly revenue",
        columns: [{ header: "Month", key: "month" }, { header: "Revenue (AED)", key: "revenue" }],
        rows: [...byMonth.entries()].sort((a, b) => b[0].localeCompare(a[0])).map(([month, revenue]) => ({ month, revenue })),
      };
    },
  },
  monthly_expenses: {
    label: "Monthly expenses",
    fetch: async () => {
      const entries = await db.ledgerEntry.findMany({ where: { type: "EXPENSE" } });
      const byMonth = new Map<string, number>();
      for (const e of entries) {
        const key = e.date.toISOString().slice(0, 7);
        byMonth.set(key, (byMonth.get(key) ?? 0) + e.amount);
      }
      return {
        title: "Monthly expenses",
        columns: [{ header: "Month", key: "month" }, { header: "Expenses (AED)", key: "expenses" }],
        rows: [...byMonth.entries()].sort((a, b) => b[0].localeCompare(a[0])).map(([month, expenses]) => ({ month, expenses })),
      };
    },
  },
  profit_loss: {
    label: "Basic profit & loss",
    fetch: async () => {
      const entries = await db.ledgerEntry.findMany();
      const income = entries.filter((e) => e.type === "INCOME").reduce((s, e) => s + e.amount, 0);
      const expense = entries.filter((e) => e.type === "EXPENSE").reduce((s, e) => s + e.amount, 0);
      return {
        title: "Basic profit & loss",
        columns: [{ header: "Metric", key: "metric" }, { header: "Amount (AED)", key: "amount" }],
        rows: [
          { metric: "Total income", amount: income },
          { metric: "Total expenses", amount: expense },
          { metric: "Profit / Loss", amount: income - expense },
        ],
      };
    },
  },
  cashflow: {
    label: "Basic cashflow",
    fetch: async () => {
      const payments = await db.payment.findMany();
      const cashIn = payments.filter((p) => p.type === "INCOMING").reduce((s, p) => s + p.amount, 0);
      const cashOut = payments.filter((p) => p.type === "OUTGOING").reduce((s, p) => s + p.amount, 0);
      return {
        title: "Basic cashflow",
        columns: [{ header: "Metric", key: "metric" }, { header: "Amount (AED)", key: "amount" }],
        rows: [
          { metric: "Cash in", amount: cashIn },
          { metric: "Cash out", amount: cashOut },
          { metric: "Net cash movement", amount: cashIn - cashOut },
        ],
      };
    },
  },
  open_invoices: {
    label: "Open client invoices",
    fetch: async () => {
      const rows = await db.invoice.findMany({ where: { status: { in: ["DRAFT", "SENT", "PARTIALLY_PAID"] } }, orderBy: { dueDate: "asc" } });
      return {
        title: "Open client invoices",
        columns: [{ header: "Number", key: "number" }, { header: "Client", key: "client" }, { header: "Due date", key: "due" }, { header: "Total", key: "total" }, { header: "Status", key: "status" }],
        rows: rows.map((i) => ({ number: i.number, client: i.clientNameSnapshot, due: fmt(i.dueDate), total: i.total, status: i.status })),
      };
    },
  },
  overdue_invoices: {
    label: "Overdue client invoices",
    fetch: async () => {
      const rows = await db.invoice.findMany({ where: { status: { notIn: ["PAID", "CANCELLED"] }, dueDate: { lt: new Date() } }, orderBy: { dueDate: "asc" } });
      return {
        title: "Overdue client invoices",
        columns: [{ header: "Number", key: "number" }, { header: "Client", key: "client" }, { header: "Due date", key: "due" }, { header: "Total", key: "total" }],
        rows: rows.map((i) => ({ number: i.number, client: i.clientNameSnapshot, due: fmt(i.dueDate), total: i.total })),
      };
    },
  },
  supplier_invoices_to_pay: {
    label: "Supplier invoices to pay",
    fetch: async () => {
      const rows = await db.receivedInvoice.findMany({ where: { paymentStatus: { in: ["RECEIVED", "PENDING_PAYMENT", "OVERDUE"] } }, orderBy: { dueDate: "asc" } });
      return {
        title: "Supplier invoices to pay",
        columns: [{ header: "Vendor", key: "vendor" }, { header: "Invoice #", key: "num" }, { header: "Due date", key: "due" }, { header: "Amount", key: "amount" }],
        rows: rows.map((r) => ({ vendor: r.vendorName, num: r.invoiceNumber, due: fmt(r.dueDate), amount: r.amount })),
      };
    },
  },
  stripe_revenue: {
    label: "Stripe revenue",
    fetch: async () => {
      const rows = await db.invoice.findMany({ where: { source: "STRIPE" }, orderBy: { invoiceDate: "desc" } });
      return {
        title: "Stripe revenue",
        columns: [{ header: "Number", key: "number" }, { header: "Client", key: "client" }, { header: "Date", key: "date" }, { header: "Total", key: "total" }, { header: "Status", key: "status" }],
        rows: rows.map((i) => ({ number: i.number, client: i.clientNameSnapshot, date: fmt(i.invoiceDate), total: i.total, status: i.status })),
      };
    },
  },
  manual_invoice_revenue: {
    label: "Manual invoice revenue",
    fetch: async () => {
      const rows = await db.invoice.findMany({ where: { source: "MANUAL" }, orderBy: { invoiceDate: "desc" } });
      return {
        title: "Manual invoice revenue",
        columns: [{ header: "Number", key: "number" }, { header: "Client", key: "client" }, { header: "Date", key: "date" }, { header: "Total", key: "total" }, { header: "Status", key: "status" }],
        rows: rows.map((i) => ({ number: i.number, client: i.clientNameSnapshot, date: fmt(i.invoiceDate), total: i.total, status: i.status })),
      };
    },
  },
  hr_compensation: {
    label: "HR compensation report",
    fetch: async () => {
      const rows = await db.compensationPayment.findMany({ orderBy: { paymentDate: "desc" } });
      const people = await db.person.findMany();
      const nameById = new Map(people.map((p) => [p.id, `${p.firstName} ${p.lastName}`]));
      return {
        title: "HR compensation report",
        columns: [{ header: "Person", key: "person" }, { header: "Period", key: "period" }, { header: "Amount", key: "amount" }, { header: "Status", key: "status" }],
        rows: rows.map((c) => ({ person: nameById.get(c.personId), period: c.referencePeriod, amount: c.amount, status: c.status })),
      };
    },
  },
  reimbursements: {
    label: "Reimbursement report",
    fetch: async () => {
      const rows = await db.reimbursement.findMany({ orderBy: { createdAt: "desc" } });
      const people = await db.person.findMany();
      const nameById = new Map(people.map((p) => [p.id, `${p.firstName} ${p.lastName}`]));
      return {
        title: "Reimbursement report",
        columns: [{ header: "Person", key: "person" }, { header: "Category", key: "category" }, { header: "Amount", key: "amount" }, { header: "Status", key: "status" }],
        rows: rows.map((r) => ({ person: nameById.get(r.personId), category: r.category, amount: r.amount, status: r.status })),
      };
    },
  },
  tax_report: {
    label: "Tax report",
    fetch: async () => {
      const rows = await db.taxRecord.findMany({ orderBy: { nextDueDate: "asc" } });
      return {
        title: "Tax report",
        columns: [{ header: "Type", key: "type" }, { header: "Reference #", key: "ref" }, { header: "Next due", key: "due" }, { header: "Status", key: "status" }],
        rows: rows.map((t) => ({ type: t.docType, ref: t.taxRefNumber, due: fmt(t.nextDueDate), status: t.status })),
      };
    },
  },
  contract_expiry: {
    label: "Contract expiry report",
    fetch: async () => {
      const [received, sent] = await Promise.all([
        db.receivedContract.findMany({ orderBy: { endDate: "asc" } }),
        db.sentContract.findMany({ orderBy: { endDate: "asc" } }),
      ]);
      return {
        title: "Contract expiry report",
        columns: [{ header: "Kind", key: "kind" }, { header: "Party", key: "party" }, { header: "End date", key: "end" }, { header: "Status", key: "status" }],
        rows: [
          ...received.map((c) => ({ kind: "Received", party: c.counterpartyName, end: fmt(c.endDate), status: c.status })),
          ...sent.map((c) => ({ kind: "Sent", party: c.partnerName, end: fmt(c.endDate), status: c.status })),
        ],
      };
    },
  },
  rent_payments: {
    label: "Rent payment report",
    fetch: async () => {
      const rows = await db.rentRecord.findMany();
      return {
        title: "Rent payment report",
        columns: [{ header: "Office", key: "office" }, { header: "Landlord", key: "landlord" }, { header: "Monthly rent", key: "rent" }, { header: "Renewal", key: "renewal" }],
        rows: rows.map((r) => ({ office: r.officeName ?? r.location, landlord: r.landlordName, rent: r.monthlyRent, renewal: fmt(r.renewalDate) })),
      };
    },
  },
  bank_reconciliation: {
    label: "Bank reconciliation report",
    fetch: async () => {
      const rows = await db.bankTransaction.findMany({ orderBy: { date: "desc" } });
      return {
        title: "Bank reconciliation report",
        columns: [{ header: "Date", key: "date" }, { header: "Description", key: "description" }, { header: "In", key: "in" }, { header: "Out", key: "out" }, { header: "Reconciliation", key: "status" }],
        rows: rows.map((t) => ({ date: fmt(t.date), description: t.description, in: t.moneyIn, out: t.moneyOut, status: t.reconciliation })),
      };
    },
  },
  expense_by_category: {
    label: "Expense by category",
    fetch: async () => {
      const entries = await db.ledgerEntry.findMany({ where: { type: "EXPENSE" } });
      const byCat = new Map<string, number>();
      for (const e of entries) byCat.set(e.category ?? "Other", (byCat.get(e.category ?? "Other") ?? 0) + e.amount);
      return {
        title: "Expense by category",
        columns: [{ header: "Category", key: "category" }, { header: "Amount", key: "amount" }],
        rows: [...byCat.entries()].sort((a, b) => b[1] - a[1]).map(([category, amount]) => ({ category, amount })),
      };
    },
  },
  revenue_by_client: {
    label: "Revenue by client",
    fetch: async () => {
      const entries = await db.ledgerEntry.findMany({ where: { type: "INCOME", clientId: { not: null } } });
      const clients = await db.client.findMany();
      const nameById = new Map(clients.map((c) => [c.id, c.name]));
      const byClient = new Map<string, number>();
      for (const e of entries) {
        const name = nameById.get(e.clientId!) ?? "Unknown";
        byClient.set(name, (byClient.get(name) ?? 0) + e.amount);
      }
      return {
        title: "Revenue by client",
        columns: [{ header: "Client", key: "client" }, { header: "Revenue", key: "revenue" }],
        rows: [...byClient.entries()].sort((a, b) => b[1] - a[1]).map(([client, revenue]) => ({ client, revenue })),
      };
    },
  },
  documents_expiring: {
    label: "Documents expiring soon",
    fetch: async () => {
      const in30 = new Date();
      in30.setDate(in30.getDate() + 30);
      const rows = await db.document.findMany({ where: { expiryDate: { lte: in30 } }, orderBy: { expiryDate: "asc" } });
      return {
        title: "Documents expiring soon",
        columns: [{ header: "File", key: "file" }, { header: "Type", key: "type" }, { header: "Expiry date", key: "expiry" }],
        rows: rows.map((d) => ({ file: d.fileName, type: d.documentType, expiry: fmt(d.expiryDate) })),
      };
    },
  },
  deadlines_overdue: {
    label: "Deadlines overdue",
    fetch: async () => {
      const rows = await db.deadline.findMany({ where: { status: "OVERDUE" }, orderBy: { date: "asc" } });
      return {
        title: "Deadlines overdue",
        columns: [{ header: "Title", key: "title" }, { header: "Category", key: "category" }, { header: "Date", key: "date" }],
        rows: rows.map((d) => ({ title: d.title, category: d.category, date: fmt(d.date) })),
      };
    },
  },
};
