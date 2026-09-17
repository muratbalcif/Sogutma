-- NotificationType extensions
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'ORDER_RETURNED';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'PAYMENT_PENDING';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'PAYMENT_APPROVED';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'PAYMENT_REJECTED';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'STOCK_AVAILABLE';

-- NotificationEntityType
DO $$ BEGIN
  CREATE TYPE "NotificationEntityType" AS ENUM ('ORDER', 'PRODUCT', 'PAYMENT', 'CAMPAIGN');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- OutboxStatus
DO $$ BEGIN
  CREATE TYPE "OutboxStatus" AS ENUM ('PENDING', 'PROCESSING', 'SENT', 'FAILED');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- ShippingProviderCode
DO $$ BEGIN
  CREATE TYPE "ShippingProviderCode" AS ENUM ('MANUAL');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- ShippingStatus
DO $$ BEGIN
  CREATE TYPE "ShippingStatus" AS ENUM ('PENDING', 'READY', 'SHIPPED', 'DELIVERED', 'RETURNED', 'CANCELLED');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Orders: orderNumber index (unique already exists; add explicit search-friendly index if missing)
CREATE INDEX IF NOT EXISTS "orders_orderNumber_idx" ON "orders"("orderNumber");

-- Shippings
CREATE TABLE IF NOT EXISTS "shippings" (
    "id" UUID NOT NULL,
    "orderId" UUID NOT NULL,
    "provider" "ShippingProviderCode" NOT NULL DEFAULT 'MANUAL',
    "trackingNumber" TEXT,
    "trackingUrl" TEXT,
    "status" "ShippingStatus" NOT NULL DEFAULT 'PENDING',
    "shippedAt" TIMESTAMP(3),
    "deliveredAt" TIMESTAMP(3),
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "shippings_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "shippings_orderId_key" ON "shippings"("orderId");
CREATE INDEX IF NOT EXISTS "shippings_orderId_idx" ON "shippings"("orderId");
CREATE INDEX IF NOT EXISTS "shippings_status_idx" ON "shippings"("status");
CREATE INDEX IF NOT EXISTS "shippings_trackingNumber_idx" ON "shippings"("trackingNumber");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'shippings_orderId_fkey'
  ) THEN
    ALTER TABLE "shippings"
      ADD CONSTRAINT "shippings_orderId_fkey"
      FOREIGN KEY ("orderId") REFERENCES "orders"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- Order returns foundation
CREATE TABLE IF NOT EXISTS "order_returns" (
    "id" UUID NOT NULL,
    "orderId" UUID NOT NULL,
    "returnReason" TEXT,
    "adminNote" TEXT,
    "createdByUserId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "order_returns_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "order_returns_orderId_key" ON "order_returns"("orderId");
CREATE INDEX IF NOT EXISTS "order_returns_orderId_idx" ON "order_returns"("orderId");
CREATE INDEX IF NOT EXISTS "order_returns_createdAt_idx" ON "order_returns"("createdAt");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'order_returns_orderId_fkey'
  ) THEN
    ALTER TABLE "order_returns"
      ADD CONSTRAINT "order_returns_orderId_fkey"
      FOREIGN KEY ("orderId") REFERENCES "orders"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'order_returns_createdByUserId_fkey'
  ) THEN
    ALTER TABLE "order_returns"
      ADD CONSTRAINT "order_returns_createdByUserId_fkey"
      FOREIGN KEY ("createdByUserId") REFERENCES "users"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- Notifications: entity + idempotency
ALTER TABLE "notifications" ADD COLUMN IF NOT EXISTS "entityType" "NotificationEntityType";
ALTER TABLE "notifications" ADD COLUMN IF NOT EXISTS "entityId" TEXT;
ALTER TABLE "notifications" ADD COLUMN IF NOT EXISTS "eventKey" TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS "notifications_eventKey_key" ON "notifications"("eventKey");
CREATE INDEX IF NOT EXISTS "notifications_userId_readAt_idx" ON "notifications"("userId", "readAt");
CREATE INDEX IF NOT EXISTS "notifications_entityType_entityId_idx" ON "notifications"("entityType", "entityId");

-- Notification outbox: status + eventKey + availableAt
ALTER TABLE "notification_outbox" ADD COLUMN IF NOT EXISTS "eventKey" TEXT;
ALTER TABLE "notification_outbox" ADD COLUMN IF NOT EXISTS "status" "OutboxStatus" NOT NULL DEFAULT 'PENDING';
ALTER TABLE "notification_outbox" ADD COLUMN IF NOT EXISTS "availableAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
CREATE UNIQUE INDEX IF NOT EXISTS "notification_outbox_eventKey_key" ON "notification_outbox"("eventKey");
CREATE INDEX IF NOT EXISTS "notification_outbox_status_availableAt_idx" ON "notification_outbox"("status", "availableAt");

-- Backfill outbox status from processedAt
UPDATE "notification_outbox"
SET "status" = 'SENT'
WHERE "processedAt" IS NOT NULL AND "status" = 'PENDING';
