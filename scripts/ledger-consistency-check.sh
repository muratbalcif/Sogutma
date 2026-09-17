#!/usr/bin/env bash
# Compare customer account summary (SUM debit / SUM credit) with ledger rows.
# Reports mismatches only — never auto-corrects.
set -euo pipefail

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "ERROR: DATABASE_URL is required" >&2
  exit 1
fi

if ! command -v psql >/dev/null 2>&1; then
  echo "ERROR: psql is required for ledger consistency check" >&2
  exit 1
fi

echo "Checking ledger vs customer account summary (debit SALE/REFUND/ADJUSTMENT, credit PAYMENT)..."

mismatch_file="$(mktemp)"
trap 'rm -f "$mismatch_file"' EXIT

psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -At -F $'\t' <<'SQL' > "$mismatch_file"
WITH agg AS (
  SELECT
    "userId",
    COALESCE(SUM(CASE WHEN type IN ('SALE','REFUND','ADJUSTMENT') THEN amount ELSE 0 END), 0) AS total_debit,
    COALESCE(SUM(CASE WHEN type = 'PAYMENT' THEN amount ELSE 0 END), 0) AS total_credit
  FROM account_transactions
  GROUP BY "userId"
),
latest AS (
  SELECT DISTINCT ON ("userId")
    "userId",
    "balanceAfter"
  FROM account_transactions
  WHERE "balanceAfter" IS NOT NULL
  ORDER BY "userId", "createdAt" DESC, id DESC
)
SELECT
  u.id,
  u.email,
  ROUND(a.total_debit::numeric, 2) AS total_debit,
  ROUND(a.total_credit::numeric, 2) AS total_credit,
  ROUND((a.total_debit - a.total_credit)::numeric, 2) AS summary_balance,
  ROUND(COALESCE(l."balanceAfter", a.total_debit - a.total_credit)::numeric, 2) AS ledger_balance_after
FROM agg a
JOIN users u ON u.id = a."userId"
LEFT JOIN latest l ON l."userId" = a."userId"
WHERE l."balanceAfter" IS NOT NULL
  AND ABS(
    ROUND((a.total_debit - a.total_credit)::numeric, 2)
    - ROUND(l."balanceAfter"::numeric, 2)
  ) > 0.009;
SQL

if [[ -s "$mismatch_file" ]]; then
  echo "FAIL: customer account summary does not match SUM(DEBIT)-SUM(CREDIT)/balanceAfter"
  echo "customer_id	email	total_debit	total_credit	summary_balance	balance_after"
  cat "$mismatch_file"
  exit 1
fi

echo "OK: no debit/credit vs balanceAfter mismatches"
exit 0
