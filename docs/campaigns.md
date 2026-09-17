# Campaigns

## Lifecycle

- Create → attach products → activate within `startsAt`/`endsAt`
- Soft deactivate (`active=false`) instead of hard delete
- Landing: `GET /campaigns/:slug` returns `status: ACTIVE | EXPIRED | INACTIVE`
- Pricing eligibility **always** uses backend clock (`active` + window), never frontend countdown

## Priority (multi-campaign on one product)

1. Higher `priority`
2. Lower effective price
3. Lower `campaignId`

Documented in code: `campaign-pricing.util.ts` → `selectBestCampaignOffer`.

## Types

| Type | CampaignProduct field |
|------|------------------------|
| PERCENTAGE | `discountPercentage` (0 < value ≤ 100) |
| FIXED_AMOUNT | `discountAmount` (≥ 0; floor at 0) |
| SPECIAL_PRICE | `specialPrice` |

## Eligibility

Only campaigns with `active=true` and `startsAt ≤ now ≤ endsAt` affect `PriceService`.

## Notifications

`POST /admin/campaigns/:id/notify` queues a controlled CAMPAIGN notification (no mass spam). Audience/preference checks apply.

## Admin

- List/create: `/campaigns`
- Products attach/detach: `/campaigns/:id`
- Audit: `CAMPAIGN_CREATED`, `CAMPAIGN_UPDATED`, `CAMPAIGN_ACTIVATED`, `CAMPAIGN_DEACTIVATED`
