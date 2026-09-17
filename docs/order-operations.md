# Order Operations — Shipping & Notifications

## Order lifecycle

`PENDING → CONFIRMED → PREPARING → SHIPPED → DELIVERED`  
Cancel: `PENDING|CONFIRMED|PREPARING → CANCELLED`  
Return: `DELIVERED → RETURNED`

Payment stays independent (`PENDING → PAID|CANCELLED|FAILED`).  
When payment becomes PAID and order is PENDING → order CONFIRMED.

## Status transitions

Centralized in `OrderStatusService.applyTransitionInTransaction`:

- validates matrix
- writes `OrderStatusHistory` (`changedBy` null = system)
- releases reserved stock once on cancel (idempotent via RELEASE inventory transactions)
- syncs shipping status on deliver/return/cancel
- creates `OrderReturn` foundation row on RETURNED

## Shipping

- Model: `Shipping` (provider `MANUAL` only in v1)
- Interface: `ShippingProvider` + `ManualShippingProvider`
- Admin: `POST /admin/orders/:id/ship` creates shipping + order SHIPPED in one transaction
- Customer receives `trackingUrl` from API (clients must not invent URLs)

## Notifications

- Outbox: `NotificationOutbox` with `eventKey` idempotency, status PENDING→PROCESSING→SENT|FAILED, retries (`NOTIFICATION_OUTBOX_MAX_ATTEMPTS`)
- In-app `Notification` also keyed by `eventKey`
- Critical types always push (prefs cannot silence payment approval / cancel / ship / deliver)
- FCM failure never rolls back order transactions
- Email via `EmailOutbox` + shared HTML template (`email-templates.ts`)

## Customer cancel

Allowed only for `PENDING` and `CONFIRMED` (`canCancel` on order DTO).
