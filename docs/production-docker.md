# FurkanSoğutma — production Docker deploy notes

Isolated stack: `docker-compose.production.yml` + root `.env.production`.
Does **not** share networks or compose files with Rotawide or `api/docker-compose.yml` (local only).

## Automatic deploy (recommended)

One command from your laptop:

```bash
git add .
git commit -m "your message"
git push origin main
```

Flow:

```text
git push origin main
    → GitHub Actions (.github/workflows/deploy-production.yml)
    → SSH → VPS
    → /opt/furkansogutma
    → git fetch + reset --hard origin/main
    → compose config validate
    → prisma migrate deploy
    → docker compose up -d --build
    → health checks (loopback 3100/3101/3102 + public)
```

Manual run (same workflow): GitHub → Actions → **Production Deploy** → **Run workflow**.

### GitHub Secrets (repository)

| Secret | Notes |
|--------|-------|
| `PRODUCTION_SSH_PRIVATE_KEY` | Private key; public half in VPS `~/.ssh/authorized_keys` |
| `PRODUCTION_HOST` | VPS hostname or IP |
| `PRODUCTION_USER` | SSH user (e.g. `muratbalci`) |

Do **not** put `.env.production`, JWT, DB, Redis, Resend, or R2 secrets in GitHub.

### One-time VPS setup

1. Clone repo at `/opt/furkansogutma` with `origin` able to `git fetch` (`main`).
2. Create `/opt/furkansogutma/.env.production` from `.env.production.example`, `chmod 600`.
3. Install Docker + Compose plugin; user in `docker` group.
4. Add the GitHub Actions deploy public key to `~/.ssh/authorized_keys`.
5. First bring-up if needed:
   `docker compose --env-file .env.production -f docker-compose.production.yml up -d --build`
6. Nginx/SSL for `api` / `admin` / `www` / apex → `127.0.0.1:3100–3102`.

Emergency manual deploy on the VPS:

```bash
bash /opt/furkansogutma/scripts/deploy-production.sh
```

## Prepare secrets

```bash
cp .env.production.example .env.production
chmod 600 .env.production
# Edit .env.production — strong POSTGRES_PASSWORD, REDIS_PASSWORD,
# JWT_ACCESS_SECRET / JWT_REFRESH_SECRET (>= 32 characters each).
```

Never commit `.env.production` (gitignored). Keep `.env.production.example` in git.

## Validate compose

```bash
docker compose --env-file .env.production -f docker-compose.production.yml config >/dev/null
```

## Ports (loopback only)

| Service | Host |
|---------|------|
| API | `127.0.0.1:3100` |
| Admin | `127.0.0.1:3101` |
| Web | `127.0.0.1:3102` |

Postgres and Redis are internal-only (`furkansogutma_internal`).

## Safety

- Migrations: **only** `prisma migrate deploy` (never `db push` / `migrate reset` / `migrate dev`).
- No `docker compose down`, no volume deletes.
- Deploy does not touch Rotawide paths, networks, or containers.
- Actions logs never print JWT, DB/Redis passwords, Resend, R2, or SSH private keys.

## Notes

- `DATABASE_URL` / `REDIS_URL` are overridden by compose to `postgres` / `redis` service hostnames.
- Web/Admin `NEXT_PUBLIC_*` values are build-time args (rebuild images after changing them).
- Web runtime `INTERNAL_API_BASE_URL` (default `http://api:3000/api/v1`) is used for SSR/BFF on the Docker network.
- Web healthcheck hits `/api/health` (not `/`).
- R2: set vars in `.env.production`; smoke via `scripts/test-r2-storage.sh` (never commit secrets).
- Do not run this stack at the same time as local `api/docker-compose.yml` (same container names).
