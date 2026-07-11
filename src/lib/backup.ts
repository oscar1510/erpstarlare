import { db } from "./db";

/**
 * Full-database backup / restore / wipe.
 *
 * The schema has no foreign-key relations (all links are plain scalar id
 * fields), so rows can be deleted and re-inserted in any order — which keeps
 * this simple and robust.
 *
 * Every model is listed once here with its Prisma delegate name; export,
 * import and wipe all iterate this single registry, so adding a model only
 * needs one line.
 */
export const BACKUP_MODELS = [
  "counter",
  "document",
  "deadline",
  "auditLog",
  "expense",
  "invoice",
  "setting",
  "quotation",
  "client",
  "purchase",
  "subscription",
  "payment",
  "receivedInvoice",
  "bankStatement",
  "bankTransaction",
  "bankDocument",
  "ledgerEntry",
  "person",
  "compensationPayment",
  "reimbursement",
  "taxRecord",
  "rentRecord",
  "receivedContract",
  "sentContract",
  "platformPolicy",
  "policyVersion",
] as const;

export type BackupModel = (typeof BACKUP_MODELS)[number];

export interface BackupPayload {
  meta: {
    app: "starflare-erp";
    version: 1;
    createdAt: string;
    counts: Record<string, number>;
  };
  data: Record<string, unknown[]>;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function delegate(model: string): any {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (db as any)[model];
}

/** Read every table into one JSON-serialisable snapshot. */
export async function exportAll(): Promise<BackupPayload> {
  const data: Record<string, unknown[]> = {};
  const counts: Record<string, number> = {};
  for (const model of BACKUP_MODELS) {
    const rows = await delegate(model).findMany();
    data[model] = rows;
    counts[model] = rows.length;
  }
  return {
    meta: { app: "starflare-erp", version: 1, createdAt: new Date().toISOString(), counts },
    data,
  };
}

/**
 * Delete every row from every table. By default the company Settings row (logo)
 * is preserved so a wipe-for-fresh-start doesn't force a logo re-upload.
 */
export async function wipeAll(opts: { keepSettings?: boolean } = {}): Promise<Record<string, number>> {
  const keepSettings = opts.keepSettings ?? true;
  const deleted: Record<string, number> = {};
  for (const model of BACKUP_MODELS) {
    if (model === "setting" && keepSettings) continue;
    const res = await delegate(model).deleteMany({});
    deleted[model] = res.count ?? 0;
  }
  return deleted;
}

/**
 * Restore a snapshot produced by {@link exportAll}. Replaces all current data
 * (wipes first, including Settings, so the restore is exact). Prisma accepts
 * ISO date strings for DateTime fields, so the JSON round-trips as-is.
 */
export async function importAll(payload: BackupPayload): Promise<Record<string, number>> {
  if (!payload?.data || payload?.meta?.app !== "starflare-erp") {
    throw new Error("This file is not a Starflare ERP backup.");
  }
  await wipeAll({ keepSettings: false });

  const inserted: Record<string, number> = {};
  for (const model of BACKUP_MODELS) {
    const rows = payload.data[model];
    if (!Array.isArray(rows) || rows.length === 0) {
      inserted[model] = 0;
      continue;
    }
    const res = await delegate(model).createMany({ data: rows, skipDuplicates: true });
    inserted[model] = res.count ?? rows.length;
  }
  return inserted;
}
