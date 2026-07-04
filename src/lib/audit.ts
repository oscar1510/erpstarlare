import { db } from "./db";

export interface AuditInput {
  action: string;
  section: string;
  recordType: string;
  recordId: string;
  summary: string;
  previousValue?: unknown;
  newValue?: unknown;
  performedByType?: string | null;
  performedByLabel?: string | null;
}

export async function logAudit(input: AuditInput) {
  await db.auditLog.create({
    data: {
      action: input.action,
      section: input.section,
      recordType: input.recordType,
      recordId: input.recordId,
      summary: input.summary,
      previousValue: input.previousValue !== undefined ? JSON.stringify(input.previousValue) : null,
      newValue: input.newValue !== undefined ? JSON.stringify(input.newValue) : null,
      performedByType: input.performedByType ?? null,
      performedByLabel: input.performedByLabel ?? null,
    },
  });
}
