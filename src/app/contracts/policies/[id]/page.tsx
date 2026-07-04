import { db } from "@/lib/db";
import { notFound } from "next/navigation";
import { PageHeader, Section } from "@/components/ui/Page";
import { StatusBadge } from "@/components/ui/Badge";
import { Select } from "@/components/ui/Field";
import { DocumentList } from "@/components/DocumentList";
import { formatDate } from "@/lib/format";
import { POLICY_STATUSES, labelize } from "@/lib/constants";
import { updatePolicyStatus } from "../../actions";

export default async function PolicyDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const policy = await db.platformPolicy.findUnique({ where: { id } });
  if (!policy) notFound();

  const [documents, versions] = await Promise.all([
    policy.documentId ? db.document.findMany({ where: { id: policy.documentId } }) : Promise.resolve([]),
    db.policyVersion.findMany({ where: { policyId: id }, orderBy: { createdAt: "desc" } }),
  ]);

  async function changeStatus(fd: FormData) {
    "use server";
    await updatePolicyStatus(id, fd.get("status") as string);
  }

  return (
    <div className="max-w-3xl space-y-6">
      <PageHeader title={policy.policyName} description={policy.versionNumber ? `v${policy.versionNumber}` : undefined} actions={<StatusBadge status={policy.status} />} />

      <Section title="Details">
        <div className="card p-5 grid grid-cols-2 gap-4 text-sm">
          <div><div className="text-slate-500">Approval date</div><div className="font-medium">{formatDate(policy.approvalDate)}</div></div>
          <div><div className="text-slate-500">Effective date</div><div className="font-medium">{formatDate(policy.effectiveDate)}</div></div>
          <div><div className="text-slate-500">Review date</div><div className="font-medium">{formatDate(policy.reviewDate)}</div></div>
        </div>
      </Section>

      <Section title="Status">
        <form action={changeStatus} className="card p-4 flex items-center gap-3">
          <Select name="status" options={POLICY_STATUSES.map((s) => ({ value: s, label: labelize(s) }))} defaultValue={policy.status} className="w-56" />
          <button className="btn-secondary" type="submit">Update status</button>
        </form>
      </Section>

      <Section title="Version history">
        <div className="card divide-y divide-slate-100">
          {versions.length === 0 && <p className="p-4 text-sm text-slate-500">No version history recorded.</p>}
          {versions.map((v) => (
            <div key={v.id} className="p-3 text-sm flex justify-between">
              <span>v{v.versionNumber} {v.changeNotes ? `— ${v.changeNotes}` : ""}</span>
              <span className="text-slate-500">{formatDate(v.createdAt)}</span>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Document">
        <DocumentList documents={documents} />
      </Section>
    </div>
  );
}
