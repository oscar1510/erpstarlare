"use client";

import { useEffect, useState } from "react";

/**
 * VAT control for expenses. By default the amount is treated as VAT-inclusive
 * at 5%, and the VAT portion is computed automatically from the amount field
 * (watched live by id). Untick to either:
 *   - leave the VAT field empty → no VAT, or
 *   - type a VAT amount manually → e.g. a different rate.
 * Submits `vatIncluded` (checkbox) and `vat` (number).
 */
export function VatFields({
  amountInputId,
  defaultIncluded = true,
  defaultVat = null,
}: {
  amountInputId: string;
  defaultIncluded?: boolean;
  defaultVat?: number | null;
}) {
  const [included, setIncluded] = useState(defaultIncluded);
  const [vat, setVat] = useState<string>(defaultVat != null ? String(defaultVat) : "");
  const [computed, setComputed] = useState<number | null>(null);

  useEffect(() => {
    const el = document.getElementById(amountInputId) as HTMLInputElement | null;
    if (!el) return;
    const update = () => {
      const amt = parseFloat(el.value);
      setComputed(Number.isFinite(amt) ? Math.round(((amt * 5) / 105) * 100) / 100 : null);
    };
    update();
    el.addEventListener("input", update);
    return () => el.removeEventListener("input", update);
  }, [amountInputId]);

  const shown = included ? (computed != null ? String(computed) : "") : vat;

  return (
    <div>
      <label className="block text-sm font-medium text-slate-600 mb-1.5">VAT</label>
      <label className="flex items-center gap-2 text-sm mb-2">
        <input type="checkbox" name="vatIncluded" checked={included} onChange={(e) => setIncluded(e.target.checked)} />
        Amount includes 5% VAT
      </label>
      <input
        type="number"
        step="0.01"
        name="vat"
        className={`form-input ${included ? "bg-slate-50 text-slate-500" : ""}`}
        value={shown}
        readOnly={included}
        onChange={(e) => setVat(e.target.value)}
        placeholder={included ? "" : "Leave empty for no VAT"}
      />
      <p className="text-xs text-slate-400 mt-1">
        {included
          ? "VAT is calculated automatically as 5% of the amount."
          : "No VAT unless you enter an amount here (e.g. for a different rate)."}
      </p>
    </div>
  );
}
