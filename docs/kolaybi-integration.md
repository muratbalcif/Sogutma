# KolayBi e-Fatura / e-Arşiv integration

## Status by phase

| Phase | Status |
|-------|--------|
| 1 Database foundation | Done (`Invoice`, `ExternalEntityLink`, tax fields) |
| 2 HTTP client + auth + health | Done |
| 3 Customer / address → Associate sync | Done |
| 4 Product → KolayBi Product sync | Done |
| 5 Sale → local Invoice → KolayBi draft | Done |
| 6 e-Fatura / e-Arşiv formalize | **Done** |
| 7 Admin invoice ops | Done |
| 8 Document retrieve + status sync | **Done** |
| 9 Production hardening | **Done** (sandbox E2E blocked — no credentials) |

Phase 6 formalizes a KolayBi **draft** into a GİB e-document (`uuid` / ETTN + `no`).
Phase 8 retrieves PDF/XML via documented e-document/view and syncs uuid/serial from detail+list.

## Architecture

```
Admin (JWT)
  → GET  /admin/invoices                          (invoice.read)
  → GET  /admin/invoices/:invoiceId               (invoice.read)
  → GET  /admin/invoices/:invoiceId/pdf           (invoice.read)
  → GET  /admin/invoices/:invoiceId/xml           (invoice.read)
  → POST /admin/invoices/:invoiceId/sync          (invoice.read)
  → GET  /admin/invoices/provider/health          (invoice.read)
  → POST /admin/invoices/from-sale/:saleId        (invoice.create)
  → POST /admin/invoices/:invoiceId/formalize     (invoice.create)
  → POST /admin/invoices/provider/:code/customers/:userId/sync   (invoice.update)
  → POST /admin/invoices/provider/:code/addresses/:addressId/sync (invoice.update)
  → POST /admin/invoices/provider/:code/products/:productId/sync  (invoice.update)
  → InvoiceFromSaleService / InvoiceFormalizeService / InvoiceDocumentService / InvoicesService
  → InvoiceProvider          (provider-neutral DTOs)
       └── KolayBiInvoiceProvider
              └── KolayBiClient (fetch + token cache)
```

Future providers (Logo, Paraşüt, Mikro) implement the same `InvoiceProvider` interface and register via the `INVOICE_PROVIDERS` DI token (same pattern as `SHIPPING_PROVIDERS`).

Sale / stock / payment flows are intentionally untouched. Invoices are created as an explicit admin action, never automatically on `POST /admin/sales`.

## Environment variables

| Variable | Required for enablement | Notes |
|----------|-------------------------|--------|
| `KOLAYBI_API_BASE_URL` | Yes | **Source of truth** for API host (no hardcoded URL in code). Example sandbox: `https://ofis-sandbox-api.kolaybi.com` |
| `KOLAYBI_API_KEY` | Yes | Used only to obtain access token (`api_key` JSON body) |
| `KOLAYBI_CHANNEL` | Yes | Sent as `Channel` header on every request |
| `KOLAYBI_SANDBOX` | No (default `true`) | Flag for logging / safety; does **not** override `KOLAYBI_API_BASE_URL` |

If any of the three required values are empty, the client is **disabled** (same optional-provider style as R2 / Resend).

Never put these values in admin/web/mobile env files.

## Authentication

