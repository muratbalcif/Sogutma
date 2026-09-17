# Environment Matrix

Never put real secrets in this document or in git.

| Variable | Dev | Test/CI | Staging | Production |
|----------|-----|---------|---------|------------|
| `NODE_ENV` | development | test | production | production |
| `DATABASE_URL` | local Postgres | CI service | private network | private network |
| `REDIS_URL` | local Redis | CI service | private + AUTH | private + AUTH |
| `JWT_ACCESS_SECRET` | ≥16 chars | CI secret | ≥32 chars | ≥32 chars (rotate) |
| `JWT_REFRESH_SECRET` | ≥16 chars | CI secret | ≥32 chars | ≥32 chars (rotate) |
| `ACCESS_TOKEN_EXPIRES_IN` | 15m | 15m | 15m | 15m |
| `REFRESH_TOKEN_EXPIRES_IN` | 30d | 1d | 14d–30d | 7d–30d |
| `CORS_ORIGINS` | localhost web/admin | localhost | staging web+admin URLs | production web+admin URLs |
| `R2_*` | optional | optional/mock | required | required |
| `FIREBASE_*` | optional | optional | required if push | required if push |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` | optional seed | optional | seed once then rotate | **do not** leave default |
| `BACKUP_PASSPHRASE` | n/a | restore-test | backup job secret | backup job secret (≠ DB password) |
| `BUSINESS_TIMEZONE` | Europe/Istanbul | Europe/Istanbul | Europe/Istanbul | Europe/Istanbul |

## App URLs (target)

| Surface | Target URL pattern |
|---------|-------------------|
| API | `https://api.<domain>/api/v1` |
| Web | `https://www.<domain>` or apex |
| Admin | `https://admin.<domain>` |

## Notes

- Production Joi validation **requires** `CORS_ORIGINS`.
- Redis is required at startup (rate limit + readiness).
- R2 incomplete → uploads return 503 (API still boots).
- Compose file is **local only**; production must not reuse compose passwords.
