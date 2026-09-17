# Security Checklist — FurkanSoğutma

Use this before every production release. Mark items after verification.

## Transport & secrets

- [ ] HTTPS only (HTTP → HTTPS redirect)
- [ ] Secrets via environment / secret manager (never in git)
- [ ] `.env` / `.env.local` / `.env.production` gitignored
- [ ] `.env.example` committed without real values
- [ ] Production startup fails if JWT / DATABASE / REDIS / CORS missing

## Auth

- [ ] Access JWT short TTL (default 15m)
- [ ] Refresh JWT longer TTL; stored hashed only
- [ ] Refresh rotation + revocation on logout
- [ ] Refresh reuse detection revokes all user sessions
- [ ] Passwords hashed with Argon2
- [ ] No password / token in logs or API responses

## Authorization

- [ ] Admin endpoints require JWT + RBAC permissions
- [ ] IDOR: users cannot access other users' orders/cart/address/payment/transfer/account/notifications
- [ ] Financial mutations require `accounting.create` (not PRODUCT_MANAGER)

## API hardening

- [ ] Rate limiting (Redis-backed with local fallback)
- [ ] Stricter limits on login / register / forgot-password / bank-transfer
- [ ] ValidationPipe whitelist + forbidNonWhitelisted
- [ ] CORS explicit allowlist (no `*`)
- [ ] Production errors hide stack traces; include `requestId`
- [ ] Structured JSON request logs (no secrets)

## Web / Admin

- [ ] Security headers (CSP, X-Frame-Options, nosniff, Referrer-Policy)
- [ ] HttpOnly + Secure + SameSite cookies on web auth
- [ ] No unsafe `dangerouslySetInnerHTML` for user HTML
- [ ] CSV exports neutralize formula injection (`=+-@`)

## Files & R2

- [ ] Presigned uploads only; credentials never on frontend
- [ ] MIME allowlist (JPEG/PNG/WEBP); controlled object keys
- [ ] Import size / row limits enforced
- [x] **XLSX mitigation (SheetJS `xlsx` has no patched release on npm):**
  - Prefer CSV imports in production when possible
  - Enforce `MAX_IMPORT_ROWS` (default 5000)
  - Enforce filename extension allowlist (`.csv` / `.xlsx` / `.xls` only; reject `.xlsm` / `.xlsb` / `.svg`)
  - Enforce MIME allowlist (`text/csv`, Excel spreadsheet types)
  - Reject non-PK XLSX buffers (magic bytes)
  - Multer size limits (10–15MB) on import endpoints
  - Admin-only import endpoints + RBAC
  - Do not parse untrusted XLSX outside ImportsService
  - Track replacement (`exceljs` / CSV-only) as follow-up — not applied here to avoid breaking catalog import
- [x] Presigned R2 uploads: JPEG/PNG/WEBP MIME + extension allowlist, size cap (`R2_MAX_UPLOAD_BYTES` / `contentLength`), no SVG
- [x] **Sharp (web/admin):** pinned `optionalDependencies.sharp@0.35.4` so Next Image Optimization does not stay on vulnerable `0.34.5`. PostCSS remains nested under Next 15.5.25 — do not jump to Next 16 without a dedicated upgrade.

## Data & ops

- [ ] Audit log for sensitive admin/financial actions
- [ ] Ledger immutable (adjustment/reversal only)
- [ ] Payment status only changeable by backend services
- [ ] Daily encrypted DB backup + restore test
- [ ] `/health/live` and `/health/ready` (DB + Redis)
- [ ] Docker non-root production image
- [ ] CI: lint / test / build (api, web, admin, android)

## Android

- [ ] Encrypted token storage
- [ ] Cleartext HTTP disabled except emulator localhost
- [ ] Release network logging off; no token/password logs
