# Financial Rules

Payment model v1: **BANK TRANSFER / EFT only**.

## Ledger immutability

- Do not hard-delete `AccountTransaction` rows.
- Do not rewrite historical amounts.
- Correct mistakes with `ADJUSTMENT` or `REVERSAL`.
- Every financial mutation is auditable.

## Credit limit

Corporate fields on `CorporateCustomer`:

- `allowCredit` (default `false`)
- `creditLimit`
- `paymentTermDays` (0 / 7 / 15 / 30 / 60 …)

When `allowCredit = false` (prepaid havale flow): **no** credit-limit check.

When `allowCredit = true`: reject if `currentBalance + newOrderAmount > creditLimit`.

## Due date / overdue

- `Order.dueDate` = order date + `paymentTermDays` (backend only).
- Overdue report: unpaid orders with `dueDate < now` and balance impact.

## Reports

`GET /admin/finance/reports/:report`

- `sales` · `collections` · `current-account` · `debtors` · `overdue` · `top-customers`
- `?format=csv` for export
- Date filters: `dateFrom` / `dateTo` (UTC storage; business day bounds for collections use Istanbul)

## Precision

All money math uses `Prisma.Decimal` / decimal strings. Never JS `Number` or Android `Double` for financial arithmetic.
