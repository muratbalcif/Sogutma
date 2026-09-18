-- AlterTable
ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "paymentReference" TEXT;

-- Backfill existing payments from order number
UPDATE "payments" p
SET "paymentReference" = o."orderNumber" || '-' || UPPER(SUBSTRING(REPLACE(p."id"::text, '-', ''), 1, 6))
FROM "orders" o
WHERE p."orderId" = o."id"
  AND p."paymentReference" IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "payments_paymentReference_key" ON "payments"("paymentReference");
CREATE INDEX IF NOT EXISTS "payments_paymentReference_idx" ON "payments"("paymentReference");
