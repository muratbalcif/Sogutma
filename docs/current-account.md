# Current Account (Cari Hesap)

## Convention (source of truth)

`AccountTransaction` is the ledger. **Never** store balance as a mutable counter alone.

| Type | Direction | Meaning |
|------|-----------|---------|
| `SALE` | DEBIT | Order placed — customer owes |
| `PAYMENT` | CREDIT | Payment received (havale approved) |
| `REFUND` | DEBIT | Refund foundation |
| `ADJUSTMENT` | DEBIT | Manual debit / adjustment |

**Balance** = `totalDebit − totalCredit`  
Positive balance ⇒ customer owes FurkanSoğutma.

## Idempotency

Unique `reference` keys:

- Order debit: `SALE:ORDER:{orderId}`
- Payment credit: `PAYMENT:{paymentId}`
- Refund: `REFUND:PAYMENT:{paymentId}`
- Manual: `MANUAL:DEBIT:{uuid}` / `MANUAL:CREDIT:{uuid}`
- Adjustment: `ADJUSTMENT:{DIRECTION}:{uuid}`
- Reversal: `REVERSAL:{originalReference}`

`recordIfAbsent` + unique constraint prevent duplicates. Concurrent writes lock the customer row (`SELECT … FOR UPDATE`) and set `balanceAfter`.

## Order → ledger

On order create: idempotent `SALE` debit.

## Payment → ledger

On bank-transfer approve → `markPaidFromBankTransfer` → idempotent `PAYMENT` credit.

Re-approving the same payment must not create a second credit.

## Manual / adjustment / reversal

- Permission: `accounting.create`
- Hard delete is forbidden; use adjustment or reversal.
- Audit: `ACCOUNT_DEBIT`, `ACCOUNT_CREDIT`, `ACCOUNT_ADJUSTMENT`, `ACCOUNT_REVERSAL`

## Customer APIs

- `GET /account/current`
- `GET /account/transactions`
- `GET /account/statement?format=csv`

Admin: `/admin/accounting/...`
