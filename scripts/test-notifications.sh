#!/usr/bin/env bash
# FurkanSoğutma notification / email smoke — production Docker aware.
#
# Run on the VPS (preferred):
#   cd /opt/furkansogutma && ./scripts/test-notifications.sh
#
# Optional real Resend (uses API container env — do NOT export RESEND_API_KEY on host):
#   RESEND_SMOKE=1 RESEND_TO=you@example.com ./scripts/test-notifications.sh
#
# Does not mutate production DB for unit/template checks.
# Never prints API keys, Authorization headers, or email HTML bodies.
set -euo pipefail

PASS=0
FAIL=0

ok() { printf 'PASS: %s\n' "$*"; PASS=$((PASS + 1)); }
bad() { printf 'FAIL: %s\n' "$*"; FAIL=$((FAIL + 1)); }

die() {
  printf 'ERROR: %s\n' "$*" >&2
  exit 1
}

resolve_root() {
  local script_root preferred
  script_root="$(cd "$(dirname "$0")/.." && pwd)"
  preferred="/opt/furkansogutma"

  if [[ -f "${preferred}/docker-compose.production.yml" && -f "${preferred}/.env.production" ]]; then
    printf '%s\n' "${preferred}"
    return 0
  fi
  if [[ -f "${script_root}/docker-compose.production.yml" ]]; then
    printf '%s\n' "${script_root}"
    return 0
  fi
  die "Production project root not found. Expected ${preferred} (or script parent) with docker-compose.production.yml"
}

ROOT="$(resolve_root)"
COMPOSE_FILE="${ROOT}/docker-compose.production.yml"
ENV_FILE="${ROOT}/.env.production"
COMPOSE=(docker compose --env-file "${ENV_FILE}" -f "${COMPOSE_FILE}")
API_SERVICE="${API_SERVICE:-api}"
SMOKE_BUILD_IMAGE="${SMOKE_BUILD_IMAGE:-furkansogutma-api:test}"
# Public health (host must not use :3000 — that is in-container only).
PUBLIC_HEALTH_URL="${PUBLIC_HEALTH_URL:-https://api.furkansogutma.net/api/v1/health}"

cd "${ROOT}" || die "Cannot cd to ${ROOT}"

[[ -f "${ENV_FILE}" ]] || die "${ENV_FILE} missing (create on VPS only; never commit)"
[[ -f "${COMPOSE_FILE}" ]] || die "${COMPOSE_FILE} missing"
command -v docker >/dev/null || die "docker is required"
docker compose version >/dev/null 2>&1 || die "docker compose plugin is required"

api_running() {
  local id
  id="$("${COMPOSE[@]}" ps -q "${API_SERVICE}" 2>/dev/null || true)"
  [[ -n "${id}" ]]
}

compose_exec_api() {
  "${COMPOSE[@]}" exec -T "${API_SERVICE}" "$@"
}

echo "== Notification smoke (root=${ROOT}) =="

# ---------------------------------------------------------------------------
# 1) API health — inside the production api container (127.0.0.1:3000 there).
#    Host loopback for this stack is 127.0.0.1:3100; do not probe :3000 on host.
# ---------------------------------------------------------------------------
echo "-- API health --"
if api_running \
  && ( compose_exec_api wget -qO- "http://127.0.0.1:3000/api/v1/health/live" >/dev/null 2>&1 \
    || compose_exec_api wget -qO- "http://127.0.0.1:3000/api/v1/health" >/dev/null 2>&1 ); then
  ok "API health"
elif curl -fsS --max-time 15 "${PUBLIC_HEALTH_URL}" >/dev/null 2>&1 \
  || curl -fsS --max-time 15 "${PUBLIC_HEALTH_URL%/health}/health/live" >/dev/null 2>&1 \
  || curl -fsS --max-time 15 "http://127.0.0.1:3100/api/v1/health/live" >/dev/null 2>&1; then
  ok "API health"
else
  bad "API health"
fi

# ---------------------------------------------------------------------------
# 2) Jest unit tests — production image is --omit=dev (no jest).
#    Run a one-off container from Dockerfile `build` stage (has jest + sources).
#    NODE_ENV=test; mocked unit tests; no production DB writes.
# ---------------------------------------------------------------------------
echo "-- Jest notification tests --"
JEST_ARGS=(
  --testPathPatterns='email-outbox.service.spec|email-templates.spec|notifications.service.spec'
  --forceExit
  --runInBand
  --silent
)

need_build=1
if [[ "${SMOKE_REBUILD:-}" != "1" ]] && docker image inspect "${SMOKE_BUILD_IMAGE}" >/dev/null 2>&1; then
  need_build=0
fi

if [[ "${need_build}" -eq 1 ]]; then
  echo "Building smoke image ${SMOKE_BUILD_IMAGE} (Dockerfile target=build)…"
  if ! docker build -f "${ROOT}/api/Dockerfile" --target build -t "${SMOKE_BUILD_IMAGE}" "${ROOT}" >/tmp/furkansogutma-smoke-build.log 2>&1; then
    bad "Jest notification tests (smoke image build failed — see /tmp/furkansogutma-smoke-build.log)"
    need_build=-1
  fi
