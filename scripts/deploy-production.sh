#!/usr/bin/env bash
# FurkanSoğutma production deploy — run on the VPS at /opt/furkansogutma.
# Invoked by GitHub Actions over SSH. Do not print secrets / .env / DATABASE_URL.
#
# Safe order: pull → validate → ensure DB → build → migrate deploy → up --build → health.
# Never: compose down, volume rm, prisma db push / migrate reset / migrate dev.
set -Eeuo pipefail

ROOT="/opt/furkansogutma"
COMPOSE_FILE="docker-compose.production.yml"
ENV_FILE=".env.production"
COMPOSE=(docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE")

log() { printf '%s %s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$*"; }
die() { log "ERROR: $*"; exit 1; }

dump_logs() {
  local name="$1"
  log "----- logs: ${name} (tail 120; no env dump) -----"
  docker logs --tail 120 "$name" 2>&1 || true
}

[[ "$(id -u)" -eq 0 ]] && die "Do not run as root; use production SSH user"

cd "$ROOT" || die "Cannot cd to $ROOT"

[[ -f "$ENV_FILE" ]] || die "$ENV_FILE missing (create on VPS only; never commit)"
[[ -f "$COMPOSE_FILE" ]] || die "$COMPOSE_FILE missing"
[[ -d .git ]] || die "Not a git checkout at $ROOT"

# Re-exec after git update so we always run the script from origin/main.
if [[ "${1:-}" != "--post-pull" ]]; then
  PREV_SHA="$(git rev-parse HEAD)"
  log "Deploy started"
  log "Current SHA: $PREV_SHA"

  git fetch origin
  git checkout main
  git reset --hard origin/main

  NEW_SHA="$(git rev-parse HEAD)"
  log "Repository updated"
  log "Deploy SHA: $NEW_SHA (was $PREV_SHA)"

  exec bash "$ROOT/scripts/deploy-production.sh" --post-pull
fi

log "Running deploy from $(git rev-parse HEAD)"

log "Compose config validated"
"${COMPOSE[@]}" config >/dev/null

log "Ensuring postgres + redis are up (no down / no volume wipe)"
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
[[ "$status" == "healthy" ]] || {
  dump_logs furkansogutma-postgres
  die "postgres not healthy (status=$status)"
}

log "Waiting for redis healthy"
for _ in $(seq 1 30); do
  status="$(docker inspect --format='{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' furkansogutma-redis 2>/dev/null || true)"
  if [[ "$status" == "healthy" ]]; then
    break
  fi
  sleep 2
done
status="$(docker inspect --format='{{if .State.Health}}{{.State.Health.Status}}{{else}}unknown{{end}}' furkansogutma-redis 2>/dev/null || true)"
[[ "$status" == "healthy" ]] || {
  dump_logs furkansogutma-redis
  die "redis not healthy (status=$status)"
}

log "Docker images built (api web admin; running containers untouched until migrate/up)"
"${COMPOSE[@]}" build api web admin

log "Database migrations applied (prisma migrate deploy only)"
# Fresh image + existing DB URL from compose. Fail before swapping app containers.
"${COMPOSE[@]}" run --rm --no-deps --entrypoint "" api \
  npx prisma migrate deploy

log "Containers started (up -d --build api web admin)"
"${COMPOSE[@]}" up -d --build api web admin

wait_healthy() {
  local name="$1"
  local tries="${2:-60}"
  local i status
  for i in $(seq 1 "$tries"); do
    status="$(docker inspect --format='{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' "$name" 2>/dev/null || true)"
    if docker inspect --format='{{if .State.Health}}{{.State.Health.Status}}{{end}}' "$name" 2>/dev/null | grep -q .; then
      [[ "$status" == "healthy" ]] && return 0
    else
      [[ "$status" == "running" ]] && return 0
    fi
    sleep 3
  done
  return 1
}

wait_http() {
  local url="$1"
  local tries="${2:-40}"
  local i
  for i in $(seq 1 "$tries"); do
    if curl -fsS --max-time 5 "$url" >/dev/null 2>&1; then
      return 0
    fi
    # HEAD for HTML frontends
    if curl -fsSI --max-time 5 "$url" >/dev/null 2>&1; then
      return 0
    fi
    sleep 3
  done
  return 1
}

log "Health checks (container status)"
wait_healthy furkansogutma-api 60 || {
  dump_logs furkansogutma-api
  die "api container not healthy"
}
wait_healthy furkansogutma-web 40 || {
  dump_logs furkansogutma-web
  die "web container not healthy"
}
wait_healthy furkansogutma-admin 40 || {
  dump_logs furkansogutma-admin
  die "admin container not healthy"
}

log "Health checks (loopback)"
wait_http "http://127.0.0.1:3100/api/v1/health" 40 || {
  dump_logs furkansogutma-api
  die "API loopback health failed (127.0.0.1:3100)"
}
wait_http "http://127.0.0.1:3102" 40 || {
  dump_logs furkansogutma-web
  die "Web loopback health failed (127.0.0.1:3102)"
}
wait_http "http://127.0.0.1:3101" 40 || {
  dump_logs furkansogutma-admin
  die "Admin loopback health failed (127.0.0.1:3101)"
}

log "Health checks passed"
log "Compose status"
"${COMPOSE[@]}" ps

log "Deployed git SHA: $(git rev-parse HEAD)"
log "Deploy completed successfully"
