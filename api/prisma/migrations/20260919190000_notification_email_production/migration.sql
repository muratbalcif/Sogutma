-- Email outbox: idempotency + delivery observability
ALTER TABLE "email_outbox" ADD COLUMN IF NOT EXISTS "eventKey" TEXT;
ALTER TABLE "email_outbox" ADD COLUMN IF NOT EXISTS "lastAttemptAt" TIMESTAMP(3);
ALTER TABLE "email_outbox" ADD COLUMN IF NOT EXISTS "sentAt" TIMESTAMP(3);
ALTER TABLE "email_outbox" ADD COLUMN IF NOT EXISTS "failedAt" TIMESTAMP(3);
ALTER TABLE "email_outbox" ADD COLUMN IF NOT EXISTS "providerMessageId" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "email_outbox_eventKey_key" ON "email_outbox"("eventKey");
CREATE INDEX IF NOT EXISTS "email_outbox_toEmail_idx" ON "email_outbox"("toEmail");

-- Channel preferences (non-destructive defaults)
ALTER TABLE "notification_preferences" ADD COLUMN IF NOT EXISTS "emailEnabled" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "notification_preferences" ADD COLUMN IF NOT EXISTS "pushEnabled" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "notification_preferences" ADD COLUMN IF NOT EXISTS "inAppEnabled" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "notification_preferences" ADD COLUMN IF NOT EXISTS "marketingEmailOptIn" BOOLEAN NOT NULL DEFAULT false;
