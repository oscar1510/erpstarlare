import Link from "next/link";
import { ReactNode } from "react";

export interface Column<T> {
  header: string;
  className?: string;
  render: (row: T) => ReactNode;
}

export function DataTable<T extends { id: string }>({
  columns,
  rows,
  href,
  emptyMessage = "No records yet.",
}: {
  columns: Column<T>[];
  rows: T[];
  href?: (row: T) => string;
  emptyMessage?: string;
}) {
  if (rows.length === 0) {
    return (
      <div className="card p-8 text-center text-sm text-slate-500">{emptyMessage}</div>
    );
  }

  return (
    <div className="card overflow-x-auto">
      <table className="min-w-full divide-y divide-slate-200 text-sm">
        <thead className="bg-slate-50">
          <tr>
            {columns.map((col) => (
              <th
                key={col.header}
                className={`px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 ${col.className ?? ""}`}
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rows.map((row) => {
            const content = (
              <>
                {columns.map((col) => (
                  <td key={col.header} className={`px-4 py-2.5 align-top ${col.className ?? ""}`}>
                    {col.render(row)}
                  </td>
                ))}
              </>
            );
            return href ? (
              <tr key={row.id} className="hover:bg-slate-50">
                {columns.map((col, i) => (
                  <td key={col.header} className={`px-4 py-2.5 align-top ${col.className ?? ""}`}>
                    {i === 0 ? (
                      <Link href={href(row)} className="text-brand-700 hover:underline font-medium">
                        {col.render(row)}
                      </Link>
                    ) : (
                      col.render(row)
                    )}
                  </td>
                ))}
              </tr>
            ) : (
              <tr key={row.id} className="hover:bg-slate-50">
                {content}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
