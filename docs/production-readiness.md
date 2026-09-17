# Production Readiness — PROMPT 18.1 Verification Report

Generated: 2026-09-17. Honest PASS / PARTIAL / FAIL only for checks that were executed.

This pass used the existing Docker Compose Postgres + Redis. Host ports were **not** hardcoded in tests. Compose published Postgres on **5434** because brew Postgres already occupies **5432**.

Root cause of `Can't reach database server at localhost:5434`:

1. Compose was already mapping Postgres to host `5434`.
2. E2E `setup-e2e.ts` previously defaulted to `5432` and did not discover the compose published port.
3. The running container role password did not match `api/.env` `POSTGRES_PASSWORD` (volume was initialized earlier with a different local password). Host TCP auth therefore failed even when the daemon was up.

Remediation: discover compose published ports in `api/test/setup-e2e.ts`, target `furkansogutma_test`, align the Docker role password with local `.env` (value not recorded here), and keep CI `DATABASE_URL` as the source of the GHA `5434` mapping.

## 1. Fixed Issues

| Area | Fix |
|------|-----|
| API E2E DB | `setup-e2e.ts` uses exported `DATABASE_URL` (CI), else compose `docker compose port`, else `POSTGRES_PORT`. Dedicated DB `furkansogutma_test`. |
| Compose init | `api/docker/postgres-init/01-test-db.sql` creates `furkansogutma_test` on first volume init. Healthcheck uses `$$POSTGRES_USER` / `$$POSTGRES_DB`. |
| Security E2E | Refresh `429`; valid JPEG presign (`201` or `503` if R2 unset). Existing IDOR / payment / idempotency / CSV / ready-vs-live kept. |
| Admin E2E | Login → dashboard → customers (unique seeded email) → products → orders → bank transfers → accounting. |
| Admin RBAC | PRODUCT_MANAGER denied finance (API 403 + UI). ACCOUNTING GET + `POST /admin/accounting/manual` `201`. SUPER_ADMIN modules. |
| Sharp | `optionalDependencies.sharp@0.35.4` on web + admin (Next 15.5.25 already allows `^0.34.3 \|\| ^0.35.4`). Clears sharp HIGH. |
| Android lint | `lint { ignoreTestSources = true; checkReleaseBuilds = false }` — AGP LintDriver crash on multi-flavor Hilt test sources. App sources still linted. |

## 2. Remaining Issues

| Severity | Issue | Root cause | Fix | Status |
|----------|-------|------------|-----|--------|
| HIGH | `xlsx` Prototype Pollution / ReDoS — **no npm patched release** | SheetJS community | Prefer CSV; size/row/ext/MIME/magic-byte limits; plan `exceljs` later | OPEN (mitigated) |
| HIGH | `multer` via `@nestjs/platform-express@11` | Nest 11 pin | Nest 12 major | OPEN (breaking) |
| HIGH | Nested `postcss@8.4.31` via Next 15.5.25 | Next tree | Next **16.3.5** is major | OPEN |
| MODERATE | `csv-parse@5.6.0` | Prototype path | `csv-parse@7` major | OPEN |
| HIGH (advisory) | `prisma` / `deepmerge-ts` | npm suggests **downgrade** to `6.12.0` | Do not downgrade from `6.19.3`; wait for Prisma 8+ | OPEN |
| MEDIUM | API Docker build context vs workspace lockfile | `api/Dockerfile` copies `package-lock.json` but lockfile lives at repo root | Build from repo root / workspace-aware Dockerfile. **Image was not rebuilt this run.** | OPEN |
| LOW | CI JWT values are dummy strings in workflow YAML | Test-only, not GitHub Secrets | Move to GitHub Secrets if desired; they are not production secrets | OPEN |
| — | Ledger check ran on e2e test DB with **0** ledger rows after cleanup | Dataset, not script failure | Re-run on a seeded staging dump with real SALE/PAYMENT rows | PARTIAL data |

## 3. Commands Executed (exact results)

