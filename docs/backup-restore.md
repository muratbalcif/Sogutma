# Backup & Restore

## Scripts

| Script | Purpose |
|--------|---------|
| `scripts/backup.sh` | `pg_dump` → gzip → AES-256-CBC (`BACKUP_PASSPHRASE`) |
| `scripts/restore-test.sh` | Decrypt into ephemeral Docker Postgres and validate tables |
| `scripts/ledger-consistency-check.sh` | Report ledger balances (no auto-fix) |

## Backup

```bash
export DATABASE_URL='postgresql://...'
export BACKUP_PASSPHRASE='...'   # separate from app DB password
export BACKUP_DIR=./backups
export BACKUP_RETENTION_DAYS=14
./scripts/backup.sh
```

Exit code must be 0; output file must be non-empty, `chmod 600`, and start with OpenSSL `Salted__`. `pg_dump` / encryption failures exit non-zero and do not leave a partial artifact.

## Restore test

```bash
export BACKUP_PASSPHRASE='...'
./scripts/restore-test.sh ./backups/furkansogutma_YYYYMMDDT....sql.gz.enc
```

Requires Docker. Uses disposable container `furkansogutma-restore-test`.

## Production order

1. Backup
2. `prisma migrate deploy`
3. Application deploy
4. `/health/ready`

If migration fails → **abort deploy**; restore from backup if needed.

## Encryption

Backups contain PII + financial history. Store only in private encrypted storage. Never public buckets.
