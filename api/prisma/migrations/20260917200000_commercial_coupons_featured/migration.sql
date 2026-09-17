-- Featured products
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "isFeatured" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "featuredSortOrder" INTEGER NOT NULL DEFAULT 0;
CREATE INDEX IF NOT EXISTS "products_isFeatured_idx" ON "products"("isFeatured");
CREATE INDEX IF NOT EXISTS "products_featuredSortOrder_idx" ON "products"("featuredSortOrder");

-- Order coupon snapshot fields
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "couponId" UUID;
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "couponCode" TEXT;
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "couponDiscountAmount" DECIMAL(12,2) NOT NULL DEFAULT 0;

DO $$ BEGIN
  CREATE TYPE "CouponType" AS ENUM ('PERCENTAGE', 'FIXED_AMOUNT');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "coupons" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "description" TEXT,
    "type" "CouponType" NOT NULL,
    "value" DECIMAL(12,2) NOT NULL,
    "minimumOrderAmount" DECIMAL(12,2),
    "maximumDiscountAmount" DECIMAL(12,2),
    "usageLimit" INTEGER,
    "perUserLimit" INTEGER,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "coupons_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "coupons_code_key" ON "coupons"("code");
CREATE INDEX IF NOT EXISTS "coupons_active_idx" ON "coupons"("active");
CREATE INDEX IF NOT EXISTS "coupons_startsAt_idx" ON "coupons"("startsAt");
CREATE INDEX IF NOT EXISTS "coupons_endsAt_idx" ON "coupons"("endsAt");
CREATE INDEX IF NOT EXISTS "coupons_code_idx" ON "coupons"("code");

CREATE TABLE IF NOT EXISTS "coupon_usages" (
    "id" UUID NOT NULL,
    "couponId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "orderId" UUID NOT NULL,
    "discountAmount" DECIMAL(12,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "coupon_usages_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "coupon_usages_couponId_orderId_key" ON "coupon_usages"("couponId", "orderId");
CREATE INDEX IF NOT EXISTS "coupon_usages_couponId_idx" ON "coupon_usages"("couponId");
CREATE INDEX IF NOT EXISTS "coupon_usages_userId_idx" ON "coupon_usages"("userId");
CREATE INDEX IF NOT EXISTS "coupon_usages_orderId_idx" ON "coupon_usages"("orderId");
CREATE INDEX IF NOT EXISTS "coupon_usages_couponId_userId_idx" ON "coupon_usages"("couponId", "userId");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'coupon_usages_couponId_fkey') THEN
    ALTER TABLE "coupon_usages"
      ADD CONSTRAINT "coupon_usages_couponId_fkey"
      FOREIGN KEY ("couponId") REFERENCES "coupons"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'coupon_usages_userId_fkey') THEN
    ALTER TABLE "coupon_usages"
      ADD CONSTRAINT "coupon_usages_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "users"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'coupon_usages_orderId_fkey') THEN
    ALTER TABLE "coupon_usages"
      ADD CONSTRAINT "coupon_usages_orderId_fkey"
      FOREIGN KEY ("orderId") REFERENCES "orders"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'orders_couponId_fkey') THEN
    ALTER TABLE "orders"
      ADD CONSTRAINT "orders_couponId_fkey"
      FOREIGN KEY ("couponId") REFERENCES "coupons"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "orders_couponId_idx" ON "orders"("couponId");
