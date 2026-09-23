-- Windows POS foundation (separate from admin counter `sales` / online orders).
-- Phase 1: registers + sale/items/payments + sale numbers + inventory uniqueness for POS_SALE.

ALTER TYPE "AdminRoleCode" ADD VALUE IF NOT EXISTS 'POS_CASHIER';

CREATE TYPE "PosSaleStatus" AS ENUM ('COMPLETED', 'CANCELLED', 'REFUNDED');
CREATE TYPE "PosPaymentMethod" AS ENUM ('CASH', 'CARD', 'BANK_TRANSFER', 'ON_ACCOUNT');
CREATE TYPE "PosPaymentStatus" AS ENUM ('COMPLETED', 'PENDING', 'FAILED', 'REFUNDED');

CREATE TABLE "pos_registers" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "openedAt" TIMESTAMP(3),
    "closedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pos_registers_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "pos_registers_code_key" ON "pos_registers"("code");
CREATE INDEX "pos_registers_isActive_idx" ON "pos_registers"("isActive");
CREATE INDEX "pos_registers_code_idx" ON "pos_registers"("code");

CREATE TABLE "pos_sales" (
    "id" UUID NOT NULL,
    "saleNumber" TEXT NOT NULL,
    "registerId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "customerId" UUID,
    "status" "PosSaleStatus" NOT NULL DEFAULT 'COMPLETED',
    "currency" CHAR(3) NOT NULL DEFAULT 'TRY',
    "subtotal" DECIMAL(12,2) NOT NULL,
    "discountTotal" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "taxTotal" DECIMAL(12,2) NOT NULL,
    "grandTotal" DECIMAL(12,2) NOT NULL,
    "note" TEXT,
    "idempotencyKey" TEXT,
    "completedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "cancelledById" UUID,
    "cancelReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pos_sales_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "pos_sales_saleNumber_key" ON "pos_sales"("saleNumber");
CREATE UNIQUE INDEX "pos_sales_idempotencyKey_key" ON "pos_sales"("idempotencyKey");
CREATE INDEX "pos_sales_registerId_idx" ON "pos_sales"("registerId");
CREATE INDEX "pos_sales_userId_idx" ON "pos_sales"("userId");
CREATE INDEX "pos_sales_customerId_idx" ON "pos_sales"("customerId");
CREATE INDEX "pos_sales_status_idx" ON "pos_sales"("status");
CREATE INDEX "pos_sales_createdAt_idx" ON "pos_sales"("createdAt");
CREATE INDEX "pos_sales_saleNumber_idx" ON "pos_sales"("saleNumber");
CREATE INDEX "pos_sales_completedAt_idx" ON "pos_sales"("completedAt");

CREATE TABLE "pos_sale_items" (
    "id" UUID NOT NULL,
    "saleId" UUID NOT NULL,
    "productId" UUID,
    "productName" TEXT NOT NULL,
    "sku" TEXT NOT NULL,
    "barcode" TEXT,
    "quantity" INTEGER NOT NULL,
    "unitPrice" DECIMAL(12,2) NOT NULL,
    "discountAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "taxRate" DECIMAL(5,2) NOT NULL,
    "taxAmount" DECIMAL(12,2) NOT NULL,
    "lineSubtotal" DECIMAL(12,2) NOT NULL,
    "lineTotal" DECIMAL(12,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pos_sale_items_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "pos_sale_items_saleId_idx" ON "pos_sale_items"("saleId");
CREATE INDEX "pos_sale_items_productId_idx" ON "pos_sale_items"("productId");
CREATE INDEX "pos_sale_items_sku_idx" ON "pos_sale_items"("sku");
CREATE INDEX "pos_sale_items_barcode_idx" ON "pos_sale_items"("barcode");

CREATE TABLE "pos_payments" (
    "id" UUID NOT NULL,
    "saleId" UUID NOT NULL,
    "method" "PosPaymentMethod" NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "status" "PosPaymentStatus" NOT NULL DEFAULT 'COMPLETED',
    "referenceNumber" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pos_payments_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "pos_payments_saleId_idx" ON "pos_payments"("saleId");
CREATE INDEX "pos_payments_method_idx" ON "pos_payments"("method");
CREATE INDEX "pos_payments_status_idx" ON "pos_payments"("status");
CREATE INDEX "pos_payments_createdAt_idx" ON "pos_payments"("createdAt");

CREATE TABLE "pos_sale_number_sequences" (
    "dateKey" CHAR(8) NOT NULL,
    "lastValue" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "pos_sale_number_sequences_pkey" PRIMARY KEY ("dateKey")
);

ALTER TABLE "pos_sales" ADD CONSTRAINT "pos_sales_registerId_fkey" FOREIGN KEY ("registerId") REFERENCES "pos_registers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "pos_sales" ADD CONSTRAINT "pos_sales_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "pos_sales" ADD CONSTRAINT "pos_sales_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "pos_sales" ADD CONSTRAINT "pos_sales_cancelledById_fkey" FOREIGN KEY ("cancelledById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "pos_sale_items" ADD CONSTRAINT "pos_sale_items_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "pos_sales"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "pos_sale_items" ADD CONSTRAINT "pos_sale_items_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "pos_payments" ADD CONSTRAINT "pos_payments_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "pos_sales"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Idempotent stock SALE for Windows POS items (referenceType = POS_SALE).
CREATE UNIQUE INDEX "inventory_transactions_pos_sale_item_unique"
ON "inventory_transactions" ("productId", "referenceId")
WHERE "type" = 'SALE' AND "referenceType" = 'POS_SALE';

CREATE UNIQUE INDEX "inventory_transactions_pos_return_item_unique"
ON "inventory_transactions" ("productId", "referenceId")
WHERE "type" = 'RETURN' AND "referenceType" = 'POS_SALE';

-- Default register for first POS workstation.
INSERT INTO "pos_registers" ("id", "name", "code", "isActive", "createdAt", "updatedAt")
VALUES (
  gen_random_uuid(),
  'Kasa 1',
  'KASA1',
  true,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
);
