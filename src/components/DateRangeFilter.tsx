import Link from "next/link";

const PRESETS: { key: string; label: string }[] = [
  { key: "this_month", label: "This month" },
  { key: "last_month", label: "Last month" },
  { key: "this_quarter", label: "This quarter" },
  { key: "this_year", label: "This year" },
  { key: "all", label: "All time" },
];

export function DateRangeFilter({ basePath, active, from, to }: { basePath: string; active: string; from?: string; to?: string }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {PRESETS.map((p) => (
        <Link
          key={p.key}
          href={`${basePath}?range=${p.key}`}
          className={active === p.key ? "btn-primary" : "btn-secondary"}
        >
          {p.label}
        </Link>
      ))}
      <form className="flex items-center gap-1.5" action={basePath} method="get">
        <input type="hidden" name="range" value="custom" />
        <input type="date" name="from" defaultValue={from} className="form-input !py-1.5 !text-xs w-36" />
        <span className="text-slate-400 text-xs">to</span>
        <input type="date" name="to" defaultValue={to} className="form-input !py-1.5 !text-xs w-36" />
        <button type="submit" className={active === "custom" ? "btn-primary !py-1.5" : "btn-secondary !py-1.5"}>
          Custom
        </button>
      </form>
    </div>
  );
}
