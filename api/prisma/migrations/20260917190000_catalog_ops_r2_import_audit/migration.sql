-- Brand: description + sortOrder
ALTER TABLE "brands" ADD COLUMN IF NOT EXISTS "description" TEXT;
ALTER TABLE "brands" ADD COLUMN IF NOT EXISTS "sortOrder" INTEGER NOT NULL DEFAULT 0;
CREATE INDEX IF NOT EXISTS "brands_sortOrder_idx" ON "brands"("sortOrder");

-- Product SEO
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "metaTitle" TEXT;
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "metaDescription" TEXT;

-- ProductImage objectKey for R2 cleanup
ALTER TABLE "product_images" ADD COLUMN IF NOT EXISTS "objectKey" TEXT;
CREATE INDEX IF NOT EXISTS "product_images_objectKey_idx" ON "product_images"("objectKey");

-- Import job enums
DO $$ BEGIN
  CREATE TYPE "ImportJobType" AS ENUM ('PRODUCTS', 'PRICES', 'STOCK', 'PRODUCT_STATUS');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "ImportJobStatus" AS ENUM ('PENDING', 'VALIDATING', 'READY', 'PROCESSING', 'COMPLETED', 'PARTIAL', 'FAILED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "import_jobs" (
    "id" UUID NOT NULL,
    "type" "ImportJobType" NOT NULL,
    "filename" TEXT NOT NULL,
    "sourceKey" TEXT,
    "status" "ImportJobStatus" NOT NULL DEFAULT 'PENDING',
    "totalRows" INTEGER NOT NULL DEFAULT 0,
    "validRows" INTEGER NOT NULL DEFAULT 0,
    "invalidRows" INTEGER NOT NULL DEFAULT 0,
    "successRows" INTEGER NOT NULL DEFAULT 0,
    "failedRows" INTEGER NOT NULL DEFAULT 0,
    "newRows" INTEGER NOT NULL DEFAULT 0,
    "updateRows" INTEGER NOT NULL DEFAULT 0,
    "preview" JSONB,
    "options" JSONB,
    "errorSummary" TEXT,
    "createdBy" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    CONSTRAINT "import_jobs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "import_jobs_type_idx" ON "import_jobs"("type");
CREATE INDEX IF NOT EXISTS "import_jobs_status_idx" ON "import_jobs"("status");
CREATE INDEX IF NOT EXISTS "import_jobs_createdBy_idx" ON "import_jobs"("createdBy");
CREATE INDEX IF NOT EXISTS "import_jobs_createdAt_idx" ON "import_jobs"("createdAt");

CREATE TABLE IF NOT EXISTS "import_row_results" (
    "id" UUID NOT NULL,
    "jobId" UUID NOT NULL,
    "rowNumber" INTEGER NOT NULL,
    "sku" TEXT,
    "status" TEXT NOT NULL,
    "errors" TEXT[] NOT NULL,
    "payload" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "import_row_results_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "import_row_results_jobId_idx" ON "import_row_results"("jobId");
CREATE INDEX IF NOT EXISTS "import_row_results_sku_idx" ON "import_row_results"("sku");
CREATE INDEX IF NOT EXISTS "import_row_results_status_idx" ON "import_row_results"("status");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'import_row_results_jobId_fkey') THEN
    ALTER TABLE "import_row_results"
      ADD CONSTRAINT "import_row_results_jobId_fkey"
      FOREIGN KEY ("jobId") REFERENCES "import_jobs"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "audit_logs" (
    "id" UUID NOT NULL,
    "adminUserId" UUID NOT NULL,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "audit_logs_adminUserId_idx" ON "audit_logs"("adminUserId");
CREATE INDEX IF NOT EXISTS "audit_logs_action_idx" ON "audit_logs"("action");
CREATE INDEX IF NOT EXISTS "audit_logs_entityType_idx" ON "audit_logs"("entityType");
CREATE INDEX IF NOT EXISTS "audit_logs_entityId_idx" ON "audit_logs"("entityId");
CREATE INDEX IF NOT EXISTS "audit_logs_createdAt_idx" ON "audit_logs"("createdAt");
