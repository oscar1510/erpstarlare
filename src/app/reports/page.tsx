import { PageHeader } from "@/components/ui/Page";
import { REPORTS } from "@/lib/reports";
import Link from "next/link";

export default function ReportsPage() {
  return (
    <div>
      <PageHeader title="Reports & Export" description="Business, finance, and admin reports. View on screen or export to Excel/PDF." />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {Object.entries(REPORTS).map(([key, r]) => (
          <div key={key} className="card p-4 flex flex-col gap-2">
            <span className="font-medium">{r.label}</span>
            <div className="flex gap-2 mt-auto pt-2">
              <Link href={`/reports/${key}`} className="btn-secondary !py-1 !text-xs">View</Link>
              <a href={`/reports/export/excel/${key}`} className="btn-secondary !py-1 !text-xs">Excel</a>
              <a href={`/reports/export/pdf/${key}`} className="btn-secondary !py-1 !text-xs">PDF</a>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
