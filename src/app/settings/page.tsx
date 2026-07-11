export const dynamic = "force-dynamic";

import { db } from "@/lib/db";
import { PageHeader, Section } from "@/components/ui/Page";
import { DocumentUploader } from "@/components/DocumentUploader";
import { SubmitButton } from "@/components/SubmitButton";
import { uploadCompanyLogo, removeCompanyLogo } from "./actions";

export default async function SettingsPage() {
  const setting = await db.setting.findUnique({ where: { id: "singleton" } });

  return (
    <div className="max-w-2xl">
      <PageHeader title="Settings" description="Company branding used on quotations and invoices." />

      <Section title="Company logo">
        <div className="card p-5 space-y-4">
          <p className="text-sm text-slate-500">
            Upload your Starflare logo (PNG or JPG works best, ideally with a transparent or white background). It appears at the
            top of every quotation and invoice — on screen, in the printed PDF, and in the downloaded Word file.
          </p>

          {setting?.companyLogoUrl ? (
            <div className="flex items-center gap-4">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={setting.companyLogoUrl} alt="Current logo" className="h-14 w-auto border border-slate-200 rounded bg-white p-1" />
              <form action={removeCompanyLogo}>
                <SubmitButton className="btn-secondary">Remove</SubmitButton>
              </form>
            </div>
          ) : (
            <p className="text-sm text-slate-400">No logo uploaded yet — documents use the built-in Starflare wordmark.</p>
          )}

          <form action={uploadCompanyLogo} className="space-y-3">
            <DocumentUploader name="file" label="Upload logo" accept="image/*" required />
            <div className="flex justify-end">
              <SubmitButton pendingLabel="Saving logo…">Save logo</SubmitButton>
            </div>
          </form>
        </div>
      </Section>
    </div>
  );
}
