import { ConfidenceBadge, StatusBadge } from "@/components/ui/Badge";
import { formatDateTime } from "@/lib/format";
import { labelize } from "@/lib/constants";

interface DocLike {
  id: string;
  fileName: string;
  documentType: string;
  category?: string | null;
  ocrStatus: string;
  ocrConfidence?: number | null;
  status: string;
  createdAt: Date;
}

export function DocumentList({ documents }: { documents: DocLike[] }) {
  if (documents.length === 0) {
    return <p className="text-sm text-slate-500">No documents uploaded yet.</p>;
  }
  return (
    <ul className="divide-y divide-slate-100 card">
      {documents.map((d) => (
        <li key={d.id} className="p-3 flex flex-wrap items-center gap-2 justify-between">
          <div className="min-w-0">
            <a href={`/api/files/${d.id}`} target="_blank" className="text-brand-700 font-medium hover:underline break-all">
              {d.fileName}
            </a>
            <div className="text-xs text-slate-500 mt-0.5">
              {labelize(d.documentType)} {d.category ? `· ${d.category}` : ""} · {formatDateTime(d.createdAt)}
            </div>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <StatusBadge status={d.status} />
            {d.ocrStatus === "FAILED" && <StatusBadge status="NEEDS_REVIEW" />}
            {d.ocrConfidence !== null && d.ocrConfidence !== undefined && <ConfidenceBadge confidence={d.ocrConfidence} />}
          </div>
        </li>
      ))}
    </ul>
  );
}
