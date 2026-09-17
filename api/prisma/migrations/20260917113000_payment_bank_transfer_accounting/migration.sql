-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('CREDIT_CARD', 'BANK_TRANSFER', 'CASH_ON_DELIVERY');

-- CreateEnum
CREATE TYPE "BankTransferStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "AccountTransactionType" AS ENUM ('SALE', 'PAYMENT', 'REFUND', 'ADJUSTMENT');

-- DropIndex
DROP INDEX IF EXISTS "payments_orderId_key";

-- AlterTable: add nullable method first for existing rows, then backfill
ALTER TABLE "payments" ADD COLUMN "failureCode" TEXT,
ADD COLUMN "failureMessage" TEXT,
ADD COLUMN "idempotencyKey" TEXT,
ADD COLUMN "method" "PaymentMethod",
ADD COLUMN "paidAt" TIMESTAMP(3),
ADD COLUMN "providerPaymentId" TEXT;

UPDATE "payments" SET "method" = 'CREDIT_CARD' WHERE "method" IS NULL;

ALTER TABLE "payments" ALTER COLUMN "method" SET NOT NULL;

-- CreateTable
CREATE TABLE "bank_transfer_notifications" (
    "id" UUID NOT NULL,
    "orderId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "paymentId" UUID NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "currency" CHAR(3) NOT NULL DEFAULT 'TRY',
    "senderName" TEXT NOT NULL,
    "senderIban" TEXT,
    "transferDate" DATE NOT NULL,
    "referenceNumber" TEXT,
    "note" TEXT,
    "status" "BankTransferStatus" NOT NULL DEFAULT 'PENDING',
    "verifiedBy" UUID,
    "verifiedAt" TIMESTAMP(3),
    "rejectionReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bank_transfer_notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "account_transactions" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "orderId" UUID,
    "paymentId" UUID,
    "type" "AccountTransactionType" NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "currency" CHAR(3) NOT NULL DEFAULT 'TRY',
    "description" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "account_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "company_bank_accounts" (
    "id" UUID NOT NULL,
    "bankName" TEXT NOT NULL,
    "accountName" TEXT NOT NULL,
    "iban" TEXT NOT NULL,
    "branch" TEXT,
    "accountNumber" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "company_bank_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "processed_webhook_events" (
    "id" UUID NOT NULL,
    "provider" TEXT NOT NULL,
    "eventKey" TEXT NOT NULL,
    "paymentId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "processed_webhook_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "bank_transfer_notifications_orderId_idx" ON "bank_transfer_notifications"("orderId");
CREATE INDEX "bank_transfer_notifications_userId_idx" ON "bank_transfer_notifications"("userId");
CREATE INDEX "bank_transfer_notifications_paymentId_idx" ON "bank_transfer_notifications"("paymentId");
CREATE INDEX "bank_transfer_notifications_status_idx" ON "bank_transfer_notifications"("status");
CREATE INDEX "bank_transfer_notifications_createdAt_idx" ON "bank_transfer_notifications"("createdAt");

CREATE UNIQUE INDEX "account_transactions_reference_key" ON "account_transactions"("reference");
CREATE INDEX "account_transactions_userId_idx" ON "account_transactions"("userId");
CREATE INDEX "account_transactions_orderId_idx" ON "account_transactions"("orderId");
CREATE INDEX "account_transactions_paymentId_idx" ON "account_transactions"("paymentId");
CREATE INDEX "account_transactions_type_idx" ON "account_transactions"("type");
CREATE INDEX "account_transactions_createdAt_idx" ON "account_transactions"("createdAt");

CREATE INDEX "company_bank_accounts_active_idx" ON "company_bank_accounts"("active");

CREATE INDEX "processed_webhook_events_paymentId_idx" ON "processed_webhook_events"("paymentId");
CREATE UNIQUE INDEX "processed_webhook_events_provider_eventKey_key" ON "processed_webhook_events"("provider", "eventKey");

CREATE UNIQUE INDEX "payments_idempotencyKey_key" ON "payments"("idempotencyKey");
CREATE INDEX "payments_orderId_idx" ON "payments"("orderId");
CREATE INDEX "payments_method_idx" ON "payments"("method");
CREATE INDEX "payments_providerPaymentId_idx" ON "payments"("providerPaymentId");
CREATE INDEX "payments_createdAt_idx" ON "payments"("createdAt");

-- AddForeignKey
ALTER TABLE "bank_transfer_notifications" ADD CONSTRAINT "bank_transfer_notifications_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "bank_transfer_notifications" ADD CONSTRAINT "bank_transfer_notifications_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "bank_transfer_notifications" ADD CONSTRAINT "bank_transfer_notifications_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "payments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "account_transactions" ADD CONSTRAINT "account_transactions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "account_transactions" ADD CONSTRAINT "account_transactions_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "account_transactions" ADD CONSTRAINT "account_transactions_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "payments"("id") ON DELETE SET NULL ON UPDATE CASCADE;
