-- Atomic claim support for email outbox (multi-instance safe)
ALTER TABLE "email_outbox" ADD COLUMN "status" "OutboxStatus" NOT NULL DEFAULT 'PENDING';
ALTER TABLE "email_outbox" ADD COLUMN "availableAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

CREATE INDEX "email_outbox_status_availableAt_idx" ON "email_outbox"("status", "availableAt");
