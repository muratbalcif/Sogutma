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

# Run a node program from stdin inside the api container (node - reads script).
# Captures exit code correctly; does not treat stderr alone as success.
compose_exec_api_node() {
  # shellcheck disable=SC2094
  compose_exec_api node - 
}

echo "== Notification smoke (root=${ROOT}) =="

# ---------------------------------------------------------------------------
# 1) API health — inside the production api container (127.0.0.1:3000 there).
# ---------------------------------------------------------------------------
echo "-- API health --"
set +e
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
set -e

# ---------------------------------------------------------------------------
# 2) Jest unit tests — production image is --omit=dev (no jest).
#    One-off container from Dockerfile `build` stage. No production DB writes.
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

set +e
if [[ "${need_build}" -eq 1 ]]; then
  echo "Building smoke image ${SMOKE_BUILD_IMAGE} (Dockerfile target=build)…"
  docker build -f "${ROOT}/api/Dockerfile" --target build -t "${SMOKE_BUILD_IMAGE}" "${ROOT}" >/tmp/furkansogutma-smoke-build.log 2>&1
  build_rc=$?
  if [[ "${build_rc}" -ne 0 ]]; then
    bad "Jest notification tests (smoke image build failed — see /tmp/furkansogutma-smoke-build.log)"
    need_build=-1
  fi
fi

if [[ "${need_build}" -ge 0 ]]; then
  docker run --rm \
    -e NODE_ENV=test \
    -e CI=1 \
    -w /app/api \
    "${SMOKE_BUILD_IMAGE}" \
    npm test -- "${JEST_ARGS[@]}"
  jest_rc=$?
  if [[ "${jest_rc}" -eq 0 ]]; then
    ok "Jest notification tests"
  else
    bad "Jest notification tests"
  fi
fi
set -e

# ---------------------------------------------------------------------------
# 3) Template XSS — ONLY against the running production api container.
#    No fallback to a different image (that caused false PASS).
#    Uses real exports from email-templates (buildTransactionalEmail or
#    renderOrderEmailHtml). Requires exit code 0 only when checks pass.
# ---------------------------------------------------------------------------
echo "-- Template XSS --"
set +e
xss_rc=1
if ! api_running; then
  printf 'template XSS: api container is not running\n' >&2
  xss_rc=1
else
  compose_exec_api_node <<'NODE'
const path = './dist/modules/payments/email-templates';
let templates;
try {
  templates = require(path);
} catch (err) {
  console.error('require failed:', err && err.message ? err.message : err);
  process.exit(1);
}

const buildTransactionalEmail =
  typeof templates.buildTransactionalEmail === 'function'
    ? templates.buildTransactionalEmail
    : null;
const renderOrderEmailHtml =
  typeof templates.renderOrderEmailHtml === 'function'
    ? templates.renderOrderEmailHtml
    : null;

const evil = '<script>alert(1)</script>';
let html = '';
let text = '';

if (buildTransactionalEmail) {
  const built = buildTransactionalEmail('ORDER_CREATED', {
    customerName: evil,
    orderNumber: 'FS-SMOKE-1',
    siteName: 'FurkanSoğutma',
    supportEmail: 'info@example.com',
    siteUrl: 'https://example.com',
  });
  if (!built || typeof built.html !== 'string') {
    console.error('buildTransactionalEmail returned invalid result');
    process.exit(1);
  }
  html = built.html;
  text = typeof built.text === 'string' ? built.text : '';
} else if (renderOrderEmailHtml) {
  html = renderOrderEmailHtml({
    customerName: evil,
    orderNumber: 'FS-SMOKE-1',
    status: 'PENDING',
    supportEmail: 'info@example.com',
    websiteUrl: 'https://example.com',
  });
  if (typeof html !== 'string') {
    console.error('renderOrderEmailHtml returned invalid result');
    process.exit(1);
  }
} else {
  console.error(
    'No usable template export (need buildTransactionalEmail or renderOrderEmailHtml). keys=' +
      Object.keys(templates || {}).join(','),
  );
  process.exit(1);
}

if (html.includes(evil)) {
  console.error('raw user HTML was rendered (XSS)');
  process.exit(1);
}
if (!html.includes('&lt;script&gt;')) {
  console.error('expected escaped script entities in HTML');
  process.exit(1);
}
if (text && !text.includes('FS-SMOKE-1') && !html.includes('FS-SMOKE-1')) {
  console.error('order number missing from output');
  process.exit(1);
}
process.exit(0);
NODE
  xss_rc=$?
fi

if [[ "${xss_rc}" -eq 0 ]]; then
  ok "template XSS"
else
  bad "template XSS"
fi
set -e