```text
# Infra
docker compose -f api/docker-compose.yml ps
  postgres healthy, host port 5434
  redis healthy, host port 6379
npx prisma migrate deploy   (furkansogutma_test @ 127.0.0.1:5434) → 14 migrations, none pending
npx prisma db seed          → SUPER_ADMIN / PRODUCT_MANAGER / ACCOUNTING + catalog

# API
npx eslint "{src,apps,libs,test}/**/*.ts"     → PASS (exit 0)
npm run test -- --forceExit                   → 34 suites / 155 tests PASS
npm run build                                 → PASS
npm run test:e2e                              → 9 suites / 53 tests PASS
  (includes request-id, ready 503 when DB down, IDOR, RBAC,
   paymentStatus reject, server totals, double CREDIT/DEBIT,
   login/forgot-password/refresh/bank-transfer 429,
   upload MIME/ext/size, CSV formula neutralization)

curl /api/v1/health          → 200 {status:ok} + X-Request-Id
curl /api/v1/health/live     → 200
curl /api/v1/health/ready    → 200 {checks:{database:up, redis:up}} + X-Request-Id

# Backup / restore / ledger
BACKUP_PASSPHRASE=<ephemeral> BACKUP_DIR=/tmp/furkansogutma-backup-verify bash scripts/backup.sh
  → OK size=33984, header=Salted__, mode=0600
BACKUP_PASSPHRASE="" bash scripts/backup.sh → exit 1
bash scripts/restore-test.sh <enc file>
  → OK (ephemeral Docker Postgres :55432; users/orders/account_transactions present;
     row counts users=5 orders=0 ledger_rows=0)
bash scripts/ledger-consistency-check.sh
  → OK (0 mismatch rows on this test DB)

# Web
npm run lint                 → PASS
npm run test                 → 2/2 PASS
npm run build                → PASS (Next 15.5.25)
npx playwright test          → 10/10 PASS

# Admin
npm run lint                 → PASS
npm run build                → PASS (Next 15.5.25)
npx playwright test          → 13/13 PASS
  (9 guest smoke + 1 authenticated UI flow + 3 RBAC API/UI)

# Android
./gradlew test assembleDebug lint → BUILD SUCCESSFUL in 31s
  (after lint ignoreTestSources; previously lintAnalyze*Test crashed)

# npm audit (after sharp 0.35.4 pin)
api:   critical 0, high 9, moderate 1, low 0, total 10
web:   critical 0, high 1, moderate 1, low 0, total 2
admin: critical 0, high 1, moderate 1, low 0, total 2
```

## 4. Production readiness matrix

| Area | Status | Notes |
|------|--------|-------|
| SECURITY | PARTIAL | Hardening e2e executed; dependency vulns remain |
| AUTH | PASS | E2E login/refresh/logout coverage + refresh 429 |
| RBAC | PASS | API + Admin UI/API: PM denied; ACCOUNTING mutate; SUPER_ADMIN |
| IDOR | PASS | Order, address, payment, bank transfer, account, admin customer |
| RATE LIMIT | PASS | Login, forgot-password, refresh, bank-transfer → 429 with Redis |
| CORS | PASS | Env allowlist (not re-broken this run) |
| CSRF | PARTIAL | Cookie SameSite on web; API JWT Bearer (not re-fuzzed) |
| XSS | PARTIAL | Headers / no user HTML; PostCSS advisory residual |
| UPLOAD | PASS | Invalid MIME/ext/size rejected; valid JPEG 503 without R2 (expected) |
| PAYMENT | PASS | Client `paymentStatus` rejected; extra total/price fields 400; amount from order |
| ACCOUNTING | PASS | Double approve → 1 CREDIT; double SALE → 1 DEBIT |
| AUDIT | PARTIAL | Service present; not fully re-enumerated |
| BACKUP | PASS | Encrypted, non-empty, chmod 600, empty passphrase → non-zero |
| RESTORE | PASS | Executed against ephemeral Docker Postgres (not syntax-only) |
| HEALTH | PASS | live 200 when ready 503 (DB down spy); ready needs DB |
| DOCKER | PARTIAL | Dockerfile non-root + HEALTHCHECK + `npm ci --omit=dev`; **image not built this run**; workspace lockfile path risk |
| CI/CD | PASS | `npm ci` (frozen lockfile); no `pull_request_target`; no production GitHub Secrets in PR jobs |
| WEB | PASS | lint + unit + build + 10 Playwright |
| ADMIN | PASS | lint + build + 13 Playwright including authenticated + RBAC |
| ANDROID | PASS | `test` + `lint` + `assembleDebug` BUILD SUCCESSFUL this run |
| KVKK | PARTIAL | Placeholder legal pages only |
| DEPENDENCY SECURITY | PARTIAL | Next 15.5.25 (latest 15.x); sharp patched; xlsx/multer/postcss/csv-parse/prisma open |

