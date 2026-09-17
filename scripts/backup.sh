#!/usr/bin/env bash
# Encrypted-at-rest Postgres dump for FurkanSoğutma.
# Requires: pg_dump, gzip, openssl, env DATABASE_URL, BACKUP_PASSPHRASE
# Optional: BACKUP_DIR, BACKUP_RETENTION_DAYS
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
BACKUP_DIR="${BACKUP_DIR:-$ROOT_DIR/backups}"
RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-14}"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
OUT_FILE="$BACKUP_DIR/furkansogutma_${STAMP}.sql.gz.enc"
TMP_FILE=""

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "ERROR: DATABASE_URL is required" >&2
  exit 1
fi

if [[ -z "${BACKUP_PASSPHRASE:-}" ]]; then
  echo "ERROR: BACKUP_PASSPHRASE is required (do not use application DB password)" >&2
  exit 1
fi

for cmd in pg_dump gzip openssl; do
  if ! command -v "$cmd" >/dev/null 2>&1; then
    echo "ERROR: $cmd is required" >&2
    exit 1
  fi
done

mkdir -p "$BACKUP_DIR"
if [[ ! -d "$BACKUP_DIR" || ! -w "$BACKUP_DIR" ]]; then
  echo "ERROR: BACKUP_DIR is not a writable directory: $BACKUP_DIR" >&2
  exit 1
fi

TMP_FILE="$(mktemp "$BACKUP_DIR/.furkansogutma_backup.XXXXXX")"
cleanup_tmp() {
  if [[ -n "${TMP_FILE:-}" && -f "$TMP_FILE" ]]; then
    rm -f "$TMP_FILE"
  fi
}
trap cleanup_tmp EXIT

echo "Creating encrypted backup → $OUT_FILE"
set +e
pg_dump --no-owner --format=plain "$DATABASE_URL" \
  | gzip -9 \
  | openssl enc -aes-256-cbc -salt -pbkdf2 -pass env:BACKUP_PASSPHRASE \
  > "$TMP_FILE"
pipe_status=("${PIPESTATUS[@]}")
set -e

dump_status=${pipe_status[0]:-1}
gzip_status=${pipe_status[1]:-1}
ssl_status=${pipe_status[2]:-1}

if [[ "$dump_status" -ne 0 ]]; then
  echo "ERROR: pg_dump failed" >&2
  exit 1
fi
if [[ "$gzip_status" -ne 0 || "$ssl_status" -ne 0 ]]; then
  echo "ERROR: compression or encryption failed" >&2
  exit 1
fi

if [[ ! -s "$TMP_FILE" ]]; then
  echo "ERROR: backup file missing or empty" >&2
  exit 1
fi

header="$(head -c 8 "$TMP_FILE" | tr -d '\0')"
if [[ "$header" != "Salted__" ]]; then
  echo "ERROR: backup does not appear to be openssl encrypted" >&2
  exit 1
fi

chmod 600 "$TMP_FILE"
mv "$TMP_FILE" "$OUT_FILE"
chmod 600 "$OUT_FILE"
TMP_FILE=""
trap - EXIT

SIZE="$(wc -c < "$OUT_FILE" | tr -d ' ')"
echo "OK: backup size=${SIZE} bytes"

find "$BACKUP_DIR" -name 'furkansogutma_*.sql.gz.enc' -type f -mtime "+${RETENTION_DAYS}" -print -delete || true
echo "Retention: deleted backups older than ${RETENTION_DAYS} days (if any)"
exit 0
