-- Phase 5: POS returns (partial/full) + refund tender rows.
-- Inventory RETURN uniqueness for POS_SALE already uses referenceId = return item id.

CREATE TABLE "pos_returns" (
    "id" UUID NOT NULL,
    "saleId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "currency" CHAR(3) NOT NULL DEFAULT 'TRY',
    "totalAmount" DECIMAL(12,2) NOT NULL,
    "reason" TEXT,
    "note" TEXT,
    "idempotencyKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pos_returns_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "pos_returns_idempotencyKey_key" ON "pos_returns"("idempotencyKey");
CREATE INDEX "pos_returns_saleId_idx" ON "pos_returns"("saleId");
CREATE INDEX "pos_returns_userId_idx" ON "pos_returns"("userId");
CREATE INDEX "pos_returns_createdAt_idx" ON "pos_returns"("createdAt");

CREATE TABLE "pos_return_items" (
    "id" UUID NOT NULL,
    "returnId" UUID NOT NULL,
    "saleItemId" UUID NOT NULL,
    "productId" UUID,
    "productName" TEXT NOT NULL,
    "sku" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "lineRefund" DECIMAL(12,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pos_return_items_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "pos_return_items_returnId_idx" ON "pos_return_items"("returnId");
CREATE INDEX "pos_return_items_saleItemId_idx" ON "pos_return_items"("saleItemId");
CREATE INDEX "pos_return_items_productId_idx" ON "pos_return_items"("productId");

CREATE TABLE "pos_return_payments" (
    "id" UUID NOT NULL,
    "returnId" UUID NOT NULL,
    "method" "PosPaymentMethod" NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pos_return_payments_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "pos_return_payments_returnId_idx" ON "pos_return_payments"("returnId");
CREATE INDEX "pos_return_payments_method_idx" ON "pos_return_payments"("method");

ALTER TABLE "pos_returns" ADD CONSTRAINT "pos_returns_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "pos_sales"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "pos_returns" ADD CONSTRAINT "pos_returns_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "pos_return_items" ADD CONSTRAINT "pos_return_items_returnId_fkey" FOREIGN KEY ("returnId") REFERENCES "pos_returns"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "pos_return_items" ADD CONSTRAINT "pos_return_items_saleItemId_fkey" FOREIGN KEY ("saleItemId") REFERENCES "pos_sale_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "pos_return_items" ADD CONSTRAINT "pos_return_items_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "pos_return_payments" ADD CONSTRAINT "pos_return_payments_returnId_fkey" FOREIGN KEY ("returnId") REFERENCES "pos_returns"("id") ON DELETE CASCADE ON UPDATE CASCADE;
