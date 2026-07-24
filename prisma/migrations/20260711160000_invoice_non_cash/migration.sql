-- Barter / service-exchange invoices: count as revenue but create no cash payment.
ALTER TABLE "Invoice" ADD COLUMN "nonCash" BOOLEAN NOT NULL DEFAULT false;
