#!/usr/bin/env bash
# Production R2 smoke test (FurkanSoğutma).
# Does NOT print secrets, tokens, or .env contents.
#
# Required env (export before running — never hardcode):
#   API_BASE_URL     e.g. https://api.furkansogutma.net/api/v1
#   ADMIN_EMAIL
#   ADMIN_PASSWORD
#
# Optional:
#   R2_PUBLIC_URL    default https://media.furkansogutma.net
#   SMOKE_FOLDER     default smoke-tests
#
# Example:
#   API_BASE_URL=https://api.furkansogutma.net/api/v1 \
#   ADMIN_EMAIL=... ADMIN_PASSWORD=... \
#   bash scripts/test-r2-storage.sh
set -Eeuo pipefail

API_BASE_URL="${API_BASE_URL:?API_BASE_URL is required}"
ADMIN_EMAIL="${ADMIN_EMAIL:?ADMIN_EMAIL is required}"
ADMIN_PASSWORD="${ADMIN_PASSWORD:?ADMIN_PASSWORD is required}"
R2_PUBLIC_URL="${R2_PUBLIC_URL:-https://media.furkansogutma.net}"
SMOKE_FOLDER="${SMOKE_FOLDER:-smoke-tests}"

API_BASE_URL="${API_BASE_URL%/}"
R2_PUBLIC_URL="${R2_PUBLIC_URL%/}"

log() { printf '%s %s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$*"; }
die() { log "ERROR: $*"; exit 1; }

command -v curl >/dev/null || die "curl is required"
command -v python3 >/dev/null || die "python3 is required"

TMP_DIR="$(mktemp -d)"
cleanup() {
  rm -rf "$TMP_DIR"
}
trap cleanup EXIT

log "1) API health"
curl -fsS --max-time 15 "${API_BASE_URL}/health" >/dev/null \
  || die "health check failed"

log "2) Admin login (token not printed)"
LOGIN_JSON="$(curl -fsS --max-time 30 \
  -H 'Content-Type: application/json' \
  -H 'Accept: application/json' \
  -d "{\"email\":\"${ADMIN_EMAIL}\",\"password\":\"${ADMIN_PASSWORD}\"}" \
  "${API_BASE_URL}/auth/login")" || die "login failed"

ACCESS_TOKEN="$(printf '%s' "$LOGIN_JSON" | python3 -c 'import json,sys; print(json.load(sys.stdin).get("accessToken") or "")')"
[[ -n "$ACCESS_TOKEN" ]] || die "login response missing accessToken"

# Minimal 1x1 JPEG
JPEG_FILE="${TMP_DIR}/smoke.jpg"
python3 - <<'PY' "$JPEG_FILE"
import sys
# tiny valid JPEG
data = bytes([
  0xFF,0xD8,0xFF,0xE0,0x00,0x10,0x4A,0x46,0x49,0x46,0x00,0x01,0x01,0x00,0x00,0x01,0x00,0x01,0x00,0x00,
  0xFF,0xDB,0x00,0x43,0x00,0x08,0x06,0x06,0x07,0x06,0x05,0x08,0x07,0x07,0x07,0x09,0x09,0x08,0x0A,0x0C,
  0x14,0x0D,0x0C,0x0B,0x0B,0x0C,0x19,0x12,0x13,0x0F,0x14,0x1D,0x1A,0x1F,0x1E,0x1D,0x1A,0x1C,0x1C,0x20,
  0x24,0x2E,0x27,0x20,0x22,0x2C,0x23,0x1C,0x1C,0x28,0x37,0x29,0x2C,0x30,0x31,0x34,0x34,0x34,0x1F,0x27,
  0x39,0x3D,0x38,0x32,0x3C,0x2E,0x33,0x34,0x32,0xFF,0xC0,0x00,0x0B,0x08,0x00,0x01,0x00,0x01,0x01,0x01,
  0x11,0x00,0xFF,0xC4,0x00,0x14,0x00,0x01,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,
  0x00,0x00,0x00,0x03,0xFF,0xC4,0x00,0x14,0x10,0x01,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,
  0x00,0x00,0x00,0x00,0x00,0x00,0xFF,0xDA,0x00,0x08,0x01,0x01,0x00,0x00,0x3F,0x00,0x37,0xFF,0xD9
])
open(sys.argv[1], 'wb').write(data)
PY
CONTENT_LENGTH="$(wc -c < "$JPEG_FILE" | tr -d ' ')"

log "3) Presign upload"
PRESIGN_JSON="$(curl -fsS --max-time 30 \
  -H "Authorization: Bearer ${ACCESS_TOKEN}" \
  -H 'Content-Type: application/json' \
  -H 'Accept: application/json' \
  -d "{\"filename\":\"smoke.jpg\",\"contentType\":\"image/jpeg\",\"folder\":\"${SMOKE_FOLDER}\",\"contentLength\":${CONTENT_LENGTH}}" \
  "${API_BASE_URL}/admin/uploads/presign")" || die "presign failed"

read -r UPLOAD_URL OBJECT_KEY PUBLIC_URL < <(printf '%s' "$PRESIGN_JSON" | python3 -c '
import json,sys
d=json.load(sys.stdin)
print(d["uploadUrl"], d["objectKey"], d["publicUrl"])
')

[[ -n "$UPLOAD_URL" && -n "$OBJECT_KEY" && -n "$PUBLIC_URL" ]] || die "presign payload incomplete"
case "$PUBLIC_URL" in
  "${R2_PUBLIC_URL}/"*) ;;
  *) die "publicUrl does not start with expected CDN base" ;;
