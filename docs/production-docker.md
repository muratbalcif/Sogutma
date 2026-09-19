# FurkanSoğutma — production Docker deploy notes

Isolated stack: `docker-compose.production.yml` + root `.env.production`.
Does **not** share networks or compose files with Rotawide or `api/docker-compose.yml` (local only).

## Automatic deploy (recommended)

Production updates from `main` via GitHub Actions:

```bash
git add .
git commit -m "your message"
git push origin main
```

Workflow: `.github/workflows/deploy-production.yml` → SSH → `/opt/furkansogutma` →
`scripts/deploy-production.sh` (build → `prisma migrate deploy` → `up -d api web admin` → health checks).

### GitHub Secrets (repository)

| Secret | Example / notes |
|--------|-----------------|
| `PRODUCTION_SSH_PRIVATE_KEY` | Private key whose public half is in VPS `~/.ssh/authorized_keys` |
| `PRODUCTION_HOST` | e.g. `186.186.205.92.host.secureserver.net` or the VPS IP |
| `PRODUCTION_USER` | `muratbalci` |

Do **not** put `.env.production`, JWT, DB, Redis, or R2 secrets in GitHub.

### One-time VPS setup

1. Clone (or keep) the repo at `/opt/furkansogutma` with `origin` able to `git fetch` (`main`).
2. Create `/opt/furkansogutma/.env.production` from `.env.production.example`, `chmod 600`.
3. Install Docker + Compose plugin; ensure user can run `docker` (docker group).
4. Add the GitHub Actions deploy public key to `~/.ssh/authorized_keys`.
5. Bring the stack up once manually if needed:
   `docker compose --env-file .env.production -f docker-compose.production.yml up -d --build`
6. Nginx/SSL for `api` / `admin` / `www` / apex must already point at `127.0.0.1:3100–3102`.

Manual deploy on the VPS (emergency):

```bash
bash /opt/furkansogutma/scripts/deploy-production.sh
```

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
- Web runtime `INTERNAL_API_BASE_URL` (default `http://api:3000/api/v1`) is used for SSR and BFF proxy fetches so they stay on the Docker network. Do not put this in `NEXT_PUBLIC_*`.
- Web healthcheck hits `/api/health` (not `/`).
- Deploy never runs `prisma migrate reset` / `db push` / `migrate dev` — only `prisma migrate deploy`.
- Do not run this stack at the same time as local `api/docker-compose.yml` (same container names).
- Do not deploy into Rotawide paths; only `/opt/furkansogutma`.
