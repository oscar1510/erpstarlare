export type RangeKey = "this_month" | "last_month" | "this_quarter" | "this_year" | "custom" | "all";

export function resolveRange(key?: string, from?: string, to?: string): { start: Date | null; end: Date | null; label: string } {
  const now = new Date();
  const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0);
  const endOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);

  switch (key) {
    case "last_month": {
      const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const end = new Date(now.getFullYear(), now.getMonth(), 0);
      return { start: startOfDay(start), end: endOfDay(end), label: "Last month" };
    }
    case "this_quarter": {
      const q = Math.floor(now.getMonth() / 3);
      const start = new Date(now.getFullYear(), q * 3, 1);
      const end = new Date(now.getFullYear(), q * 3 + 3, 0);
      return { start: startOfDay(start), end: endOfDay(end), label: "This quarter" };
    }
    case "this_year": {
      return {
        start: startOfDay(new Date(now.getFullYear(), 0, 1)),
        end: endOfDay(new Date(now.getFullYear(), 11, 31)),
        label: "This year",
      };
    }
    case "custom": {
      const start = from ? new Date(from + "T00:00:00") : null;
      const end = to ? new Date(to + "T23:59:59") : null;
      return { start, end, label: "Custom range" };
    }
    case "all":
      return { start: null, end: null, label: "All time" };
    case "this_month":
    default: {
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      return { start: startOfDay(start), end: endOfDay(end), label: "This month" };
    }
  }
}
