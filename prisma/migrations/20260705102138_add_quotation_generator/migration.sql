-- CreateTable
CREATE TABLE "Quotation" (
    "id" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'QUOTATION',
    "number" TEXT NOT NULL,
    "clientId" TEXT,
    "companyName" TEXT,
    "brandName" TEXT,
    "contactPerson" TEXT,
    "clientTrn" TEXT,
    "clientEmail" TEXT,
    "clientPhone" TEXT,
    "clientAddress" TEXT,
    "packageType" TEXT,
    "packageName" TEXT,
    "venues" INTEGER,
    "coverage" TEXT,
    "campaigns" INTEGER,
    "creators" INTEGER,
    "creatorType" TEXT,
    "subjectLine" TEXT,
    "includePackageList" BOOLEAN NOT NULL DEFAULT true,
    "price" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'AED',
    "vatMode" TEXT NOT NULL DEFAULT 'EXCLUDED',
    "vatPercent" DOUBLE PRECISION NOT NULL DEFAULT 5,
    "paymentMethod" TEXT,
    "paymentFrequency" TEXT,
    "paymentTerms" TEXT,
    "extraLineItems" TEXT,
    "initialTerm" TEXT,
    "startDate" TIMESTAMP(3),
    "autoRenewal" BOOLEAN NOT NULL DEFAULT true,
    "cancellationViaPlatform" BOOLEAN NOT NULL DEFAULT true,
    "refundPolicy" TEXT,
    "discount" TEXT,
    "exclusivity" TEXT,
    "paidMediaIncluded" BOOLEAN NOT NULL DEFAULT false,
    "extraUsageRights" BOOLEAN NOT NULL DEFAULT false,
    "otherNotes" TEXT,
    "starflareSignatory" TEXT,
    "signatoryTitle" TEXT,
    "clientSignatory" TEXT,
    "docDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "validUntil" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "invoiceId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Quotation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Quotation_number_key" ON "Quotation"("number");

-- CreateIndex
CREATE INDEX "Quotation_kind_idx" ON "Quotation"("kind");

-- CreateIndex
CREATE INDEX "Quotation_status_idx" ON "Quotation"("status");
