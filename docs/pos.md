# FurkanSoğutma — Windows POS

Market satış (Windows desktop). Backend source of truth: Nest API + Prisma + inventory + pricing + accounting.

> **Durum:** Phase 1–6 tamamlandı.  
> Phase 7’ye geçilmedi.

## Fazlar

| Faz | İçerik | Durum |
|-----|--------|--------|
| 1 | Prisma Pos* + transactional sale + inventory | ✅ |
| 2 | AccountTransaction cari entegrasyonu | ✅ |
| 3 | Tauri + React POS UI | ✅ (`pos/`) |
| 4 | Admin POS menüsü (kasalar + satışlar) | ✅ (`admin/`) |
| 5 | Raporlama + iade + X raporu | ✅ |
| 5.1 | `pos.refund` RBAC seed / catalog | ✅ |
| 6 | Windows NSIS release + browser POS | ✅ |

## Production URLs

| Yüzey | URL |
|-------|-----|
| Browser POS (Admin) | https://admin.furkansogutma.net/pos |
| Windows installer | GitHub Release (`pos-v*` tags) / artifact `furkansogutma-pos-windows` |
| API | https://api.furkansogutma.net/api/v1 |

Dokümantasyon:

- [pos-desktop.md](./pos-desktop.md) — Tauri / Windows + Admin `/pos` paylaşımı
- [pos-windows-smoke-test.md](./pos-windows-smoke-test.md) — QA checklist

## Desktop + Web (Phase 3 + 6)

Uygulama kökü: [`pos/`](../pos/) — tek React POS UI (Tauri + Admin `/pos`).

```bash
npm run pos:dev
npm run pos:tauri:dev
npm run admin:dev   # → http://localhost:3001/pos
```

Kısayollar: F2 ürün · F4 müşteri · F6 iskonto · F8/F12 ödeme · **F9 iade** · Esc kapat

### Windows release (Phase 6)

- Workflow: `.github/workflows/pos-windows-release.yml`
- Tag: `pos-v1.0.0`
- Target: `x86_64-pc-windows-msvc`, NSIS (+ MSI)
- Installer **unsigned**
- Auto-update: yok

### Browser POS (Admin altında)

- URL: `/pos` (fullscreen layout, admin sidebar yok)
- Rapor / kasa / satış listesi: `/pos/registers`, `/pos/sales`, `/pos/reports` (normal admin layout)
- Deploy: mevcut Admin container / `deploy-production.yml`
- Ayrı `pos.furkansogutma.net` **yok**

## Admin POS

| Menü | Route | Permission |
|------|-------|------------|
| POS · Satış | `/pos` | `pos.sell` (fullscreen) |
| POS · Kasalar | `/pos/registers` | `pos.read` (yazma: `pos.register`) |
| POS · Satışlar | `/pos/sales` | `pos.read` |
| Satış detay + iade | `/pos/sales/:id` | `pos.read` / iade: `pos.refund` |
| POS · Raporlar | `/pos/reports` | `pos.read` |

### Raporlar (Phase 5)

- Özet: brüt ciro, iade, net satış, ürün/sepet, ödeme / kasa / kasiyer breakdown
- Tarih: Bugün / Dün / 7 gün / Bu ay / Özel (`from` inclusive, `to` exclusive)
- Filtre: register, cashier
- X raporu: bugünün anlık özeti — **state değiştirmez**
- CSV: `GET /admin/pos/reports/export.csv`

### İade (Phase 5)

- Partial / full return
- `PosReturn` + `PosReturnItem` + `PosReturnPayment`
- Inventory: `commitReturnInTransaction` · `referenceType=POS_SALE` · `referenceId=PosReturnItem.id`
- Accounting (müşterili):
  - `REVERSAL:POS_RETURN:{returnId}` → PAYMENT (CREDIT, satış borcunu azaltır)
  - `REFUND:POS:{returnPaymentId}` → REFUND (DEBIT, nakit/kart ödemesini geri alır)
  - ON_ACCOUNT iadesinde yalnızca REVERSAL
- Idempotency-Key + `SELECT … FOR UPDATE` on `pos_sales`
- Sale status → `REFUNDED` yalnızca tüm kalemler iade edildiyse

### Z raporu

**Bu fazda uygulanmadı.** Gerçek Z = immutable kasa kapanışı; `PosRegister.openedAt/closedAt` soft alanları var ama closing ledger/session modeli yok. Phase 7+ için tasarlanacak; sahte Z tablosu oluşturulmadı.

## Roller / yetkiler

| Rol / izin | Davranış |
|------------|----------|
| `SUPER_ADMIN` | Bypass (tam katalog) |
| `pos.register` | Kasa CRUD |
| `pos.read` | Liste / detay / rapor |
| `pos.sell` | Satış |
| `pos.discount` | İskonto |
| `pos.refund` | İade |
| `POS_CASHIER` | `pos.read/sell/discount/refund` (+ product/stock/customer/pricing.read). `pos.register` yok → admin’de yalnızca kendi satışları |

**Seed / sync:** `pos.refund` permission catalog’da (`ADMIN_PERMISSION_CODES`). `POS_CASHIER` ataması hem `AdminService.ensureRbacCatalog()` hem `prisma/seed.ts` üzerinden upsert edilir. Mevcut kasiyerlerin yeni izni alması için seed veya `ensureRbacCatalog` yeniden çalıştırılmalı (yeni migration gerekmez).

## API

### Public POS

| Method | Path | Permission |
|--------|------|------------|
| GET | `/api/v1/pos/registers` | `pos.read` |
| GET | `/api/v1/pos/products/lookup?q=` | `pos.sell` |
| GET | `/api/v1/pos/sales/:id` | `pos.read` |
| GET | `/api/v1/pos/sales/by-number/:saleNumber` | `pos.read` |
| POST | `/api/v1/pos/sales` | `pos.sell` |
| POST | `/api/v1/pos/sales/:id/returns` | `pos.refund` |

### Admin POS

| Method | Path | Permission |
|--------|------|------------|
| GET/POST/PATCH | `/api/v1/admin/pos/registers` | `pos.read` / `pos.register` |
| GET | `/api/v1/admin/pos/cashiers` | `pos.read` |
| GET | `/api/v1/admin/pos/sales` | `pos.read` |
| GET | `/api/v1/admin/pos/sales/:id` | `pos.read` |
| POST | `/api/v1/admin/pos/sales/:id/returns` | `pos.refund` |
| GET | `/api/v1/admin/pos/reports/summary` | `pos.read` |
| GET | `/api/v1/admin/pos/reports/x` | `pos.read` |
| GET | `/api/v1/admin/pos/reports/export.csv` | `pos.read` |

## Migration

```bash
cd api && npx prisma migrate deploy
```

- Phase 1: `20260923120000_windows_pos_foundation`
- Phase 5: `20260923140000_pos_returns`
