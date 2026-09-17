# Payment Flow — FurkanSoğutma v1

Initial payment method: **Bank Transfer / EFT** only.  
Online card providers (iyzico, PayTR, Stripe, etc.) are **not** enabled.

## 1. Payment architecture

- `Payment` is separate from `Order` lifecycle.
- Active method: `BANK_TRANSFER`.
- Enum still contains `CREDIT_CARD` / `CASH_ON_DELIVERY` for a future release; create endpoints reject non-bank methods.
- Provider interface (`PaymentProvider`) remains for future online flows; v1 webhook handlers return disabled.

## 2. Bank transfer flow

1. Customer places order.
2. Backend creates `Order(PENDING)` + `Payment(BANK_TRANSFER, PENDING, expiresAt)` + stock reservation in one DB transaction.
3. Customer sees company bank accounts (`GET /payment/bank-accounts`).
4. Customer submits transfer notification.
5. Admin approves → `Payment(PAID)` + `Order(CONFIRMED)` + accounting credit.
6. Admin rejects → notification `REJECTED`, payment stays `PENDING`, order stays `PENDING` (retry allowed).

## 3. Order lifecycle

`PENDING` → `CONFIRMED` → `PREPARING` → `SHIPPED` → `DELIVERED`  
Cancel paths: customer/admin cancel, or payment expiry job.

## 4. Payment lifecycle

`PENDING` → `PAID` | `CANCELLED` | (`FAILED` reserved for future providers)  
Refund: `PAID` → `REFUNDED` (admin).

## 5. Transfer notification

Fields: order, optional bank account, amount, transfer date, reference, note.  
If reported amount ≠ order total → `amountMismatch=true` (never auto-approved).  
Only one `PENDING` notification per order.

## 6. Admin approval

Transaction:

1. Notification → `APPROVED`
2. Payment → `PAID`
3. Order → `CONFIRMED` (+ status history)
4. Accounting `PAYMENT` entry (idempotent unique reference)
5. In-app notification + email outbox events

## 7. Rejection

Notification → `REJECTED` (admin note/reason required).  
Payment remains `PENDING`. Order not cancelled. Customer may submit again.

## 8. Expiration

`PAYMENT_EXPIRY_HOURS` (default 24).  
Interval job finds `PENDING` bank payments with `expiresAt < now` and:

- Payment → `CANCELLED`
- Order → `CANCELLED`
- Release reserved stock
- Notify + email outbox

Idempotent via row lock + status checks.

## 9. Stock reservation

On order create: `reservedQuantity += qty`.  
Released on cancel / expiry. Not released on payment approval (stock stays reserved until fulfillment rules evolve).

## 10. Accounting

- Order create: `SALE` debit (`SALE:ORDER:{id}`)
- Payment paid: `PAYMENT` credit (`PAYMENT:{paymentId}`)
- Unique `reference` prevents duplicates.

## 11. Notifications

In-app via notification outbox:

- Order created / confirmed / cancelled
- Transfer submitted / approved / rejected

FCM failure never rolls back payment/order transactions.

## 12. Email

`email_outbox` table + worker (log stub until Resend/SMTP).  
Events: `OrderCreated`, `TransferNotificationCreated`, `TransferApproved`, `TransferRejected`, `OrderConfirmed`, `OrderCancelled`.

## 13. Idempotency

- Payment create: idempotency key + existing pending bank payment reuse
- Approve/reject: `FOR UPDATE` + status guards
- Accounting: unique reference
- Expiry: status guards

## 14. Security

- Public bank accounts: active only, no admin fields
- Approve/reject: `bank_transfer.approve` / `bank_transfer.reject`
- Users can only access own orders/transfers
- Client cannot set payment/order status to paid
- Order totals always computed server-side (Decimal)
