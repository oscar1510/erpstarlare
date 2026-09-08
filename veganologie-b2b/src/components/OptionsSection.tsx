import type { OrderOptions } from "../types";

function Toggle<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <div className="inline-flex rounded-lg border border-forest-200 p-0.5">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={`rounded-md px-3 py-1.5 text-xs font-semibold transition ${
            value === o.value
              ? "bg-forest-700 text-white"
              : "text-forest-600 hover:bg-forest-50"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function NumField({
  label,
  value,
  onChange,
  prefix = "AED",
  w = "w-32",
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  prefix?: string;
  w?: string;
}) {
  return (
    <div>
      <label className="field-label">{label}</label>
      <div className={`relative ${w}`}>
        {prefix && (
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-xs text-forest-400">
            {prefix}
          </span>
        )}
        <input
          className={`input text-right ${prefix ? "pl-11" : ""}`}
          type="number"
          min={0}
          value={value}
          onChange={(e) => {
            const v = parseFloat(e.target.value);
            onChange(Number.isFinite(v) && v >= 0 ? v : 0);
          }}
        />
      </div>
    </div>
  );
}

function ChargedBlock({
  charged,
  amount,
  amountLabel,
  passthroughCost,
  onCharged,
  onAmount,
}: {
  charged: boolean;
  amount: number;
  amountLabel: string;
  passthroughCost: number; // the internal cost of this extra
  onCharged: (v: boolean) => void;
  onAmount: (v: number) => void;
}) {
  const atCost = Math.abs(amount - passthroughCost) < 0.01 && passthroughCost > 0;
  return (
    <div className="space-y-2">
      <div>
        <label className="field-label">Charged to Customer?</label>
        <Toggle
          value={charged ? "yes" : "no"}
          options={[
            { value: "yes", label: "Yes" },
            { value: "no", label: "No" },
          ]}
          onChange={(v) => onCharged(v === "yes")}
        />
      </div>
      {charged && (
        <div>
          <NumField label={`${amountLabel} (excl. VAT)`} value={amount} onChange={onAmount} />
          <div className="mt-1 text-[11px] text-forest-400">
            Cost: AED {passthroughCost.toLocaleString("en-AE", { maximumFractionDigits: 2 })}.{" "}
            {atCost ? (
              <span className="text-forest-500">Charged at cost — pass-through (no margin impact).</span>
            ) : (
              <button
                type="button"
                className="font-medium text-forest-600 underline hover:text-forest-800"
                onClick={() => onAmount(Math.round(passthroughCost * 100) / 100)}
              >
                Charge at cost (pass-through)
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export function OptionsSection({
  options,
  onChange,
}: {
  options: OrderOptions;
  onChange: (o: OrderOptions) => void;
}) {
  const patch = (p: Partial<OrderOptions>) => onChange({ ...options, ...p });
  const { packaging, logo, shipping } = options;

  return (
    <div className="card p-5">
      <h2 className="section-title mb-4">3 · Options</h2>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Packaging */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-forest-800">Packaging</h3>
          </div>
          <Toggle
            value={packaging.kind}
            options={[
              { value: "veganologie", label: "Veganologie" },
              { value: "custom", label: "Custom" },
            ]}
            onChange={(kind) => patch({ packaging: { ...packaging, kind } })}
          />
          {packaging.kind === "custom" && (
            <div className="space-y-3 rounded-lg bg-forest-50/60 p-3">
              <div className="flex flex-wrap gap-3">
                <NumField
                  label="Cost per Box"
                  value={packaging.costPerBox}
                  onChange={(costPerBox) => patch({ packaging: { ...packaging, costPerBox } })}
                  w="w-28"
                />
                <NumField
                  label="Number of Boxes"
                  value={packaging.numBoxes}
                  prefix=""
                  onChange={(numBoxes) => patch({ packaging: { ...packaging, numBoxes } })}
                  w="w-28"
                />
              </div>
              <ChargedBlock
                charged={packaging.charged}
                amount={packaging.sellingPrice}
                amountLabel="Selling Price (total)"
                passthroughCost={(packaging.costPerBox || 0) * (packaging.numBoxes || 0)}
                onCharged={(charged) => {
                  // Default to charging at cost so "Yes" is a true pass-through
                  // (profitability returns to its pre-packaging level).
                  const cost = (packaging.costPerBox || 0) * (packaging.numBoxes || 0);
                  const sellingPrice =
                    charged && !packaging.sellingPrice
                      ? Math.round(cost * 100) / 100
                      : packaging.sellingPrice;
                  patch({ packaging: { ...packaging, charged, sellingPrice } });
                }}
                onAmount={(sellingPrice) => patch({ packaging: { ...packaging, sellingPrice } })}
              />
            </div>
          )}
        </div>

        {/* Logo */}
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-forest-800">Logo</h3>
          <Toggle
            value={logo.kind}
            options={[
              { value: "veganologie", label: "Veganologie" },
              { value: "custom", label: "Custom" },
            ]}
            onChange={(kind) => patch({ logo: { ...logo, kind } })}
          />
          {logo.kind === "custom" && (
            <div className="space-y-3 rounded-lg bg-forest-50/60 p-3">
              <NumField
                label="Custom Logo Cost"
                value={logo.cost}
                onChange={(cost) => patch({ logo: { ...logo, cost } })}
                w="w-32"
              />
              <ChargedBlock
                charged={logo.charged}
                amount={logo.sellingPrice}
                amountLabel="Amount Charged"
                passthroughCost={logo.cost || 0}
                onCharged={(charged) => {
                  const sellingPrice =
                    charged && !logo.sellingPrice
                      ? Math.round((logo.cost || 0) * 100) / 100
                      : logo.sellingPrice;
                  patch({ logo: { ...logo, charged, sellingPrice } });
                }}
                onAmount={(sellingPrice) => patch({ logo: { ...logo, sellingPrice } })}
              />
            </div>
          )}
        </div>

        {/* Shipping */}
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-forest-800">Shipping</h3>
          <Toggle
            value={shipping.kind}
            options={[
              { value: "included", label: "Included" },
              { value: "not", label: "Not Included" },
            ]}
            onChange={(kind) => patch({ shipping: { ...shipping, kind } })}
          />
          {shipping.kind === "included" && (
            <div className="space-y-1 rounded-lg bg-forest-50/60 p-3">
              <NumField
                label="Shipping Cost (internal)"
                value={shipping.cost}
                onChange={(cost) => patch({ shipping: { ...shipping, cost } })}
                w="w-36"
              />
              <p className="text-xs text-forest-400">
                Included in profitability. Not charged as a separate line.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
