export const dynamic = "force-dynamic";

import { db } from "@/lib/db";
import { PageHeader, Section } from "@/components/ui/Page";
import { Field, FormGrid, Select, TextArea, TextInput } from "@/components/ui/Field";
import { CURRENCIES, PAYMENT_METHODS } from "@/lib/constants";
import { createGeneratedDocument } from "../actions";

const PACKAGE_TYPES = ["Monthly Subscription", "Quarterly Subscription", "Annual Subscription", "One-off Campaign", "Custom"];
const CREATOR_TYPES = ["Mixed", "Nano", "Micro", "Macro", "Celebrity"];
const VAT_MODES = [
  { value: "EXCLUDED", label: "Excluded (add on top)" },
  { value: "INCLUDED", label: "Included in price" },
  { value: "NONE", label: "No VAT" },
];
const FREQUENCIES = ["One-off", "Monthly", "Quarterly", "Annual"];
const REFUND_POLICIES = ["Not applicable", "Pro-rata refund", "Full refund within 7 days", "No refund"];

export default async function NewDocumentPage({ searchParams }: { searchParams: Promise<{ kind?: string; clientId?: string }> }) {
  const { kind: kindParam, clientId } = await searchParams;
  const kind = kindParam === "INVOICE" ? "INVOICE" : "QUOTATION";
  const isInvoice = kind === "INVOICE";
  const clients = await db.client.findMany({ orderBy: { name: "asc" } });
  const today = new Date().toISOString().slice(0, 10);
  const validDefault = new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10);

  return (
    <div className="max-w-4xl">
      <PageHeader
        title={isInvoice ? "Create invoice document" : "Create quotation"}
        description="Most fields are pre-filled with sensible defaults — at minimum set the price, then generate. The document opens where you can Print / Save as PDF or download Word (.docx)."
      />

      <div className="mb-4 flex gap-2 text-sm">
        <a href="/billing/documents/new?kind=QUOTATION" className={`px-3 py-1.5 rounded-md border ${!isInvoice ? "bg-brand-600 text-white border-brand-600" : "border-slate-200 text-slate-600"}`}>
          Quotation
        </a>
        <a href="/billing/documents/new?kind=INVOICE" className={`px-3 py-1.5 rounded-md border ${isInvoice ? "bg-brand-600 text-white border-brand-600" : "border-slate-200 text-slate-600"}`}>
          Invoice
        </a>
      </div>

      <form action={createGeneratedDocument} className="space-y-5">
        <input type="hidden" name="kind" value={kind} />

        <Section title="1 · Client">
          <FormGrid>
            <Field label="Link to existing client (optional)">
              <Select name="clientId" options={clients.map((c) => ({ value: c.id, label: c.name }))} placeholder="No link" defaultValue={clientId} />
            </Field>
            <Field label="Company name">
              <TextInput name="companyName" />
            </Field>
            <Field label="Brand / trade name">
              <TextInput name="brandName" />
            </Field>
            <Field label="Contact person">
              <TextInput name="contactPerson" />
            </Field>
            <Field label="Email">
              <TextInput type="email" name="clientEmail" />
            </Field>
            <Field label="Phone">
              <TextInput name="clientPhone" />
            </Field>
            <Field label="TRN / VAT no.">
              <TextInput name="clientTrn" />
            </Field>
            <Field label="Address">
              <TextInput name="clientAddress" />
            </Field>
          </FormGrid>
        </Section>

        <Section title="2 · Package">
          <FormGrid>
            <Field label="Package type">
              <Select name="packageType" options={PACKAGE_TYPES.map((p) => ({ value: p, label: p }))} defaultValue="Monthly Subscription" />
            </Field>
            <Field label="Package name (optional)">
              <TextInput name="packageName" placeholder="e.g. Growth, Starter" />
            </Field>
            <Field label="Venues included">
              <TextInput type="number" name="venues" defaultValue="1" />
            </Field>
            <Field label="Coverage / market">
              <TextInput name="coverage" defaultValue="UAE & GCC" />
            </Field>
            <Field label="Campaigns included (per month)">
              <TextInput type="number" name="campaigns" defaultValue="15" />
            </Field>
            <Field label="Creators included (per month)">
              <TextInput type="number" name="creators" defaultValue="100" />
            </Field>
            <Field label="Creator type">
              <Select name="creatorType" options={CREATOR_TYPES.map((c) => ({ value: c, label: c }))} defaultValue="Mixed" />
            </Field>
            <Field label="Subject line">
              <TextInput name="subjectLine" placeholder="Starflare Platform Subscription" />
            </Field>
          </FormGrid>
          <label className="flex items-center gap-2 text-sm text-slate-600 mt-3">
            <input type="checkbox" name="includePackageList" defaultChecked /> Include the &quot;Package &amp; Platform Access&quot; list in the document
          </label>
        </Section>

        <Section title="3 · Pricing & payment">
          <FormGrid>
            <Field label="Price / fee">
              <TextInput type="number" step="0.01" name="price" placeholder="0.00" required />
            </Field>
            <Field label="Currency">
              <Select name="currency" options={CURRENCIES.map((c) => ({ value: c, label: c }))} defaultValue="AED" />
            </Field>
            <Field label="VAT">
              <Select name="vatMode" options={VAT_MODES} defaultValue="EXCLUDED" />
            </Field>
            <Field label="VAT %">
              <TextInput type="number" step="0.1" name="vatPercent" defaultValue="5" />
            </Field>
            <Field label="Payment method">
              <Select name="paymentMethod" options={PAYMENT_METHODS.map((m) => ({ value: m, label: m }))} defaultValue="Bank transfer" />
            </Field>
            <Field label="Payment frequency">
              <Select name="paymentFrequency" options={FREQUENCIES.map((f) => ({ value: f, label: f }))} defaultValue="Monthly" />
            </Field>
          </FormGrid>
          <Field label="Payment terms">
            <TextArea name="paymentTerms" rows={2} defaultValue="100% advance payment due within seven (7) calendar days of acceptance of this document." />
          </Field>
          <div className="mt-3">
            <p className="form-label">Extra line items (optional)</p>
            {[0, 1, 2].map((i) => (
              <div key={i} className="grid grid-cols-1 sm:grid-cols-6 gap-2 mb-2">
                <input className="form-input sm:col-span-4" name="itemDescription" placeholder="Description" />
                <input className="form-input" name="itemQty" type="number" placeholder="Qty" />
                <input className="form-input" name="itemRate" type="number" step="0.01" placeholder="Rate" />
              </div>
            ))}
          </div>
        </Section>

        <Section title="4 · Term & renewal">
          <FormGrid>
            <Field label="Initial term">
              <TextInput name="initialTerm" defaultValue="1 month" />
            </Field>
            <Field label="Start / activation date">
              <TextInput type="date" name="startDate" defaultValue={today} />
            </Field>
          </FormGrid>
          <div className="flex gap-6 mt-2 text-sm text-slate-600">
            <label className="flex items-center gap-2"><input type="checkbox" name="autoRenewal" defaultChecked /> Auto-renewal</label>
            <label className="flex items-center gap-2"><input type="checkbox" name="cancellationViaPlatform" defaultChecked /> Cancellation via platform</label>
          </div>
        </Section>

        <Section title="5 · Refund, conditions & signatories">
          <FormGrid>
            <Field label="Refund policy">
              <Select name="refundPolicy" options={REFUND_POLICIES.map((r) => ({ value: r, label: r }))} defaultValue="Not applicable" />
            </Field>
            <Field label="Document date">
              <TextInput type="date" name="docDate" defaultValue={today} />
            </Field>
            <Field label={isInvoice ? "Due date" : "Valid until"}>
              <TextInput type="date" name="validUntil" defaultValue={validDefault} />
            </Field>
            <Field label="Discount (optional)">
              <TextInput name="discount" placeholder="e.g. 10% first month" />
            </Field>
            <Field label="Exclusivity (optional)">
              <TextInput name="exclusivity" />
            </Field>
          </FormGrid>
          <div className="flex gap-6 mt-2 text-sm text-slate-600">
            <label className="flex items-center gap-2"><input type="checkbox" name="paidMediaIncluded" /> Paid media / whitelisting included</label>
            <label className="flex items-center gap-2"><input type="checkbox" name="extraUsageRights" /> Extra usage rights included</label>
          </div>
          <Field label="Other notes">
            <TextArea name="otherNotes" rows={2} />
          </Field>
          <FormGrid>
            <Field label="Starflare signatory">
              <TextInput name="starflareSignatory" />
            </Field>
            <Field label="Signatory title">
              <TextInput name="signatoryTitle" placeholder="e.g. COO" />
            </Field>
            <Field label="Client signatory (if known)">
              <TextInput name="clientSignatory" />
            </Field>
          </FormGrid>
        </Section>

        <div className="flex justify-end">
          <button className="btn-primary" type="submit">
            Generate {isInvoice ? "invoice" : "quotation"}
          </button>
        </div>
      </form>
    </div>
  );
}
