import { db } from "@/lib/db";
import { PageHeader, Section } from "@/components/ui/Page";
import { StatusBadge } from "@/components/ui/Badge";
import { formatDate } from "@/lib/format";
import Link from "next/link";

interface Result {
  type: string;
  title: string;
  subtitle?: string;
  date?: Date | null;
  status?: string | null;
  href: string;
}

export default async function SearchPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q } = await searchParams;
  const query = q?.trim();
  const results: Result[] = [];

  if (query) {
    const [clients, people, invoices, receivedInvoices, documents, deadlines, expenses, receivedContracts, sentContracts, policies, taxRecords, rentRecords] =
      await Promise.all([
        db.client.findMany({ where: { OR: [{ name: { contains: query } }, { companyName: { contains: query } }] }, take: 15 }),
        db.person.findMany({ where: { OR: [{ firstName: { contains: query } }, { lastName: { contains: query } }, { role: { contains: query } }] }, take: 15 }),
        db.invoice.findMany({ where: { OR: [{ number: { contains: query } }, { clientNameSnapshot: { contains: query } }, { description: { contains: query } }] }, take: 15 }),
        db.receivedInvoice.findMany({ where: { OR: [{ vendorName: { contains: query } }, { invoiceNumber: { contains: query } }] }, take: 15 }),
        db.document.findMany({ where: { OR: [{ fileName: { contains: query } }, { ocrText: { contains: query } }, { category: { contains: query } }] }, take: 15 }),
        db.deadline.findMany({ where: { OR: [{ title: { contains: query } }, { category: { contains: query } }] }, take: 15 }),
        db.expense.findMany({ where: { OR: [{ vendor: { contains: query } }, { actorLabel: { contains: query } }, { description: { contains: query } }] }, take: 15 }),
        db.receivedContract.findMany({ where: { counterpartyName: { contains: query } }, take: 10 }),
        db.sentContract.findMany({ where: { partnerName: { contains: query } }, take: 10 }),
        db.platformPolicy.findMany({ where: { policyName: { contains: query } }, take: 10 }),
        db.taxRecord.findMany({ where: { OR: [{ docType: { contains: query } }, { taxRefNumber: { contains: query } }] }, take: 10 }),
        db.rentRecord.findMany({ where: { OR: [{ landlordName: { contains: query } }, { location: { contains: query } }, { officeName: { contains: query } }] }, take: 10 }),
      ]);

    for (const c of clients) results.push({ type: "Client", title: c.name, subtitle: c.companyName ?? undefined, status: c.status, href: `/clients/${c.id}` });
    for (const p of people) results.push({ type: "Person (HR)", title: `${p.firstName} ${p.lastName}`, subtitle: p.role ?? undefined, status: p.status, href: `/hr/${p.id}` });
    for (const i of invoices) results.push({ type: "Invoice", title: i.number, subtitle: i.clientNameSnapshot ?? undefined, date: i.invoiceDate, status: i.status, href: `/billing/${i.id}` });
    for (const r of receivedInvoices) results.push({ type: "Received Invoice", title: r.vendorName ?? "Supplier invoice", subtitle: r.invoiceNumber ?? undefined, date: r.invoiceDate, status: r.paymentStatus, href: `/received-invoices/${r.id}` });
    for (const d of documents) results.push({ type: "Document", title: d.fileName, subtitle: d.category ?? d.documentType, date: d.createdAt, status: d.status, href: `/api/files/${d.id}` });
    for (const dl of deadlines) results.push({ type: "Deadline", title: dl.title, subtitle: dl.category, date: dl.date, status: dl.status, href: `/deadlines` });
    for (const e of expenses) results.push({ type: "Expense", title: e.vendor ?? "Expense", subtitle: e.actorLabel, date: e.expenseDate, status: e.status, href: `/expenses/${e.id}` });
    for (const c of receivedContracts) results.push({ type: "Received Contract", title: c.counterpartyName ?? "Contract", date: c.endDate, status: c.status, href: `/contracts/received/${c.id}` });
    for (const c of sentContracts) results.push({ type: "Sent Contract", title: c.partnerName ?? "Contract", date: c.endDate, status: c.status, href: `/contracts/sent/${c.id}` });
    for (const p of policies) results.push({ type: "Policy", title: p.policyName, date: p.reviewDate, status: p.status, href: `/contracts/policies/${p.id}` });
    for (const t of taxRecords) results.push({ type: "Tax / Admin", title: t.docType.replace(/_/g, " "), subtitle: t.taxRefNumber ?? undefined, date: t.nextDueDate, status: t.status, href: `/admin-tax/${t.id}` });
    for (const r of rentRecords) results.push({ type: "Rent / Lease", title: r.officeName ?? r.location ?? "Lease", subtitle: r.landlordName ?? undefined, date: r.endDate, href: `/rent/${r.id}` });
  }

  return (
    <div>
      <PageHeader title="Global Search" description="Search across clients, invoices, documents, HR, contracts, deadlines and more." />
      <form action="/search" method="get" className="mb-6 max-w-xl">
        <input type="search" name="q" defaultValue={query} placeholder='e.g. "Cristina expenses", "contracts expiring in August"' className="form-input" autoFocus />
      </form>

      {query && (
        <Section title={`${results.length} result${results.length === 1 ? "" : "s"} for "${query}"`}>
          <div className="card divide-y divide-slate-100">
            {results.length === 0 && <p className="p-4 text-sm text-slate-500">No matches found.</p>}
            {results.map((r, i) => (
              <Link key={i} href={r.href} className="p-3 flex flex-wrap items-center justify-between gap-2 hover:bg-slate-50">
                <div>
                  <span className="text-xs font-semibold uppercase tracking-wide text-slate-400 mr-2">{r.type}</span>
                  <span className="font-medium text-brand-700">{r.title}</span>
                  {r.subtitle && <span className="text-sm text-slate-500 ml-2">{r.subtitle}</span>}
                </div>
                <div className="flex items-center gap-2 text-xs text-slate-500">
                  {r.date && <span>{formatDate(r.date)}</span>}
                  {r.status && <StatusBadge status={r.status} />}
                </div>
              </Link>
            ))}
          </div>
        </Section>
      )}
    </div>
  );
}
