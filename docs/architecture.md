# FurkanSoğutma Architecture

## Overview

FurkanSoğutma is an e-commerce platform with **one backend** and **three clients**. The NestJS API is the single source of truth for business rules and data. Clients never own pricing, inventory, or order logic.

## High-level diagram

```text
┌─────────────┐  ┌─────────────┐  ┌─────────────┐
│   Android   │  │  Public Web │  │ Admin Panel │
│   (mobile)  │  │    (web)    │  │   (admin)   │
└──────┬──────┘  └──────┬──────┘  └──────┬──────┘
       │                │                │
       └────────────────┼────────────────┘
                        │
                        ▼
              ┌───────────────────┐
              │   NestJS REST API │
              │     /api/v1       │
              └─────────┬─────────┘
                        │
           ┌────────────┴────────────┐
           ▼                         ▼
   ┌──────────────┐          ┌──────────────┐
   │  PostgreSQL  │          │    Redis     │
   │  (source of  │          │  (cache /    │
   │   truth)     │          │   sessions)  │
   └──────────────┘          └──────────────┘
```

## Clients

| Client | Role |
|---|---|
| Android | Mobile shopping experience |
| Web | Public storefront |
| Admin | Internal management (katalog, siparişler, muhasebe, etc.) |

All clients talk to the same API. Authorization and capabilities differ by user role / token claims.

## Backend principles

- **Clean / modular NestJS**: feature modules under `src/modules/`
- **PostgreSQL + Prisma**: relational persistence and migrations
- **Redis-ready**: connection configured now; caching/sessions added when needed
- **JWT authentication**: access + refresh secrets prepared; auth module in a later milestone
- **Never trust client prices**: monetary amounts calculated/validated server-side (use decimal-safe types; no float money)
- **Consistent API errors**: global exception filter with a stable JSON shape
- **Validated input**: global `ValidationPipe` with whitelist + forbid non-whitelisted

## Planned API modules

Prepared under `src/modules/`:

`auth`, `users`, `customers`, `categories`, `brands`, `products`, `inventory`, `pricing`, `cart`, `favorites`, `orders`, `payments`, `addresses`, `campaigns`, `banners`, `notifications`, `comments`, `accounting`, `admin`

Plus shared infrastructure: `common/`, `config/`, `prisma/`, `health/`.

See also: [pricing-campaigns.md](./pricing-campaigns.md), [payment-architecture.md](./payment-architecture.md).

## Data notes

- UUID primary keys
- Passwords stored only as hashes (`passwordHash`)
- Domain language may be Turkish in docs/UI; code identifiers stay English
- Business data is not hard-coded in clients or API source

## Milestone status

| Milestone | Scope | Status |
|---|---|---|
| 1 | API foundation | Done |
| 2 | Auth + RBAC | Done |
| 3 | Catalog | Done |
| 4 | Inventory + Pricing | Done |
| 5 | Cart + Favorites + Alerts | Done |
| 6 | Orders + Checkout | Done |
| 7 | Payments + Accounting | Done |
| 8 | Campaigns + Banners + Notifications + FCM foundation | Done |
| 9 | Admin Panel foundation (auth, RBAC, dashboard, shells) | Current |
| 10+ | Admin CRUD depth / Web / Android / real FCM-payment-shipping | Not started |
