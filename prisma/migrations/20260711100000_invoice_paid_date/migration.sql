-- Add paidDate to Invoice: revenue is attributed to when an invoice was actually
-- paid, not when it was issued, so a July-dated invoice paid last September
-- counts toward September revenue.
ALTER TABLE "Invoice" ADD COLUMN "paidDate" TIMESTAMP(3);
