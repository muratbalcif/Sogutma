#!/usr/bin/env bash
# FurkanSoğutma production deploy — run on the VPS at /opt/furkansogutma.
# Invoked by GitHub Actions over SSH. Do not print secrets / .env / DATABASE_URL.
#
# Safe order: pull → validate → ensure DB → build (old containers keep running) →
# migrate → up api/web/admin → health checks.
set -Eeuo pipefail

ROOT="/opt/furkansogutma"
COMPOSE_FILE="docker-compose.production.yml"
ENV_FILE=".env.production"
COMPOSE=(docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE")

log() { printf '%s %s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$*"; }
die() { log "ERROR: $*"; exit 1; }

[[ "$(id -u)" -eq 0 ]] && die "Do not run as root; use production SSH user"

cd "$ROOT" || die "Cannot cd to $ROOT"

[[ -f "$ENV_FILE" ]] || die "$ENV_FILE missing (create on VPS only; never commit)"
[[ -f "$COMPOSE_FILE" ]] || die "$COMPOSE_FILE missing"
[[ -d .git ]] || die "Not a git checkout at $ROOT"

# Re-exec after git update so we always run the script from origin/main.
if [[ "${1:-}" != "--post-pull" ]]; then
  PREV_SHA="$(git rev-parse HEAD)"
  log "Current SHA: $PREV_SHA"

  git fetch origin
  git checkout main
  git reset --hard origin/main

  NEW_SHA="$(git rev-parse HEAD)"
  log "Deploy SHA: $NEW_SHA (was $PREV_SHA)"

  exec bash "$ROOT/scripts/deploy-production.sh" --post-pull
fi

log "Running deploy from $(git rev-parse HEAD)"

log "Validating compose config (output discarded)"
"${COMPOSE[@]}" config >/dev/null

log "Ensuring postgres + redis are up (no down / no full recreate)"
"${COMPOSE[@]}" up -d postgres redis

log "Waiting for postgres healthy"
for _ in $(seq 1 60); do
  status="$(docker inspect --format='{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' furkansogutma-postgres 2>/dev/null || true)"
  if [[ "$status" == "healthy" ]]; then
    break
  fi
  sleep 2
done
status="$(docker inspect --format='{{if .State.Health}}{{.State.Health.Status}}{{else}}unknown{{end}}' furkansogutma-postgres 2>/dev/null || true)"
[[ "$status" == "healthy" ]] || die "postgres not healthy (status=$status)"

log "Building api web admin images (running containers untouched until migrate/up)"
"${COMPOSE[@]}" build api web admin

log "Running prisma migrate deploy (new api image, existing DATABASE_URL from compose)"
# Uses freshly built furkansogutma-api:latest. Fails deploy before swapping app containers.
"${COMPOSE[@]}" run --rm --no-deps --entrypoint "" api \
  npx prisma migrate deploy

log "Starting/recreating api web admin with new images"
"${COMPOSE[@]}" up -d api web admin

wait_healthy() {
  local name="$1"
  local tries="${2:-60}"
  local i status
  for i in $(seq 1 "$tries"); do
    status="$(docker inspect --format='{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' "$name" 2>/dev/null || true)"
    if [[ "$status" == "healthy" || "$status" == "running" ]]; then
      # Prefer explicit healthy when healthcheck exists
      if docker inspect --format='{{if .State.Health}}{{.State.Health.Status}}{{end}}' "$name" 2>/dev/null | grep -q .; then
        [[ "$status" == "healthy" ]] && return 0
      else
        [[ "$status" == "running" ]] && return 0
      fi
    fi
    sleep 3
  done
  return 1
}

log "Waiting for api container health"
wait_healthy furkansogutma-api 60 || die "api container not healthy"

log "Waiting for web container health"
wait_healthy furkansogutma-web 40 || die "web container not healthy"

log "Waiting for admin container health"
wait_healthy furkansogutma-admin 40 || die "admin container not healthy"

log "Public health checks"
curl -fsS --max-time 15 "https://api.furkansogutma.net/api/v1/health" >/dev/null \
  || die "API public health failed"
curl -fsSI --max-time 15 "https://www.furkansogutma.net" >/dev/null \
  || die "Web public health failed"
curl -fsSI --max-time 15 "https://admin.furkansogutma.net" >/dev/null \
  || die "Admin public health failed"

log "Compose status"
"${COMPOSE[@]}" ps

log "Deployed git SHA: $(git rev-parse HEAD)"
log "🚀 Production deployment successful"
