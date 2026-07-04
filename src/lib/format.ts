export function formatMoney(amount: number | null | undefined, currency = "AED") {
  if (amount === null || amount === undefined) return "-";
  return new Intl.NumberFormat("en-AE", { style: "currency", currency, maximumFractionDigits: 2 }).format(
    amount
  );
}

export function formatDate(date: Date | string | null | undefined) {
  if (!date) return "-";
  const d = typeof date === "string" ? new Date(date) : date;
  if (Number.isNaN(d.getTime())) return "-";
  return new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric" }).format(d);
}

export function formatDateInput(date: Date | string | null | undefined) {
  if (!date) return "";
  const d = typeof date === "string" ? new Date(date) : date;
  if (Number.isNaN(d.getTime())) return "";
  return d.toISOString().slice(0, 10);
}

export function formatDateTime(date: Date | string | null | undefined) {
  if (!date) return "-";
  const d = typeof date === "string" ? new Date(date) : date;
  if (Number.isNaN(d.getTime())) return "-";
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

export function parseFormDate(value: FormDataEntryValue | null): Date | null {
  if (!value || typeof value !== "string" || !value.trim()) return null;
  const d = new Date(value + "T12:00:00Z");
  return Number.isNaN(d.getTime()) ? null : d;
}

export function parseFormNumber(value: FormDataEntryValue | null): number | null {
  if (value === null || typeof value !== "string" || !value.trim()) return null;
  const n = parseFloat(value);
  return Number.isFinite(n) ? n : null;
}
