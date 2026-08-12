import type { Customer } from "../types";

const fields: { key: keyof Customer; label: string; type?: string; full?: boolean }[] = [
  { key: "customerName", label: "Customer Name" },
  { key: "companyName", label: "Company Name" },
  { key: "phone", label: "Phone" },
  { key: "email", label: "Email", type: "email" },
  { key: "address", label: "Address", full: true },
];

export function CustomerSection({
  customer,
  onChange,
}: {
  customer: Customer;
  onChange: (c: Customer) => void;
}) {
  return (
    <div className="card p-5">
      <h2 className="section-title mb-4">1 · Customer</h2>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {fields.map((f) => (
          <div key={f.key} className={f.full ? "sm:col-span-2" : ""}>
            <label className="field-label">{f.label}</label>
            <input
              className="input"
              type={f.type || "text"}
              value={customer[f.key]}
              onChange={(e) => onChange({ ...customer, [f.key]: e.target.value })}
              placeholder={f.label}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
