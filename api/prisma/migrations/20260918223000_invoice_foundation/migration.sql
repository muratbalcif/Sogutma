-- Invoice foundation (KolayBi / e-document). Additive only — does not alter Sale/Order/Payment/Inventory behavior.

-- Tax / identity foundation on users (nullable — existing rows safe)
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "identityNumber" TEXT;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "isEInvoiceTaxpayer" BOOLEAN NOT NULL DEFAULT false;

-- Enums
CREATE TYPE "InvoiceProviderCode" AS ENUM ('KOLAYBI');
CREATE TYPE "InvoiceDocumentType" AS ENUM ('E_INVOICE', 'E_ARCHIVE');
CREATE TYPE "InvoiceStatus" AS ENUM ('PENDING', 'SUCCESS', 'FAILED', 'CANCELLED');
CREATE TYPE "ExternalEntityType" AS ENUM ('USER', 'ADDRESS', 'PRODUCT');

-- Invoices
CREATE TABLE "invoices" (
    "id" UUID NOT NULL,
    "saleId" UUID NOT NULL,
    "customerId" UUID NOT NULL,
    "provider" "InvoiceProviderCode" NOT NULL DEFAULT 'KOLAYBI',
    "externalDocumentId" TEXT,
    "uuid" TEXT,
    "invoiceNumber" TEXT,
    "documentType" "InvoiceDocumentType" NOT NULL,
    "status" "InvoiceStatus" NOT NULL DEFAULT 'PENDING',
    "idempotencyKey" TEXT NOT NULL,
    "errorCode" TEXT,
    "errorMessage" TEXT,
    "pdfUrl" TEXT,
    "xmlUrl" TEXT,
    "currency" CHAR(3) NOT NULL DEFAULT 'TRY',
    "subtotal" DECIMAL(12,2) NOT NULL,
    "discountAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "taxAmount" DECIMAL(12,2) NOT NULL,
    "totalAmount" DECIMAL(12,2) NOT NULL,
    "billingAddressId" UUID,
    "billingAddressSnapshot" JSONB NOT NULL,
    "createdById" UUID NOT NULL,
    "issuedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "invoices_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "invoices_idempotencyKey_key" ON "invoices"("idempotencyKey");
CREATE INDEX "invoices_saleId_idx" ON "invoices"("saleId");
CREATE INDEX "invoices_customerId_idx" ON "invoices"("customerId");
CREATE INDEX "invoices_createdById_idx" ON "invoices"("createdById");
CREATE INDEX "invoices_provider_idx" ON "invoices"("provider");
CREATE INDEX "invoices_status_idx" ON "invoices"("status");
CREATE INDEX "invoices_documentType_idx" ON "invoices"("documentType");
CREATE INDEX "invoices_externalDocumentId_idx" ON "invoices"("externalDocumentId");
CREATE INDEX "invoices_uuid_idx" ON "invoices"("uuid");
CREATE INDEX "invoices_invoiceNumber_idx" ON "invoices"("invoiceNumber");
CREATE INDEX "invoices_createdAt_idx" ON "invoices"("createdAt");

-- At most one active invoice per sale (retry FAILED/CANCELLED allowed via in-place update or new row after terminal status)
CREATE UNIQUE INDEX "invoices_saleId_active_key"
ON "invoices" ("saleId")
WHERE "status" IN ('PENDING', 'SUCCESS');

ALTER TABLE "invoices" ADD CONSTRAINT "invoices_saleId_fkey"
  FOREIGN KEY ("saleId") REFERENCES "sales"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_customerId_fkey"
  FOREIGN KEY ("customerId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_createdById_fkey"
  FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_billingAddressId_fkey"
  FOREIGN KEY ("billingAddressId") REFERENCES "addresses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Provider-agnostic external IDs
CREATE TABLE "external_entity_links" (
    "id" UUID NOT NULL,
    "provider" "InvoiceProviderCode" NOT NULL,
    "entityType" "ExternalEntityType" NOT NULL,
    "entityId" UUID NOT NULL,
    "externalId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "external_entity_links_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "external_entity_links_provider_entityType_entityId_key"
  ON "external_entity_links"("provider", "entityType", "entityId");
CREATE UNIQUE INDEX "external_entity_links_provider_entityType_externalId_key"
  ON "external_entity_links"("provider", "entityType", "externalId");
CREATE INDEX "external_entity_links_entityId_idx" ON "external_entity_links"("entityId");
CREATE INDEX "external_entity_links_externalId_idx" ON "external_entity_links"("externalId");
