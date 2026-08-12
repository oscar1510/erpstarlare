import type { Profitability } from "../types";
import { Gauge } from "./Gauge";
import { aed, pct } from "../lib/format";

function Stat({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: "green" | "red" | "plain";
}) {
  const color =
    accent === "green"
      ? "text-forest-700"
      : accent === "red"
        ? "text-red-600"
        : "text-forest-900";
  return (
    <div className="rounded-xl border border-forest-100 bg-white px-4 py-3">
      <div className="text-[11px] font-medium uppercase tracking-wider text-forest-400">
        {label}
      </div>
      <div className={`mt-0.5 text-lg font-bold tabular-nums ${color}`}>{value}</div>
    </div>
  );
}

export function ProfitabilitySection({ prof }: { prof: Profitability }) {
  const profitAccent = prof.profit >= 0 ? "green" : "red";
  return (
    <div className="card overflow-hidden">
      <div className="border-b border-forest-100 bg-forest-700 px-5 py-3">
        <h2 className="text-xs font-semibold uppercase tracking-[0.18em] text-forest-100">
          4 · Profitability
          <span className="ml-2 font-normal text-forest-200/80">Internal only</span>
        </h2>
      </div>

      <div className="grid grid-cols-1 gap-4 p-5 lg:grid-cols-2">
        <div className="flex items-center justify-center py-2">
          <Gauge marginPct={prof.marginPct} />
        </div>

        <div className="grid grid-cols-2 gap-3 self-center">
          <Stat label="Total Revenue" value={aed(prof.totalRevenue)} />
          <Stat label="Total Cost" value={aed(prof.totalCost)} />
          <Stat label="Profit" value={aed(prof.profit)} accent={profitAccent} />
          <Stat label="Profit Margin" value={pct(prof.marginPct)} accent={profitAccent} />
          <Stat label="Retail Value" value={aed(prof.retailValue)} accent="plain" />
          <Stat label="Total Discount Given" value={aed(prof.totalDiscount)} accent="plain" />
        </div>
      </div>

      <div className="border-t border-forest-100 bg-forest-50/50 px-5 py-2 text-center text-[11px] text-forest-400">
        Production cost, total cost, profit and margin are internal — they never appear on the
        customer quotation.
      </div>
    </div>
  );
}
