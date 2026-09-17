# Pricing & Campaign Resolution

> Canonical docs: [pricing.md](./pricing.md), [campaigns.md](./campaigns.md), [coupons.md](./coupons.md).

## Final price resolution order

1. **Customer-specific** (`CustomerPrice`) — highest priority; never overridden by campaigns
2. **Corporate** (`ProductPrice` type `CORPORATE`) — corporate users only
3. **Wholesale** (`ProductPrice` type `WHOLESALE`) — corporate users only
4. **Campaign** — active Campaign-module offers and/or legacy `ProductPrice` type `CAMPAIGN`; the **lower** effective price wins between them
5. **Retail** (`ProductPrice` type `RETAIL`) — default

Coupons apply **after** line price resolution (order-level), never replacing unit price resolution.

## Campaign validity

A Campaign-module offer applies only when:

- `active = true`
- `startsAt <= now`
- `endsAt >= now`

Expired and future campaigns are ignored for pricing (landing pages may still render an “ended” state).

## Multiple campaigns on one product

Deterministic selection:

1. Higher `priority` wins
2. On equal priority, lower effective price wins
3. On equal price, lower `campaignId` wins

## Discount rules

| Type | Rule |
|------|------|
| `PERCENTAGE` | `retail - retail * pct / 100` (Decimal, 2 places) |
| `FIXED_AMOUNT` | `retail - amount`; if result would be negative → **0.00** (never negative) |
| `SPECIAL_PRICE` | use `specialPrice` |

Only the field matching the campaign type may be set on `CampaignProduct`.

## Notifications & push

Controlled via `POST /admin/campaigns/:id/notify` — preference-aware, not mass spam.