# ---------------------------------------------------------------------------
# 4) Optional real Resend — API container env only (never read host RESEND_API_KEY)
# ---------------------------------------------------------------------------
if [[ "${RESEND_SMOKE:-}" == "1" ]]; then
  echo "-- Resend smoke --"
  set +e
  if [[ -z "${RESEND_TO:-}" ]]; then
    bad "Resend smoke (RESEND_TO is required)"
  elif ! api_running; then
    bad "Resend smoke (api container not running)"
  else
    # Presence only — never print secret values
    compose_exec_api node -e '
      const flag = (n) =>
        process.env[n] && String(process.env[n]).trim() ? "SET" : "MISSING";
      console.log("RESEND_API_KEY:", flag("RESEND_API_KEY"));
      console.log("RESEND_FROM_EMAIL:", flag("RESEND_FROM_EMAIL"));
      console.log(
        "EMAIL_DEV_MOCK:",
        String(process.env.EMAIL_DEV_MOCK || "").toLowerCase() === "true"
          ? "true"
          : "false",
      );
    '
    # RESEND_TO via argv (keeps container env intact; avoids `env` quirks).
    # node - reads program from stdin; argv[2] is the recipient.
    "${COMPOSE[@]}" exec -T "${API_SERVICE}" \
      node - "${RESEND_TO}" <<'NODE'
require('reflect-metadata');

const to = String(process.argv[2] || '').trim();
if (!to) {
  console.error('RESEND_TO missing');
  process.exit(1);
}

if (String(process.env.EMAIL_DEV_MOCK || '').toLowerCase() === 'true') {
  console.error('EMAIL_DEV_MOCK is true — refusing real Resend smoke');
  process.exit(1);
}

const flag = (n) =>
  process.env[n] && String(process.env[n]).trim() ? 'SET' : 'MISSING';
if (flag('RESEND_API_KEY') === 'MISSING') {
  console.error('RESEND_API_KEY: MISSING');
  process.exit(1);
}
if (flag('RESEND_FROM_EMAIL') === 'MISSING' && flag('EMAIL_FROM') === 'MISSING') {
  console.error('RESEND_FROM_EMAIL: MISSING');
  process.exit(1);
}

let EmailOutboxService;
let ConfigService;
try {
  ({ EmailOutboxService } = require('./dist/modules/payments/email-outbox.service'));
  ({ ConfigService } = require('@nestjs/config'));
} catch {
  console.error('EmailOutboxService/ConfigService require failed');
  process.exit(1);
}

// Use Nest ConfigService (what EmailOutboxService expects) backed by container env.
// Never log secret values — only pass them into the service.
const config = new ConfigService({
  RESEND_API_KEY: process.env.RESEND_API_KEY,
  RESEND_FROM_EMAIL: process.env.RESEND_FROM_EMAIL,
  EMAIL_FROM: process.env.EMAIL_FROM,
  RESEND_FROM_NAME: process.env.RESEND_FROM_NAME,
  RESEND_REPLY_TO: process.env.RESEND_REPLY_TO,
  EMAIL_DEV_MOCK:
    String(process.env.EMAIL_DEV_MOCK || '').toLowerCase() === 'true',
  EMAIL_OUTBOX_MAX_ATTEMPTS: Number(process.env.EMAIL_OUTBOX_MAX_ATTEMPTS || 5),
  NODE_ENV: process.env.NODE_ENV || 'production',
});

const prisma = {}; // sendEmail does not touch the database
const email = new EmailOutboxService(prisma, config);

if (!email.isProviderConfigured()) {
  // Same-process bridge diagnostics (presence only)
  const bridge = (key) => {
    const v = config.get(key);
    return v !== undefined && v !== null && String(v).trim() !== ''
      ? 'SET'
      : 'MISSING';
  };
  console.error(
    'isProviderConfigured=false bridge RESEND_API_KEY=' +
      bridge('RESEND_API_KEY') +
      ' RESEND_FROM_EMAIL=' +
      bridge('RESEND_FROM_EMAIL') +
      ' EMAIL_FROM=' +
      bridge('EMAIL_FROM'),
  );
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
      console.error('sendEmail failed');
      process.exit(1);
    }
    if (result.providerMessageId) {
      console.log('providerMessageId: SET');
    } else {
      console.log('providerMessageId: MISSING');
    }
    process.exit(0);
  })
  .catch(() => {
    console.error('sendEmail threw');
    process.exit(1);
  });
NODE
    resend_rc=$?
    if [[ "${resend_rc}" -eq 0 ]]; then
      ok "Resend smoke"
    else
      bad "Resend smoke"
    fi
  fi
  set -e
else
  ok "Resend smoke skipped (set RESEND_SMOKE=1 RESEND_TO=… to run)"
fi

echo ""
echo "Result: ${PASS} passed, ${FAIL} failed"
if [[ "${FAIL}" -gt 0 ]]; then
  exit 1
fi
exit 0
