import { useMemo, useState } from "react";
import type { LineItem, Product } from "../types";
import { finalUnitPrice, lineTotal } from "../lib/calc";
import { aed, num } from "../lib/format";
import { newId } from "../lib/storage";

function ProductSearch({
  catalog,
  onPick,
}: {
  catalog: Product[];
  onPick: (p: Product) => void;
}) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const results = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return catalog.slice(0, 50);
    return catalog
      .filter((p) => p.name.toLowerCase().includes(term) || p.sku.toLowerCase().includes(term))
      .slice(0, 50);
  }, [q, catalog]);

  return (
    <div className="relative">
      <input
        className="input"
        placeholder={
          catalog.length
            ? `Search ${catalog.length} products — click to add…`
            : "Import products first (top-right)"
        }
        value={q}
        disabled={!catalog.length}
        onFocus={() => setOpen(true)}
        onChange={(e) => {
          setQ(e.target.value);
          setOpen(true);
        }}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
      />
      {open && results.length > 0 && (
        <div className="absolute z-20 mt-1 max-h-72 w-full overflow-auto rounded-lg border border-forest-100 bg-white shadow-lg">
          {results.map((p) => (
            <button
              key={p.id}
              type="button"
              className="flex w-full items-center justify-between gap-3 border-b border-forest-50 px-3 py-2 text-left text-sm last:border-0 hover:bg-forest-50"
              onMouseDown={(e) => {
                e.preventDefault();
                onPick(p);
                setQ("");
              }}
            >
              <span className="flex items-center gap-2">
                <span className="text-forest-900">{p.name}</span>
                {!p.costMatched && (
                  <span className="pill bg-amber-100 text-amber-700">no cost</span>
                )}
              </span>
              <span className="whitespace-nowrap text-forest-500">{aed(p.retail)}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function ProductsSection({
  lines,
  catalog,
  onChange,
}: {
  lines: LineItem[];
  catalog: Product[];
  onChange: (lines: LineItem[]) => void;
}) {
  const addProduct = (p: Product) => {
    const existing = lines.find((l) => l.productId === p.id);
    if (existing) {
      onChange(
        lines.map((l) => (l.id === existing.id ? { ...l, quantity: l.quantity + 1 } : l)),
      );
      return;
    }
    onChange([
      ...lines,
      {
        id: newId(),
        productId: p.id,
        name: p.name,
        retail: p.retail,
        cost: p.cost,
        quantity: 1,
        discountPct: 0,
      },
    ]);
  };

  const update = (id: string, patch: Partial<LineItem>) =>
    onChange(lines.map((l) => (l.id === id ? { ...l, ...patch } : l)));
  const remove = (id: string) => onChange(lines.filter((l) => l.id !== id));

  const clamp = (v: number, min = 0) => (Number.isFinite(v) && v >= min ? v : min);

  return (
    <div className="card p-5">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="section-title">2 · Products</h2>
        <span className="text-xs text-forest-400">{lines.length} line(s)</span>
      </div>

      <ProductSearch catalog={catalog} onPick={addProduct} />

      {lines.length > 0 && (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[720px] border-collapse text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-forest-400">
                <th className="pb-2 pr-2 font-medium">Product</th>
                <th className="pb-2 px-2 text-right font-medium">Retail</th>
                <th className="pb-2 px-2 text-right font-medium">Qty</th>
                <th className="pb-2 px-2 text-right font-medium">Disc %</th>
                <th className="pb-2 px-2 text-right font-medium">Final Unit</th>
                <th className="pb-2 px-2 text-right font-medium">Total</th>
                <th className="pb-2 pl-2"></th>
              </tr>
            </thead>
            <tbody>
              {lines.map((l) => (
                <tr key={l.id} className="border-t border-forest-50">
                  <td className="py-2 pr-2">
                    <div className="text-forest-900">{l.name}</div>
                    {l.cost === 0 && (
                      <span className="pill mt-0.5 bg-amber-100 text-amber-700">
                        cost not set — margin understated
                      </span>
                    )}
                  </td>
                  <td className="px-2 text-right tabular-nums text-forest-600">
                    {num(l.retail)}
                  </td>
                  <td className="px-2 text-right">
                    <input
                      className="input w-20 py-1 text-right"
                      type="number"
                      min={0}
                      value={l.quantity === 0 ? "" : l.quantity}
                      onFocus={(e) => e.target.select()}
                      onChange={(e) =>
                        update(l.id, { quantity: clamp(parseInt(e.target.value, 10)) })
                      }
                    />
                  </td>
                  <td className="px-2 text-right">
                    <input
                      className="input w-20 py-1 text-right"
                      type="number"
                      min={0}
                      max={100}
                      value={l.discountPct === 0 ? "" : l.discountPct}
                      onFocus={(e) => e.target.select()}
                      onChange={(e) =>
                        update(l.id, {
                          discountPct: Math.min(100, clamp(parseFloat(e.target.value))),
                        })
                      }
                    />
                  </td>
                  <td className="px-2 text-right tabular-nums text-forest-700">
                    {num(finalUnitPrice(l.retail, l.discountPct))}
                  </td>
                  <td className="px-2 text-right font-semibold tabular-nums text-forest-900">
                    {num(lineTotal(l))}
                  </td>
                  <td className="pl-2 text-right">
                    <button
                      type="button"
                      onClick={() => remove(l.id)}
                      className="rounded p-1 text-forest-300 hover:bg-red-50 hover:text-red-500"
                      aria-label="Remove"
                    >
                      ✕
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