Official flow ([KolayBi auth docs](https://developer.kolaybi.com/docs/auth/intro)):

1. `POST {BASE}/kolaybi/v1/access_token`
2. Headers: `Channel: {CHANNEL}`, `Content-Type: application/json`
3. Body: `{ "api_key": "{API_KEY}" }`
4. Response: `{ "data": "<access_token_string>" }`
5. Token lifetime: **24 hours**
6. Subsequent calls: `Authorization: Bearer <token>` + `Channel: {CHANNEL}`

## Token lifecycle

- Tokens are cached **in process memory** only.
- Refresh skew: renew ~5 minutes before the 24h expiry.
- Concurrent callers share a **single-flight** refresh promise (no stampede).
- Authenticated `401` responses invalidate the cache and retry **once** with a fresh token.
- Secrets (API key, channel, bearer token, Authorization header) are **never** written to logs.

## Health check

`GET /api/v1/admin/invoices/provider/health?provider=KOLAYBI`

- Permission: `invoice.read`
- Steps: authenticate → `GET /kolaybi/v1/companies` (read-only)
- Response: `{ provider, enabled, ok, sandbox, message }`

## Phase 3 — Customer / Address sync

### User → Associate mapping

Docs: [Cari oluşturma](https://developer.kolaybi.com/docs/associates/create/) (`POST /kolaybi/v1/associates`, **form-urlencoded**).

| FurkanSoğutma | KolayBi field |
|---------------|---------------|
| INDIVIDUAL `firstName` | `name` (required, min 2) |
| INDIVIDUAL `lastName` | `surname` (required, min 2) |
| INDIVIDUAL `identityNumber` (TCKN 11) | `identity_no` |
| CORPORATE `companyName` | `name` |
| CORPORATE contact surname / fallback | `surname` |
| CORPORATE `taxNumber` (VKN 10) | `identity_no` |
| CORPORATE `taxOffice` | `tax_office` (required for VKN) |
| `userType` | `is_corporate` true/false |
| — | `associate_type=customer` |
| stable local id | `code=fs-user-{userId}` (orphan recovery) |
| email / phone | optional `email` / `phone` |

Validation rejects missing/invalid TCKN or VKN — **no fake identity numbers**.

### Address mapping

Docs: [Adres oluşturma](https://developer.kolaybi.com/docs/associates/addresses/) (`POST /kolaybi/v1/address/create`).

| FurkanSoğutma Address | KolayBi |
|-----------------------|---------|
| linked associate | `associate_id` (required) |
| neighborhood + addressLine | `address` |
| city / district | `city` / `district` (required) |
| country `TR` → `Türkiye` | `country` (required) |
| postalCode | `postal_code` (optional) |
| — | `address_type=invoice` |

Address sync **requires** customer sync first (auto-runs `syncCustomer` if `ExternalEntityLink` for USER is missing).

`Invoice.billingAddressSnapshot` is never modified by address sync.

### ExternalEntityLink

| provider | entityType | entityId | externalId |
|----------|------------|----------|------------|
| `KOLAYBI` | `USER` | local User.id | KolayBi associate `id` |
| `KOLAYBI` | `ADDRESS` | local Address.id | KolayBi address `id` |
| `KOLAYBI` | `PRODUCT` | local Product.id | KolayBi product `id` |

No `kolayBiId` columns on User/Address/Product.

### Create / update behaviour

KolayBi public docs expose **create + detail + list**, not associate/address **update**.

| Local state | Behaviour |
|-------------|-----------|
| No link | `POST` create → upsert link |
| Link exists | `GET /associates/{id}` verify; on **404** recreate + update link |
| Create 409/400 + conflict | `GET /associates?code=fs-user-{id}` (then `identity_no`) → link found id |

So “update” in product language means **ensure / verify**, not a PUT to KolayBi.

### Retry / idempotency

1. HTTP call completes **before** `ExternalEntityLink` upsert (no long DB transaction around HTTP).
2. Stable `code=fs-user-{userId}` on create.
3. Orphan recovery: if create succeeded but DB upsert failed, next sync lists by `code` / `identity_no` and links without duplicating when KolayBi returns conflict.

**Risk (documented):** Address create has no `code` filter — orphan address rows on KolayBi after DB failure may require manual cleanup. Associate path is safer via `code`.

### Admin sync endpoints

```
POST /api/v1/admin/invoices/provider/KOLAYBI/customers/{userId}/sync
POST /api/v1/admin/invoices/provider/KOLAYBI/addresses/{addressId}/sync
POST /api/v1/admin/invoices/provider/KOLAYBI/products/{productId}/sync
```

Permission: `invoice.update`.

### e-Fatura mükellefi

`User.isEInvoiceTaxpayer` remains a **local cache** only. Phase 3 does not query GİB or auto-select e-Fatura vs e-Arşiv.

## Phase 4 — Product Sync

Docs: [Ürün oluşturma](https://developer.kolaybi.com/docs/products/create/) (`POST /kolaybi/v1/products`, form), [liste](https://developer.kolaybi.com/docs/products/list/) (`GET /products?code=` / `?barcode=`), [detay](https://developer.kolaybi.com/docs/products/detail/) (`GET /products/{id}`).

PUT update exists in KolayBi docs but Phase 4 **ensure** only verifies / creates / links — no automatic push of local edits.

### Product mapping

| FurkanSoğutma | KolayBi |
|---------------|---------|
| `sku` | `code` (stable identity; **do not invent another code**) |
| `name` | `name` (required) |
| `description` | `description` (optional; only if present) |
| `barcode` | `barcode` (optional; **never invent**) |
| `vatRate` | `vat_rate` (decimal string via `toFixed(2)`, e.g. `20.00`) |
| — | `product_type=good` |
| unit | **not sent** — create API has no unit param (no DB `unit` column either) |
| price | **not sent** — optional on KolayBi; invoice lines use `SaleItem.unitPrice` |

### ensureProduct behaviour

| Local state | Behaviour |
|-------------|-----------|
| Link exists | `GET /products/{id}`; on **404** → lookup → create |
| No link | `GET /products?code={sku}` (then `?barcode=` if set) → link if found |
| Not found remotely | `POST /products` with `code=sku` |
| Create 409/400 conflict | list by `code` / `barcode` → link found id |

### Duplicate prevention / recovery

- Stable `code = product.sku`.
- Lookup-before-create + conflict list resolution.
- `ExternalEntityLink` upsert **after** successful HTTP (no long Prisma transaction around KolayBi).
- Orphan after CREATE-ok / DB-fail: next sync finds by `code` and links.

### Invoice price note

Product sync does **not** copy `ProductPrice` / `CustomerPrice`. Invoice lines use SaleItem snapshot prices (Phase 5).

## Phase 5 — Sale → Invoice

Docs: [Fatura oluşturma](https://developer.kolaybi.com/docs/invoices/create/) (`POST /kolaybi/v1/invoices`, form), [liste](https://developer.kolaybi.com/docs/invoices/list/).

**Endpoint:** `POST /api/v1/admin/invoices/from-sale/:saleId` (`invoice.create`)

Body (optional):

```json
{ "documentType": "E_ARCHIVE", "billingAddressId": "..." }
```

### Sale validation

| Check | Result |
|-------|--------|
| Sale missing | 404 |
| Status ≠ `COMPLETED` | 400 |
| `customerId` null (perakende) | 400 — "Fatura oluşturmak için müşteri bilgisi gereklidir." |
| No items / missing `productId` | 400 |
| Billing address not owned by customer | 400 |

Sale status/stock/payment are **never** modified by invoice create.

### Document type

Local `documentType` is derived from `User.isEInvoiceTaxpayer` (`true` → `E_INVOICE`, else `E_ARCHIVE`). Request override must match. Phase 5 does **not** formalize to GİB.

### Flow

```
Sale (COMPLETED + customer)
  → validate + resolve billing address
  → local Invoice PENDING (idempotencyKey = SALE:{saleId})
  → syncCustomer / syncAddress / syncProduct (Phase 3–4)
  → KolayBi POST /invoices (draft)
  → local Invoice SUCCESS (externalDocumentId = document_id)
```

HTTP calls run **outside** long Prisma transactions.

### Line mapping (SaleItem snapshot)

| SaleItem | KolayBi item field |
|----------|--------------------|
| provider product id | `items[n][product_id]` |
| `lineSubtotal / quantity` | `items[n][unit_price]` (**VAT-exclusive**; Sale `unitPrice` is inclusive) |
| `quantity` | `items[n][quantity]` |
| `taxRate` | `items[n][vat_rate]` |
| `productName` | `items[n][description]` |

Totals copied from Sale. Provider `grand_total` compared to Sale `totalAmount` (±0.01); mismatch → `FAILED` + `TOTAL_MISMATCH`.

### KolayBi request / response

- Request: `contact_id`, `address_id`, `order_date`, `currency=try`, `type=sale_invoice`, `serial_no=saleNumber`, `description=SALE:{saleId}`, items…
- Response: `document_id` → `externalDocumentId`; `uuid` null until Phase 6; `invoiceNumber` from saleNumber / list serial

### Idempotency / concurrency

- Unique `idempotencyKey = SALE:{saleId}`
- Partial unique: one `PENDING|SUCCESS` per `saleId`
- Concurrent create → `P2002` → reload existing
- SUCCESS re-call → same invoice (no second KolayBi create)
- FAILED/CANCELLED → in-place retry
- Pre-create list by `description` + `associate_id` (orphan recovery)
- Retryable errors → keep **PENDING** (no blind recreate)

### Billing address snapshot

Immutable JSON (Order pattern): title, names, phone, city, district, neighborhood, addressLine, postalCode, country, companyName.

### Known risks

1. Timeout after KolayBi create before local SUCCESS → PENDING; next call resolves via description list when possible.
2. Address orphan risk from Phase 3 still applies.
3. `uuid` (ETTN) only after Phase 6 formalize.
4. Existing DBs need permission seed/redeploy for `invoice.create`.

## Phase 6 — E-document formalization

Docs: [E-Fatura gönderimi](https://developer.kolaybi.com/docs/invoices/e-document/) (`POST /kolaybi/v1/invoices/e-document/create`, form), detail uuid: [Fatura detay](https://developer.kolaybi.com/docs/invoices/detail/).

**Endpoint:** `POST /api/v1/admin/invoices/:invoiceId/formalize` (`invoice.create`)

Body (optional): `{ "prefix": "HDB" }` — KolayBi series prefix; omitted → company default.

### Lifecycle (no new enum / migration)

| Local state | Meaning |
|-------------|---------|
| `SUCCESS` + `uuid` null | KolayBi **draft** created (Phase 5) — eligible to formalize |
| `SUCCESS` + `uuid` set | **Formalized** — GİB ETTN stored |
| `SUCCESS` + `errorCode=FORMALIZE_UNKNOWN` | Formalize timeout/unknown — draft may already be formalized remotely; retry safe via detail lookup |
| `PENDING` / `FAILED` | Not eligible for formalize |

Phase 1 `InvoiceStatus` is kept. Formalization is distinguished by **`uuid` presence**, not a new status.

### Request mapping (KolayBi)

| Field | Value |
|-------|-------|
| `document_id` | Invoice.`externalDocumentId` (required) |
| `prefix` | optional |

**Not sent:** `scenario`, `document_type`, e-Fatura/e-Arşiv switch — KolayBi derives scenario from the associate (response may include `scenario`, e.g. `EARSIVFATURA`).

### Response mapping

| KolayBi | Local Invoice |
|---------|---------------|
| `uuid` | `uuid` (ETTN) |
| `no` | `invoiceNumber` (replaces Phase 5 saleNumber placeholder when present) |
| `document_id` | unchanged `externalDocumentId` |
| `scenario` | logged / returned informationally — not authoritative vs GİB query |

### Scenario / documentType

- Local `documentType` remains authoritative from Phase 5 (`isEInvoiceTaxpayer` → `E_INVOICE` / else `E_ARCHIVE`).
- Formalize re-checks customer `isEInvoiceTaxpayer` vs stored `documentType`; mismatch → 400.
- **No GİB mükellef query endpoint** found in KolayBi public docs — local flag is a limitation (documented).
- Soft warn if response `scenario` looks like e-Arşiv vs local `E_INVOICE` (or reverse).

### Idempotency / timeout

1. If `uuid` already set → return (no second e-document create).
2. Before create: `GET /invoices/{document_id}` — if `uuid` present, link and return.
3. After timeout/409/400: detail lookup again before failing.
4. Concurrent writers: `updateMany` where `uuid` is null; loser reloads winner’s uuid.
5. Blind retry of e-document create is avoided when detail already has uuid.

Phase 5 `idempotencyKey = SALE:{saleId}` is unchanged.

### Known limitations / blockers

1. No documented taxpayer (GİB mükellef) query API — relies on local `isEInvoiceTaxpayer`.
2. Detail GET response docs only show `uuid` — timeout recovery may restore ETTN without `no` (invoice number).
3. Enum cannot express DRAFT vs FORMALIZED separately without migration — `uuid` is the discriminator.

## Phase 8 — Document retrieve + status sync

Docs: [e-Belge görüntüleme](https://developer.kolaybi.com/docs/invoices/e-document-view/) (`GET /kolaybi/v1/invoices/e-document/view`), [Fatura detay](https://developer.kolaybi.com/docs/invoices/detail/), [Fatura listeleme](https://developer.kolaybi.com/docs/invoices/list/).

| Admin endpoint | Provider | Notes |
|----------------|----------|--------|
| `GET …/invoices/:id/pdf` | `e-document/view?uuid=&output_type=pdf` | JSON `data.src` base64 → streamed `application/pdf` |
| `GET …/invoices/:id/xml` | `e-document/view?uuid=&output_type=xml` | Same endpoint; `application/xml` |
| `POST …/invoices/:id/sync` | detail + list | Updates local `uuid` / `invoiceNumber` only |

Capability flags on list/detail: `canDownloadPdf`, `canDownloadXml`, `canSync`.

**Not implemented (not in public docs sitemap):** dedicated webhook API, dedicated status-only endpoint, R2 auto-persist (schema already has `pdfUrl`/`xmlUrl` for later).

Provider e-document / commercial status from list is returned **ephemerally** on sync response — not persisted (no migration for provider status column).

### Error handling

`KolayBiApiError` normalizes upstream failures:

| HTTP / case | Code | Retryable |
|-------------|------|-----------|
| timeout / abort | `KOLAYBI_TIMEOUT` | yes |
| not configured | `KOLAYBI_NOT_CONFIGURED` | no |
| 400 | `KOLAYBI_VALIDATION_ERROR` | no |
| 401 | `KOLAYBI_UNAUTHORIZED` | no |
| 403 | `KOLAYBI_FORBIDDEN` | no |
| 404 | `KOLAYBI_NOT_FOUND` | no |
| 409 | `KOLAYBI_CONFLICT` | no (resolved via list when possible) |
| 429 | `KOLAYBI_RATE_LIMITED` | yes |
| 5xx | `KOLAYBI_UPSTREAM_ERROR` | yes |

Default request timeout: **15s**.

## Logging

Safe metadata: provider, operation, userId, addressId, productId, sku, saleId, invoiceId, externalId, duration, HTTP status/path.

Never log: API key, channel, access token, Authorization, full TCKN/VKN.

## Secret management

- Store credentials only in API server env / secret manager.
- `.env.example` lists empty keys only.
- Do not commit real keys.

## Sandbox usage

1. Set `KOLAYBI_API_BASE_URL` to the sandbox host from KolayBi docs.
2. Set `KOLAYBI_API_KEY` and `KOLAYBI_CHANNEL`.
3. Keep `KOLAYBI_SANDBOX=true`.
4. Health → customer/address/product sync → completed Sale with customer → `POST /admin/invoices/from-sale/:saleId` → `POST /admin/invoices/:invoiceId/formalize`.
5. Call from-sale and formalize twice; second calls must be idempotent (same draft / same uuid).
6. Confirm `invoices.uuid` + `invoiceNumber` (`no`); do not use production credentials.

## Related schema (Phase 1)

- `Invoice`, `ExternalEntityLink`, enums — already migrated.
- Phase 2–6 do **not** add migrations.
## Phase 9 — Production hardening

### Production checklist

- [ ] `KOLAYBI_API_BASE_URL` (sandbox or live host from KolayBi docs)
- [ ] `KOLAYBI_API_KEY` (secret manager / API env only — never admin/web/mobile)
- [ ] `KOLAYBI_CHANNEL`
- [ ] `KOLAYBI_SANDBOX=false` only for live
- [ ] credentials in secret manager / server env
- [ ] HTTPS on API + Admin
- [ ] JWT access tokens
- [ ] `invoice.read` / `invoice.create` / `invoice.update` seeded
- [ ] logs sanitized (no API key / token / Authorization)
- [ ] DB backup + restore drill
- [ ] invoice foundation migration applied
- [ ] monitoring / alerting on invoice FAILED rate + provider health
- [ ] PDF/XML proxy verified with formalized sandbox invoice
- [ ] retry policy understood (create ≠ formalize ≠ download)
- [ ] idempotency verified (from-sale + formalize double-call)
- [ ] timeout recovery (`FORMALIZE_UNKNOWN` + sync/detail)
- [ ] R2 decision documented (default: fetch-through KolayBi)
- [ ] sandbox E2E completed before go-live
- [ ] rollback plan (clear/disable `KOLAYBI_*` → provider off)

### R2 recommendation (not implemented)

| Option | Pros | Cons |
|--------|------|------|
| A — Always fetch from KolayBi | Simple; always fresh; no extra storage ACL | Latency; KolayBi dependency on every view; rate limits |
| B — KolayBi → private R2 → Admin proxy | Faster repeat views; offline if KolayBi blip | Storage cost; ACL must stay **private** (do not use public CDN); invalidate on cancel |

**Recommendation:** stay on A until PDF traffic or SLA requires caching; if B, use private bucket + short-lived signed URLs or same JWT proxy — never public product CDN URLs.

### Sandbox E2E

Requires non-empty `KOLAYBI_*` on the API process. When empty, provider is disabled (`health.code=NOT_CONFIGURED`).

Phase 2–9 hardening do **not** add migrations beyond Phase 1 foundation.
