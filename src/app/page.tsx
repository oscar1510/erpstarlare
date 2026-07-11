export const dynamic = "force-dynamic";

import { db } from "@/lib/db";
import { PageHeader, Section } from "@/components/ui/Page";
import { DateRangeFilter } from "@/components/DateRangeFilter";
import { StatusBadge } from "@/components/ui/Badge";
import { resolveRange } from "@/lib/date-ranges";
import { formatDate, formatMoney } from "@/lib/format";
import { refreshDeadlineStatuses } from "@/lib/deadlines";
import Link from "next/link";

function Kpi({ label, value, tone }: { label: string; value: string; tone?: "green" | "red" | "default" }) {
  const color = tone === "green" ? "text-green-700" : tone === "red" ? "text-red-700" : "text-slate-900";
  return (
    <div className="kpi-tile">
      <span className="text-xs text-slate-500">{label}</span>
      <span className={`text-xl font-semibold ${color}`}>{value}</span>
    </div>
  );
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string; from?: string; to?: string }>;
}) {
  await refreshDeadlineStatuses();
  const sp = await searchParams;
  const { start, end } = resolveRange(sp.range, sp.from, sp.to);
  const dateFilter = { ...(start ? { gte: start } : {}), ...(end ? { lte: end } : {}) };

  const [
    invoices,
    paidInvoicesAll,
    expenses,
    payments,
    clients,
    purchasesCount,
    unmatchedBankTxns,
    unreconciledInvoicePayments,
    latestExpenses,
    latestDocuments,
    upcomingContractDeadlines,
    upcomingDocumentDeadlines,
    upcomingComplianceDeadlines,
    hrCompDue,
    reimbursementsDue,
  ] = await Promise.all([
    db.invoice.findMany({ where: { invoiceDate: dateFilter, deletedAt: null } }),
    // All paid invoices — revenue is attributed by *payment* date (paidDate),
    // not issue date, so we filter these in JS by their effective paid date.
    db.invoice.findMany({ where: { status: "PAID", deletedAt: null } }),
    db.ledgerEntry.findMany({ where: { type: "EXPENSE", date: dateFilter } }),
    db.payment.findMany({ where: { date: dateFilter } }),
    db.client.findMany({ where: { status: "ACTIVE" } }),
    db.purchase.count({ where: { date: dateFilter } }),
    db.bankTransaction.count({ where: { reconciliation: "UNMATCHED" } }),
    db.payment.count({ where: { invoiceId: { not: null }, reconciliation: { not: "MATCHED" } } }),
    db.expense.findMany({ orderBy: { createdAt: "desc" }, take: 5 }),
    db.document.findMany({ orderBy: { createdAt: "desc" }, take: 5 }),
    db.deadline.findMany({
      where: { status: { in: ["UPCOMING", "DUE_SOON"] }, category: { in: ["Contract End", "HR Contract"] } },
      orderBy: { date: "asc" },
      take: 5,
    }),
    db.deadline.findMany({
      where: { status: { in: ["UPCOMING", "DUE_SOON"] }, documentId: { not: null } },
      orderBy: { date: "asc" },
      take: 5,
    }),
    db.deadline.findMany({
      where: { status: { in: ["UPCOMING", "DUE_SOON"] }, category: { in: ["Tax / License", "Lease End", "Lease Renewal", "Visa / Permit"] } },
      orderBy: { date: "asc" },
      take: 8,
    }),
    db.compensationPayment.findMany({ where: { status: { in: ["DUE", "PARTIALLY_PAID", "OVERDUE"] } }, take: 5 }),
    db.reimbursement.findMany({ where: { status: { in: ["SUBMITTED", "RECORDED"] } }, take: 5 }),
  ]);

  // Revenue is counted in the month the invoice was actually paid. An invoice
  // dated this month but paid last September must not inflate this month's
  // revenue — and one paid this month but issued long ago must still count.
  const inRange = (d: Date | null | undefined) => !!d && (!start || d >= start) && (!end || d <= end);
  const revenueInvoices = paidInvoicesAll.filter((i) => inRange(i.paidDate ?? i.invoiceDate));
  const totalRevenue = revenueInvoices.reduce((s, i) => s + i.total, 0);
  const stripeRevenue = revenueInvoices.filter((i) => i.source === "STRIPE").reduce((s, i) => s + i.total, 0);
  const manualRevenue = revenueInvoices.filter((i) => i.source === "MANUAL").reduce((s, i) => s + i.total, 0);
  const invoicesPaid = revenueInvoices.length;
  const invoicesOverdue = invoices.filter((i) => i.status === "OVERDUE" || (i.dueDate && i.dueDate < new Date() && i.status !== "PAID" && i.status !== "CANCELLED")).length;

  const totalExpenses = expenses.reduce((s, e) => s + e.amount, 0);
  const unpaidExpensesCount = await db.expense.count({ where: { status: { in: ["DRAFT", "RECORDED", "REIMBURSABLE", "NEEDS_REVIEW"] } } });

  const cashIn = payments.filter((p) => p.type === "INCOMING").reduce((s, p) => s + p.amount, 0);
  const cashOut = payments.filter((p) => p.type === "OUTGOING").reduce((s, p) => s + p.amount, 0);

  return (
    <div className="space-y-8">
      <PageHeader title="KPI Dashboard" description="Overview of Starflare's business — pulled live from every module." />
      <DateRangeFilter basePath="/" active={sp.range ?? "this_month"} from={sp.from} to={sp.to} />

      <Section title="Revenue">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <Kpi label="Total revenue" value={formatMoney(totalRevenue)} tone="green" />
          <Kpi label="Revenue from Stripe" value={formatMoney(stripeRevenue)} />
          <Kpi label="Revenue from manual invoices" value={formatMoney(manualRevenue)} />
          <Kpi label="Invoices issued" value={String(invoices.length)} />
          <Kpi label="Invoices paid" value={String(invoicesPaid)} tone="green" />
          <Kpi label="Invoices overdue" value={String(invoicesOverdue)} tone={invoicesOverdue > 0 ? "red" : "default"} />
          <Kpi label="Payments not yet reconciled" value={String(unreconciledInvoicePayments)} tone={unreconciledInvoicePayments > 0 ? "red" : "default"} />
        </div>
      </Section>

      <Section title="Expenses & cashflow">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <Kpi label="Total expenses" value={formatMoney(totalExpenses)} tone="red" />
          <Kpi label="Unpaid / draft expenses" value={String(unpaidExpensesCount)} />
          <Kpi label="Cash in" value={formatMoney(cashIn)} tone="green" />
          <Kpi label="Cash out" value={formatMoney(cashOut)} tone="red" />
          <Kpi label="Basic profit / loss" value={formatMoney(totalRevenue - totalExpenses)} tone={totalRevenue - totalExpenses >= 0 ? "green" : "red"} />
          <Kpi label="Total payments received" value={formatMoney(cashIn)} />
          <Kpi label="Total payments made" value={formatMoney(cashOut)} />
          <Kpi label="Bank transactions unmatched" value={String(unmatchedBankTxns)} tone={unmatchedBankTxns > 0 ? "red" : "default"} />
        </div>
      </Section>

      <Section title="Clients">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <Kpi label="Active clients" value={String(clients.length)} />
          <Kpi label="Client purchases (in range)" value={String(purchasesCount)} />
        </div>
      </Section>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Section title="Upcoming contract deadlines">
          <DeadlineMini items={upcomingContractDeadlines} />
        </Section>
        <Section title="Upcoming document deadlines">
          <DeadlineMini items={upcomingDocumentDeadlines} />
        </Section>
        <Section title="Licenses, tax, rent, visa & permit deadlines">
          <DeadlineMini items={upcomingComplianceDeadlines} />
        </Section>
        <Section title="HR compensation & reimbursements due">
          <div className="card divide-y divide-slate-100">
            {hrCompDue.length === 0 && reimbursementsDue.length === 0 && <p className="p-4 text-sm text-slate-500">Nothing due.</p>}
            {hrCompDue.map((c) => (
              <div key={c.id} className="p-3 flex justify-between text-sm">
                <span>Compensation · {c.referencePeriod ?? "—"}</span>
                <span className="font-medium">{formatMoney(c.amount, c.currency)}</span>
              </div>
            ))}
            {reimbursementsDue.map((r) => (
              <div key={r.id} className="p-3 flex justify-between text-sm">
                <span>Reimbursement · {r.category ?? "—"}</span>
                <span className="font-medium">{formatMoney(r.amount, r.currency)}</span>
              </div>
            ))}
          </div>
        </Section>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Section title="Latest uploaded expenses">
          <div className="card divide-y divide-slate-100">
            {latestExpenses.length === 0 && <p className="p-4 text-sm text-slate-500">No expenses yet.</p>}
            {latestExpenses.map((e) => (
              <Link key={e.id} href={`/expenses/${e.id}`} className="p-3 flex justify-between text-sm hover:bg-slate-50">
                <span>{e.vendor ?? "(unknown vendor)"}</span>
                <span className="flex items-center gap-2">
                  {formatMoney(e.amount, e.currency)}
                  <StatusBadge status={e.status} />
                </span>
              </Link>
            ))}
          </div>
        </Section>
        <Section title="Latest uploaded documents">
          <div className="card divide-y divide-slate-100">
            {latestDocuments.length === 0 && <p className="p-4 text-sm text-slate-500">No documents yet.</p>}
            {latestDocuments.map((d) => (
              <a key={d.id} href={`/api/files/${d.id}`} target="_blank" className="p-3 flex justify-between text-sm hover:bg-slate-50">
                <span className="truncate max-w-[60%]">{d.fileName}</span>
                <StatusBadge status={d.status} />
              </a>
            ))}
          </div>
        </Section>
      </div>
    </div>
  );
}

function DeadlineMini({ items }: { items: { id: string; title: string; date: Date; status: string }[] }) {
  return (
    <div className="card divide-y divide-slate-100">
      {items.length === 0 && <p className="p-4 text-sm text-slate-500">Nothing upcoming.</p>}
      {items.map((d) => (
        <div key={d.id} className="p-3 flex justify-between text-sm">
          <span>{d.title}</span>
          <span className="flex items-center gap-2 text-slate-500">
            {formatDate(d.date)}
            <StatusBadge status={d.status} />
          </span>
        </div>
      ))}
    </div>
  );
}
