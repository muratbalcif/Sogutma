#!/usr/bin/env bash
# Encrypted-at-rest Postgres dump for FurkanSoğutma.
# Requires: pg_dump, openssl, env DATABASE_URL, optional BACKUP_PASSPHRASE / BACKUP_DIR / BACKUP_RETENTION_DAYS
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
BACKUP_DIR="${BACKUP_DIR:-$ROOT_DIR/backups}"
RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-14}"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
OUT_FILE="$BACKUP_DIR/furkansogutma_${STAMP}.sql.gz.enc"

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "ERROR: DATABASE_URL is required" >&2
  exit 1
fi

if [[ -z "${BACKUP_PASSPHRASE:-}" ]]; then
  echo "ERROR: BACKUP_PASSPHRASE is required (do not use application DB password)" >&2
  exit 1
fi

mkdir -p "$BACKUP_DIR"

echo "Creating encrypted backup → $OUT_FILE"
pg_dump --no-owner --format=plain "$DATABASE_URL" \
  | gzip -9 \
  | openssl enc -aes-256-cbc -salt -pbkdf2 -pass env:BACKUP_PASSPHRASE \
  > "$OUT_FILE"

if [[ ! -s "$OUT_FILE" ]]; then
  echo "ERROR: backup file missing or empty" >&2
  rm -f "$OUT_FILE"
  exit 1
fi

chmod 600 "$OUT_FILE" || true

SIZE="$(wc -c < "$OUT_FILE" | tr -d ' ')"
echo "OK: backup size=${SIZE} bytes"

# Retention cleanup
find "$BACKUP_DIR" -name 'furkansogutma_*.sql.gz.enc' -type f -mtime "+${RETENTION_DAYS}" -print -delete || true
echo "Retention: deleted backups older than ${RETENTION_DAYS} days (if any)"
exit 0
