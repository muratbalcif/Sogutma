-- AlterTable
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "technicalHtml" TEXT;
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "compatibilityHtml" TEXT;
