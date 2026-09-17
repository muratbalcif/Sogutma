# Customer Management

Admin customer lifecycle for FurkanSoğutma (bank transfer / EFT only — no card gateways).

## Endpoints

| Method | Path | Permission |
|--------|------|------------|
| GET | `/admin/customers` | `customer.read` |
| GET | `/admin/customers/export` | `customer.read` |
| GET | `/admin/customers/:id` | `customer.read` |
| GET | `/admin/customers/:id/orders` | `customer.read` |
| PATCH | `/admin/customers/:id` | `customer.update` |
| PATCH | `/admin/customers/:id/status` | `customer.update` |
| POST | `/admin/customers/invite` | `customer.update` |
| POST | `/admin/customers/import` | `customer.update` |

## List filters

`INDIVIDUAL` · `CORPORATE` · `ACTIVE` · `INACTIVE` · `DEBTOR` · `CREDITOR`

Search (server-side): name, email, phone, company, tax number.

## Status

`ACTIVE` | `INACTIVE` | `BLOCKED` (existing `UserStatus`).

- Inactive/blocked users cannot login (auth) or place new orders.
- Existing orders remain readable per ownership rules.

## Invite / import

- Passwords are **never** imported.
- Imported users get a random unusable hash + `CUSTOMER_INVITE` email outbox event.
- Corporate invite uses the same activation/reset foundation (`forgotPassword` messaging).

## Customer pricing

Managed via `/admin/pricing/customers/:customerId`. Audit actions:

- `CUSTOMER_PRICE_CREATED`
- `CUSTOMER_PRICE_UPDATED`
- `CUSTOMER_PRICE_DELETED`

Overlapping active prices are rejected by `PriceService`.

## Security

Customers can only access their own orders, addresses, transfers, notifications, and account transactions (IDOR → 403/404).
