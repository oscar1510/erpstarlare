import { useRef, useState } from "react";
import { Modal } from "./Modal";
import { buildCatalog, type ImportResult } from "../lib/catalog";
import type { Product } from "../types";

function FilePick({
  label,
  hint,
  file,
  onPick,
}: {
  label: string;
  hint: string;
  file: File | null;
  onPick: (f: File | null) => void;
}) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <div className="rounded-xl border border-dashed border-forest-200 p-4">
      <div className="text-sm font-semibold text-forest-800">{label}</div>
      <div className="mt-0.5 text-xs text-forest-400">{hint}</div>
      <div className="mt-3 flex items-center gap-3">
        <button className="btn-ghost" type="button" onClick={() => ref.current?.click()}>
          Choose file
        </button>
        <span className="truncate text-xs text-forest-500">
          {file ? file.name : "No file selected"}
        </span>
        <input
          ref={ref}
          type="file"
          accept=".xlsx,.xls,.csv"
          className="hidden"
          onChange={(e) => onPick(e.target.files?.[0] || null)}
        />
      </div>
    </div>
  );
}

export function ImportModal({
  onClose,
  onImported,
  hasCatalog,
}: {
  onClose: () => void;
  onImported: (products: Product[]) => void;
  hasCatalog: boolean;
}) {
  const [priceFile, setPriceFile] = useState<File | null>(null);
  const [costFile, setCostFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<ImportResult | null>(null);

  const run = async () => {
    if (!priceFile || !costFile) return;
    setBusy(true);
    setError("");
    try {
      const res = await buildCatalog(priceFile, costFile);
      if (res.products.length === 0) {
        setError(
          "No products could be read. Check that the retail file has a product-name column and a price column.",
        );
      } else {
        setResult(res);
      }
    } catch (e) {
      setError((e as Error).message || "Could not read the files.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal title="Import products" onClose={onClose}>
      <p className="mb-4 text-sm text-forest-600">
        Upload the <strong>Retail Price</strong> file and the{" "}
        <strong>Production Cost</strong> file. They are matched by SKU when present, otherwise by
        product name. Production costs are internal and never appear on quotations.
      </p>

      {!result && (
        <div className="space-y-3">
          <FilePick
            label="Retail Price file"
            hint="Columns: Product Name, Retail / Full Price (SKU optional)"
            file={priceFile}
            onPick={setPriceFile}
          />
          <FilePick
            label="Production Cost file"
            hint="Columns: Product Name, Cost / Landing Cost (SKU optional)"
            file={costFile}
            onPick={setCostFile}
          />

          {error && <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</div>}

          {hasCatalog && (
            <p className="text-xs text-amber-600">
              Importing will replace the current product catalog. Saved orders keep their own
              price/cost snapshots and are unaffected.
            </p>
          )}

          <div className="flex justify-end gap-2 pt-1">
            <button className="btn-ghost" onClick={onClose}>
              Cancel
            </button>
            <button
              className="btn-primary"
              disabled={!priceFile || !costFile || busy}
              onClick={run}
            >
              {busy ? "Reading…" : "Import"}
            </button>
          </div>
        </div>
      )}

      {result && (
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-3 text-center">
            <div className="rounded-lg bg-forest-50 p-3">
              <div className="text-2xl font-bold text-forest-700">{result.products.length}</div>
              <div className="text-xs text-forest-500">products</div>
            </div>
            <div className="rounded-lg bg-forest-50 p-3">
              <div className="text-2xl font-bold text-forest-700">{result.matched}</div>
              <div className="text-xs text-forest-500">cost matched</div>
            </div>
            <div className="rounded-lg bg-amber-50 p-3">
              <div className="text-2xl font-bold text-amber-600">{result.unmatched}</div>
              <div className="text-xs text-amber-600">need a cost</div>
            </div>
          </div>
          {result.unmatched > 0 && (
            <p className="text-xs text-forest-500">
              {result.unmatched} product(s) had no matching production cost (the two files name
              things differently). You can set their cost by hand in “Review catalog”. Their margin
              is understated until you do.
            </p>
          )}
          <div className="flex justify-end gap-2">
            <button className="btn-ghost" onClick={() => setResult(null)}>
              Back
            </button>
            <button
              className="btn-primary"
              onClick={() => {
                onImported(result.products);
                onClose();
              }}
            >
              Use these products
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}
