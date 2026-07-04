import { db } from "@/lib/db";
import { PageHeader, Section } from "@/components/ui/Page";
import { DataTable } from "@/components/ui/Table";
import { DateRangeFilter } from "@/components/DateRangeFilter";
import { resolveRange } from "@/lib/date-ranges";
import { ledgerSummary } from "@/lib/ledger";
import { formatDate, formatMoney } from "@/lib/format";
import { labelize } from "@/lib/constants";
import Link from "next/link";

export default async function LedgerPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string; from?: string; to?: string; category?: string; type?: string }>;
}) {
  const sp = await searchParams;
  const { start, end } = resolveRange(sp.range, sp.from, sp.to);
  const summary = await ledgerSummary({ start, end, category: sp.category, type: sp.type });

  return (
    <div className="space-y-8">
      <PageHeader
        title="General Ledger"
        description="A clear financial record pulled automatically from invoices, expenses, payroll, rent, tax and more."
        actions={
          <>
            <a href={`/ledger/export/excel?range=${sp.range ?? "all"}&from=${sp.from ?? ""}&to=${sp.to ?? ""}`} className="btn-secondary">
              📊 Export Excel
            </a>
            <Link href="/ledger/new" className="btn-primary">+ Manual entry</Link>
          </>
        }
      />

      <DateRangeFilter basePath="/ledger" active={sp.range ?? "this_month"} from={sp.from} to={sp.to} />

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="kpi-tile">
          <span className="text-xs text-slate-500">Income</span>
          <span className="text-xl font-semibold text-green-700">{formatMoney(summary.income)}</span>
        </div>
        <div className="kpi-tile">
          <span className="text-xs text-slate-500">Expenses</span>
          <span className="text-xl font-semibold text-red-700">{formatMoney(summary.expense)}</span>
        </div>
        <div className="kpi-tile">
          <span className="text-xs text-slate-500">Profit / Loss</span>
          <span className={`text-xl font-semibold ${summary.profitLoss >= 0 ? "text-green-700" : "text-red-700"}`}>
            {formatMoney(summary.profitLoss)}
          </span>
        </div>
        <div className="kpi-tile">
          <span className="text-xs text-slate-500">Net cashflow</span>
          <span className="text-xl font-semibold">{formatMoney(summary.income - summary.expense)}</span>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        <Section title="Expenses by category">
          <div className="card divide-y divide-slate-100">
            {summary.byCategory.length === 0 && <p className="p-4 text-sm text-slate-500">No expense entries in range.</p>}
            {summary.byCategory.map(([cat, amt]) => (
              <div key={cat} className="p-3 flex justify-between text-sm">
                <span>{cat}</span>
                <span className="font-medium">{formatMoney(amt)}</span>
              </div>
            ))}
          </div>
        </Section>
        <Section title="Revenue by client">
          <div className="card divide-y divide-slate-100">
            {summary.byClient.length === 0 && <p className="p-4 text-sm text-slate-500">No client revenue in range.</p>}
            {summary.byClient.map(([name, amt]) => (
              <div key={name} className="p-3 flex justify-between text-sm">
                <span>{name}</span>
                <span className="font-medium">{formatMoney(amt)}</span>
              </div>
            ))}
          </div>
        </Section>
      </div>

      <Section title="Ledger entries">
        <DataTable
          rows={summary.entries}
          emptyMessage="No ledger entries in this range."
          columns={[
            { header: "Date", render: (e) => formatDate(e.date) },
            { header: "Type", render: (e) => labelize(e.type) },
            { header: "Category", render: (e) => e.category ?? "-" },
            { header: "Amount", render: (e) => formatMoney(e.amount, e.currency) },
            { header: "VAT", render: (e) => (e.vat ? formatMoney(e.vat, e.currency) : "-") },
            { header: "Payment method", render: (e) => e.paymentMethod ?? "-" },
            { header: "Source", render: (e) => e.sourceModule ?? "-" },
            { header: "Notes", render: (e) => e.notes ?? "-" },
          ]}
        />
      </Section>
    </div>
  );
}
