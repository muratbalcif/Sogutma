-- AlterEnum: notification types for bank transfer lifecycle
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'BANK_TRANSFER_SUBMITTED';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'BANK_TRANSFER_APPROVED';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'BANK_TRANSFER_REJECTED';

-- AlterTable payments: reservation expiry
ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "expiresAt" TIMESTAMP(3);
CREATE INDEX IF NOT EXISTS "payments_expiresAt_idx" ON "payments"("expiresAt");

-- AlterTable company_bank_accounts
ALTER TABLE "company_bank_accounts" ADD COLUMN IF NOT EXISTS "currency" CHAR(3) NOT NULL DEFAULT 'TRY';
ALTER TABLE "company_bank_accounts" ADD COLUMN IF NOT EXISTS "description" TEXT;
ALTER TABLE "company_bank_accounts" ADD COLUMN IF NOT EXISTS "sortOrder" INTEGER NOT NULL DEFAULT 0;
CREATE INDEX IF NOT EXISTS "company_bank_accounts_sortOrder_idx" ON "company_bank_accounts"("sortOrder");

-- AlterTable bank_transfer_notifications
ALTER TABLE "bank_transfer_notifications" ADD COLUMN IF NOT EXISTS "bankAccountId" UUID;
ALTER TABLE "bank_transfer_notifications" ADD COLUMN IF NOT EXISTS "amountMismatch" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "bank_transfer_notifications" ADD COLUMN IF NOT EXISTS "adminNote" TEXT;
CREATE INDEX IF NOT EXISTS "bank_transfer_notifications_bankAccountId_idx" ON "bank_transfer_notifications"("bankAccountId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'bank_transfer_notifications_bankAccountId_fkey'
  ) THEN
    ALTER TABLE "bank_transfer_notifications"
      ADD CONSTRAINT "bank_transfer_notifications_bankAccountId_fkey"
      FOREIGN KEY ("bankAccountId") REFERENCES "company_bank_accounts"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- Email outbox (async, non-transactional delivery)
CREATE TABLE IF NOT EXISTS "email_outbox" (
    "id" UUID NOT NULL,
    "event" TEXT NOT NULL,
    "toEmail" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "processedAt" TIMESTAMP(3),
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "email_outbox_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "email_outbox_processedAt_idx" ON "email_outbox"("processedAt");
CREATE INDEX IF NOT EXISTS "email_outbox_event_idx" ON "email_outbox"("event");
CREATE INDEX IF NOT EXISTS "email_outbox_createdAt_idx" ON "email_outbox"("createdAt");
