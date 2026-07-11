export const dynamic = "force-dynamic";

import { db } from "@/lib/db";
import { PageHeader, Section } from "@/components/ui/Page";
import { DocumentUploader } from "@/components/DocumentUploader";
import { SubmitButton } from "@/components/SubmitButton";
import { WipeDataForm } from "@/components/WipeDataForm";
import { formatDate } from "@/lib/format";
import { uploadCompanyLogo, removeCompanyLogo, restoreBackup, wipeAllData } from "./actions";

async function listBackups(): Promise<{ url: string; name: string; uploadedAt: Date; size: number }[]> {
  try {
    const { list } = await import("@vercel/blob");
    const { blobs } = await list({ prefix: "backups/" });
    return blobs
      .map((b) => ({ url: b.url, name: b.pathname.replace("backups/", ""), uploadedAt: b.uploadedAt, size: b.size }))
      .sort((a, b) => (a.uploadedAt < b.uploadedAt ? 1 : -1));
  } catch {
    return [];
  }
}

export default async function SettingsPage() {
  const [setting, backups] = await Promise.all([
    db.setting.findUnique({ where: { id: "singleton" } }),
    listBackups(),
  ]);

  return (
    <div className="max-w-2xl space-y-8">
      <PageHeader title="Settings" description="Company branding, backups and data management." />

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

      <Section title="Backup & export">
        <div className="card p-5 space-y-4">
          <p className="text-sm text-slate-500">
            A complete snapshot of everything in the system is saved automatically once a day (kept for 14 days). You can also
            download a snapshot any time as a single JSON file — keep it somewhere safe.
          </p>
          <a href="/api/export" className="btn-primary inline-flex">⬇ Download full backup (JSON)</a>

          <div>
            <div className="text-sm font-medium text-slate-700 mb-2">Automatic daily backups</div>
            {backups.length === 0 ? (
              <p className="text-sm text-slate-400">
                No automatic backups yet — the first one runs on the next scheduled cycle (or you can download one now above).
              </p>
            ) : (
              <div className="divide-y divide-slate-100 border border-slate-200 rounded-lg">
                {backups.map((b) => (
                  <a key={b.url} href={b.url} className="flex items-center justify-between px-3 py-2 text-sm hover:bg-slate-50">
                    <span className="truncate">{b.name}</span>
                    <span className="text-slate-400 ml-3 whitespace-nowrap">
                      {formatDate(b.uploadedAt)} · {(b.size / 1024).toFixed(0)} KB
                    </span>
                  </a>
                ))}
              </div>
            )}
          </div>
        </div>
      </Section>

      <Section title="Restore from backup">
        <div className="card p-5 space-y-3">
          <p className="text-sm text-slate-500">
            Import a previously downloaded backup file. This <strong>replaces all current data</strong> with the contents of the
            file, so use it to recover after a mistake or to move data between environments.
          </p>
          <form action={restoreBackup} className="space-y-3">
            <DocumentUploader name="file" label="Choose backup file" accept="application/json,.json" required />
            <div className="flex justify-end">
              <SubmitButton className="btn-secondary" pendingLabel="Restoring…">Restore backup</SubmitButton>
            </div>
          </form>
        </div>
      </Section>

      <Section title="Danger zone">
        <div className="card p-5 space-y-4 border-red-200 bg-red-50/40">
          <div>
            <div className="font-semibold text-red-800">Delete all data</div>
            <p className="text-sm text-red-700/90 mt-1">
              Permanently erases every client, invoice, expense, payment and record, <strong>plus all uploaded files</strong>
              {" "}(receipts, PDFs, ID photos), so you can start entering real data from scratch. Your company logo and saved
              backups are kept. <strong>This cannot be undone</strong> — download a backup first if in doubt.
            </p>
          </div>
          <WipeDataForm action={wipeAllData} />
        </div>
      </Section>
    </div>
  );
}
