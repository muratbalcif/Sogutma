# Deployment

## Topology (target)

- **API**: container (see `api/Dockerfile`) behind HTTPS reverse proxy
- **Web / Admin**: Next.js hosting (Vercel / container / static+SSR)
- **Postgres / Redis**: managed private network
- **R2**: Cloudflare object storage

## Safe deploy sequence

1. Create encrypted DB backup
2. Apply **additive** migrations (`prisma migrate deploy`)
3. Deploy API image (health: `/api/v1/health/ready`)
4. Deploy web + admin
5. Smoke: login → catalog → cart → order → bank transfer path (staging)

## Zero-downtime guidance

1. Additive migration first (new columns nullable / new tables)
2. Deploy code that reads/writes both old and new shapes
3. Backfill if needed
4. Cleanup migration later (drop unused columns)

Destructive `DROP` migrations must be manual, reviewed, and never silent in CI auto-prod.

## Rollback

- **Code**: redeploy previous image/tag
- **DB**: do **not** auto-run down migrations; restore from encrypted backup if schema is incompatible
- Document incident + restore point

## CI

GitHub Actions:

- `.github/workflows/api.yml` — lint, unit, migrate, e2e (Postgres+Redis services)
- `.github/workflows/web.yml` — lint, build, Playwright
- `.github/workflows/admin.yml` — lint, build
- `.github/workflows/android.yml` — test, lint, assembleDebug

Production promote should use a protected environment / manual approval (platform setting).

## HTTPS / domains

- Force HTTPS; HSTS at edge
- Separate hosts for api / www / admin
- Cookies: `Secure` + `HttpOnly` + `SameSite=Lax` (web already)
