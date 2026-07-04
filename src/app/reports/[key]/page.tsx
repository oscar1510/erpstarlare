export const dynamic = "force-dynamic";

import { notFound } from "next/navigation";
import { PageHeader } from "@/components/ui/Page";
import { REPORTS } from "@/lib/reports";

export default async function ReportViewPage({ params }: { params: Promise<{ key: string }> }) {
  const { key } = await params;
  const report = REPORTS[key];
  if (!report) notFound();
  const data = await report.fetch();

  return (
    <div>
      <PageHeader
        title={data.title}
        actions={
          <>
            <a href={`/reports/export/excel/${key}`} className="btn-secondary">📊 Excel</a>
            <a href={`/reports/export/pdf/${key}`} className="btn-secondary">📄 PDF</a>
          </>
        }
      />
      <div className="card overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50">
            <tr>
              {data.columns.map((c) => (
                <th key={c.key} className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  {c.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {data.rows.length === 0 && (
              <tr>
                <td colSpan={data.columns.length} className="px-4 py-6 text-center text-slate-500">
                  No data for this report yet.
                </td>
              </tr>
            )}
            {data.rows.map((row, i) => (
              <tr key={i} className="hover:bg-slate-50">
                {data.columns.map((c) => (
                  <td key={c.key} className="px-4 py-2.5">{row[c.key] ?? "-"}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
