-- Legal page content versioning
ALTER TABLE "legal_pages" ADD COLUMN "version" INTEGER NOT NULL DEFAULT 1;