fi

if [[ "${need_build}" -ge 0 ]]; then
  if docker run --rm \
    -e NODE_ENV=test \
    -e CI=1 \
    -w /app/api \
    "${SMOKE_BUILD_IMAGE}" \
    npm test -- "${JEST_ARGS[@]}"; then
    ok "Jest notification tests"
  else
    bad "Jest notification tests"
  fi
fi

# ---------------------------------------------------------------------------
# 3) Template XSS — compiled templates in api runtime (compose exec, or image)
# ---------------------------------------------------------------------------
echo "-- Template XSS --"
xss_ok=0
if api_running; then
  if compose_exec_api node <<'NODE'
const { buildTransactionalEmail } = require('./dist/modules/payments/email-templates');
const built = buildTransactionalEmail('ORDER_CREATED', {
  customerName: '<script>alert(1)</script>',
  orderNumber: 'FS-SMOKE-1',
  siteName: 'FurkanSoğutma',
  supportEmail: 'info@example.com',
  siteUrl: 'https://example.com',
});
if (built.html.includes('<script>alert(1)</script>')) process.exit(1);
if (!built.html.includes('&lt;script&gt;')) process.exit(1);
if (!built.text.includes('FS-SMOKE-1')) process.exit(1);
process.exit(0);
NODE
  then
    xss_ok=1
  fi
fi

if [[ "${xss_ok}" -eq 0 ]] && docker image inspect furkansogutma-api:latest >/dev/null 2>&1; then
  if docker run --rm --entrypoint "" -w /app/api furkansogutma-api:latest node <<'NODE'
const { buildTransactionalEmail } = require('./dist/modules/payments/email-templates');
const built = buildTransactionalEmail('ORDER_CREATED', {
  customerName: '<script>alert(1)</script>',
  orderNumber: 'FS-SMOKE-1',
  siteName: 'FurkanSoğutma',
  supportEmail: 'info@example.com',
  siteUrl: 'https://example.com',
});
if (built.html.includes('<script>alert(1)</script>')) process.exit(1);
if (!built.html.includes('&lt;script&gt;')) process.exit(1);
if (!built.text.includes('FS-SMOKE-1')) process.exit(1);
process.exit(0);
NODE
  then
    xss_ok=1
  fi
fi

if [[ "${xss_ok}" -eq 1 ]]; then
  ok "template XSS"
else
  bad "template XSS"
fi

# ---------------------------------------------------------------------------
# 4) Optional real Resend — API container env only (RESEND_API_KEY never on host)
# ---------------------------------------------------------------------------
if [[ "${RESEND_SMOKE:-}" == "1" ]]; then
  echo "-- Resend smoke --"
  if [[ -z "${RESEND_TO:-}" ]]; then
    bad "Resend smoke (RESEND_TO is required)"
  elif ! api_running; then
    bad "Resend smoke (api container not running)"
  else
    # Pass only RESEND_TO into the container; keys already come from compose env_file.
    if "${COMPOSE[@]}" exec -T \
      -e "RESEND_TO=${RESEND_TO}" \
      "${API_SERVICE}" node <<'NODE'
require('reflect-metadata');
const { EmailOutboxService } = require('./dist/modules/payments/email-outbox.service');

const to = (process.env.RESEND_TO || '').trim();
if (!to) {
  console.error('RESEND_TO missing');
  process.exit(1);
}

if (String(process.env.EMAIL_DEV_MOCK || '').toLowerCase() === 'true') {
  console.error('EMAIL_DEV_MOCK is true — refusing real Resend smoke in this environment');
  process.exit(1);
}

const config = {
  get(key) {
    if (key === 'EMAIL_DEV_MOCK') {
      return String(process.env.EMAIL_DEV_MOCK || '').toLowerCase() === 'true';
    }
    if (key === 'EMAIL_OUTBOX_MAX_ATTEMPTS') {
      return Number(process.env.EMAIL_OUTBOX_MAX_ATTEMPTS || 5);
    }
    return process.env[key];
  },
};

const prisma = {}; // sendEmail does not touch the database
const email = new EmailOutboxService(prisma, config);

if (!email.isProviderConfigured()) {
  console.error('Resend is not configured inside the api container');
  process.exit(1);
}

email
  .sendEmail({
    to,
    subject: 'FurkanSoğutma notification smoke',
    html: '<p>Smoke OK</p>',
    text: 'Smoke OK',
  })
  .then((result) => {
    if (!result || !result.ok) {
      // Do not print provider error bodies (may echo request metadata).
      console.error('sendEmail failed');
      process.exit(1);
    }
    process.exit(0);
  })
  .catch(() => {
    console.error('sendEmail threw');
    process.exit(1);
  });
NODE
    then
      ok "Resend smoke"
    else
      bad "Resend smoke"
    fi
  fi
else
  ok "Resend smoke skipped (set RESEND_SMOKE=1 RESEND_TO=… to run)"
fi

echo ""
echo "Result: ${PASS} passed, ${FAIL} failed"
if [[ "${FAIL}" -gt 0 ]]; then
  exit 1
fi
exit 0
