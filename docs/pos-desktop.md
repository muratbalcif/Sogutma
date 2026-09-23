# FurkanSoğutma POS — Windows Desktop

Tauri 2 + React + TypeScript market satış istemcisi.

**Production web POS (Admin altında):** https://admin.furkansogutma.net/pos  
Ayrı `pos.*` domain yok. Aynı `pos/` React iş mantığı; Admin JWT ile çalışır.

## Gereksinimler

- Node.js ≥ 22
- Rust (Tauri): https://www.rust-lang.org/tools/install
- Çalışan API: `VITE_API_BASE_URL`
  - Dev: `http://localhost:3000/api/v1` (`.env.development` / `.env.example`)
  - Prod installer: `https://api.furkansogutma.net/api/v1` (CI build-time env; **do not commit** `.env.production`)
- POS yetkisi: `SUPER_ADMIN`, `POS_CASHIER` veya `pos.sell`
- Aktif kasa: migration ile `KASA1` gelir

## Versioning

Source of truth: `pos/package.json` (`version`).

Must match:

- `pos/src-tauri/tauri.conf.json` → `version`
- `pos/src-tauri/Cargo.toml` → `version`

Git tags for Windows releases: `pos-v1.0.0` (prefix `pos-v` + semver).

## Shared UI (Admin + Tauri)

`furkansogutma-pos` workspace paketi Admin tarafından `transpilePackages` ile gömülür.

- HTTP: `configurePosHttp()` — Tauri kendi `apiRequest`, Admin kendi `apiRequest`
- Auth: Tauri kendi login; Admin mevcut JWT/session (`RequireAuth`)
- Ortak: `PosPage`, `RegisterSelectPage`, store, components, money utils

## Geliştirme

```bash
cd pos
cp .env.example .env.development   # gerekirse
npm install
npm run dev          # yalnızca Vite UI (http://localhost:1420)
npm run tauri:dev    # native pencere + Vite
```

Admin web POS:

```bash
npm run admin:dev
# → http://localhost:3001/pos
```

## Windows production build (CI)

Workflow: `.github/workflows/pos-windows-release.yml`

| | |
|--|--|
| Trigger | `workflow_dispatch` veya tag `pos-v*` |
| Runner | `windows-latest` |
| Target | `x86_64-pc-windows-msvc` |
| Installer | **NSIS** (+ MSI) |
| Artifact | `furkansogutma-pos-windows` |
| API | `https://api.furkansogutma.net/api/v1` |
| Signing | **Unsigned** — Windows installer currently unsigned |
| Auto-update | Phase 6’da yok |

```bash
git tag pos-v1.0.0
git push origin pos-v1.0.0
```

Mac `npm run tauri build` Windows NSIS kanıtı değildir.

### Code signing (future)

Not configured. Later: OV/EV certificate as GitHub secret + timestamp server.

## Barkod okuyucu (USB)

Gerçek USB scanner için ekstra driver/SDK gerekmez (keyboard wedge):

1. USB scanner’ı tak
2. Cihazı **keyboard wedge** modunda bırak
3. Suffix: **Enter** (CR)
4. POS barkod alanına odak (F2)
5. Barkodu okut → Enter → ürün lookup / sepete ekle

Browser (Admin `/pos`) aynı keyboard-wedge davranışını kullanır.

## Klavye

| Tuş | İşlem |
|-----|--------|
| F2 | Barkod / arama |
| F4 | Müşteri |
| F6 | İskonto |
| F8 / F12 | Ödeme / satış |
| F9 | İade |
| ESC | Modal kapat |
| + / − | Seçili satır adet |
| Delete | Seçili satır sil (odak barkodda ve boşsa) |

## Backend

- Auth: `POST /auth/login`, `POST /auth/refresh`, `GET /auth/me`
- POS: `/pos/registers`, `/pos/products/lookup`, `POST /pos/sales` + `Idempotency-Key`
- Müşteri: `GET /admin/customers`, `GET /admin/customers/:id`

Client fiyat/stok/total üretmez; backend source of truth.

## Test

```bash
cd pos
npm test
npm run typecheck
npm run lint
```

Smoke checklist: [pos-windows-smoke-test.md](./pos-windows-smoke-test.md)
