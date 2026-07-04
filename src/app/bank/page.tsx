import { db } from "@/lib/db";
import { PageHeader, Section } from "@/components/ui/Page";
import { DataTable } from "@/components/ui/Table";
import { StatusBadge } from "@/components/ui/Badge";
import { Select } from "@/components/ui/Field";
import { formatDate, formatMoney } from "@/lib/format";
import { BANK_TXN_CATEGORIES, RECONCILIATION_STATUSES, labelize } from "@/lib/constants";
import { DocumentList } from "@/components/DocumentList";
import Link from "next/link";
import { classifyBankTransaction } from "./actions";

export default async function BankPage({ searchParams }: { searchParams: Promise<{ filter?: string }> }) {
  const { filter } = await searchParams;

  const [statements, transactions, bankDocuments] = await Promise.all([
    db.bankStatement.findMany({ orderBy: { createdAt: "desc" } }),
    db.bankTransaction.findMany({
      where: filter === "unmatched" ? { reconciliation: "UNMATCHED" } : undefined,
      orderBy: { date: "desc" },
      take: 200,
    }),
    db.bankDocument.findMany({ orderBy: { createdAt: "desc" } }),
  ]);

  const docIds = bankDocuments.map((d) => d.documentId).filter((x): x is string => !!x);
  const documents = docIds.length ? await db.document.findMany({ where: { id: { in: docIds } } }) : [];

  return (
    <div className="space-y-8">
      <PageHeader
        title="Bank / Bank Documents"
        description="Bank statements, transactions, and bank-related documents."
        actions={
          <>
            <Link href="/bank/documents/new" className="btn-secondary">+ Bank document</Link>
            <Link href="/bank/statements/new" className="btn-primary">+ Upload statement</Link>
          </>
        }
      />

      <Section title="Statements">
        <DataTable
          rows={statements}
          emptyMessage="No bank statements uploaded yet."
          columns={[
            { header: "Bank", render: (s) => s.bankName ?? "-" },
            { header: "Account", render: (s) => s.accountName ?? "-" },
            { header: "Period", render: (s) => `${formatDate(s.periodStart)} – ${formatDate(s.periodEnd)}` },
            { header: "Opening", render: (s) => formatMoney(s.openingBalance) },
            { header: "Closing", render: (s) => formatMoney(s.closingBalance) },
          ]}
        />
      </Section>

      <Section title="Transactions">
        <div className="flex gap-2 mb-3">
          <Link href="/bank" className={!filter ? "btn-primary !py-1 !text-xs" : "btn-secondary !py-1 !text-xs"}>All</Link>
          <Link href="/bank?filter=unmatched" className={filter === "unmatched" ? "btn-primary !py-1 !text-xs" : "btn-secondary !py-1 !text-xs"}>
            Unmatched (requires review)
          </Link>
        </div>
        <DataTable
          rows={transactions}
          emptyMessage="No bank transactions yet."
          columns={[
            { header: "Date", render: (t) => formatDate(t.date) },
            { header: "Description", render: (t) => t.description ?? "-" },
            { header: "In", render: (t) => (t.moneyIn ? formatMoney(t.moneyIn) : "-") },
            { header: "Out", render: (t) => (t.moneyOut ? formatMoney(t.moneyOut) : "-") },
            { header: "Balance", render: (t) => (t.balanceAfter !== null ? formatMoney(t.balanceAfter) : "-") },
            {
              header: "Classify",
              render: (t) => (
                <form
                  action={async (fd: FormData) => {
                    "use server";
                    await classifyBankTransaction(t.id, fd);
                  }}
                  className="flex items-center gap-1.5"
                >
                  <Select name="category" options={BANK_TXN_CATEGORIES.map((c) => ({ value: c, label: c }))} defaultValue={t.category ?? ""} placeholder="Category" className="!py-1 !text-xs w-36" />
                  <Select name="reconciliation" options={RECONCILIATION_STATUSES.map((s) => ({ value: s, label: labelize(s) }))} defaultValue={t.reconciliation} className="!py-1 !text-xs w-32" />
                  <button type="submit" className="btn-ghost !py-1 !text-xs">Save</button>
                </form>
              ),
            },
          ]}
        />
      </Section>

      <Section title="Bank documents (IBAN letter, KYC, confirmations, correspondence...)">
        <DocumentList documents={documents} />
      </Section>
    </div>
  );
}