esac

# Do not print uploadUrl (contains signature query params).
log "4) PUT object to R2 (presigned)"
HTTP_PUT="$(curl -sS --max-time 60 -o /dev/null -w '%{http_code}' \
  -X PUT \
  -H 'Content-Type: image/jpeg' \
  --data-binary @"$JPEG_FILE" \
  "$UPLOAD_URL")" || die "R2 PUT request failed"
[[ "$HTTP_PUT" == "200" || "$HTTP_PUT" == "204" ]] || die "R2 PUT status=$HTTP_PUT"

log "5) GET via public CDN"
HTTP_GET="$(curl -sS --max-time 30 -o /dev/null -w '%{http_code}' "$PUBLIC_URL")" \
  || die "CDN GET failed"
[[ "$HTTP_GET" == "200" ]] || die "CDN GET status=$HTTP_GET (url host ok, object may need cache)"

log "6) Cleanup R2 object (optional — uses R2_* env if set; never logged)"
if [[ -n "${R2_ACCOUNT_ID:-}" && -n "${R2_ACCESS_KEY_ID:-}" && -n "${R2_SECRET_ACCESS_KEY:-}" && -n "${R2_BUCKET:-}" ]] \
  && command -v aws >/dev/null; then
  export AWS_ACCESS_KEY_ID="$R2_ACCESS_KEY_ID"
  export AWS_SECRET_ACCESS_KEY="$R2_SECRET_ACCESS_KEY"
  export AWS_DEFAULT_REGION=auto
  aws s3api delete-object \
    --bucket "$R2_BUCKET" \
    --key "$OBJECT_KEY" \
    --endpoint-url "https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com" \
    >/dev/null
  log "R2 object deleted"
  unset AWS_ACCESS_KEY_ID AWS_SECRET_ACCESS_KEY
else
  log "Skip automated delete (set R2_* + aws CLI, or remove prefix ${SMOKE_FOLDER}/ in dashboard)"
fi

log "R2 STORAGE SMOKE: SUCCESS"
log "OBJECT_KEY=${OBJECT_KEY}"
log "PUBLIC_HOST=${R2_PUBLIC_URL}"
