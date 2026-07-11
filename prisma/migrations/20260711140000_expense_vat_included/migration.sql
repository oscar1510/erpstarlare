-- Expenses default to VAT-inclusive at 5% (VAT computed from the amount).
ALTER TABLE "Expense" ADD COLUMN "vatIncluded" BOOLEAN NOT NULL DEFAULT true;
