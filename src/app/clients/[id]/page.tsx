export const dynamic = "force-dynamic";

import { db } from "@/lib/db";
import { notFound } from "next/navigation";
import { PageHeader, Section } from "@/components/ui/Page";
import { Field, FormGrid, Select, TextArea, TextInput } from "@/components/ui/Field";
import { StatusBadge } from "@/components/ui/Badge";
import { DataTable } from "@/components/ui/Table";
import { DocumentList } from "@/components/DocumentList";
import { formatDate, formatMoney } from "@/lib/format";
import { CLIENT_STATUSES, CURRENCIES, PAYMENT_METHODS, PURCHASE_TYPES, SUBSCRIPTION_STATUSES, labelize } from "@/lib/constants";
import { DeleteButton } from "@/components/DeleteButton";
import { addPurchase, addSubscription, updateClient, deleteClient } from "../actions";
import Link from "next/link";

export default async function ClientDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const client = await db.client.findUnique({ where: { id } });
  if (!client) notFound();

  const [purchases, subscriptions, invoices, payments, documents] = await Promise.all([
    db.purchase.findMany({ where: { clientId: id }, orderBy: { date: "desc" } }),
    db.subscription.findMany({ where: { clientId: id }, orderBy: { createdAt: "desc" } }),
    db.invoice.findMany({ where: { clientId: id }, orderBy: { invoiceDate: "desc" } }),
    db.payment.findMany({ where: { clientId: id }, orderBy: { date: "desc" } }),
    db.document.findMany({ where: { clientId: id }, orderBy: { createdAt: "desc" } }),
  ]);

  const updateAction = updateClient.bind(null, id);
  const purchaseAction = addPurchase.bind(null, id);
  const subscriptionAction = addSubscription.bind(null, id);

  return (
    <div className="max-w-4xl space-y-8">
      <PageHeader
        title={client.name}
        description={client.companyName ?? undefined}
        actions={
          <div className="flex items-center gap-2">
            <StatusBadge status={client.status} />
            <DeleteButton action={deleteClient.bind(null, id)} confirm="Delete this client? Their purchases are removed and invoices unlinked. This cannot be undone." />
          </div>
        }
      />

      <Section title="Profile">
        <form action={updateAction} className="card p-5 space-y-4">
          <FormGrid>
            <Field label="Client name" required>
              <TextInput name="name" defaultValue={client.name} required />
            </Field>
            <Field label="Company name">
              <TextInput name="companyName" defaultValue={client.companyName ?? ""} />
            </Field>
            <Field label="Trade license number">
              <TextInput name="tradeLicenseNumber" defaultValue={client.tradeLicenseNumber ?? ""} />
            </Field>
            <Field label="TRN / VAT number">
              <TextInput name="trn" defaultValue={client.trn ?? ""} />
            </Field>
            <Field label="Main contact person">
              <TextInput name="mainContact" defaultValue={client.mainContact ?? ""} />
            </Field>
            <Field label="Main email">
              <TextInput type="email" name="mainEmail" defaultValue={client.mainEmail ?? ""} />
            </Field>
            <Field label="Billing email">
              <TextInput type="email" name="billingEmail" defaultValue={client.billingEmail ?? ""} />
            </Field>
            <Field label="Phone number">
              <TextInput name="phone" defaultValue={client.phone ?? ""} />
            </Field>
            <Field label="Website / Instagram">
              <TextInput name="website" defaultValue={client.website ?? ""} />
            </Field>
            <Field label="Status">
              <Select name="status" options={CLIENT_STATUSES.map((s) => ({ value: s, label: labelize(s) }))} defaultValue={client.status} />
            </Field>
          </FormGrid>
          <Field label="Address">
            <TextArea name="address" defaultValue={client.address ?? ""} rows={2} />
          </Field>
          <Field label="Notes">
            <TextArea name="notes" defaultValue={client.notes ?? ""} />
          </Field>
          <div className="flex justify-end">
            <button className="btn-primary" type="submit">Save changes</button>
          </div>
        </form>
      </Section>

      <Section title="Issued invoices" actions={<Link href={`/billing/new?clientId=${id}`} className="btn-secondary !py-1 !text-xs">+ New invoice</Link>}>
        <DataTable
          rows={invoices}
          href={(inv) => `/billing/${inv.id}`}
          emptyMessage="No invoices issued yet."
          columns={[
            { header: "Number", render: (i) => i.number },
            { header: "Date", render: (i) => formatDate(i.invoiceDate) },
            { header: "Total", render: (i) => formatMoney(i.total, i.currency) },
            { header: "Status", render: (i) => <StatusBadge status={i.status} /> },
          ]}
        />
      </Section>

      <Section title="Payments received">
        <DataTable
          rows={payments}
          emptyMessage="No payments recorded yet."
          columns={[
            { header: "Date", render: (p) => formatDate(p.date) },
            { header: "Amount", render: (p) => formatMoney(p.amount, p.currency) },
            { header: "Method", render: (p) => p.method ?? "-" },
            { header: "Reconciliation", render: (p) => <StatusBadge status={p.reconciliation} /> },
          ]}
        />
      </Section>

      <Section title="Purchase history">
        <form action={purchaseAction} className="card p-4 space-y-3 mb-4">
          <FormGrid>
            <Field label="Purchase type">
              <Select name="type" options={PURCHASE_TYPES.map((t) => ({ value: t, label: labelize(t) }))} defaultValue="SINGLE_CAMPAIGN" />
            </Field>
            <Field label="Date">
              <TextInput type="date" name="date" defaultValue={new Date().toISOString().slice(0, 10)} />
            </Field>
            <Field label="Amount">
              <div className="flex gap-2">
                <TextInput type="number" step="0.01" name="amount" className="flex-1" />
                <Select name="currency" options={CURRENCIES.map((c) => ({ value: c, label: c }))} defaultValue="AED" className="w-24" />
              </div>
            </Field>
            <Field label="Payment method">
              <Select name="paymentMethod" options={PAYMENT_METHODS.map((m) => ({ value: m, label: m }))} placeholder="Select..." />
            </Field>
          </FormGrid>
          <Field label="Notes">
            <TextArea name="notes" rows={2} />
          </Field>
          <div className="flex justify-end">
            <button className="btn-primary" type="submit">Add purchase</button>
          </div>
        </form>
        <DataTable
          rows={purchases}
          emptyMessage="No purchases recorded yet."
          columns={[
            { header: "Type", render: (p) => labelize(p.type) },
            { header: "Date", render: (p) => formatDate(p.date) },
            { header: "Amount", render: (p) => formatMoney(p.amount, p.currency) },
            { header: "Method", render: (p) => p.paymentMethod ?? "-" },
          ]}
        />
      </Section>

      <Section title="Subscriptions">
        <form action={subscriptionAction} className="card p-4 space-y-3 mb-4">
          <FormGrid>
            <Field label="Package name">
              <TextInput name="packageName" required />
            </Field>
            <Field label="Price">
              <div className="flex gap-2">
                <TextInput type="number" step="0.01" name="price" className="flex-1" />
                <Select name="currency" options={CURRENCIES.map((c) => ({ value: c, label: c }))} defaultValue="AED" className="w-24" />
              </div>
            </Field>
            <Field label="Start date">
              <TextInput type="date" name="startDate" defaultValue={new Date().toISOString().slice(0, 10)} />
            </Field>
            <Field label="End date">
              <TextInput type="date" name="endDate" />
            </Field>
            <Field label="Renewal date">
              <TextInput type="date" name="renewalDate" />
            </Field>
            <Field label="Status">
              <Select name="status" options={SUBSCRIPTION_STATUSES.map((s) => ({ value: s, label: labelize(s) }))} defaultValue="ACTIVE" />
            </Field>
          </FormGrid>
          <div className="flex justify-end">
            <button className="btn-primary" type="submit">Add subscription</button>
          </div>
        </form>
        <DataTable
          rows={subscriptions}
          emptyMessage="No subscriptions yet."
          columns={[
            { header: "Package", render: (s) => s.packageName },
            { header: "Price", render: (s) => formatMoney(s.price, s.currency) },
            { header: "Start", render: (s) => formatDate(s.startDate) },
            { header: "Renewal", render: (s) => formatDate(s.renewalDate) },
            { header: "Status", render: (s) => <StatusBadge status={s.status} /> },
          ]}
        />
      </Section>

      <Section title="Documents">
        <DocumentList documents={documents} />
      </Section>
    </div>
  );
}
