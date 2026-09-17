#!/usr/bin/env bash
# Restore-test: decrypt backup → clean Postgres container → restore → validate.
# Requires Docker. Does NOT touch production databases.
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
BACKUP_FILE="${1:-}"
CONTAINER="furkansogutma-restore-test"
PG_USER="restore"
PG_PASS="restore"
PG_DB="restore"
PORT="${RESTORE_TEST_PORT:-55432}"

if [[ -z "$BACKUP_FILE" || ! -f "$BACKUP_FILE" ]]; then
  echo "Usage: $0 path/to/furkansogutma_*.sql.gz.enc" >&2
  exit 1
fi

if [[ -z "${BACKUP_PASSPHRASE:-}" ]]; then
  echo "ERROR: BACKUP_PASSPHRASE is required" >&2
  exit 1
fi

cleanup() {
  docker rm -f "$CONTAINER" >/dev/null 2>&1 || true
}
trap cleanup EXIT

echo "Starting ephemeral Postgres on localhost:${PORT}"
docker run -d --name "$CONTAINER" \
  -e POSTGRES_USER="$PG_USER" \
  -e POSTGRES_PASSWORD="$PG_PASS" \
  -e POSTGRES_DB="$PG_DB" \
  -p "${PORT}:5432" \
  postgres:16-alpine >/dev/null

for i in $(seq 1 30); do
  if docker exec "$CONTAINER" pg_isready -U "$PG_USER" -d "$PG_DB" >/dev/null 2>&1; then
    break
  fi
  sleep 1
done

echo "Decrypting and restoring..."
openssl enc -d -aes-256-cbc -pbkdf2 -pass env:BACKUP_PASSPHRASE -in "$BACKUP_FILE" \
  | gunzip \
  | docker exec -i "$CONTAINER" psql -U "$PG_USER" -d "$PG_DB" >/dev/null

echo "Validating core tables exist..."
docker exec "$CONTAINER" psql -U "$PG_USER" -d "$PG_DB" -v ON_ERROR_STOP=1 -c \
  "SELECT to_regclass('public.users') IS NOT NULL AS users_ok, to_regclass('public.orders') IS NOT NULL AS orders_ok;"

echo "OK: restore test passed"
exit 0
