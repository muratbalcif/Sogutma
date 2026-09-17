# Payment Architecture

## Payment vs Order

Orders and payments have **separate** lifecycles.

| Domain | Statuses |
|--------|----------|
| Order | `PENDING` → `CONFIRMED` → `PREPARING` → `SHIPPED` → `DELIVERED` (+ `CANCELLED` / `RETURNED`) |
| Payment | `PENDING` → `AUTHORIZED` / `PAID` / `FAILED` / `CANCELLED` (+ `REFUNDED`) |

An order may exist before any payment succeeds. Creating a payment attempt never marks an order as paid.

### Synchronization decision

When a payment becomes **PAID** and the order is still **PENDING**, the order transitions to **CONFIRMED** (payment required before fulfillment).

Payment **FAILED** or bank-transfer **REJECTED** leaves the order **PENDING**. Orders are not auto-cancelled on payment failure.

## Provider adapter

Application code depends on `PaymentProvider`:

- `createPayment`
- `getPaymentStatus`
- `cancelPayment`
- `refundPayment`
- `verifyWebhook`

Current implementation: `DevelopmentPaymentProvider` (`provider = "development"`).

Real PayTR / iyzico / bank APIs are **not** integrated in this milestone. Future providers implement the same interface.

## Idempotency

`POST /api/v1/orders/:orderId/payment` accepts optional header:

`Idempotency-Key: <opaque-string>`

`payments.idempotencyKey` is uniquely constrained. Concurrent duplicates with the same key resolve to a single payment row.

## Webhook verification

`POST /api/v1/payments/webhook/:provider`

Every provider must implement `verifyWebhook`. Development provider requires header:

`x-dev-webhook-secret: <DEV_PAYMENT_WEBHOOK_SECRET>`

Processed events are stored in `processed_webhook_events` (`provider` + `eventKey` unique) so duplicate deliveries do not double-apply state or accounting.

## Bank transfer workflow

1. Customer creates payment with `method = BANK_TRANSFER` (status `PENDING`).
2. Customer submits `BankTransferNotification` (amount always = `order.totalAmount`).
3. Admin approves → notification `APPROVED`, payment `PAID`, order may `CONFIRMED`, accounting `PAYMENT` credit.
4. Admin rejects → notification `REJECTED`, payment `FAILED`, order stays `PENDING`.

Repeated approval on an already-approved notification is idempotent.

## Accounting model

| Type | Effect | When |
|------|--------|------|
| `SALE` | debit | Order created (`reference = SALE:ORDER:<orderId>`) |
| `PAYMENT` | credit | Payment becomes PAID (`reference = PAYMENT:<paymentId>`) |
| `REFUND` | debit | Refund succeeds (`reference = REFUND:PAYMENT:<paymentId>`) |
| `ADJUSTMENT` | debit (foundation) | Manual adjustments later |

`reference` is unique → duplicate webhook/approval cannot create duplicate ledger rows.

## Current account

```
totalDebit  = SALE + REFUND + ADJUSTMENT
totalCredit = PAYMENT
balance     = totalDebit - totalCredit
```

Positive balance means the customer still owes money. Balances are calculated via aggregation, not stored.

## PCI / card-data strategy

This backend **never** stores:

- PAN
- CVV
- PIN
- magnetic stripe data

Future card payments must use provider-hosted pages, SDKs, or tokenization. Only provider payment IDs / tokens are persisted.

Company bank accounts live in `company_bank_accounts` (no hardcoded IBANs in controllers).
