import { STATUS_COLORS, labelize } from "@/lib/constants";

const COLOR_CLASSES: Record<string, string> = {
  green: "bg-green-100 text-green-800",
  red: "bg-red-100 text-red-800",
  amber: "bg-amber-100 text-amber-800",
  blue: "bg-blue-100 text-blue-800",
  gray: "bg-slate-100 text-slate-700",
};

export function StatusBadge({ status }: { status?: string | null }) {
  if (!status) return null;
  const color = STATUS_COLORS[status] ?? "gray";
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap ${COLOR_CLASSES[color]}`}
    >
      {labelize(status)}
    </span>
  );
}

export function ConfidenceBadge({ confidence }: { confidence?: number | null }) {
  if (confidence === null || confidence === undefined) return null;
  const pct = Math.round(confidence * 100);
  const color = confidence >= 0.75 ? "green" : confidence >= 0.5 ? "amber" : "red";
  const label = confidence >= 0.75 ? "High confidence" : confidence >= 0.5 ? "Medium confidence" : "Low confidence — please check";
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap ${COLOR_CLASSES[color]}`}
      title={label}
    >
      {label} ({pct}%)
    </span>
  );
}
