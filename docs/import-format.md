# Import format (CSV / XLSX)

All bulk imports: **upload → parse → validate → preview → confirm → result**.

Nothing is written to catalog tables until **confirm**.

## Product import columns

| Column | Required | Notes |
|--------|----------|-------|
| sku | yes | Unique upsert key (uppercase) |
| barcode | no | Must be unique if set |
| name | yes | |
| description | no | |
| brand | yes | Brand **name** or **slug** |
| category | yes | Category **name** or **slug** |
| vatRate | no | 0–100, default 20 |
| retailPrice | no | Decimal ≥ 0 |
| campaignPrice | no | Decimal ≥ 0 |
| wholesalePrice | no | Decimal ≥ 0 |
| corporatePrice | no | Decimal ≥ 0 |
| stock | no | Absolute SET quantity ≥ 0 |
| minimumStock | no | ≥ 0 |
| active | no | true/false/1/0/yes/no |
| slug | no | Auto from name (TR-normalized) if empty |

### Validation errors (examples)

- Row 17: SKU missing
- Row 42: Invalid price
- Brand not found / Category not found
- Negative stock / Invalid VAT / Invalid boolean / Invalid slug
- Duplicate SKU within file

### Upsert

- Existing SKU → UPDATE
- New SKU → CREATE (+ inventory row)

## Price import columns

| Column | Required |
|--------|----------|
| sku | yes |
| priceType | yes (RETAIL / CAMPAIGN / WHOLESALE / CORPORATE) |
| price | yes (≥ 0) |
| validFrom | no (ISO date) |
| validTo | no (must be ≥ validFrom) |

## Stock import columns

| Column | Required |
|--------|----------|
| sku | yes |
| quantity | yes (≥ 0) |
| operation | yes (SET / INCREASE / DECREASE) |
| reason | no |

DECREASE cannot exceed available stock. Every row creates an `InventoryTransaction`.

## Limits

- `MAX_IMPORT_ROWS` (default 5000)
- `IMPORT_BATCH_SIZE` (default 100)
- File size: products 15MB, price/stock 10MB

## Error export

`GET /admin/imports/:id/errors.csv` → `row,sku,error`
