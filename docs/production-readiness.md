# Production Readiness

## Commerce path (must work without mocks)

Customer → Product/Price → Cart → Order → Bank Transfer → Payment Approval → Accounting CREDIT → Inventory → Notification → Admin visibility

## Hardening delivered

- Env validation (stricter in production)
- Redis rate limiting + auth throttles
- Request ID + structured logs + safe error shape
- Refresh token reuse detection
- Health live/ready
- Security headers (web/admin)
- CSV formula injection mitigation
- Encrypted backup + restore-test scripts
- CI workflows
- Ops docs (security, env, DR, deploy, privacy map)

## Before go-live checklist

1. Fill production secrets in vault (not repo)
2. Run `scripts/backup.sh` + `scripts/restore-test.sh` against a staging dump
3. Confirm `/health/ready` green
4. Confirm CORS allowlist = real web+admin origins only
5. Confirm R2 + FCM + email outbox credentials
6. Walk bank-transfer approval on staging with real Decimal totals
7. Complete `docs/security-checklist.md`

## Out of scope / remaining ops

- Managed WAL/PITR (target)
- External APM/alerting provider wiring
- Legal Privacy/Terms copy (placeholder pages only)
- Admin Playwright e2e suite (script not present yet)
