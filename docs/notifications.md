# Notifications & Email (FurkanSoğutma)

## Architecture

Business events emit notifications through the existing stack — there is no second notification system.

```
Business Event (order / payment / bank transfer / auth / stock / campaign)
        ↓
NotificationsService.enqueueOutbox  →  NotificationOutbox (IN_APP + PUSH)
EmailOutboxService.enqueue          →  EmailOutbox (EMAIL)
        ↓
commit (business TX never waits on Resend / FCM)
        ↓
in-process workers (atomic claim + lease)
        ↓
delivery: Notification row + FCM  |  Resend
```

Channels are independent: FCM failure does not fail email or in-app; email failure does not roll back orders.

## Event keys & idempotency

### In-app / push (`Notification` + `NotificationOutbox`)

- Outbox `eventKey` = `{type}:{aggregateType}:{aggregateId}` (unique)
- Notification `eventKey` mirrors the outbox key when present (unique)
- Duplicate inserts hit `P2002` and are skipped

### Email (`EmailOutbox`)

- `eventKey` = `{EVENT}:{entityRef}:{toEmail}` (unique, nullable for legacy rows)
- Examples:
  - `ORDER_CREATED:order:{orderId}:{email}`
  - `BANK_TRANSFER_APPROVED:transfer:{transferId}:{email}`
  - `ACCOUNT_INVITATION:user:{userId}:{email}`
- `enqueue()` returns `{ created: false }` on duplicate

## Email lifecycle

Statuses: `PENDING` → `PROCESSING` (claim lease) → `SENT` | `FAILED`

Fields:

| Field | Meaning |
| --- | --- |
| `attempts` | Attempt count |
| `lastAttemptAt` | Last claim/send attempt |
| `availableAt` | Next retry time **or** claim lease expiry while `PROCESSING` |
| `sentAt` / `failedAt` | Terminal timestamps |
| `lastError` | Truncated provider error (no secrets / HTML body) |
| `providerMessageId` | Resend message id |

### Retry / backoff

Default max attempts: **5** (`EMAIL_OUTBOX_MAX_ATTEMPTS`).

Backoff minutes: **1 → 5 → 15 → 30 → 60**.

Admin retry: `POST /api/v1/admin/email-outbox/:id/retry` (idempotent). Requeues `FAILED` without creating a new row.

Transactional emails are processed before marketing (`CAMPAIGN_*` / `PROMO`) so campaigns cannot starve order/payment mail.

## Templates

Central templates live in `api/src/modules/payments/email-templates.ts`.

- Shared responsive layout (logo/brand bar, title, message, details, CTA, footer)
- HTML is built from **escaped** strings — never render raw user HTML
- Every send includes subject + HTML + text fallback when built via templates

## User preferences

`NotificationPreference` categories + channels:

- Categories: order / payment / stock / campaign / system
- Channels: `emailEnabled`, `pushEnabled`, `inAppEnabled`
- Marketing: `marketingEmailOptIn` (default **false**)

`PASSWORD_RESET`, `ACCOUNT_INVITATION`, `WELCOME`, and other security/critical emails **cannot** be opted out of email.

## FCM (Android)

`FcmPushProvider` uses `FIREBASE_*` credentials when present. Payload includes title, body, and string data (`type`, `entityId`, `eventKey`, `deepLink`, …). Missing FCM credentials disable push only.

## Resend config

| Env | Purpose |
| --- | --- |
| `RESEND_API_KEY` | API key (never log) |
| `RESEND_FROM_EMAIL` or `EMAIL_FROM` | From address |
| `RESEND_FROM_NAME` | Optional display name |
| `RESEND_REPLY_TO` | Optional reply-to |
| `EMAIL_DEV_MOCK=true` | Dev/test mock send without Resend (never in production) |
| `EMAIL_OUTBOX_MAX_ATTEMPTS` | Default 5 |

Production starts with a clear error log if Resend is not configured. Business APIs stay up; emails remain `FAILED` and retry.

## Admin APIs

- `GET /admin/notifications` — in-app list (filters: type, eventKey, dates)
- `GET /admin/notifications/summary`
- `GET /admin/notifications/:id`
- `GET /admin/email-outbox` — email delivery list
- `GET /admin/email-outbox/summary`
- `GET /admin/email-outbox/:id`
- `POST /admin/email-outbox/:id/retry`

Permission: `notification.read` (existing RBAC; `SUPER_ADMIN` wildcard unchanged).

## User APIs

- `GET /notifications`
- `GET /notifications/unread-count`
- `PATCH /notifications/:id/read` (IDOR: own rows only)
- `POST /notifications/read-all`
- Preferences: `GET/PATCH /notifications/preferences`

## Logging

Structured messages: `notification.created|processing|sent|failed|retrying`.

Never log JWT, passwords, email HTML bodies, R2 secrets, Resend API keys, or Authorization headers. Recipient emails are masked in debug mock logs.

## Smoke test

On the VPS (production Docker):

```bash
cd /opt/furkansogutma
./scripts/test-notifications.sh
```

- Health: probed **inside** the `api` container (`http://127.0.0.1:3000/api/v1/health/live`). Do not use host `:3000` (API is published on `127.0.0.1:3100`).
- Jest: one-off image from Dockerfile `build` stage (`furkansogutma-api:test`) — production runtime omits devDeps. Force rebuild with `SMOKE_REBUILD=1`.
- Template XSS: `node` against compiled templates in the running `api` container.
- Optional real Resend (container env only — never export `RESEND_API_KEY` on the host):

```bash
RESEND_SMOKE=1 RESEND_TO=you@example.com ./scripts/test-notifications.sh
```

Uses `EmailOutboxService.sendEmail` inside the container. Requires `EMAIL_DEV_MOCK=false` and Resend configured in `.env.production`.

## Migrations

Apply (production-safe SQL, no reset/push/dev):

`api/prisma/migrations/20260919190000_notification_email_production/migration.sql`
