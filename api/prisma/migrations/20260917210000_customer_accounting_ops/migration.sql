-- Corporate credit settings
ALTER TABLE "corporate_customers" ADD COLUMN IF NOT EXISTS "allowCredit" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "corporate_customers" ADD COLUMN IF NOT EXISTS "creditLimit" DECIMAL(12,2);
ALTER TABLE "corporate_customers" ADD COLUMN IF NOT EXISTS "paymentTermDays" INTEGER NOT NULL DEFAULT 0;

-- Account transaction enrichment
ALTER TABLE "account_transactions" ADD COLUMN IF NOT EXISTS "referenceType" TEXT;
ALTER TABLE "account_transactions" ADD COLUMN IF NOT EXISTS "referenceId" TEXT;
ALTER TABLE "account_transactions" ADD COLUMN IF NOT EXISTS "balanceAfter" DECIMAL(12,2);
ALTER TABLE "account_transactions" ADD COLUMN IF NOT EXISTS "createdBy" UUID;

CREATE INDEX IF NOT EXISTS "account_transactions_referenceType_idx" ON "account_transactions"("referenceType");
CREATE INDEX IF NOT EXISTS "account_transactions_referenceId_idx" ON "account_transactions"("referenceId");
CREATE INDEX IF NOT EXISTS "account_transactions_userId_createdAt_idx" ON "account_transactions"("userId", "createdAt");

-- Order due date for credit/overdue reporting
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "dueDate" TIMESTAMP(3);
CREATE INDEX IF NOT EXISTS "orders_dueDate_idx" ON "orders"("dueDate");

-- Customer bulk import
ALTER TYPE "ImportJobType" ADD VALUE IF NOT EXISTS 'CUSTOMERS';
