import { db } from "./db";
import { Prisma } from "@prisma/client";

export interface LedgerFilters {
  start?: Date | null;
  end?: Date | null;
  category?: string;
  clientId?: string;
  vendorName?: string;
  personId?: string;
  paymentMethod?: string;
  type?: string;
}

export function ledgerWhere(f: LedgerFilters): Prisma.LedgerEntryWhereInput {
  return {
    date: {
      ...(f.start ? { gte: f.start } : {}),
      ...(f.end ? { lte: f.end } : {}),
    },
    ...(f.category ? { category: f.category } : {}),
    ...(f.clientId ? { clientId: f.clientId } : {}),
    ...(f.vendorName ? { vendorName: { contains: f.vendorName } } : {}),
    ...(f.personId ? { personId: f.personId } : {}),
    ...(f.paymentMethod ? { paymentMethod: f.paymentMethod } : {}),
    ...(f.type ? { type: f.type } : {}),
  };
}

export async function ledgerSummary(f: LedgerFilters) {
  const where = ledgerWhere(f);
  const entries = await db.ledgerEntry.findMany({ where, orderBy: { date: "desc" } });

  const income = entries.filter((e) => e.type === "INCOME").reduce((s, e) => s + e.amount, 0);
  const expense = entries.filter((e) => e.type === "EXPENSE").reduce((s, e) => s + e.amount, 0);

  const byCategory = new Map<string, number>();
  for (const e of entries.filter((e) => e.type === "EXPENSE")) {
    const key = e.category ?? "Other";
    byCategory.set(key, (byCategory.get(key) ?? 0) + e.amount);
  }

  const byClient = new Map<string, number>();
  const clientIds = [...new Set(entries.filter((e) => e.clientId).map((e) => e.clientId!))];
  const clients = clientIds.length ? await db.client.findMany({ where: { id: { in: clientIds } } }) : [];
  const clientNameById = new Map(clients.map((c) => [c.id, c.name]));
  for (const e of entries.filter((e) => e.type === "INCOME" && e.clientId)) {
    const name = clientNameById.get(e.clientId!) ?? "Unknown client";
    byClient.set(name, (byClient.get(name) ?? 0) + e.amount);
  }

  return {
    entries,
    income,
    expense,
    profitLoss: income - expense,
    byCategory: [...byCategory.entries()].sort((a, b) => b[1] - a[1]),
    byClient: [...byClient.entries()].sort((a, b) => b[1] - a[1]),
  };
}
