# Catalog Operations

Production catalog architecture for FurkanSoğutma (API + Admin).

## Product architecture

- `Product`: SKU (unique), barcode, name, slug (unique), description, VAT, brand, category, `active`, SEO (`metaTitle`, `metaDescription`)
- Soft delete only (`active=false`) — order history snapshots are never hard-deleted
- Public catalog returns only `active=true`
- Admin list supports server-side pagination, search (name/SKU/barcode/brand/category), filter, sort

## Category

- Nested via `parentId`
- Fields: name, slug, parent, image, sortOrder, active
- Delete is soft-deactivate (never hard delete when children/products exist)

## Brand

- Fields: name, slug (unique), logo, description, sortOrder, active
- Logo may be an R2 public URL

## Attributes

- `ProductAttribute`: name/value/sortOrder rows per product
- Admin product edit → Özellikler tab

## Compatibility

- `ProductCompatibility`: manufacturer, model, modelYear, notes
- Admin product edit → Uyumluluk tab

## Pricing

- `ProductPrice` types: RETAIL, CAMPAIGN, WHOLESALE, CORPORATE
- `CustomerPrice` for customer-specific amounts
- Negative prices rejected; `validFrom`/`validTo` validated
- Resolution is centralized in `PriceService` (never trust client prices)

## Inventory

- Available = `quantity - reservedQuantity` (backend)
- Critical: `availableQuantity <= minimumQuantity`
- Increase/decrease create `InventoryTransaction` atomically
- Decrease cannot exceed available stock

## R2 (Cloudflare)

- Env: `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`, `R2_PUBLIC_URL`, `R2_MAX_UPLOAD_BYTES`, `R2_PRESIGN_TTL_SECONDS`
- Secrets never exposed to frontend
- Flow: `POST /admin/uploads/presign` → browser PUT → `POST /admin/products/:id/images`
- Object keys: `products/{uuid}.ext` (filename not used as key)
- Allowed: JPEG/PNG/WEBP
- Image delete: DB first, then R2 (failures logged for orphan cleanup via `objectKey`)

## Bulk import

- Preview → validate → confirm → result
- Job model: `ImportJob` + `ImportRowResult`
- Status: PENDING / READY / PROCESSING / COMPLETED / PARTIAL / FAILED
- Batch size: `IMPORT_BATCH_SIZE` (default 100)
- Max rows: `MAX_IMPORT_ROWS` (default 5000)
- Product upsert by SKU
- See [import-format.md](./import-format.md)

## Bulk price / stock

- `/admin/imports/prices/*` and `/admin/imports/stock/*`
- Stock operations: SET / INCREASE / DECREASE with InventoryTransaction
- Requires `import.create` permission + audit log

## Audit log

- `AuditLog`: adminUserId, action, entityType, entityId, metadata, createdAt
- Actions include PRODUCT_*, PRICE_*, STOCK_*, BULK_*, IMAGE_*
- Admin UI: `/audit` (`audit.read`)

## Payment note

Active payment method remains **bank transfer / EFT only**. Catalog does not introduce card providers.
