-- Add "account" (which real account money moved from/into) across the money
-- movements: expenses, invoices, supplier invoices, payments and the ledger.
ALTER TABLE "Expense" ADD COLUMN "account" TEXT;
ALTER TABLE "Invoice" ADD COLUMN "account" TEXT;
ALTER TABLE "ReceivedInvoice" ADD COLUMN "account" TEXT;
ALTER TABLE "Payment" ADD COLUMN "account" TEXT;
ALTER TABLE "LedgerEntry" ADD COLUMN "account" TEXT;
