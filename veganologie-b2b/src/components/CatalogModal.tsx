import { useMemo, useState } from "react";
import { Modal } from "./Modal";
import type { Product } from "../types";

export function CatalogModal({
  catalog,
  onClose,
  onSave,
}: {
  catalog: Product[];
  onClose: () => void;
  onSave: (products: Product[]) => void;
}) {
  const [rows, setRows] = useState<Product[]>(catalog.map((p) => ({ ...p })));
  const [q, setQ] = useState("");
  const [onlyMissing, setOnlyMissing] = useState(false);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    return rows.filter(
      (p) =>
        (!onlyMissing || !p.costMatched || p.cost === 0) &&
        (!term || p.name.toLowerCase().includes(term)),
    );
  }, [rows, q, onlyMissing]);

  const setCost = (id: string, cost: number) =>
    setRows((rs) =>
      rs.map((p) => (p.id === id ? { ...p, cost, costMatched: true } : p)),
    );
  const setRetail = (id: string, retail: number) =>
    setRows((rs) => rs.map((p) => (p.id === id ? { ...p, retail } : p)));

  const missing = rows.filter((p) => !p.costMatched || p.cost === 0).length;

  return (
    <Modal title="Review catalog" onClose={onClose} wide>
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <input
          className="input max-w-xs"
          placeholder="Search products…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <label className="flex items-center gap-2 text-sm text-forest-600">
          <input
            type="checkbox"
            checked={onlyMissing}
            onChange={(e) => setOnlyMissing(e.target.checked)}
          />
          Only missing cost ({missing})
        </label>
        <span className="ml-auto text-xs text-forest-400">{rows.length} products</span>
      </div>

      <div className="max-h-[55vh] overflow-auto rounded-lg border border-forest-100">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-forest-50 text-left text-xs uppercase tracking-wide text-forest-500">
            <tr>
              <th className="px-3 py-2 font-medium">Product</th>
              <th className="px-3 py-2 text-right font-medium">Retail (AED)</th>
              <th className="px-3 py-2 text-right font-medium">Cost (AED · internal)</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((p) => (
              <tr key={p.id} className="border-t border-forest-50">
                <td className="px-3 py-1.5">
                  <span className="text-forest-900">{p.name}</span>
                  {(!p.costMatched || p.cost === 0) && (
                    <span className="pill ml-2 bg-amber-100 text-amber-700">check cost</span>
                  )}
                </td>
                <td className="px-3 py-1.5 text-right">
                  <input
                    className="input w-28 py-1 text-right"
                    type="number"
                    min={0}
                    value={p.retail}
                    onChange={(e) => setRetail(p.id, Math.max(0, parseFloat(e.target.value) || 0))}
                  />
                </td>
                <td className="px-3 py-1.5 text-right">
                  <input
                    className="input w-28 py-1 text-right"
                    type="number"
                    min={0}
                    value={p.cost}
                    onChange={(e) => setCost(p.id, Math.max(0, parseFloat(e.target.value) || 0))}
                  />
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={3} className="px-3 py-6 text-center text-forest-400">
                  Nothing to show.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-4 flex justify-end gap-2">
        <button className="btn-ghost" onClick={onClose}>
          Cancel
        </button>
        <button
          className="btn-primary"
          onClick={() => {
            onSave(rows);
            onClose();
          }}
        >
          Save costs
        </button>
      </div>
    </Modal>
  );
}
