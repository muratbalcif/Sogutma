# FurkanSoğutma — production Docker deploy notes

Isolated stack: `docker-compose.production.yml` + root `.env.production`.
Does **not** share networks or compose files with Rotawide or `api/docker-compose.yml` (local only).

## Prepare secrets

```bash
cp .env.production.example .env.production
chmod 600 .env.production
# Edit .env.production — set strong POSTGRES_PASSWORD, REDIS_PASSWORD,
# JWT_ACCESS_SECRET / JWT_REFRESH_SECRET (>= 32 characters each).
```

Never commit `.env.production`. It is gitignored (`.env.production`, `.env.production.*`).

## Validate compose (no secrets printed if you avoid piping full config)

```bash
docker compose --env-file .env.production -f docker-compose.production.yml config >/dev/null
```

Missing required variables fail with messages such as `POSTGRES_DB is required`.

## Bring up

```bash
docker compose --env-file .env.production -f docker-compose.production.yml up -d --build
```

Published only on loopback:

| Service | Host |
|---------|------|
| API | `127.0.0.1:3100` |
| Admin | `127.0.0.1:3101` |
| Web | `127.0.0.1:3102` |

Postgres and Redis are internal-only (`furkansogutma_internal`). Put a reverse proxy (Caddy/Nginx) on the host in front of the loopback ports.

## Notes

- `DATABASE_URL` / `REDIS_URL` are overridden by compose to `postgres` / `redis` service hostnames.
- Web/Admin `NEXT_PUBLIC_*` values are build-time args (rebuild images after changing them).
- Do not run this stack at the same time as local `api/docker-compose.yml` (same container names).
