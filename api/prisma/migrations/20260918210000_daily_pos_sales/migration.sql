-- Daily POS sales (admin counter). Separate from online orders.
CREATE TYPE "SaleStatus" AS ENUM ('COMPLETED', 'CANCELLED');
CREATE TYPE "SalePaymentMethod" AS ENUM ('CASH', 'CREDIT_CARD', 'BANK_TRANSFER');

CREATE TABLE "sales" (
    "id" UUID NOT NULL,
    "saleNumber" TEXT NOT NULL,
    "customerId" UUID,
    "createdById" UUID NOT NULL,
    "status" "SaleStatus" NOT NULL DEFAULT 'COMPLETED',
    "paymentMethod" "SalePaymentMethod" NOT NULL,
    "currency" CHAR(3) NOT NULL DEFAULT 'TRY',
    "subtotal" DECIMAL(12,2) NOT NULL,
    "discountAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "taxAmount" DECIMAL(12,2) NOT NULL,
    "totalAmount" DECIMAL(12,2) NOT NULL,
    "note" TEXT,
    "cancelledAt" TIMESTAMP(3),
    "cancelledById" UUID,
    "cancelReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sales_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "sale_items" (
    "id" UUID NOT NULL,
    "saleId" UUID NOT NULL,
    "productId" UUID,
    "productName" TEXT NOT NULL,
    "sku" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unitPrice" DECIMAL(12,2) NOT NULL,
    "discountAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "taxRate" DECIMAL(5,2) NOT NULL,
    "taxAmount" DECIMAL(12,2) NOT NULL,
    "lineSubtotal" DECIMAL(12,2) NOT NULL,
    "lineTotal" DECIMAL(12,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sale_items_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "sale_number_sequences" (
    "dateKey" CHAR(8) NOT NULL,
    "lastValue" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "sale_number_sequences_pkey" PRIMARY KEY ("dateKey")
);

CREATE UNIQUE INDEX "sales_saleNumber_key" ON "sales"("saleNumber");
CREATE INDEX "sales_customerId_idx" ON "sales"("customerId");
CREATE INDEX "sales_createdById_idx" ON "sales"("createdById");
CREATE INDEX "sales_status_idx" ON "sales"("status");
CREATE INDEX "sales_paymentMethod_idx" ON "sales"("paymentMethod");
CREATE INDEX "sales_createdAt_idx" ON "sales"("createdAt");
CREATE INDEX "sales_saleNumber_idx" ON "sales"("saleNumber");

CREATE INDEX "sale_items_saleId_idx" ON "sale_items"("saleId");
CREATE INDEX "sale_items_productId_idx" ON "sale_items"("productId");
CREATE INDEX "sale_items_sku_idx" ON "sale_items"("sku");

ALTER TABLE "sales" ADD CONSTRAINT "sales_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "sales" ADD CONSTRAINT "sales_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "sales" ADD CONSTRAINT "sales_cancelledById_fkey" FOREIGN KEY ("cancelledById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "sale_items" ADD CONSTRAINT "sale_items_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "sales"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "sale_items" ADD CONSTRAINT "sale_items_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Idempotent SALE stock tx for POS sale items (mirrors ORDER sale uniqueness)
CREATE UNIQUE INDEX "inventory_transactions_sale_saleitem_unique"
ON "inventory_transactions" ("productId", "referenceId")
WHERE "type" = 'SALE' AND "referenceType" = 'SALE';

CREATE UNIQUE INDEX "inventory_transactions_return_saleitem_unique"
ON "inventory_transactions" ("productId", "referenceId")
WHERE "type" = 'RETURN' AND "referenceType" = 'SALE';
