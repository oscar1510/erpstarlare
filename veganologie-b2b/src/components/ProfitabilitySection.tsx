import type { Profitability } from "../types";
import { Gauge } from "./Gauge";
import { aed0, pct } from "../lib/format";

function Stat({
  label,
  value,
  accent = "plain",
}: {
  label: string;
  value: string;
  accent?: "green" | "red" | "plain";
}) {
  const color =
    accent === "green" ? "text-forest-700" : accent === "red" ? "text-red-600" : "text-forest-900";
  return (
    <div className="min-w-0 rounded-xl border border-forest-100 bg-white px-4 py-3">
      <div className="truncate text-[11px] font-medium uppercase tracking-wider text-forest-400">
        {label}
      </div>
      <div className={`mt-1 truncate text-xl font-bold tabular-nums ${color}`} title={value}>
        {value}
      </div>
    </div>
  );
}

export function ProfitabilitySection({ prof }: { prof: Profitability }) {
  const acc = prof.profit >= 0 ? "green" : "red";
  return (
    <div className="card overflow-hidden">
      <div className="flex items-center justify-between border-b border-forest-100 bg-forest-700 px-5 py-3">
        <h2 className="text-xs font-semibold uppercase tracking-[0.18em] text-forest-100">
          4 · Profitability
        </h2>
        <span className="text-[11px] font-medium uppercase tracking-wide text-forest-200/80">
          Internal only
        </span>
      </div>

      <div className="px-5 pb-2 pt-4">
        <Gauge marginPct={prof.marginPct} />
      </div>

      {/* headline figures */}
      <div className="grid grid-cols-2 gap-3 px-5 pt-2">
        <Stat label="Total Revenue" value={aed0(prof.totalRevenue)} />
        <Stat label="Total Cost" value={aed0(prof.totalCost)} />
        <Stat label="Profit" value={aed0(prof.profit)} accent={acc} />
        <Stat label="Profit Margin" value={pct(prof.marginPct)} accent={acc} />
      </div>

      {/* secondary figures */}
      <div className="mt-3 grid grid-cols-2 gap-x-6 gap-y-1 border-t border-forest-100 px-5 py-3 text-sm">
        <div className="flex items-center justify-between">
          <span className="text-forest-400">Retail Value</span>
          <span className="font-medium tabular-nums text-forest-700">{aed0(prof.retailValue)}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-forest-400">Discount Given</span>
          <span className="font-medium tabular-nums text-forest-700">{aed0(prof.totalDiscount)}</span>
        </div>
      </div>

      <div className="border-t border-forest-100 bg-forest-50/50 px-5 py-2 text-center text-[11px] text-forest-400">
        Cost, profit, margin and this gauge are internal — never shown on the customer quotation.
      </div>
    </div>
  );
}
