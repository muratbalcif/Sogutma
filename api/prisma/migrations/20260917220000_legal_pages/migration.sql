-- Editable legal pages (KVKK / privacy / terms)
CREATE TABLE "legal_pages" (
    "id" UUID NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "legal_pages_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "legal_pages_slug_key" ON "legal_pages"("slug");