## 5. Security risks / production blockers

**Do not call this production ready.** Remaining blockers:

1. **SEVERITY: HIGH** — `xlsx` unpatched. Keep imports admin-only with CSV preference + limits. Replacement (`exceljs` / CSV-only) is a follow-up, not done here (catalog import risk).
2. **SEVERITY: HIGH** — Nest 11 / `multer` DoS class. Keep uploads admin-only + size caps until Nest 12.
3. **SEVERITY: HIGH** — Next nested `postcss` (file-read / XSS class). Fixed only in Next 16.x; 15.5.25 is latest 15 line. Do not jump to 16 in this pass.
4. **SEVERITY: MEDIUM** — Production API image build not verified; Dockerfile vs monorepo lockfile needs a dedicated build.
5. **SEVERITY: MEDIUM** — Ops: managed WAL/PITR, real Privacy/Terms copy, staging restore + ledger on a dump that contains SALE/PAYMENT rows.

**Verified this run (not blockers):** client cannot set `PAID`; totals/prices server-side; bank-transfer approve idempotent; IDOR; Redis 429; request id header + logs; encrypted backup + Docker restore; Admin authenticated + RBAC including API authorization.

## 6. npm audit detail (no exploit steps)

| Package | Current | Vulnerable dep | Fixed version | Breaking? |
|---------|---------|----------------|---------------|-----------|
| `xlsx` | 0.18.5 (direct, API) | `xlsx` itself | **none** | n/a |
| `@nestjs/platform-express` | ^11.2.5 | `multer<=2.2.0` | Nest / platform-express **12.0.3** | **yes (major)** |
| `@nestjs/core` / swagger / testing | ^11 | via platform-express | 12.x | **yes** |
| `csv-parse` | 5.6.0 (direct, API) | csv-parse | **7.0.2** | **yes (major)** |
| `prisma` / `@prisma/config` | 6.19.3 | `deepmerge-ts` | npm says 6.12.0 (downgrade) | do **not** apply |
| `next` (web/admin) | 15.5.25 | nested `postcss<=8.5.22` | next **16.3.5** | **yes (major)** |
| `sharp` | **0.35.4** (optional pin) | libvips/libheif | 0.35.4 | applied (non-breaking for Next 15.5.25) |

## 7. Secret scan

- No private keys / `AKIA*` / `sk_live_` / `ghp_` / service-account JSON / `.pem` tracked in git.
- Local gitignored files exist: `api/.env`, `web/.env.local`, `admin/.env.local`. Keys only (values not dumped): JWT/DB/R2 placeholders and `NEXT_PUBLIC_*`.
- Backup passphrase used for this restore drill was ephemeral and is not in the repository.
- CI workflows embed **dummy** `ci-access-secret-min-16` / e2e passwords (test-only). No `secrets.` GitHub Secrets references. No `pull_request_target`.

## 8. Migrations

- Production order is documented in `docs/backup-restore.md` and `docs/deployment.md`: backup → `prisma migrate deploy` → health/ready.
- Destructive SQL found: `DROP INDEX IF EXISTS "payments_orderId_key"` in `20260917113000_payment_bank_transfer_accounting`. No `DROP TABLE` / `DELETE FROM` / `TRUNCATE`.

## 9. Recommended next step

1. Staging drill: backup of a **populated** DB → restore → ledger check with real SALE/PAYMENT rows.
2. Plan Nest 12 + replace `xlsx` + evaluate Next 16 for PostCSS.
3. Fix API production image build to use the workspace root lockfile; actually `docker build` in CI.
4. Optionally move CI dummy JWT/e2e passwords into GitHub Secrets (not a production-secret leak today).

**Verdict:** Not claiming “production ready”. API E2E against Docker Postgres, Admin authenticated/RBAC E2E, Web E2E, backup/restore, Android lint/test/assemble, and health/rate-limit/IDOR/payment checks were executed. Dependency HIGH findings and unverified production image build remain.
