# Collections (Tahsilatlar)

Collections in v1 are **approved bank transfer notifications** only (no iyzico/PayTR/Stripe).

## Endpoints

| Method | Path | Notes |
|--------|------|-------|
| GET | `/admin/collections` | Paginated approved transfers |
| GET | `/admin/collections/summary` | Today / month / pending / rejected |

Summary timezone: **Europe/Istanbul**.

## Columns

Customer · Order · Payment · Amount · Bank · Transfer date · Approved date · Approved by

## Dashboard

Use `/admin/collections/summary` for:

- Bugünkü tahsilat
- Bu ay tahsilat
- Bekleyen havale
- Reddedilen havale

Do not invent client-side sums with `Number`.
