# Privacy Data Map (technical inventory)

Hukuki yorum değildir. Sistemde tutulan kişisel / ilgili veri kategorileri:

| Category | Fields | Purpose | Storage | Access | Retention (target) |
|----------|--------|---------|---------|--------|--------------------|
| Identity | firstName, lastName | Account, orders, invoices | Postgres `users` | Self + admin (`customer.*`) | Account lifetime + legal order retention |
| Contact | email, phone | Auth, support, notifications | Postgres `users` | Self + admin | Account lifetime |
| Address | address fields | Shipping/billing | Postgres `addresses` + order snapshots | Self + admin | Account / order history |
| Corporate | companyName, taxNumber, taxOffice | B2B sales | Postgres `corporate_customers` | Self + admin | Account lifetime |
| Auth secrets | passwordHash, refresh token hashes | Authentication | Postgres | System only | Until rotate/revoke |
| Orders | order lines, totals, status | Commerce | Postgres | Self + admin (`order.*`) | Business retention (target ≥ 10y financial) |
| Payments | amount, method, status, bank transfer metadata | Payment ops | Postgres | Self + admin (`payment.*` / `bank_transfer.*`) | Business retention |
| Accounting | AccountTransaction amounts/refs | Current account | Postgres ledger | Self + admin (`accounting.*`) | Immutable; long retention |
| Devices | FCM device tokens | Push | Postgres | Self + system | Until unregister |
| Notifications | title/body, read state | Comms | Postgres | Self + admin | Short–medium |
| Audit | adminUserId, action, metadata | Security/compliance | Postgres `audit_logs` | Admin `audit.read` | Long; do not hard-delete |
| Technical logs | requestId, path, status, userId | Ops | App logs | Ops | Short (target 14–30d) |
| Media | product/banner images | Catalog | R2 | Public CDN URLs for product assets | Catalog lifetime |

## Never store

- Card PAN / CVV / full payment-provider raw card payloads (v1 is bank transfer only)
- Plaintext passwords or refresh tokens
- R2 / JWT / SMTP secrets in client apps or git

## Deletion / inactivation foundation

- Prefer `UserStatus.INACTIVE` / `BLOCKED` over hard delete
- Financial + order history must not be cascade-destroyed for convenience
- Hard delete requires explicit legal/ops process (out of scope for auto cascade)
