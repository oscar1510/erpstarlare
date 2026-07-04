import { db } from "./db";

/**
 * Flag likely duplicate expenses: same-ish vendor, same amount (+/- 1%), and
 * a date within 3 days. Returns any matches so the UI can warn without
 * blocking the save (the user might legitimately have two identical
 * purchases).
 */
export async function findPossibleDuplicateExpenses(params: {
  vendor?: string | null;
  amount?: number | null;
  expenseDate?: Date | null;
  excludeId?: string;
}) {
  if (!params.amount || !params.expenseDate) return [];

  const windowStart = new Date(params.expenseDate);
  windowStart.setDate(windowStart.getDate() - 3);
  const windowEnd = new Date(params.expenseDate);
  windowEnd.setDate(windowEnd.getDate() + 3);

  const candidates = await db.expense.findMany({
    where: {
      id: params.excludeId ? { not: params.excludeId } : undefined,
      expenseDate: { gte: windowStart, lte: windowEnd },
      amount: { gte: params.amount * 0.99, lte: params.amount * 1.01 },
    },
    orderBy: { expenseDate: "desc" },
    take: 10,
  });

  if (!params.vendor) return candidates;

  const vendorLower = params.vendor.toLowerCase().trim();
  return candidates.filter((c) => {
    if (!c.vendor) return true; // amount+date match already, still worth flagging
    const other = c.vendor.toLowerCase().trim();
    return other === vendorLower || other.includes(vendorLower) || vendorLower.includes(other);
  });
}
