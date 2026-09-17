# Disaster Recovery

## Targets (initial)

| Metric | Target | Notes |
|--------|--------|-------|
| RPO | ≤ 24 hours | Daily encrypted full dump; WAL/PITR is a future enhancement |
| RTO | ≤ 4 hours | Manual restore + config + health checks |
| Backup retention | 14 days (configurable via `BACKUP_RETENTION_DAYS`) | Keep off-host |

## Components

1. **PostgreSQL** — source of truth for commerce/finance.
2. **Redis** — ephemeral (rate limits / cache); rebuildable; do not store secrets.
3. **R2 media** — product/banner images; separate from DB dumps.
4. **App images / env** — container registry + secret manager.

## Backup frequency

- Daily encrypted `pg_dump` via `scripts/backup.sh`.
- Optional weekly offsite copy of backup artifacts.
- R2: enable bucket versioning / lifecycle in Cloudflare dashboard (ops).

## Restore procedure (DB)

1. Take incident note; stop writes if corruption suspected.
2. Provision clean Postgres (private network).
3. Decrypt + restore latest good backup (`scripts/restore-test.sh` pattern).
4. Run `prisma migrate deploy` if schema lag.
5. Point `DATABASE_URL`; start API; hit `/health/ready`.
6. Spot-check users, orders, account_transactions counts.

## R2 recovery

- Restore from R2 versioning or secondary bucket sync.
- DB holds object keys; media restore does not rewrite ledger rows.

## Environment recovery

- Recreate secrets from vault (JWT, R2, FCM, SMTP).
- Redeploy previous known-good container image.
- Confirm CORS origins and HTTPS certificates.

## What not to do

- Do not rely on Prisma `migrate down` for production rollback.
- Do not restore backups into a publicly exposed DB.
- Do not reuse application DB credentials as `BACKUP_PASSPHRASE`.
